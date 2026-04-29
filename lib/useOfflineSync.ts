// lib/useOfflineSync.ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // 1. Function to drain the queue
    const syncQueue = async () => {
      const queueStr = localStorage.getItem('fp_offline_tx_queue');
      if (!queueStr) return;

      const queue = JSON.parse(queueStr);
      if (queue.length === 0 || isSyncing) return;

      console.log(`📡 Heartbeat: Attempting to sync ${queue.length} offline transactions...`);
      setIsSyncing(true);

      try {
        const { error } = await supabase.from("transactions").insert(queue);
        
        if (!error) {
          console.log("✅ Sync Successful! Clearing local queue.");
          localStorage.removeItem('fp_offline_tx_queue');
        } else {
          throw error;
        }
      } catch (err) {
        console.warn("Sync failed (still offline or DB error). Will retry next pulse.");
      } finally {
        setIsSyncing(false);
      }
    };

    // 2. Set the Pulse (Every 30 seconds)
    const interval = setInterval(syncQueue, 30000);

    // 3. Instant Sync when browser regains focus or comes back online
    window.addEventListener('online', syncQueue);
    window.addEventListener('focus', syncQueue);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncQueue);
      window.removeEventListener('focus', syncQueue);
    };
  }, [isSyncing]);
}