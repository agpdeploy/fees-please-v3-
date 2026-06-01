import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Setup Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function seedTestEnvironment() {
  const runId = crypto.randomBytes(4).toString('hex');
  const clubId = crypto.randomUUID();
  const teamId = crypto.randomUUID();
  const player1Id = crypto.randomUUID();
  const player2Id = crypto.randomUUID();
  const fixtureId = crypto.randomUUID();

  // 1. Create Club
  const { error: e1 } = await supabase.from('clubs').insert({
    id: clubId,
    name: `E2E Test Club ${runId}`,
    is_square_enabled: true
  });
  if (e1) console.error("Club Error:", e1);

  // 2. Create Team
  const { error: e2 } = await supabase.from('teams').insert({
    id: teamId,
    club_id: clubId,
    name: `E2E Team ${runId}`
  });
  if (e2) console.error("Team Error:", e2);

  // 3. Create Players
  const { error: e3 } = await supabase.from('players').insert([
    { id: player1Id, club_id: clubId, first_name: 'Testy', last_name: 'McTestface', is_member: true, default_team_id: teamId },
    { id: player2Id, club_id: clubId, first_name: 'Debt', last_name: 'Owerson', is_member: false, default_team_id: teamId },
  ]);
  if (e3) console.error("Players Error:", e3);

  // 4. Create Fixture
  const { error: e4 } = await supabase.from('fixtures').insert({
    id: fixtureId,
    club_id: clubId,
    team_id: teamId,
    match_date: new Date().toISOString().split('T')[0],
    opponent: 'The Bugs',
    status: 'scheduled'
  });
  if (e4) console.error("Fixture Error:", e4);

  // 5. Add players to Match Squad
  await supabase.from('match_squads').insert([
    { fixture_id: fixtureId, player_id: player1Id },
    { fixture_id: fixtureId, player_id: player2Id }
  ]);
  
  // 6. Give player 2 some debt
  await supabase.from('transactions').insert({
    club_id: clubId,
    player_id: player2Id,
    team_id: teamId,
    amount: 50,
    transaction_type: 'fee',
    status: 'unpaid',
    description: 'Past debt'
  });

  return { runId, clubId, teamId, player1Id, player2Id, fixtureId };
}

export async function teardownTestEnvironment(clubId: string) {
  // Cascading deletes should handle everything else, but we explicitly delete to be safe
  await supabase.from('clubs').delete().eq('id', clubId);
}
