"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 opacity-0" />; // Invisible placeholder

  return (
    <div className="flex items-center justify-between p-1 rounded-xl bg-zinc-200/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800">
      <button
        onClick={() => setTheme("light")}
        className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${
          theme === "light" 
            ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" 
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
        title="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => setTheme("system")}
        className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${
          theme === "system" 
            ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" 
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
        title="System Preference"
      >
        <Monitor className="w-4 h-4" />
      </button>

      <button
        onClick={() => setTheme("dark")}
        className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${
          theme === "dark" 
            ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" 
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
        title="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}