import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.feesplease.app',
  appName: 'Fees Please',
  webDir: 'public',
  server: {
    // During local dev, this points to your localhost. 
    // Before building for production, update this to your live production URL (e.g., https://feesplease.app)
    url: 'http://192.168.1.107:3000',
    cleartext: true
  }
};

export default config;
