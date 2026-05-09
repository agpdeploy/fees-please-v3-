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
          posthog.reset(); // <-- Reset tracking if they are not logged in
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setLoading(false);
          posthog.reset(); // <-- Reset tracking if no user
          return;
        }

        // Fetch data using the OR logic to catch unlinked invites by email
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('user_roles')
            .select('*, clubs(id, name, logo_url)')
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

        const isSuper: boolean = Boolean(rolesData.some((r: any) => r.role === 'super_admin'));
        const adminRole = rolesData.find((r: any) => r.role === 'club_admin');
        const teamRole = rolesData.find((r: any) => r.role === 'team_admin');

        const finalProfile = {
          id: user.id,
          email: user.email,
          ...(profileData || {}), 
          role: isSuper ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player')),
          club_id: adminRole?.club_id || teamRole?.club_id || null,
          team_id: teamRole?.team_id || null
        };

        if (isMounted) {
          setProfile(finalProfile);
          setRoles(rolesData);

          // --- 🔥 IDENTIFY THE USER IN POSTHOG 🔥 ---
          if (typeof window !== 'undefined') {
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
        
      const { data: rolesData } = await supabase.from('user_roles').select('*, clubs(id, name, logo_url)').or(query);
      const adminRole = rolesData?.find((r: any) => r.role === 'club_admin');
      const teamRole = rolesData?.find((r: any) => r.role === 'team_admin');

      const updatedProfile = {
        id: userId,
        email: baseProfileData?.email || email, 
        ...(baseProfileData || {}), 
        role: isSuper ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player')),
        club_id: adminRole?.club_id || teamRole?.club_id || null,
        team_id: teamRole?.team_id || null
      };

      setProfile(updatedProfile);
      setRoles(rolesData || []);

      // Re-identify in case their role changed during the session
      if (typeof window !== 'undefined') {
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