import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Use service role key to bypass RLS and check if profile exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error("Error checking email:", error);
      return NextResponse.json({ error: "Failed to check email" }, { status: 500 });
    }

    return NextResponse.json({ exists: !!data });
  } catch (error: any) {
    console.error("Exception checking email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
