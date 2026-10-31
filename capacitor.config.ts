  import type { CapacitorConfig } from '@capacitor/cli';

  const config: CapacitorConfig = {
    appId: 'com.trainext.app',
    appName: 'TraiNext',
    webDir: 'dist',
    server: {
      androidScheme: 'https'
    }
  };

  export default config;