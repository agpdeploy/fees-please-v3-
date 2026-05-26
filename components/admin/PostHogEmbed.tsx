"use client";
import { useState, useEffect } from "react";

export default function PostHogEmbed() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Read from env var
    const url = process.env.NEXT_PUBLIC_POSTHOG_EMBED_URL;
    if (url) {
      setEmbedUrl(url);
    }
  }, []);

  if (!embedUrl) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center mb-6">
          <i className="fa-solid fa-chart-pie text-3xl text-orange-500"></i>
        </div>
        <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-2">
          PostHog Analytics
        </h3>
        <p className="text-sm text-zinc-500 max-w-md">
          To view your platform analytics here, please add your PostHog Shared Dashboard URL to the <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs">NEXT_PUBLIC_POSTHOG_EMBED_URL</code> environment variable.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm h-full min-h-[600px] flex flex-col">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
        <h2 className="font-black uppercase tracking-widest text-sm text-zinc-900 dark:text-white flex items-center gap-3">
          <i className="fa-solid fa-chart-pie text-orange-500"></i>
          Platform Behavior
        </h2>
        <a href={embedUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
          Open in PostHog <i className="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
      <div className="flex-1 w-full relative">
        <iframe 
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          title="PostHog Analytics Dashboard"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
