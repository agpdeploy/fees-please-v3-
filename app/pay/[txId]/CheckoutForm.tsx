"use client";

import { useState } from 'react';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { useRouter } from 'next/navigation';
import { calculateSquareOnlineGross } from '@/lib/fees';

export default function CheckoutForm({ transaction, club, player, team, fixture, balance, outstandingList, appId, locationId }: any) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalToCollect = transaction.amount;
  const grossAmount = calculateSquareOnlineGross(totalToCollect, club);

  const handlePayment = async (token: any) => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/pay/square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: token.token,
          txId: transaction.id,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      
      setIsSuccess(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const matchDate = fixture ? new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase() : '';
  const teamLogoUrl = Array.isArray(team?.public_team_profiles) 
      ? team?.public_team_profiles[0]?.club_logo_url 
      : team?.public_team_profiles?.club_logo_url;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header matching Game Day */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
          {teamLogoUrl || club?.logo_url ? <img src={teamLogoUrl || club.logo_url} className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-shield-halved text-zinc-300 dark:text-zinc-700 text-2xl"></i>}
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{team?.name || club?.name}</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">Digital Checkout</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Paying For</span>
            <span className="text-xs font-bold uppercase">{player.nickname || `${player.first_name} ${player.last_name?.charAt(0) || ''}.`}</span>
          </div>
        </div>
      </div>

      {/* Fixture / Payment Card */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-lg overflow-hidden flex flex-col relative">
        
        {fixture && (
          <>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center ml-1">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-emerald-600 text-white tracking-widest pl-2">Match</span>
                <span className="text-xs font-bold text-zinc-500 uppercase">{matchDate}</span>
            </div>
            
            <div className="p-4 flex items-center justify-between gap-2 ml-1">
                <div className="flex items-center gap-3 flex-1 pl-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {teamLogoUrl || club?.logo_url ? <img src={teamLogoUrl || club.logo_url} className="w-full h-full object-cover bg-white" /> : <span className="text-[10px] font-black">{team?.name?.substring(0, 2).toUpperCase()}</span>}
                    </div>
                    <span className="font-black text-xs uppercase leading-tight">{team?.name}</span>
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
          </>
        )}

        {/* Outstanding Balance Breakdown */}
        {balance > 0 && outstandingList?.length > 0 && (
          <div className="bg-white dark:bg-zinc-950/30 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">Outstanding from previous games</p>
            <div className="space-y-2.5">
              {outstandingList.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold dark:text-zinc-600 dark:text-zinc-300">{item.title}</span>
                    {item.date && <span className="text-[10px] text-zinc-500 font-medium">{item.date}</span>}
                  </div>
                  <span className="text-xs font-black text-zinc-500">${item.amount.toFixed(2)}</span>
                </div>
              ))}

            </div>
          </div>
        )}

        <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1 flex flex-col gap-2">
           <div className="flex justify-between items-center">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Owed</p>
                <p className="text-xs text-zinc-400 font-medium">{transaction.description || 'Match Fee'}</p>
             </div>
             <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">${totalToCollect.toFixed(2)}</p>
           </div>
           
           {club?.is_square_enabled && totalToCollect > 0 && (
             <div className="flex justify-between items-center pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 mt-1">
               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Card Processing Fee</p>
               <p className="text-xs font-bold text-zinc-500">${(grossAmount - totalToCollect).toFixed(2)}</p>
             </div>
           )}
           {club?.is_square_enabled && totalToCollect > 0 && (
             <div className="flex justify-between items-center pt-1">
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Charge</p>
               <p className="text-sm font-black text-emerald-600 dark:text-emerald-500">${grossAmount.toFixed(2)}</p>
             </div>
           )}
        </div>

        <div className="p-4 flex flex-col gap-2.5 bg-zinc-50 dark:bg-zinc-950/50 ml-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100 text-center uppercase tracking-widest">
              {error}
            </div>
          )}

          <div className="square-payment-wrapper relative min-h-[150px]">
            {(isProcessing || isSuccess) && (
              <div className="absolute inset-0 bg-white/80 dark:bg-[#111]/80 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
                <div className="font-bold text-emerald-600 animate-pulse flex items-center gap-2 uppercase tracking-widest text-xs">
                  {isSuccess ? <><i className="fa-solid fa-circle-check"></i> Success! Reloading...</> : <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>}
                </div>
              </div>
            )}
            <PaymentForm
              applicationId={appId}
              locationId={locationId}
              cardTokenizeResponseReceived={handlePayment}
            >
              <CreditCard 
                buttonProps={{
                  css: {
                    backgroundColor: '#10b981',
                    fontSize: '12px',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    '&:hover': {
                      backgroundColor: '#059669'
                    }
                  }
                }}
              />
            </PaymentForm>
          </div>
        </div>
      </div>
    </div>
  );
}
