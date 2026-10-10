import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.preppilot.nimcet2027',
  appName: 'PrepPilot — NIMCET 2027',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    // Custom MobileFocusLock plugin bridge configuration
  },
};

export default config;
