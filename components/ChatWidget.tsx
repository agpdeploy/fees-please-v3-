"use client";

import { useState, useRef, useEffect } from "react";
import { useActiveClub } from "@/contexts/ClubContext";
import { useProfile } from "@/lib/useProfile";
import ReactMarkdown from 'react-markdown';

// Added logId and rating to track feedback state
type Message = { id: string; role: 'user' | 'assistant'; content: string; logId?: string; rating?: 1 | -1 };

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "G'day! I'm **dAIve 1.0**. I can help you with getting onboarded, answering questions about your club, and managing your ledger stuff.\n\nWhat can I give you a hand with today?"
};

const QUICK_PROMPTS = [
  "How do I set up my club?",
  "How much money have we collected?",
  "When is our next game?"
];

export default function ChatWidget({ teamId }: { teamId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { activeClubId } = useActiveClub();
  const { profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen]);

  const handleFeedback = async (messageId: string, logId: string | undefined, rating: 1 | -1) => {
    if (!logId) return;

    // Optimistically update the UI so the user sees their vote immediately
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
      const responseText = data.text || data.message || "Sorry mate, I couldn't process that.";
      const logId = data.logId; // Capture the newly created ai_logs ID

      setMessages((prev) => prev.map((msg) => 
        msg.id === assistantMessageId ? { ...msg, content: responseText, logId } : msg
      ));

    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages((prev) => 
        prev.map((msg) => msg.id === assistantMessageId ? { ...msg, content: "Sorry mate, the line dropped. Try again." } : msg)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-[99999]"
      >
        <i className="fa-solid fa-robot text-xl"></i>
      </button>
    );
  }

  return (
    <div className="fixed bottom-32 right-6 w-[350px] h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col z-[99999] overflow-hidden animate-in slide-in-from-bottom-4 font-sans">
      
      {/* HEADER WITH AVATAR */}
      <div className="bg-emerald-600 p-4 flex justify-between items-center text-white shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30 shadow-inner">
            <i className="fa-solid fa-robot text-sm"></i>
          </div>
          <div className="flex flex-col">
            <div className="font-black italic uppercase tracking-tighter text-lg leading-none">
              dAIve <span className="text-emerald-200 text-xs font-medium tracking-normal not-italic opacity-80">1.0</span>
            </div>
            <div className="text-[10px] text-emerald-100 font-medium uppercase tracking-widest mt-0.5">Grassroots Mate</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors"><i className="fa-solid fa-xmark"></i></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-[#0a0a0a]">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col group ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.content && (
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-bl-sm'}`}>
                {/* TS FIX: Wrapping ReactMarkdown in a div that holds the classes */}
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
                  className={`hover:scale-110 transition-transform ${m.rating === 1 ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-500 hover:text-emerald-500'}`}
                  title="Good response"
                >
                  <i className="fa-solid fa-thumbs-up text-xs"></i>
                </button>
                <button 
                  onClick={() => handleFeedback(m.id, m.logId, -1)} 
                  className={`hover:scale-110 transition-transform ${m.rating === -1 ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500 hover:text-red-500'}`}
                  title="Poor response"
                >
                  <i className="fa-solid fa-thumbs-down text-xs"></i>
                </button>
              </div>
            )}
          </div>
        ))}

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

        {/* GEMINI STYLE THINKING STATE */}
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 p-2 text-[11px] font-semibold uppercase tracking-wider animate-pulse">
             <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 dark:text-emerald-500"></i>
             dAIve is thinking...
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask dAIve..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 font-sans"
          />
          <button 
            type="submit" 
            disabled={isLoading || !text.trim()}
            className="w-12 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-30 cursor-pointer shadow-sm active:scale-95 transition-all"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}