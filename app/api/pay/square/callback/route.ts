import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const clubId = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorDescription || 'OAuth Error')}`, request.url));
  }

  if (!code || !clubId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
  const appSecret = process.env.SQUARE_SECRET?.trim();

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Square credentials not configured on server" }, { status: 500 });
  }

  const isSandbox = appId.startsWith('sandbox');
  const baseUrl = isSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

  const origin = new URL(request.url).origin;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/pay/square/callback`
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Square Token Error:", tokenData);
      const errorDetail = tokenData.message || tokenData.error_description || JSON.stringify(tokenData);
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Failed to connect to Square: ' + errorDetail)}`, request.url));
    }

    const { access_token, refresh_token, merchant_id } = tokenData;

    // Save tokens securely to Supabase
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    );

    // Fetch the merchant location ID to store as well
    const locationRes = await fetch(`${baseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const locationData = await locationRes.json();
    
    // We try to find the main location, or just use the first active one
    const locations = locationData.locations || [];
    const activeLocation = locations.find((l: any) => l.status === 'ACTIVE') || locations[0];
    const locationId = activeLocation?.id || null;

    const { data, error: updateError } = await supabase
      .from('clubs')
      .update({
        square_access_token: access_token,
        square_refresh_token: refresh_token,
        square_merchant_id: merchant_id,
        square_location_id: locationId,
        is_square_enabled: true
      })
      .eq('id', clubId)
      .select('id');

    if (updateError) {
      console.error("DB Update Error:", updateError);
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Failed to save Square connection')}`, request.url));
    }

    if (!data || data.length === 0) {
      console.error("DB Update Error: 0 rows updated. Missing SUPABASE_SERVICE_ROLE_KEY or RLS blocked the update.");
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Database update failed. Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel.')}`, request.url));
    }

    // Success! Redirect back to settings
    return NextResponse.redirect(new URL(`/?success=square_connected`, request.url));

  } catch (err) {
    console.error("OAuth Callback Error:", err);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Internal server error during Square connection')}`, request.url));
  }
}
