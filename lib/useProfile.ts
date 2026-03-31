import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getProfile() {
      // 1. Check if the frontend actually knows who is logged in
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn("🔐 No active user session found on frontend.");
        setLoading(false);
        return;
      }

      console.log("👤 Active user found:", user.email);

      // 2. Fetch the profile (simplified to avoid foreign-key crashes)
      const { data, error } = await supabase
        .from('profiles')
        .select('*') 
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error("❌ Error fetching profile from DB:", error.message);
      } else {
        console.log("✅ Profile loaded successfully:", data);
        setProfile(data)
      }
      
      setLoading(false)
    }

    getProfile()
  }, [])

  return { profile, loading }
}