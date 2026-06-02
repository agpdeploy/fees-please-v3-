import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const clubId = searchParams.get('state') // We passed clubId in state
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (!code || !clubId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(`${origin}/`)
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID
  const appSecret = process.env.SQUARE_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Square Credentials not configured" }, { status: 500 })
  }

  const squareBaseUrl = appId.startsWith("sandbox")
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com"

  try {
    const response = await fetch(`${squareBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/square/callback`,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Square token error:", data)
      return NextResponse.redirect(`${origin}/?error=Square+Connection+Failed`)
    }

    const { access_token, refresh_token, merchant_id } = data

    // Fetch the merchant's locations to get the location_id automatically
    let location_id = null
    try {
      const locationRes = await fetch(`${squareBaseUrl}/v2/locations`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      })
      if (locationRes.ok) {
        const locData = await locationRes.json()
        if (locData.locations && locData.locations.length > 0) {
          // Pick the first active location, or just the first one
          const activeLoc = locData.locations.find((l: any) => l.status === 'ACTIVE')
          location_id = activeLoc ? activeLoc.id : locData.locations[0].id
        }
      }
    } catch (e) {
      console.error("Failed to fetch Square locations:", e)
    }

    const { error: updateError } = await supabase
      .from('clubs')
      .update({
        square_access_token: access_token,
        square_refresh_token: refresh_token,
        square_merchant_id: merchant_id,
        square_location_id: location_id,
        is_square_enabled: true
      })
      .eq('id', clubId)

    if (updateError) {
      console.error("Supabase update error:", updateError)
      return NextResponse.redirect(`${origin}/?error=Failed+to+save+Square+credentials`)
    }

    return NextResponse.redirect(`${origin}/?square_connected=true`)
  } catch (err) {
    console.error("Square OAuth error:", err)
    return NextResponse.redirect(`${origin}/?error=Server+Error`)
  }
}
