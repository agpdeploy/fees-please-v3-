'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function CapacitorListener() {
  const router = useRouter();

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;

      import('@capacitor/app').then(({ App: CapacitorApp }) => {
        const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url);
            
            // Supabase OAuth Callback
            if (url.pathname.includes('/auth/callback') || url.host === 'callback') {
              const search = url.search || '';
              const hash = url.hash || '';
              const path = '/auth/callback' + search + hash;
              router.push(path);
            }
            // Any other intercepted App Link (like Square OAuth)
            else {
              import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => {}));
              // Navigate the internal WebView to process the route (e.g. API callbacks)
              window.location.href = url.pathname + url.search + url.hash;
            }
          } catch (err) {
            console.error('Failed to parse appUrlOpen', err);
          }
        });

        return () => {
          listener.then(l => l.remove());
        };
      });
    });
  }, [router]);

  return null;
}
