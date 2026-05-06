import { useEffect, useState } from 'react'
import { supabase } from './supabase'

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
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch data in parallel to save time
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('user_roles').select('*, clubs(id, name, logo_url)').eq('user_id', user.id)
        ]);

        const profileData = profileRes.data;
        const rolesData = rolesRes.data || [];

        // STRICT BOOLEAN CASTING TO SATISFY TYPESCRIPT
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
          
          // --- REALTIME SUBSCRIPTION ---
          if (!rolesSubscription) {
            rolesSubscription = supabase
              .channel(uniqueChannelName)
              .on('postgres_changes', {
                event: '*', 
                schema: 'public',
                table: 'user_roles',
                filter: `user_id=eq.${user.id}`, 
              }, () => fetchRolesSilently(user.id, profileData, isSuper))
              .subscribe();
          }
        }
      } catch (err) {
        console.error("❌ Profile Sync Error:", err);
      } finally {
        // THIS IS THE UNSTUCKER: It must run even if there's an error
        if (isMounted) setLoading(false);
      }
    }

    async function fetchRolesSilently(userId: string, baseProfileData: any, isSuper: boolean) {
      if (!isMounted) return;
      const { data: rolesData } = await supabase.from('user_roles').select('*, clubs(id, name, logo_url)').eq('user_id', userId);
      const adminRole = rolesData?.find((r: any) => r.role === 'club_admin');
      const teamRole = rolesData?.find((r: any) => r.role === 'team_admin');

      setProfile({
        id: userId,
        email: baseProfileData?.email, 
        ...(baseProfileData || {}), 
        role: isSuper ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player')),
        club_id: adminRole?.club_id || teamRole?.club_id || null,
        team_id: teamRole?.team_id || null
      });
      setRoles(rolesData || []);
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