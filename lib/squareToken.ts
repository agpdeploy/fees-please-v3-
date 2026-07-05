import { SupabaseClient } from '@supabase/supabase-js';

export async function ensureValidSquareToken(clubId: string, supabaseAdmin: SupabaseClient) {
  const { data: club } = await supabaseAdmin
    .from('clubs')
    .select('*')
    .eq('id', clubId)
    .single();
  
  if (!club || !club.is_square_enabled || !club.square_access_token) return club;

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const appSecret = process.env.SQUARE_SECRET;
  if (!appId || !appSecret) return club;

  const squareBaseUrl = appId.startsWith("sandbox")
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

  try {
    // Fast check to see if the token is still valid (401 means expired/revoked)
    const testRes = await fetch(`${squareBaseUrl}/v2/locations`, {
      headers: {
        'Authorization': `Bearer ${club.square_access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (testRes.status === 401 && club.square_refresh_token) {
      console.log(`Square token expired for club ${clubId}. Attempting refresh...`);
      
      const refreshRes = await fetch(`${squareBaseUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          refresh_token: club.square_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshRes.ok) {
        const tokenData = await refreshRes.json();
        const newAccessToken = tokenData.access_token;
        // Keep the old refresh token if a new one wasn't provided
        const newRefreshToken = tokenData.refresh_token || club.square_refresh_token;

        await supabaseAdmin.from('clubs').update({
          square_access_token: newAccessToken,
          square_refresh_token: newRefreshToken
        }).eq('id', clubId);

        console.log(`Successfully refreshed Square token for club ${clubId}.`);
        return { ...club, square_access_token: newAccessToken, square_refresh_token: newRefreshToken };
      } else {
        console.error("Failed to refresh Square token:", await refreshRes.json());
      }
    }
  } catch (err) {
    console.error("Error validating Square token:", err);
  }

  return club;
}
