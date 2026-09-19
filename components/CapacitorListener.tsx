'use client';
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export function CapacitorListener() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        
        // Handle both https://.../auth/callback and feesplease://callback
        if (url.pathname.includes('/auth/callback') || url.host === 'callback') {
          // Construct the relative path with search params and hash
          const search = url.search || '';
          const hash = url.hash || '';
          const path = '/auth/callback' + search + hash;
          
          router.push(path);
        }
      } catch (err) {
        console.error('Failed to parse appUrlOpen', err);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [router]);

  return null;
}
