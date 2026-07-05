const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpsert() {
  const { data: clubs } = await supabaseAdmin.from('clubs').select('id, name');
  const targetClub = clubs.find(c => c.name.toLowerCase().includes("bowl movements"));
  
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name').eq('club_id', targetClub.id);
  const teamIds = teams.map(t => t.id);

  const { data: allCurrentSponsors } = await supabaseAdmin.from('team_sponsors').select('*').in('team_id', teamIds).order('created_at', { ascending: true });
  
  // Pretend sponsors state has 3 items
  const sponsors = [
    { name: "MJ & Co Designs", logo_url: "logo1.png", url: "https://mj", is_active: true },
    { name: "Fees Please", logo_url: "logo2.png", url: "https://fp", is_active: true },
    { name: "Test 3", logo_url: "logo3.png", url: "https://t3", is_active: false }
  ];

  const upserts = [];
  for (const t of teams) {
    const teamCurrentSponsors = allCurrentSponsors.filter(s => s.team_id === t.id);
    
    sponsors.forEach((sponsorState, index) => {
      const correspondingTeamSponsor = teamCurrentSponsors[index];
      if (correspondingTeamSponsor) {
        upserts.push({
          id: correspondingTeamSponsor.id,
          team_id: t.id,
          name: sponsorState.name,
          logo_url: sponsorState.logo_url,
          url: sponsorState.url,
          is_active: sponsorState.is_active
        });
      }
    });
  }

  console.log("Upserts payload:", upserts);

  const { error } = await supabaseAdmin.from('team_sponsors').upsert(upserts);
  if (error) {
     console.error("UPSERT ERROR:", error);
  } else {
     console.log("UPSERT SUCCESS!");
  }
}

testUpsert();
