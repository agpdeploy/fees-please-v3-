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
      // event.url will be something like https://fees-please-v3.../auth/callback#access_token=...
      const url = new URL(event.url);
      
      // If it's a callback URL from our App Link
      if (url.pathname.includes('/auth/callback')) {
        // Construct the relative path with hash
        const path = ${url.pathname};
        router.push(path);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [router]);

  return null;
}
