import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import posthog from 'posthog-js' // <-- Add PostHog import

export function useProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true;
    let rolesSubscription: any = null;
    const uniqueChannelName = `roles-${Math.random().toString(36).substring(2, 9)}`;

    async function getProfile() {
      try {
        console.log("📡 useProfile: Fetching session...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("📡 useProfile: No session found.");
          if (isMounted) setLoading(false);
          if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.reset(); // <-- Reset tracking if they are not logged in
          }
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setLoading(false);
          if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.reset(); // <-- Reset tracking if no user
          }
          return;
        }

        // Fetch data using the OR logic to catch unlinked invites by email
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('user_roles')
            .select('*, clubs(id, name, logo_url, is_active, plan_tier)')
            .or(`user_id.eq.${user.id},email.eq.${user.email}`) 
        ]);

        const profileData = profileRes.data;
        let rolesData = rolesRes.data || [];

        // --- 🚨 SELF-HEALING INVITE LOGIC 🚨 ---
        // If they have an invited role but no UUID attached, bind it now!
        const unlinkedRoles = rolesData.filter((r: any) => !r.user_id && r.email === user.email);
        if (unlinkedRoles.length > 0) {
          console.log("📡 useProfile: Claiming orphaned roles...");
          for (const role of unlinkedRoles) {
            await supabase.from('user_roles').update({ user_id: user.id }).eq('id', role.id);
            // Update local state so it doesn't stay null
            role.user_id = user.id; 
          }
        }

        const isSuper: boolean = Boolean(rolesData.some((r: any) => r.role === 'super_admin')) || profileData?.role === 'super_admin';
        const adminRole = rolesData.find((r: any) => r.role === 'club_admin');
        const teamRole = rolesData.find((r: any) => r.role === 'team_admin');

        let finalRole = isSuper ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player'));
        let finalClubId = adminRole?.club_id || teamRole?.club_id || null;
        let finalTeamId = teamRole?.team_id || null;

        // --- 🚨 NEW: MULTI-TEAM PLAYER AUTO-LINKING 🚨 ---
        const { data: playerMatchesData } = await supabase
          .from('players')
          .select('id, club_id, default_team_id, user_id')
          .eq('email', user.email);
        const playerMatches = (playerMatchesData || []) as any[];

        if (playerMatches.length > 0) {
          const clubIds = [...new Set(playerMatches.map((p: any) => p.club_id).filter(Boolean))];
          const { data: clubsData } = await supabase
            .from('clubs')
            .select('id, name, logo_url, is_active, plan_tier')
            .in('id', clubIds);
          const clubMap = new Map(clubsData?.map((c: any) => [c.id, c]) || []);

          for (const p of playerMatches) {
            p.clubs = clubMap.get(p.club_id) || null;
            // Auto-link their user ID if not already linked
            if (p.user_id !== user.id) {
              await supabase.from('players').update({ user_id: user.id }).eq('id', p.id);
            }
            
            // Add a synthetic role to rolesData so they appear in the club switcher
            // Only if they don't already have an admin role in this specific team/club
            const existingRole = rolesData.find((r: any) => r.club_id === p.club_id && (r.role === 'club_admin' || r.team_id === p.default_team_id));
            if (!existingRole && p.clubs) {
              rolesData.push({
                role: 'player',
                club_id: p.club_id,
                team_id: p.default_team_id,
                clubs: p.clubs,
                player_id: p.id
              });
            }
          }

          // If they didn't have any admin roles, default their profile to the first player record
          if (!isSuper && !adminRole && !teamRole) {
            finalRole = 'player';
            finalClubId = playerMatches[0].club_id;
            finalTeamId = playerMatches[0].default_team_id;
          }
        }

        const finalProfile = {
          id: user.id,
          email: user.email,
          ...(profileData || {}), 
          role: finalRole,
          club_id: finalClubId,
          team_id: finalTeamId
        };

        if (isMounted) {
          setProfile(finalProfile);
          setRoles(rolesData);

          // --- 🔥 IDENTIFY THE USER IN POSTHOG 🔥 ---
          if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.identify(
              user.id, // The unique Supabase Auth ID
              { 
                email: user.email,
                first_name: profileData?.first_name || '',
                last_name: profileData?.last_name || '',
                role: finalProfile.role 
              }
            );
          }
          
          // --- REALTIME SUBSCRIPTION ---
          if (!rolesSubscription) {
            rolesSubscription = supabase
              .channel(uniqueChannelName)
              .on('postgres_changes', {
                event: '*', 
                schema: 'public',
                table: 'user_roles',
                filter: `user_id=eq.${user.id}`, // This works now because we self-healed above!
              }, () => fetchRolesSilently(user.id, profileData, isSuper, user.email))
              .subscribe();
          }
        }
      } catch (err) {
        console.error("❌ Profile Sync Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function fetchRolesSilently(userId: string, baseProfileData: any, isSuper: boolean, email: string | undefined) {
      if (!isMounted) return;
      
      // Also updated to use the OR logic just in case
      const query = email 
        ? `user_id.eq.${userId},email.eq.${email}` 
        : `user_id.eq.${userId}`;
        
      const { data: rolesRes } = await supabase.from('user_roles').select('*, clubs(id, name, logo_url, is_active)').or(query);
      let rolesData = rolesRes || [];
      const adminRole = rolesData?.find((r: any) => r.role === 'club_admin');
      const teamRole = rolesData?.find((r: any) => r.role === 'team_admin');

      let finalRole = isSuper || baseProfileData?.role === 'super_admin' ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player'));
      let finalClubId = adminRole?.club_id || teamRole?.club_id || null;
      let finalTeamId = teamRole?.team_id || null;

      if (email) {
        const { data: playerMatchesData } = await supabase
          .from('players')
          .select('id, club_id, default_team_id, user_id')
          .eq('email', email);
        const playerMatches = (playerMatchesData || []) as any[];

        if (playerMatches.length > 0) {
          const clubIds = [...new Set(playerMatches.map((p: any) => p.club_id).filter(Boolean))];
          const { data: clubsData } = await supabase
            .from('clubs')
            .select('id, name, logo_url, is_active, plan_tier')
            .in('id', clubIds);
          const clubMap = new Map(clubsData?.map((c: any) => [c.id, c]) || []);

          for (const p of playerMatches) {
            p.clubs = clubMap.get(p.club_id) || null;
            // Auto-link their user ID if not already linked
            if (p.user_id !== userId) {
              await supabase.from('players').update({ user_id: userId }).eq('id', p.id);
            }
            
            // Add a synthetic role to rolesData so they appear in the club switcher
            // Only if they don't already have an admin role in this specific team/club
            const existingRole = rolesData.find((r: any) => r.club_id === p.club_id && (r.role === 'club_admin' || r.team_id === p.default_team_id));
            if (!existingRole && p.clubs) {
              rolesData.push({
                role: 'player',
                club_id: p.club_id,
                team_id: p.default_team_id,
                clubs: p.clubs,
                player_id: p.id
              });
            }
          }

          // If they didn't have any admin roles, default their profile to the first player record
          if (!isSuper && !adminRole && !teamRole) {
            finalRole = 'player';
            finalClubId = playerMatches[0].club_id;
            finalTeamId = playerMatches[0].default_team_id;
          }
        }
      }

      const updatedProfile = {
        id: userId,
        email: baseProfileData?.email || email, 
        ...(baseProfileData || {}), 
        role: finalRole,
        club_id: finalClubId,
        team_id: finalTeamId
      };

      setProfile(updatedProfile);
      setRoles(rolesData || []);

      // Re-identify in case their role changed during the session
      if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.identify(userId, { role: updatedProfile.role });
      }
    }

    getProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') getProfile();
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (rolesSubscription) supabase.removeChannel(rolesSubscription);
    };
  }, []);

  return { profile, roles, loading }
}