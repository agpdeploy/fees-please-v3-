import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // Return an HTML page that auto-submits a POST request.
    // This prevents email scanners (like Apple Mail) from consuming the single-use
    // Supabase Magic Link code via a GET request.
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Authenticating...</title>
          <style>
            body { background: #09090b; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; color: white; }
            .loader { border: 3px solid rgba(255,255,255,0.1); border-top-color: #10b981; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div class="loader"></div>
            <p style="font-size: 12px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; color: #a1a1aa;">Verifying Secure Link...</p>
          </div>
          <form id="auth-form" method="POST" action="/auth/callback">
            <input type="hidden" name="code" value="${code}" />
            <noscript>
              <button type="submit" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 16px; font-family: sans-serif;">Continue to App</button>
            </noscript>
          </form>
          <script>
            // Only real browsers execute this, not email scanners
            document.getElementById('auth-form').submit();
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // If no code, just redirect to home
  const cookieStore = await cookies()
  const next = cookieStore.get('fp_next_url')?.value || '/'
  cookieStore.set('fp_next_url', '', { maxAge: 0 });
  return NextResponse.redirect(`${origin}${next}`)
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const formData = await request.formData();
  const code = formData.get('code')?.toString();
  
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
  return NextResponse.redirect(`${origin}${next}`, { status: 303 }) // Use 303 to redirect after POST
}