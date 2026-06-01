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
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(errorDescription || 'OAuth Error')}`, request.url));
  }

  if (!code || !clubId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const appSecret = process.env.SQUARE_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Square credentials not configured on server" }, { status: 500 });
  }

  const isSandbox = appId.startsWith('sandbox');
  const baseUrl = isSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

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
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Square Token Error:", tokenData);
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent('Failed to connect to Square')}`, request.url));
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

    const { error: updateError } = await supabase
      .from('clubs')
      .update({
        square_access_token: access_token,
        square_refresh_token: refresh_token,
        square_merchant_id: merchant_id,
        square_location_id: locationId,
        is_square_enabled: true
      })
      .eq('id', clubId);

    if (updateError) {
      console.error("DB Update Error:", updateError);
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent('Failed to save Square connection')}`, request.url));
    }

    // Success! Redirect back to settings
    return NextResponse.redirect(new URL(`/settings?success=square_connected`, request.url));

  } catch (err) {
    console.error("OAuth Callback Error:", err);
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent('Internal server error during Square connection')}`, request.url));
  }
}
