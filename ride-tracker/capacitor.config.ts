import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ridetracker.app',
  appName: 'Ride Tracker',
  webDir: 'www',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#3880ff',
      sound: 'beep.wav'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
