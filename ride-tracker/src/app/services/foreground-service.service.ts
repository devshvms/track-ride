// src/app/services/foreground-service.service.ts
import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class ForegroundServiceService {
  private notificationId = 1000;
  private isServiceActive = false;

  async startForegroundService(
    distance: number = 0,
    duration: number = 0,
    speed: number = 0
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Foreground service not available on web');
      return;
    }

    try {
      // Request notification permissions if not already granted
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') {
          console.warn('Notification permission not granted');
          return;
        }
      }

      // Create notification channel for Android
      await this.createNotificationChannel();

      // Create ongoing notification for foreground service
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId,
            title: 'Ride Tracker Active',
            body: this.formatNotificationBody(distance, duration, speed),
            ongoing: true,
            autoCancel: false,
            silent: true,
            channelId: 'ride-tracking',
            extra: {
              foregroundService: true
            }
          }
        ]
      });

      this.isServiceActive = true;
      console.log('Foreground service started successfully');
    } catch (error) {
      console.error('Failed to start foreground service:', error);
    }
  }

  private async createNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await LocalNotifications.createChannel({
          id: 'ride-tracking',
          name: 'Ride Tracking',
          description: 'Shows ongoing ride tracking information',
          importance: 3, // Default importance
          visibility: 1, // Public
          sound: undefined,
          vibration: false
        });
      } catch (error) {
        console.error('Failed to create notification channel:', error);
      }
    }
  }

  async updateForegroundService(
    distance: number,
    duration: number,
    speed: number
  ): Promise<void> {
    if (!this.isServiceActive || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId,
            title: 'Ride Tracker Active',
            body: this.formatNotificationBody(distance, duration, speed),
            ongoing: true,
            autoCancel: false,
            silent: true,
            channelId: 'ride-tracking',
            extra: {
              foregroundService: true
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to update foreground service:', error);
    }
  }

  async stopForegroundService(): Promise<void> {
    if (!this.isServiceActive || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: this.notificationId }]
      });
      this.isServiceActive = false;
    } catch (error) {
      console.error('Failed to stop foreground service:', error);
    }
  }

  private formatNotificationBody(
    distance: number,
    duration: number,
    speed: number
  ): string {
    const distKm = (distance / 1000).toFixed(2);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const speedKmh = (speed * 3.6).toFixed(1);
    
    let timeStr = '';
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m`;
    } else {
      timeStr = `${minutes}m`;
    }

    return `${distKm} km • ${timeStr} • ${speedKmh} km/h`;
  }

  get isActive(): boolean {
    return this.isServiceActive;
  }
}
