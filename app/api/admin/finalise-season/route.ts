import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { clubId, selectedTeams } = await req.json();

    if (!clubId || !selectedTeams || !Array.isArray(selectedTeams)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: club } = await supabase.from('clubs').select('season_name').eq('id', clubId).single();
    const outgoingSeason = club?.season_name || null;

    // 1. Process each team
    for (const teamConfig of selectedTeams) {
      const { teamId, rosterAction, financialsAction } = teamConfig;

      // Financials Sweep (Write Off)
      if (financialsAction === 'write_off') {
        const { data: teamPlayers } = await supabase.from('players').select('id').eq('default_team_id', teamId);
        if (teamPlayers && teamPlayers.length > 0) {
          const playerIds = teamPlayers.map(p => p.id);
          const { data: txData } = await supabase.from('transactions').select('player_id, amount, transaction_type').in('player_id', playerIds);
          
          if (txData) {
            const debts: Record<string, number> = {};
            txData.forEach(tx => {
              if (tx.transaction_type === 'fee') debts[tx.player_id] = (debts[tx.player_id] || 0) + Number(tx.amount);
              if (tx.transaction_type === 'payment') debts[tx.player_id] = (debts[tx.player_id] || 0) - Number(tx.amount);
            });

            const writeOffTransactions: any[] = [];
            for (const [pId, debtAmt] of Object.entries(debts)) {
              if (debtAmt > 0) {
                writeOffTransactions.push({ player_id: pId, team_id: teamId, club_id: clubId, amount: debtAmt, transaction_type: 'payment', payment_method: 'write_off', season_name: outgoingSeason });
              } else if (debtAmt < 0) {
                writeOffTransactions.push({ player_id: pId, team_id: teamId, club_id: clubId, amount: Math.abs(debtAmt), transaction_type: 'fee', description: 'Credit Write-off', season_name: outgoingSeason });
              }
            }
            if (writeOffTransactions.length > 0) {
              await supabase.from('transactions').insert(writeOffTransactions);
            }
          }
        }
      }

      // Roster Sweep (Start Fresh)
      if (rosterAction === 'clear') {
        await supabase.from('players').update({ default_team_id: null }).eq('default_team_id', teamId);
      }
    }

    // 3. Clear global season from club
    await supabase.from('clubs').update({ 
      season_name: null, 
      season_start: null, 
      season_end: null 
    }).eq('id', clubId);

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error("Finalise Error:", error);
    return NextResponse.json({ error: error.message || "An unknown error occurred" }, { status: 500 });
  }
}
