import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true 

    async function getProfile() {
      console.log("📡 useProfile: Fetching session...");
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.log("📡 useProfile: No session found or session error.", sessionError);
        if (isMounted) setLoading(false)
        return
      }

      console.log("📡 useProfile: Found session for", session.user.id);
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error("❌ AUTH ERROR:", authError);
        if (isMounted) setLoading(false);
        return;
      }

      console.log("📡 useProfile: Fetching profile data...");
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle() 
      
      if (profileError) {
        console.error("❌ DB Profile Error:", profileError);
      }

      console.log("📡 useProfile: Fetching roles data...");
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*, clubs(id, name, logo_url)')
        .eq('user_id', user.id)
      
      if (rolesError) {
        console.error("❌ DB Roles Error:", rolesError);
      }

      const isSuper = rolesData?.some(r => r.role === 'super_admin');
      const adminRole = rolesData?.find(r => r.role === 'club_admin');
      const teamRole = rolesData?.find(r => r.role === 'team_admin');

      const finalProfile = {
        id: user.id,
        email: user.email,
        ...(profileData || {}), 
        role: isSuper ? 'super_admin' : (adminRole ? 'club_admin' : (teamRole ? 'team_admin' : 'player')),
        club_id: adminRole?.club_id || teamRole?.club_id || null,
        team_id: teamRole?.team_id || null
      };

      console.log("📡 useProfile: Success. Profile Assembled.");
      
      if (isMounted) {
        setProfile(finalProfile)
        setRoles(rolesData || [])
        setLoading(false)
      }
    }

    getProfile()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
         getProfile();
      }
    })

    return () => {
      isMounted = false 
      authListener.subscription.unsubscribe()
    }
  }, [])

  return { profile, roles, loading }
}