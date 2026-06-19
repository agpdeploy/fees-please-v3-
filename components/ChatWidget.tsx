"use client";

import { useState, useRef, useEffect } from "react";
import { useActiveClub } from "@/contexts/ClubContext";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from 'react-markdown';

type Attachment = { name: string; url: string; path: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; logId?: string; rating?: 1 | -1; attachments?: Attachment[] };


const QUICK_PROMPTS = ["Can you help me get started?", "How much money have we collected?", "When is our next game?"];

export default function ChatWidget({ teamId, onClose }: { teamId?: string; onClose?: () => void }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const { activeClubId } = useActiveClub();
  const { profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `daive_chat_${activeClubId || 'default'}_${profile?.id || 'anon'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) { }
    } else {
      setMessages([{ id: '1', role: 'assistant', content: 'Hey there! I’m dAIve, your team’s personal tactical support assistant. I’m here to help you navigate the system, set up your club, manage payments and ledger, and pull fixture data.\nWhat do you need a hand with?' }]);
    }
  }, [activeClubId, profile?.id]);

  useEffect(() => {
    const key = `daive_chat_${activeClubId || 'default'}_${profile?.id || 'anon'}`;
    if (messages.length > 1) {
      localStorage.setItem(key, JSON.stringify(messages));
    }
  }, [messages, activeClubId, profile?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (activeClubId) formData.append('clubId', activeClubId);

      const response = await fetch('/api/upload-attachment', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.path) {
        setAttachments(prev => [...prev, { name: data.name, url: data.url, path: data.path }]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRate = async (msgId: string, logId: string | undefined, rating: 1 | -1) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating } : m));
    
    if (!logId) return;
    
    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, rating })
      });
    } catch (error) {
      console.error("Failed to submit rating", error);
    }
  };

  const sendMessage = async (messageText: string) => {
    if ((!messageText.trim() && attachments.length === 0) || isLoading) return;
    const messageAttachments = [...attachments];
    setText(""); 
    setAttachments([]);
    setIsLoading(true);

    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', content: messageText, attachments: messageAttachments }];
    setMessages(newMessages);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content, attachments: m.attachments })),
          clubId: activeClubId || profile?.club_id || "Unknown",
          teamId: teamId || "Unknown",
          userId: profile?.id || "Unknown" 
        }),
      });
      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error("Parse error:", e);
        throw new Error("Server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data.text || data.error || "Server error");
      }

      setMessages((prev) => prev.map((msg) => 
        msg.id === assistantMessageId ? { ...msg, content: data.text, logId: data.logId } : msg
      ));
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? { ...msg, content: `System error, mate: ${err.message}` } : msg));
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
              dAIve
            </div>
            <div className="text-[10px] text-emerald-100 font-medium uppercase tracking-widest mt-0.5">Tactical Support</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              setMessages([{ id: '1', role: 'assistant', content: 'Hey there! I’m dAIve, your team’s personal tactical support assistant. I’m here to help you navigate the system, set up your account, manage payments and ledger, and pull fixture data. What do you need a hand with?' }]);
              localStorage.removeItem(`daive_chat_${activeClubId || 'default'}_${profile?.id || 'anon'}`);
            }}
            title="Reset Chat"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-emerald-100"
          >
            <i className="fa-solid fa-rotate-right"></i>
          </button>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <i className="fa-solid fa-chevron-down"></i>
            </button>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-[#0a0a0a]">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
             <div className={m.content === '' ? 'py-2 px-1' : `px-4 py-3 max-w-[90%] text-sm rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'}`}>
               <div className={`prose prose-sm max-w-none ${m.role === 'user' ? 'text-white prose-headings:text-white prose-strong:text-white prose-a:text-white' : 'dark:prose-invert prose-emerald'}`}>
                  {m.content === '' ? (
                    <div className="flex items-center text-zinc-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-lg"></i>
                    </div>
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {m.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-black/20 rounded-md text-[10px] flex items-center gap-1 hover:bg-black/30 transition-colors">
                          <i className="fa-solid fa-paperclip"></i> {att.name}
                        </a>
                      ))}
                    </div>
                  )}
               </div>
            </div>
            {m.role === 'assistant' && m.content !== '' && m.id !== 'welcome' && (
               <div className="flex gap-3 mt-1.5 px-2 text-zinc-400">
                 <button onClick={() => handleRate(m.id, m.logId, 1)} className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-emerald-500 transition-colors ${m.rating === 1 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                   <i className="fa-solid fa-thumbs-up text-sm"></i>
                 </button>
                 <button onClick={() => handleRate(m.id, m.logId, -1)} className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-rose-500 transition-colors ${m.rating === -1 ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : ''}`}>
                   <i className="fa-solid fa-thumbs-down text-sm"></i>
                 </button>
               </div>
            )}
          </div>
        ))}
      </div>

      {/* QUICK PROMPTS */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-3 bg-zinc-50 dark:bg-[#0a0a0a] flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button 
              key={prompt} 
              onClick={() => sendMessage(prompt)}
              className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-lg shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* INPUT AREA */}
      <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(text); }} className="flex flex-col gap-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {attachments.map((att, i) => (
                <div key={i} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                  <i className="fa-solid fa-paperclip"></i> {att.name}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label className={`w-12 shrink-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
              {isUploading ? <i className="fa-solid fa-circle-notch fa-spin text-zinc-400"></i> : <i className="fa-solid fa-paperclip text-zinc-500"></i>}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
            <input
              ref={inputRef}
              value={text} 
              onChange={(e) => setText(e.target.value)}
              placeholder="Get Help..."
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-colors"
            />
            <button type="submit" disabled={isLoading || (!text.trim() && attachments.length === 0)} className="w-12 shrink-0 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
        </form>
        <div className="text-center mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
          dAIve is an AI assistant and may make mistakes.
        </div>
      </div>
    </div>
  );
}