import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true // <-- FIX 1: The safety switch for Strict Mode

    async function getProfile() {
      // <-- FIX 2: Check local session first to prevent lock stealing
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        if (isMounted) setLoading(false)
        return
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error("AUTH ERROR:", authError);
        if (isMounted) setLoading(false);
        return;
      }

      console.log("1. AUTH USER ID:", user.id);

      // Fetch base profile and roles
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('*, clubs(id, name, logo_url)').eq('user_id', user.id)
      
      console.log("2. DB PROFILE DATA:", profileData, "| ERROR:", profileError);
      console.log("3. DB ROLES DATA:", rolesData, "| ERROR:", rolesError);

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

      console.log("4. FINAL ASSEMBLED PROFILE:", finalProfile);

      // <-- FIX 3: Only update state if the component hasn't been unmounted
      if (isMounted) {
        setProfile(finalProfile)
        setRoles(rolesData || [])
        setLoading(false)
      }
    }

    getProfile()

    // <-- FIX 4: Cleanup function flips the switch when React unmounts it
    return () => {
      isMounted = false 
    }
  }, [])

  return { profile, roles, loading }
}