"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface PaymentCardProps {
  fixtureId: string;
  playerId: string;
  amountOwed: number;
  expenseLabel: string;
  club?: {
    is_square_enabled: boolean;
    pay_id_type: 'mobile' | 'email' | 'bank_account' | null;
    pay_id_value: string | null;
  };
  onPaymentComplete?: () => void;
}

export default function PlayerPaymentCard({
  fixtureId,
  playerId,
  amountOwed,
  expenseLabel,
  club,
  onPaymentComplete
}: PaymentCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopyPayId = async () => {
    if (!club?.pay_id_value) return;
    try {
      await navigator.clipboard.writeText(club.pay_id_value);
      setIsCopied(true);
      showToast("Payment Info copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showToast("Failed to copy", "error");
    }
  };

  const handleMarkAsPaid = async (method: 'card' | 'cash', descriptionLabel: string) => {
    setIsProcessing(true);
    
    const { error } = await supabase.from('transactions').insert([{
      fixture_id: fixtureId,
      player_id: playerId,
      amount: amountOwed,
      transaction_type: 'payment',
      payment_method: method,
      description: `${expenseLabel} Payment via ${descriptionLabel}`
    }]);

    setIsProcessing(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Payment recorded successfully!");
      if (onPaymentComplete) onPaymentComplete();
    }
  };

  if (amountOwed <= 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-center">
        <p className="text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-xs">
          <i className="fa-solid fa-check-circle mr-2"></i> All Settled Up!
        </p>
      </div>
    );
  }

  const renderPaymentOptions = () => {
    if (club?.is_square_enabled) {
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center">
            Pay Securely Online
          </p>
          <button 
            disabled={isProcessing}
            onClick={() => handleMarkAsPaid('card', 'Square Online')} 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <i className="fa-brands fa-square"></i> {isProcessing ? 'Processing...' : 'Pay Now with Card'}
          </button>
        </div>
      );
    }

    if (club?.pay_id_value) {
      return (
        <div className="space-y-3">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 text-center">
              {club.pay_id_type === 'bank_account' ? 'Pay Club via Bank Transfer' : `Pay Club via Digital Transfer (${club.pay_id_type})`}
            </p>
            
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 bg-white dark:bg-[#111] px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-sm text-center font-bold text-zinc-900 dark:text-white select-all">
                {club.pay_id_value}
              </code>
              <button 
                onClick={handleCopyPayId}
                className={`px-4 py-3 rounded-xl font-black uppercase text-xs transition-colors shadow-sm flex items-center justify-center min-w-[80px] ${isCopied ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}
              >
                {isCopied ? <i className="fa-solid fa-check"></i> : 'Copy'}
              </button>
            </div>

            <button 
              disabled={isProcessing}
              onClick={() => handleMarkAsPaid('card', `Digital Transfer (${club.pay_id_type})`)} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane"></i> {isProcessing ? 'Updating Ledger...' : "I've Sent the Transfer"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 text-center py-2">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
          <i className="fa-solid fa-coins text-zinc-400 dark:text-zinc-500 text-xl"></i>
        </div>
        <p className="text-xs text-zinc-500 font-bold">
          No digital payment methods configured.
        </p>
        <button 
          disabled={isProcessing}
          onClick={() => handleMarkAsPaid('cash', 'Cash')} 
          className="w-full bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
        >
          {isProcessing ? 'Updating...' : "I Paid Cash to the Club"}
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors space-y-4">
      {toast && (
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-50 animate-in slide-in-from-bottom-2 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Amount Due
        </h2>
        <span className="text-xl font-black text-zinc-900 dark:text-white">
          ${amountOwed.toFixed(2)}
        </span>
      </div>

      {renderPaymentOptions()}
    </div>
  );
}