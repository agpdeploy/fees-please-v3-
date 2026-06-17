"use client";

import { useEffect, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Login from "@/components/Login";
import { getReferrerName } from "./actions";

function RegisterLogic() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    if (ref) {
      // Set a cookie that expires in 30 days
      document.cookie = `fees_please_ref=${ref}; path=/; max-age=${60 * 60 * 24 * 30}`;

      const fetchReferrer = async () => {
        const name = await getReferrerName(ref);
        if (name) {
          setReferrerName(name);
        }
      };

      fetchReferrer();
    }
  }, [ref]);

  return (
    <div className="relative">
      {referrerName && (
        <div className="absolute top-0 left-0 w-full z-50 bg-emerald-500/90 backdrop-blur-md border-b border-emerald-400 text-white text-center py-4 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 animate-in slide-in-from-top-full duration-500">
          <i className="fa-solid fa-gift text-emerald-100 text-sm"></i>
          <span>
            You've been referred by {referrerName}! <br className="sm:hidden" />
            <span className="font-medium opacity-90 tracking-wide text-[9px] sm:text-[10px] ml-0 sm:ml-2">
              When you play 2 games or join our plus plan, they will get a bonus.
            </span>
          </span>
        </div>
      )}
      <Login />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-3xl"></i></div>}>
      <RegisterLogic />
    </Suspense>
  );
}
