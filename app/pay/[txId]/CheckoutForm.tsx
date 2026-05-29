"use client";

import { useState } from 'react';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { useRouter } from 'next/navigation';
import { calculateSquareOnlineGross } from '@/lib/fees';

export default function CheckoutForm({ transaction, club, player, appId, locationId }: any) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grossAmount = calculateSquareOnlineGross(transaction.amount, club);
  const amountDisplay = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(grossAmount);

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
      
      // Refresh to show success screen
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#111] rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mx-auto">
      {/* Header */}
      <div className="bg-zinc-50 dark:bg-[#1A1A1A] p-6 text-center border-b border-zinc-200 dark:border-zinc-800">
        {club?.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-16 h-16 object-contain mx-auto mb-3 rounded-xl bg-white" />
        ) : (
          <div className="w-16 h-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-black text-zinc-400">
            {club?.name?.substring(0, 2).toUpperCase()}
          </div>
        )}
        <h2 className="text-[10px] font-black opacity-60 uppercase tracking-widest text-zinc-900 dark:text-white mb-2">{club?.name}</h2>
        <div className="text-4xl font-black mt-2 text-zinc-900 dark:text-white tracking-tighter">{amountDisplay}</div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-2">Paying As: {player?.first_name} {player?.last_name?.charAt(0)}.</p>
      </div>

      {/* Body */}
      <div className="p-6">
        <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-500 mb-5 text-center uppercase tracking-widest">
          {transaction.description || 'Match Fee'}
        </h3>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 font-medium border border-red-100">
            {error}
          </div>
        )}

        <div className="square-payment-wrapper relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
              <div className="font-bold text-emerald-600 animate-pulse flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> Processing...
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
                  fontSize: '14px',
                  color: '#fff',
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
  );
}
