import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Auth Error:", authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS so users can see their referrals' profiles
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, onboarding_completed, updated_at')
      .eq('referred_by', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error("Supabase Admin Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ referrals: data || [] })
  } catch (err: any) {
    console.error("Referral Route Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
