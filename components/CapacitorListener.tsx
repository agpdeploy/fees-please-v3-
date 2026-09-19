'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function CapacitorListener() {
  const router = useRouter();

  useEffect(() => {
    // Dynamically import Capacitor only on the client inside useEffect
    // This prevents Vercel Server-Side Rendering (SSR) from crashing
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;

      import('@capacitor/app').then(({ App: CapacitorApp }) => {
        const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url);
            
            // Handle both https://.../auth/callback and feesplease://callback
            if (url.pathname.includes('/auth/callback') || url.host === 'callback') {
              const search = url.search || '';
              const hash = url.hash || '';
              const path = '/auth/callback' + search + hash;
              
              router.push(path);
            }
          } catch (err) {
            console.error('Failed to parse appUrlOpen', err);
          }
        });

        // Cleanup when unmounted
        return () => {
          listener.then(l => l.remove());
        };
      });
    });
  }, [router]);

  return null;
}
