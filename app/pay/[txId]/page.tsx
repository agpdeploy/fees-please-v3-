import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import CheckoutForm from './CheckoutForm'
import TeamAvailabilityClient from '@/app/t/[slugid]/TeamAvailabilityClient'

export default async function PayPage(props: { params: Promise<{ txId: string }> }) {
  // Next.js 15 requires awaiting params
  const { txId } = await props.params;
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*, players(*)')
    .eq('id', txId)
    .single();

  if (txError || !transaction) {
    return <div className="p-8 text-center text-red-500 font-bold">Transaction not found.</div>;
  }

  const [
    { data: club },
    { data: team },
    { data: publicProfile },
    { data: fixture },
    { data: allTxs }
  ] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', transaction.club_id).single(),
    supabase.from('teams').select('*').eq('id', transaction.team_id).single(),
    supabase.from('public_team_profiles').select('*').eq('team_id', transaction.team_id).maybeSingle(),
    transaction.fixture_id ? supabase.from('fixtures').select('*').eq('id', transaction.fixture_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('transactions').select('*').eq('player_id', transaction.player_id).eq('club_id', transaction.club_id)
  ]);

  let balance = 0;
  allTxs?.forEach(tx => {
    if (tx.transaction_type === 'payment' && tx.status !== 'failed' && tx.status !== 'pending') {
      balance -= tx.amount;
    } else if (tx.transaction_type === 'fee' || tx.transaction_type === 'expense') {
      balance += tx.amount;
    }
  });

  const unpaidPastTxs = allTxs?.filter(tx => 
    (tx.transaction_type === 'fee' || tx.transaction_type === 'expense') && 
    tx.status !== 'paid' && 
    tx.fixture_id !== transaction.fixture_id
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

  const sponsors = publicProfile ? [
    { logo: publicProfile.sponsor_1_logo, url: publicProfile.sponsor_1_url, index: 1 },
    { logo: publicProfile.sponsor_2_logo, url: publicProfile.sponsor_2_url, index: 2 },
    { logo: publicProfile.sponsor_3_logo, url: publicProfile.sponsor_3_url, index: 3 }
  ].filter(s => s.logo) : [];

  const player = transaction.players;

  if (transaction.status === 'paid' || transaction.transaction_type === 'payment') {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]">
        <div className="bg-emerald-600 text-white p-4 text-center shadow-md z-50 sticky top-0">
           <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm">
             <i className="fa-solid fa-circle-check text-xl"></i> Payment Successful
           </div>
           <p className="text-emerald-100 text-[10px] font-bold mt-1 uppercase">Please confirm your upcoming availability below</p>
        </div>
        <div className="flex-1">
          <TeamAvailabilityClient teamId={team.id} clubId={club.id} teamName={team.name} initialPlayerId={player?.id} />
        </div>
      </div>
    );
  }

  if (!club?.is_square_enabled || !club?.square_location_id) {
    return <div className="p-8 text-center text-zinc-500 font-bold">This club is not fully configured for online payments.</div>;
  }

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  if (!appId) {
    return <div className="p-8 text-center text-red-500 font-bold">Square configuration error on server.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center pt-8 pb-12 px-4">
      <CheckoutForm 
        transaction={transaction}
        club={club}
        player={player}
        team={team}
        fixture={fixture}
        balance={balance}
        outstandingList={outstandingList}
        appId={appId}
        locationId={club.square_location_id}
      />
      
      <div className="w-full max-w-md mx-auto mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800/50">
        <div className="flex flex-col items-center">
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
