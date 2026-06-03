import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import PrepaySquareForm from './PrepaySquareForm';
import { calculateSquareOnlineGross } from '@/lib/fees';

export default async function PrePayPage({ params, searchParams }: { params: Promise<{ slugid: string }>, searchParams: Promise<{ f?: string, p?: string }> }) {
  const { slugid } = await params;
  const { f: fixtureId, p: playerId } = await searchParams;

  if (!fixtureId || !playerId) {
    return <div className="p-8 text-center font-bold">Invalid checkout link. Missing parameters.</div>;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  );

  // 1. Fetch player
  const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
  if (!player) return <div className="p-8 text-center font-bold">Player not found.</div>;

  // 2. Fetch fixture
  const { data: fixture } = await supabase.from('fixtures').select('*, teams(*, public_team_profiles(club_logo_url))').eq('id', fixtureId).single();
  if (!fixture) return <div className="p-8 text-center font-bold">Fixture not found.</div>;

  const team = fixture.teams;
  const clubId = player.club_id;

  // 3. Fetch club
  const { data: club } = await supabase.from('clubs').select('*').eq('id', clubId).single();
  if (!club) return <div className="p-8 text-center font-bold">Club not found.</div>;

  // 4. Fetch public profile for sponsors
  const { data: publicProfile } = await supabase
    .from('public_team_profiles')
    .select('*')
    .eq('team_id', player.default_team_id)
    .maybeSingle();

  const sponsors = publicProfile ? [
    { logo: publicProfile.sponsor_1_logo, url: publicProfile.sponsor_1_url, index: 1 },
    { logo: publicProfile.sponsor_2_logo, url: publicProfile.sponsor_2_url, index: 2 },
    { logo: publicProfile.sponsor_3_logo, url: publicProfile.sponsor_3_url, index: 3 }
  ].filter(s => s.logo) : [];

  // 5. Calculate amount owed
  const { data: transactions } = await supabase.from('transactions').select('*').eq('player_id', playerId).eq('club_id', clubId);
  
  let balance = 0;
  let hasFeeForThisFixture = false;
  let hasPaidForThisFixture = false;

  transactions?.forEach(tx => {
    if (tx.fixture_id === fixtureId) {
      if (tx.transaction_type === 'fee') hasFeeForThisFixture = true;
      if (tx.transaction_type === 'payment') hasPaidForThisFixture = true;
    }

    if (tx.transaction_type === 'payment' && tx.status !== 'failed' && tx.status !== 'pending') {
      balance -= tx.amount;
    } else if (tx.transaction_type === 'fee' || tx.transaction_type === 'expense') {
      balance += tx.amount;
    }
  });

  if (hasPaidForThisFixture) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <i className="fa-solid fa-check-circle text-5xl text-emerald-500 mb-4"></i>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Already Paid</h1>
          <p className="text-zinc-500 text-sm mt-2 font-bold">You are all settled up for this match!</p>
        </div>
      </div>
    );
  }

  // Calculate Match Fee
  let matchFee = player.is_member ? club.default_member_fee : club.default_casual_fee;
  
  // The amount they need to pay is their balance + the match fee for this game.
  let totalToCollect = balance;
  if (!hasFeeForThisFixture) {
    totalToCollect += matchFee;
  }

  totalToCollect = Math.max(0, totalToCollect);

  let txId = null;
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;

  if (totalToCollect > 0) {
    let existingCheckout = transactions?.find(tx => tx.fixture_id === fixtureId && tx.transaction_type === 'checkout_link' && tx.status !== 'paid');
    
    if (!existingCheckout) {
      const { data: newTx } = await supabase.from('transactions').insert({
        club_id: club.id,
        player_id: player.id,
        team_id: player.default_team_id,
        fixture_id: fixture.id,
        amount: totalToCollect,
        transaction_type: 'checkout_link',
        status: 'unpaid',
        description: `Combined Payment (${fixture.opponent || 'TBA'})`
      }).select('id').single();
      if (newTx) txId = newTx.id;
    } else {
      txId = existingCheckout.id;
      if (existingCheckout.amount !== totalToCollect) {
        await supabase.from('transactions').update({ amount: totalToCollect }).eq('id', txId);
      }
    }
  }

  const matchDate = new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase();
  const teamLogoUrl = Array.isArray(team.public_team_profiles) 
      ? team.public_team_profiles[0]?.club_logo_url 
      : team.public_team_profiles?.club_logo_url;

  const unpaidPastTxs = transactions?.filter(tx => 
    (tx.transaction_type === 'fee' || tx.transaction_type === 'expense') && 
    tx.status !== 'paid' && 
    tx.fixture_id !== fixtureId
  ) || [];

  const pastFixtureIds = unpaidPastTxs.map(tx => tx.fixture_id).filter(Boolean);
  let pastFixturesMap = new Map();
  if (pastFixtureIds.length > 0) {
    const { data: pf } = await supabase.from('fixtures').select('id, match_date, opponent').in('id', pastFixtureIds);
    pf?.forEach(f => pastFixturesMap.set(f.id, f));
  }

  const outstandingList = unpaidPastTxs.map(tx => {
     const f = tx.fixture_id ? pastFixturesMap.get(tx.fixture_id) : null;
     return {
       id: tx.id,
       title: f ? `vs ${f.opponent}` : (tx.description || 'Other Fee'),
       date: f ? new Date(f.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase() : '',
       amount: tx.amount
     };
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white pt-8 pb-32 px-4 font-sans transition-colors relative flex flex-col items-center">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Header matching Game Day */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
            {teamLogoUrl ? <img src={teamLogoUrl} className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-shield-halved text-zinc-300 dark:text-zinc-700 text-2xl"></i>}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{team.name}</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">Pre-Pay Match Fees</p>
          </div>
        </div>

        {/* Player Block */}
        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex justify-between items-center mb-4">
          <div className="pl-2">
            <p className="text-[9px] text-zinc-500 font-black uppercase mb-0.5">Paying For</p>
            <p className="font-bold uppercase text-sm">{player.nickname || `${player.first_name} ${player.last_name?.charAt(0)}.`}</p>
          </div>
        </div>

        {/* Fixture / Payment Card */}
        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-lg overflow-hidden flex flex-col relative">
          
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center ml-1">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-emerald-600 text-white tracking-widest pl-2">Upcoming</span>
              <span className="text-xs font-bold text-zinc-500 uppercase">{matchDate}</span>
          </div>
          
          <div className="p-4 flex items-center justify-between gap-2 ml-1">
              <div className="flex items-center gap-3 flex-1 pl-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {teamLogoUrl ? <img src={teamLogoUrl} className="w-full h-full object-cover bg-white" /> : <span className="text-[10px] font-black">{team.name?.substring(0, 2).toUpperCase()}</span>}
                  </div>
                  <span className="font-black text-xs uppercase leading-tight">{team.name}</span>
              </div>
              <div className="shrink-0 px-2 text-[10px] font-black text-zinc-300 dark:text-zinc-700 italic">VS</div>
              <div className="flex items-center justify-end gap-3 flex-1">
                  <span className="font-black text-xs uppercase text-right leading-tight">{fixture.opponent || 'TBA'}</span>
                  <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-shield text-zinc-300 dark:text-zinc-700 text-xs"></i></div>
              </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/50 px-6 py-3 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
              {fixture.start_time && `${fixture.start_time} • `}
              {fixture.location || 'Location TBA'}
            </p>
          </div>

          {/* Outstanding Balance Breakdown */}
          {balance > 0 && outstandingList.length > 0 && (
            <div className="bg-white dark:bg-zinc-950/30 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">Outstanding from previous games</p>
              <div className="space-y-2.5">
                {outstandingList.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold dark:text-zinc-600 dark:text-zinc-300">{item.title}</span>
                      {item.date && <span className="text-[10px] text-zinc-500 font-medium">{item.date}</span>}
                    </div>
                    <span className="text-xs font-black text-zinc-500">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
                {outstandingList.reduce((acc, curr) => acc + curr.amount, 0) !== balance && (
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800 border-dashed">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Partial Payments / Adjustments</span>
                    <span className="text-xs font-black text-emerald-500">-${(outstandingList.reduce((acc, curr) => acc + curr.amount, 0) - balance).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1 flex flex-col gap-2">
             <div className="flex justify-between items-center">
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Owed</p>
                  <p className="text-xs text-zinc-400 font-medium">Match Fee + Outstanding</p>
               </div>
               <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">${totalToCollect.toFixed(2)}</p>
             </div>
             
             {club.is_square_enabled && totalToCollect > 0 && (
               <div className="flex justify-between items-center pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 mt-1">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Card Processing Fee</p>
                 <p className="text-xs font-bold text-zinc-500">${(calculateSquareOnlineGross(totalToCollect, club) - totalToCollect).toFixed(2)}</p>
               </div>
             )}
             {club.is_square_enabled && totalToCollect > 0 && (
               <div className="flex justify-between items-center pt-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Charge</p>
                 <p className="text-sm font-black text-emerald-600 dark:text-emerald-500">${calculateSquareOnlineGross(totalToCollect, club).toFixed(2)}</p>
               </div>
             )}
          </div>

          <div className="p-4 flex flex-col gap-2.5 bg-zinc-50 dark:bg-zinc-950/50 ml-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
            {totalToCollect > 0 ? (
              club.is_square_enabled && club.square_location_id && appId && txId ? (
                <PrepaySquareForm 
                  transactionId={txId} 
                  appId={appId} 
                  locationId={club.square_location_id} 
                  amount={totalToCollect} 
                />
              ) : (
                <div className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl text-center">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Direct Bank Transfer</p>
                  <p className="text-sm font-black text-zinc-900 dark:text-white">{club.bank_account_name || club.name}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-mono">{club.bank_bsb} {club.bank_account_number}</p>
                  <p className="text-[10px] text-zinc-500 mt-3 font-bold uppercase tracking-wider">Ref: {player.first_name} {player.last_name}</p>
                </div>
              )
            ) : (
              <div className="w-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl font-bold text-sm text-center">
                 You don't owe any fees at this time!
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/80 pt-3 pb-6 sm:pb-4 z-50">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center">
          {sponsors.length > 0 && (
            <>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-600 text-center mb-3">Proudly Supported By</p>
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-5">
                {sponsors.map((s) => (
                  <a key={s.index} href={s.url || '#'} target={s.url ? "_blank" : undefined} rel={s.url ? "noopener noreferrer" : undefined} className={`h-10 flex grayscale hover:grayscale-0 transition-all ${!s.url ? 'cursor-default' : 'cursor-pointer hover:scale-105'}`}>
                    <img src={s.logo} alt={`Sponsor ${s.index}`} className="max-h-full max-w-[120px] object-contain opacity-70 hover:opacity-100" />
                  </a>
                ))}
              </div>
            </>
          )}
          <a href="https://feesplease.app" target="_blank" rel="noopener noreferrer" className="italic font-black text-emerald-500 text-[10px] tracking-widest hover:opacity-80 mt-1">
            Powered By Fees Please
          </a>
        </div>
      </div>
    </div>
  );
}
