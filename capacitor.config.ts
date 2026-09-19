import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || 'https://kings-durango.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.kingsdurango.app',
  appName: 'kings-durango',
  webDir: 'public',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),
};

export default config;
