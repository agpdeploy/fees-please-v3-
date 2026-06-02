import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('clubId')

  if (!clubId) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 })
  }

  // Next.js 15+ requires cookies() to be awaited
  const cookieStore = await cookies()
  
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
            // Ignore
          }
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "Square App ID not configured" }, { status: 500 })
  }

  const squareBaseUrl = appId.startsWith("sandbox")
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com"

  const authUrl = new URL(`${squareBaseUrl}/oauth2/authorize`)
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/square/callback`
  
  authUrl.searchParams.set("client_id", appId)
  authUrl.searchParams.set(
    "scope",
    "PAYMENTS_WRITE PAYMENTS_READ SETTLEMENTS_READ MERCHANT_PROFILE_READ"
  )
  authUrl.searchParams.set("state", clubId)
  authUrl.searchParams.set("session", "false")
  authUrl.searchParams.set("redirect_uri", redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
