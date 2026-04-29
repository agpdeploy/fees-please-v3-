"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';

type PaymentPhase = 'METHOD' | 'FALLBACK' | 'PAYID_TYPE' | 'PAYID_INPUT' | 'PROCESSING' | 'DONE';

export default function Step5_Payment({ clubId, onNext }: { clubId: string, onNext: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [phase, setPhase] = useState<PaymentPhase>('METHOD');
  const [localInput, setLocalInput] = useState('');
  
  // Data Capture
  const [payIdType, setPayIdType] = useState<'mobile' | 'email' | 'bank_account' | null>(null);
  const [payIdValue, setPayIdValue] = useState("");

  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', content: "Almost done! How would you like to collect fees from the squad mostly?" }
  ]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, content }]);
  };

  const handleMethodSelect = (method: string) => {
    addMessage('user', method);
    
    if (method === 'Square (Tap & Pay)') {
      setTimeout(() => {
        addMessage('assistant', "Awesome. You can connect your Square account in the Config settings later.\n\nIn the meantime, do you want to add a PayID or Bank Account as a fallback?");
        setPhase('FALLBACK');
      }, 500);
    } else if (method === 'PayID / Bank Transfer') {
      setTimeout(() => {
        addMessage('assistant', "Too easy. What's the best way for players to transfer you?");
        setPhase('PAYID_TYPE');
      }, 500);
    } else if (method === 'Cash') {
      setTimeout(() => {
        addMessage('assistant', "Cash is king! Give me a second to finalize your setup.");
        setPhase('PROCESSING');
        saveAndComplete(null, null);
      }, 500);
    }
  };

  const handleFallbackSelect = (wantsFallback: boolean) => {
    addMessage('user', wantsFallback ? 'Yes, add a fallback' : 'No, skip for now');
    if (wantsFallback) {
      setTimeout(() => {
        addMessage('assistant', "What's the best way for players to transfer you?");
        setPhase('PAYID_TYPE');
      }, 500);
    } else {
      setTimeout(() => {
        addMessage('assistant', "No worries, we will leave it blank for now. Wrapping things up...");
        setPhase('PROCESSING');
        saveAndComplete(null, null);
      }, 500);
    }
  };

  const handlePayIdTypeSelect = (typeLabel: string, typeValue: 'mobile' | 'email' | 'bank_account') => {
    setPayIdType(typeValue);
    addMessage('user', typeLabel);
    setTimeout(() => {
      addMessage('assistant', `Got it. Type the ${typeLabel} below.`);
      setPhase('PAYID_INPUT');
    }, 500);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim() || phase !== 'PAYID_INPUT') return;

    const input = localInput.trim();
    setPayIdValue(input);
    setLocalInput('');
    
    addMessage('user', input);
    setPhase('PROCESSING');
    
    setTimeout(() => {
      addMessage('assistant', "Locked in! Finalizing your organization setup now...");
      saveAndComplete(payIdType, input);
    }, 500);
  };

  const saveAndComplete = async (type: string | null, value: string | null) => {
    try {
      if (type && value) {
        await supabase.from('clubs').update({ 
          pay_id_type: type, 
          pay_id_value: value 
        }).eq('id', clubId);
      }
      
      setPhase('DONE');
      setTimeout(() => {
        addMessage('assistant', "All set! Let's get you over to the Dashboard. 🚀");
        setTimeout(() => {
          onNext();
        }, 1500);
      }, 1000);
    } catch (error) {
      console.error("Payment setup error:", error);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  return (
    <div className="flex flex-col h-full w-full font-sans bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-5 py-4 max-w-[90%] text-sm rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-none'}`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        
        {phase === 'METHOD' && (
          <div className="flex flex-col gap-2 w-full max-w-[80%]">
            <button onClick={() => handleMethodSelect('Square (Tap & Pay)')} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Square (Tap & Pay)</button>
            <button onClick={() => handleMethodSelect('PayID / Bank Transfer')} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">PayID / Bank Transfer</button>
            <button onClick={() => handleMethodSelect('Cash')} className="bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Cash Only</button>
          </div>
        )}

        {phase === 'FALLBACK' && (
          <div className="flex gap-2 w-full max-w-[80%]">
            <button onClick={() => handleFallbackSelect(true)} className="flex-1 bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold transition-colors">Yes, add fallback</button>
            <button onClick={() => handleFallbackSelect(false)} className="flex-1 bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold transition-colors">No, skip for now</button>
          </div>
        )}

        {phase === 'PAYID_TYPE' && (
          <div className="flex flex-col gap-2 w-full max-w-[80%]">
            <button onClick={() => handlePayIdTypeSelect('Mobile PayID', 'mobile')} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Mobile Number</button>
            <button onClick={() => handlePayIdTypeSelect('Email PayID', 'email')} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Email Address</button>
            <button onClick={() => handlePayIdTypeSelect('Bank Account Details', 'bank_account')} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Bank Account (BSB/ACC)</button>
          </div>
        )}

        {phase === 'PROCESSING' && (
          <div className="text-[10px] font-black uppercase text-emerald-600 animate-pulse">
            dAIve is saving your config...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            value={localInput} 
            onChange={(e) => setLocalInput(e.target.value)}
            disabled={phase !== 'PAYID_INPUT'}
            placeholder={
              phase === 'PAYID_INPUT' ? (payIdType === 'bank_account' ? "e.g. BSB: 123-456 ACC: 12345678" : "Type details here...") :
              phase === 'PROCESSING' || phase === 'DONE' ? "Finalizing setup..." : 
              "Please select an option above ⬆️"
            }
            className="flex-1 bg-zinc-100 border border-zinc-300 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button type="submit" disabled={!localInput.trim() || phase !== 'PAYID_INPUT'} className="w-14 h-[54px] bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50">
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}