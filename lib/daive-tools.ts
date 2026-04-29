// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

// 1. All your Aussie/NZ Sport Presets
const SPORT_PRESETS = {
  "AFL": {
    terminology: { role: "Coach", unit: "Match", expense: "Umpire Fees" },
    defaults: { member_fee: 250, casual_fee: 30, game_day_fee: 15, official_fee: 60 }
  },
  "Cricket": {
    terminology: { role: "Captain", unit: "Match", expense: "Umpire Fees" },
    defaults: { member_fee: 300, casual_fee: 40, game_day_fee: 20, official_fee: 50 }
  },
  "Indoor Cricket": {
    terminology: { role: "Captain", unit: "Game", expense: "Match Fee" },
    defaults: { member_fee: 50, casual_fee: 25, game_day_fee: 20, official_fee: 0 }
  },
  "Soccer": {
    terminology: { role: "Manager", unit: "Match", expense: "Referee Fees" },
    defaults: { member_fee: 220, casual_fee: 30, game_day_fee: 15, official_fee: 40 }
  },
  "Futsal": {
    terminology: { role: "Manager", unit: "Match", expense: "Match Fee" },
    defaults: { member_fee: 60, casual_fee: 25, game_day_fee: 20, official_fee: 0 }
  },
  "Netball": {
    terminology: { role: "Manager", unit: "Game", expense: "Umpire Fees" },
    defaults: { member_fee: 180, casual_fee: 25, game_day_fee: 12, official_fee: 25 }
  },
  "Indoor Netball": {
    terminology: { role: "Manager", unit: "Game", expense: "Match Fee" },
    defaults: { member_fee: 60, casual_fee: 25, game_day_fee: 20, official_fee: 0 }
  },
  "Rugby League": {
    terminology: { role: "Coach", unit: "Match", expense: "Referee Fees" },
    defaults: { member_fee: 200, casual_fee: 30, game_day_fee: 15, official_fee: 45 }
  },
  "Rugby Union": {
    terminology: { role: "Coach", unit: "Match", expense: "Referee Fees" },
    defaults: { member_fee: 200, casual_fee: 30, game_day_fee: 15, official_fee: 45 }
  },
  "Basketball": {
    terminology: { role: "Coach", unit: "Game", expense: "Referee Fees" },
    defaults: { member_fee: 150, casual_fee: 20, game_day_fee: 10, official_fee: 35 }
  },
  "Hockey": {
    terminology: { role: "Manager", unit: "Match", expense: "Umpire Fees" },
    defaults: { member_fee: 190, casual_fee: 25, game_day_fee: 15, official_fee: 30 }
  },
  "Beach Volleyball": {
    terminology: { role: "Captain", unit: "Game", expense: "Court Hire / Ref Fees" },
    defaults: { member_fee: 120, casual_fee: 20, game_day_fee: 15, official_fee: 20 }
  },
  "Touch Football": {
    terminology: { role: "Captain", unit: "Game", expense: "Referee Fees" },
    defaults: { member_fee: 160, casual_fee: 25, game_day_fee: 10, official_fee: 40 }
  },
  "OzTag": {
    terminology: { role: "Manager", unit: "Game", expense: "Referee Fees" },
    defaults: { member_fee: 160, casual_fee: 25, game_day_fee: 10, official_fee: 40 }
  },
  "Other": {
    terminology: { role: "Manager", unit: "Event", expense: "Fees" },
    defaults: { member_fee: 100, casual_fee: 20, game_day_fee: 10, official_fee: 0 }
  }
};

export async function createEntities(name, isClub, sport, entityType, token) {
  try {
    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) throw new Error("User not found");

    const preset = SPORT_PRESETS[sport] || SPORT_PRESETS["Other"];
    
    // Collision-proof slug generation
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const clubSlug = `${baseSlug}-${randomSuffix}`;

    // 1. FINALIZE THE PROFILE
    await supabaseServer.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || 'New Admin',
      onboarding_completed: false, 
      updated_at: new Date()
    });

    // 2. CREATE THE CLUB
    const { data: club, error: clubError } = await supabaseServer
      .from('clubs')
      .insert([{ 
        name, 
        slug: clubSlug, 
        is_club: isClub, 
        club_cat: sport,      
        entity_type: entityType, 
        owner_id: user.id,
        sport_type: sport.toLowerCase(),
        terminology_preset: preset.terminology,
        default_member_fee: preset.defaults.member_fee,
        default_casual_fee: preset.defaults.casual_fee
      }])
      .select().single();

    if (clubError) throw clubError;

    // 3. CREATE THE FIRST TEAM
    await supabaseServer.from('teams').insert([{ 
      club_id: club.id, 
      name: name, 
      slug: `${clubSlug}-team`,
      owner_id: user.id
    }]);

    return { success: true, clubId: club.id };
  } catch (error) {
    console.error("Setup Error:", error);
    return { success: false };
  }
}

export async function scoutClubBranding(url: string, token?: string) {
  try {
    if (!token) throw new Error("No token provided");
    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await supabaseServer.auth.getUser();
    const { data: latestTeam } = await supabaseServer
      .from('teams').select('id').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(1).single();
    if (!latestTeam) return { success: false };

    const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    const discoveredLogo = `https://logo.clearbit.com/${domain}`;

    await supabaseServer.from('teams').update({ logo_url: discoveredLogo }).eq('id', latestTeam.id);
    return { success: true };
  } catch (error) { return { success: false }; }
}

export async function updateTeamBranding(teamId: string, brandingData: { logo: string, colors: string[] }, token?: string) {
  if (!token) return { success: false, error: "No token" };

  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { error } = await supabaseServer
    .from('teams')
    .update({ logo_url: brandingData.logo, theme_colors: brandingData.colors })
    .eq('id', teamId);
    
  return { success: !error };
}