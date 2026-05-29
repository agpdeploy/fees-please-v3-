import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
  }

  // Ensure the user is an admin of this club
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check role
  const { data: role } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('club_id', clubId)
    .eq('role', 'club_admin')
    .single();

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();

  if (!role && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "Square App ID not configured" }, { status: 500 });
  }

  const isSandbox = appId.startsWith('sandbox');
  const baseUrl = isSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  
  const scopes = [
    "PAYMENTS_WRITE",
    "MERCHANT_PROFILE_READ",
    "PAYMENTS_READ",
    "PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS"
  ].join('+');

  // We pass the clubId in the state parameter so we know which club to update in the callback
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${appId}&scope=${scopes}&session=false&state=${clubId}`;

  return NextResponse.redirect(authUrl);
}
