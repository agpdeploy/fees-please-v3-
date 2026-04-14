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

const QUICK_PROMPTS = [
  "How do I set up my club?",
  "How much money have we collected?",
  "When is our next game?"
];

// Rotating statuses to make the wait feel active
const THINKING_STATES = [
  "Analyzing request...",
  "Searching the technical manual...",
  "Checking the ledger...",
  "Querying database...",
  "Formatting response..."
];

export default function ChatWidget({ teamId, onClose }: { teamId?: string; onClose?: () => void }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState(THINKING_STATES[0]);
  
  const { activeClubId } = useActiveClub();
  const { profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // Dynamic Thinking State Cycler
  useEffect(() => {
    if (!isLoading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_STATES.length;
      setThinkingText(THINKING_STATES[i]);
    }, 1800); // Change text every 1.8 seconds
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleFeedback = async (messageId: string, logId: string | undefined, rating: 1 | -1) => {
    if (!logId) return;
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, rating } : m));
    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, rating }),
      });
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    setText(""); 
    setIsLoading(true);
    setThinkingText(THINKING_STATES[0]); // Reset to first state

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

      if (!response.ok) throw new Error("SERVER_ERROR");

      const data = await response.json();
      const responseText = data.text || data.message || "I hit a snag. Let's try that again.";
      const logId = data.logId;

      setMessages((prev) => prev.map((msg) => 
        msg.id === assistantMessageId ? { ...msg, content: responseText, logId } : msg
      ));

    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages((prev) => 
        prev.map((msg) => msg.id === assistantMessageId ? { ...msg, content: "System error. Try refreshing." } : msg)
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-zinc-50 dark:bg-[#0a0a0a]">
      
      {/* HEADER WITH AVATAR AND CLOSE BUTTON */}
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
        {/* CLOSE BUTTON - Allows swipe down/dismiss behavior */}
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-chevron-down"></i>
          </button>
        )}
      </div>

      {/* CHAT AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col group ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.content && (
              <div className={`px-4 py-3 max-w-[90%] text-sm rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'}`}>
                {/* FIX: Moved the prose classes to a parent div instead of the ReactMarkdown tag */}
                <div className={`prose prose-sm max-w-none ${m.role === 'user' ? 'text-white prose-headings:text-white prose-strong:text-white prose-a:text-white' : 'dark:prose-invert prose-emerald'}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            )}
            
            {/* The Feedback UI */}
            {m.role === 'assistant' && m.id !== 'welcome' && !isLoading && m.logId && (
              <div className={`flex gap-3 mt-1 px-2 transition-opacity duration-200 ${m.rating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  onClick={() => handleFeedback(m.id, m.logId, 1)} 
                  className={`hover:scale-110 transition-transform ${m.rating === 1 ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-600 hover:text-emerald-500'}`}
                >
                  <i className="fa-solid fa-thumbs-up text-xs"></i>
                </button>
                <button 
                  onClick={() => handleFeedback(m.id, m.logId, -1)} 
                  className={`hover:scale-110 transition-transform ${m.rating === -1 ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-600 hover:text-red-500'}`}
                >
                  <i className="fa-solid fa-thumbs-down text-xs"></i>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* QUICK PROMPTS */}
        {messages.length === 1 && !isLoading && (
          <div className="flex flex-col gap-2 mt-4 items-start">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button 
                key={i}
                onClick={() => sendMessage(prompt)}
                className="text-left text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* DYNAMIC THINKING STATE */}
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 p-2 text-[11px] font-semibold uppercase tracking-wider animate-pulse">
             <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 dark:text-emerald-500"></i>
             {thinkingText}
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask dAIve..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
          />
          <button 
            type="submit" 
            disabled={isLoading || !text.trim()}
            className="w-12 h-[46px] bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-30 cursor-pointer shadow-sm active:scale-95 transition-all"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}