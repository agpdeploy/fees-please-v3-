"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function PlayerTransactions() {
  const { profile, loading: profileLoading } = useProfile();
  const { activeClubId } = useActiveClub();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [financials, setFinancials] = useState({ outstanding: 0, paid: 0, charged: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    async function fetchTransactions() {
      if (profileLoading) return;
      if (!profile?.email && !profile?.id) {
        setIsLoading(false);
        return;
      }
      if (!activeClubId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // 1. Find all player records in the active club matching the user's email or user_id
      let query = supabase.from('players').select('id').eq('club_id', activeClubId);
      if (profile.email && profile.id) {
        query = query.or(`email.eq.${encodeURIComponent(profile.email)},user_id.eq.${profile.id}`);
      } else if (profile.email) {
        query = query.eq('email', profile.email);
      } else if (profile.id) {
        query = query.eq('user_id', profile.id);
      }

      const { data: playersData, error: playersError } = await query;
      console.log("PlayerTransactions -> playersData:", playersData, "playersError:", playersError);

      if (playersError || !playersData || playersData.length === 0) {
        setTransactions([]);
        setFinancials({ outstanding: 0, paid: 0, charged: 0 });
        setIsLoading(false);
        return;
      }

      const playerIds = playersData.map((p: any) => p.id);

      // 2. Fetch transactions for these player IDs
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          transaction_type,
          payment_method,
          created_at,
          description,
          status,
          season_name,
          teams ( name ),
          fixtures ( opponent, match_date )
        `)
        .in('player_id', playerIds)
        .eq('club_id', activeClubId)
        .order('created_at', { ascending: false });

      console.log("PlayerTransactions -> txData:", txData, "txError:", txError);

      if (txError || !txData) {
        setTransactions([]);
        setFinancials({ outstanding: 0, paid: 0, charged: 0 });
        setIsLoading(false);
        return;
      }

      // Calculate totals
      let totalCharged = 0;
      let totalPaid = 0;

      txData.forEach(tx => {
        if (tx.transaction_type === 'fee') {
          totalCharged += Number(tx.amount);
        } else if (tx.transaction_type === 'payment') {
          totalPaid += Number(tx.amount);
        }
      });

      setFinancials({
        charged: totalCharged,
        paid: totalPaid,
        outstanding: totalCharged - totalPaid
      });

      setTransactions(txData);
      setIsLoading(false);
    }

    fetchTransactions();
  }, [profile, activeClubId, profileLoading]);

  const groupedFeed = useMemo(() => {
    const map = new Map();
    const groups: any[] = [];
    
    transactions.forEach(tx => {
      const dateObj = new Date(tx.created_at);
      const dateKey = dateObj.toLocaleDateString('en-GB'); 
      const fixtureId = tx.fixture_id || 'no_fixture';
      const groupKey = `${dateKey}_${fixtureId}`;

      if (!map.has(groupKey)) {
        const newGroup = {
          id: groupKey,
          date: dateObj,
          dateString: dateKey,
          fixtureName: tx.fixtures?.opponent ? `Match vs ${tx.fixtures.opponent}` : (tx.description || ''),
          seasonName: tx.season_name,
          teamName: tx.teams?.name || 'Club',
          paid: 0,
          fee: 0,
          raw_transactions: [],
          cash_payments: false,
          card_payments: false
        };
        map.set(groupKey, newGroup);
        groups.push(newGroup);
      }

      const g = map.get(groupKey);
      g.raw_transactions.push(tx);
      if (tx.transaction_type === 'payment') {
          g.paid += Number(tx.amount);
          if (tx.payment_method === 'cash') g.cash_payments = true;
          if (tx.payment_method === 'card') g.card_payments = true;
      }
      if (tx.transaction_type === 'fee') {
          g.fee += Number(tx.amount);
      }
    });

    return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions]);

  if (isLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <i className="fa-solid fa-circle-notch animate-spin text-emerald-500 text-3xl mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          Loading Transactions...
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
         <h1 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">My Transactions</h1>
      </div>

      <div className="px-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm space-y-4 relative overflow-hidden">
          {financials.outstanding <= 0 && (
            <div className="absolute top-0 right-0 p-4">
              <i className="fa-solid fa-circle-check text-emerald-500 text-3xl opacity-20"></i>
            </div>
          )}
          
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Outstanding Balance</div>
              <div className={`text-4xl font-black tracking-tighter ${financials.outstanding > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                ${financials.outstanding > 0 ? financials.outstanding.toFixed(2) : "0.00"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Paid</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                ${financials.paid.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Fees</div>
              <div className="text-lg font-black text-zinc-900 dark:text-white">
                ${financials.charged.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-8">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Transaction History</h3>
        
        {groupedFeed.length === 0 ? (
          <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <i className="fa-solid fa-receipt text-3xl text-zinc-300 dark:text-zinc-700 mb-3"></i>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No transactions found</p>
          </div>
        ) : (
          <>
            {groupedFeed.slice(0, visibleCount).map((group) => {
              const net = group.paid - group.fee;
              const netStr = net === 0 ? '$0' : (net > 0 ? `+$${net.toFixed(0)}` : `-$${Math.abs(net).toFixed(0)}`);
              const netColor = net >= 0 ? 'text-emerald-500' : 'text-red-500';

              return (
                <div key={group.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm relative transition-all hover:border-zinc-300 dark:hover:border-zinc-700 mb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1.5">
                      <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                        {group.dateString}
                        {group.seasonName && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {group.seasonName}
                          </span>
                        )}
                      </div>
                      {group.fixtureName && (
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                          {group.fixtureName}
                        </div>
                      )}
                      <div className="text-[10px] font-black uppercase tracking-widest mt-1 flex gap-2">
                         <span className="text-emerald-500">Paid: ${group.paid.toFixed(0)}</span>
                         <span className="text-zinc-300 dark:text-zinc-700">•</span>
                         <span className="text-red-500/80">Fee: ${group.fee.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <div className={`font-black text-lg tracking-tighter ${netColor}`}>
                        {netStr}
                      </div>
                      {(group.cash_payments || group.card_payments) && (
                         <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                           {group.cash_payments && 'CASH'}{group.cash_payments && group.card_payments && ' / '}{group.card_payments && 'CARD'}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {groupedFeed.length > visibleCount && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 6)}
                className="w-full py-3 mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
              >
                Show {groupedFeed.length - visibleCount} More Transactions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
