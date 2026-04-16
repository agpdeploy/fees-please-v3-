export const forceAppUpdate = async () => {
  if (typeof window !== 'undefined') {
    // 1. Clear all cache storage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // 2. Unregister service workers (The PWA "sticky" brain)
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 3. Hard reload from server
    window.location.reload();
  }
};