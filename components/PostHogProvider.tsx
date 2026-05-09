'use client'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Grab the variables first
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (typeof window !== 'undefined') {
      // Only initialize if the key actually exists
      if (posthogKey) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          person_profiles: 'identified_only',
          capture_pageview: false 
        });
      } else {
        // Give a helpful warning instead of crashing the app
        console.warn('⚠️ PostHog tracking is disabled: NEXT_PUBLIC_POSTHOG_KEY is missing.');
      }
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}