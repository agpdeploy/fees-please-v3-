import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Next.js 15+ requires cookies() to be awaited
  const cookieStore = await cookies()

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore errors thrown when setting cookies from a Server Component
            }
          },
        },
      }
    )
    
    // Exchange the token for a real session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session) {
      const refCookie = cookieStore.get('fees_please_ref')?.value;
      if (refCookie) {
        const userId = data.session.user.id;
        
        // Check if they already have a referred_by set
        const { data: profile } = await supabase
          .from('profiles')
          .select('referred_by')
          .eq('id', userId)
          .single();

        if (profile && !profile.referred_by) {
          // Use admin client to bypass RLS since new users can't read other profiles
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Find the referrer by their code
          const { data: referrerProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('referral_code', refCookie)
            .single();

          if (referrerProfile) {
            // Update the new user's profile
            await supabaseAdmin
              .from('profiles')
              .update({ referred_by: referrerProfile.id })
              .eq('id', userId);
          }
        }
        
        // Clear the cookie so it's not processed again
        cookieStore.set('fees_please_ref', '', { maxAge: 0 });
      }
    }
  }

  // Send the user to the destination (or origin if not specified)
  const next = cookieStore.get('fp_next_url')?.value || '/'
  cookieStore.set('fp_next_url', '', { maxAge: 0 });
  return NextResponse.redirect(`${origin}${next}`)
}