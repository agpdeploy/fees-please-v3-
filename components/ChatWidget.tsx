"use client";

import { useState, useRef, useEffect } from "react";
import { useActiveClub } from "@/contexts/ClubContext";
import { useProfile } from "@/lib/useProfile";
import ReactMarkdown from 'react-markdown';

type Message = { id: string; role: 'user' | 'assistant'; content: string; logId?: string; rating?: 1 | -1 };

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "I'm **dAIve 1.0**. I can help you onboard, check the ledger, and pull fixture data.\n\nWhat do you need a hand with?"
};

const QUICK_PROMPTS = ["How do I set up my club?", "How much money have we collected?", "When is our next game?"];
const THINKING_STATES = ["Analyzing request...", "Searching the manual...", "Checking ledger...", "Formatting response..."];

export default function ChatWidget({ teamId, onClose }: { teamId?: string; onClose?: () => void }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState(THINKING_STATES[0]);
  
  const { activeClubId } = useActiveClub();
  const { profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_STATES.length;
      setThinkingText(THINKING_STATES[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    setText(""); 
    setIsLoading(true);

    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', content: messageText }];
    setMessages(newMessages);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          clubId: activeClubId || profile?.club_id || "Unknown",
          teamId: teamId || "Unknown",
          userId: profile?.id || "Unknown" 
        }),
      });
      const data = await response.json();
      setMessages((prev) => prev.map((msg) => 
        msg.id === assistantMessageId ? { ...msg, content: data.text, logId: data.logId } : msg
      ));
    } catch (err) {
      setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? { ...msg, content: "System error, mate." } : msg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-950 font-sans shadow-2xl">
      {/* HEADER */}
      <div className="bg-emerald-600 p-4 flex justify-between items-center text-white shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30 shadow-inner">
            <i className="fa-solid fa-robot text-lg"></i>
          </div>
          <div className="flex flex-col">
            <div className="font-black italic uppercase tracking-tighter text-lg leading-none">
              dAIve <span className="text-emerald-200 text-xs font-medium tracking-normal not-italic opacity-80">1.0</span>
            </div>
            <div className="text-[10px] text-emerald-100 font-medium uppercase tracking-widest mt-0.5">Tactical Support</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-chevron-down"></i>
          </button>
        )}
      </div>

      {/* CHAT AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-[#0a0a0a]">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-3 max-w-[90%] text-sm rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'}`}>
               <div className={`prose prose-sm max-w-none ${m.role === 'user' ? 'text-white prose-headings:text-white prose-strong:text-white prose-a:text-white' : 'dark:prose-invert prose-emerald'}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
               </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 animate-pulse flex items-center gap-2">
            <i className="fa-solid fa-circle-notch fa-spin"></i> {thinkingText}
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(text); }} className="flex gap-2">
          <input
            ref={inputRef}
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask dAIve..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-colors"
          />
          <button type="submit" disabled={isLoading || !text.trim()} className="w-12 h-[46px] bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-30">
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}