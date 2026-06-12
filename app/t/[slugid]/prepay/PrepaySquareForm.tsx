"use client";

import { useState } from 'react';
import { PaymentForm, CreditCard, ApplePay, GooglePay } from 'react-square-web-payments-sdk';
import { useRouter } from 'next/navigation';

export default function PrepaySquareForm({ transactionId, appId, locationId, amount, grossAmount }: any) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async (token: any) => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/pay/square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: token.token,
          txId: transactionId,
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
    <div className="w-full">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-3 font-bold border border-red-100 text-center uppercase tracking-widest">
          {error}
        </div>
      )}

      <div className="square-payment-wrapper relative min-h-[150px]">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 dark:bg-[#111]/80 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
            <div className="font-bold text-emerald-600 animate-pulse flex items-center gap-2 uppercase tracking-widest text-xs">
              <i className="fa-solid fa-spinner fa-spin"></i> Processing...
            </div>
          </div>
        )}
        <PaymentForm
          applicationId={appId}
          locationId={locationId}
          cardTokenizeResponseReceived={handlePayment}
          createPaymentRequest={() => ({
            countryCode: 'AU',
            currencyCode: 'AUD',
            total: {
              amount: grossAmount.toFixed(2),
              label: 'Prepay Match Fees',
            },
          })}
        >
          <div className="flex flex-col gap-3">
            <ApplePay />
            <GooglePay />
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Or Pay with Card</span>
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>
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
          </div>
        </PaymentForm>
      </div>
    </div>
  );
}
