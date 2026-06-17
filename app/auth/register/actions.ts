"use server"

import { createClient } from "@supabase/supabase-js";

export async function getReferrerName(code: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("referral_code", code)
    .single();

  if (data) {
    if (data.full_name) {
      const parts = data.full_name.trim().split(' ');
      const firstName = parts[0];
      const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) + "." : "";
      return `${firstName} ${lastInitial}`.trim();
    } else if (data.email) {
      const username = data.email.split('@')[0];
      return username.charAt(0).toUpperCase() + username.slice(1);
    } else {
      return "a friend";
    }
  }
  
  return null;
}
