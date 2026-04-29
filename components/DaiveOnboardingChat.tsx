"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';

type SetupPhase = 'ENTITY' | 'SPORT' | 'NAME' | 'PROCESSING' | 'DONE';

export default function DaiveOnboardingChat({ onComplete }: { onComplete?: (clubId: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [phase, setPhase] = useState<SetupPhase>('ENTITY');
  const [setupData, setSetupData] = useState({ isClub: true, sport: '', name: '' });
  
  const [localInput, setLocalInput] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', content: "G'day! I'm dAIve. Before we open up the dashboard, what are we setting up today?" }
  ]);

  const sportsList = [
    "AFL", "Cricket", "Indoor Cricket", "Soccer", "Futsal", "Netball", "Indoor Netball", 
    "Basketball", "Hockey", "Rugby League", "Rugby Union", 
    "Beach Volleyball", "Touch Football", "OzTag", "Other"
  ];

  const handleEntitySelect = (type: string, isClub: boolean) => {
    setSetupData(prev => ({ ...prev, isClub }));
    setMessages(prev => [
      ...prev, 
      { id: Date.now().toString(), role: 'user', content: type },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: type === 'Something else' 
        ? "No worries. What kind of event or activity are we setting up?" 
        : "Too easy. What sport are we playing?" }
    ]);
    setPhase('SPORT');
  };

  const handleSportSelect = (sport: string) => {
    setSetupData(prev => ({ ...prev, sport }));
    setMessages(prev => [
      ...prev, 
      { id: Date.now().toString(), role: 'user', content: sport },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: `Awesome. What's the actual name of the ${setupData.isClub ? 'club' : 'team'}?` }
    ]);
    setPhase('NAME');
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    const input = localInput.trim();
    setLocalInput('');

    if (phase === 'NAME') {
      setSetupData(prev => ({ ...prev, name: input }));
      
      const newMessages = [
        ...messages, 
        { id: Date.now().toString(), role: 'user', content: input }
      ];
      setMessages(newMessages);
      setPhase('PROCESSING');

      await executeSetup(input, setupData.isClub, setupData.sport);
    } 
  };

  const executeSetup = async (name: string, isClub: boolean, sport: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/chat/daive', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          action: 'EXECUTE_SETUP',
          data: { name, isClub, sport }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // --- THE MISSING HANDSHAKE ---
        // We now have the newly created clubId. Before we move to Step 2, 
        // we MUST tell the database that the current user is the boss!
        if (data.clubId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: roleError } = await supabase.from('user_roles').insert({
              user_id: user.id,
              email: user.email,
              club_id: data.clubId,
              role: 'club_admin' // <--- This grants permission for Step 2 and Step 3!
            });
            
            if (roleError) {
              console.error("Handshake Error: Could not assign admin role", roleError);
            } else {
              console.log("✅ Handshake complete: You are now the Club Admin!");
            }
          }
        }
        // -----------------------------

        setPhase('DONE');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Beauty, I've run that through the system! Let's get your branding sorted." }]);
        
        setTimeout(() => {
            if (onComplete && data.clubId) {
                onComplete(data.clubId);
            }
        }, 1500);

      } else {
         setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Ah mate, the server threw a wobbly." }]);
         setPhase('NAME');
      }
    } catch (err) { 
      setPhase('NAME'); 
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  return (
    <div className="flex flex-col h-full w-full font-sans bg-white border-4 border-emerald-500 rounded-lg overflow-hidden shadow-xl">
      
      {/* RESTORED HEADER! */}
      <div className="bg-emerald-600 p-6 flex items-center gap-4 text-white shrink-0">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
          <i className="fa-solid fa-robot text-xl"></i>
        </div>
        <div className="font-black italic uppercase tracking-tighter text-2xl leading-none">
          Setup Assistant <span className="text-[10px] not-italic opacity-50">v12.1</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-5 py-4 max-w-[90%] text-sm rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-none'}`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        
        {phase === 'ENTITY' && (
          <div className="flex flex-col gap-2 w-full max-w-[80%]">
            <button onClick={() => handleEntitySelect('A multi-team Club', true)} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">A local Club (Multiple teams)</button>
            <button onClick={() => handleEntitySelect('A single Team', false)} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">A single social Team</button>
            <button onClick={() => handleEntitySelect('Something else', false)} className="bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold text-left transition-colors">Something else (Event/Fundraiser)</button>
          </div>
        )}

        {phase === 'SPORT' && (
          <div className="flex flex-wrap gap-2 w-full max-w-[95%]">
            {sportsList.map(sport => (
              <button key={sport} onClick={() => handleSportSelect(sport)} className="bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-xl px-4 py-2 text-sm font-bold transition-colors">
                {sport}
              </button>
            ))}
          </div>
        )}

        {phase === 'PROCESSING' && (
          <div className="text-[10px] font-black uppercase text-emerald-600 animate-pulse">
            dAIve is locking in your settings...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            value={localInput} 
            onChange={(e) => setLocalInput(e.target.value)}
            disabled={phase !== 'NAME'}
            placeholder={
              phase === 'ENTITY' || phase === 'SPORT' ? "Please select an option above ⬆️" :
              phase === 'PROCESSING' || phase === 'DONE' ? "Moving to next step..." : 
              "Type the name here..."
            }
            className="flex-1 bg-zinc-100 border border-zinc-300 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button type="submit" disabled={!localInput.trim() || phase !== 'NAME'} className="w-14 h-[54px] bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50">
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}