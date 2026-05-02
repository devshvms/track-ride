// src/app/services/background-geolocation.service.ts
import { Injectable } from '@angular/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { GpsPoint } from '../models/ride.model';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface BackgroundGeolocationConfig {
  distanceFilter?: number; // Minimum distance (meters) before update
  stale?: boolean; // Allow stale locations
  backgroundMessage?: string;
  backgroundTitle?: string;
}

@Injectable({ providedIn: 'root' })
export class BackgroundGeolocationService {
  private watcherId: string | null = null;
  private isTracking = false;

  /**
   * Start background GPS tracking with a callback for location updates.
   * This uses a true Android foreground service that prevents the app from being killed.
   */
  async startTracking(
    callback: (point: GpsPoint) => void,
    config: BackgroundGeolocationConfig = {}
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('Background geolocation only works on native platforms');
      return;
    }

    if (this.isTracking) {
      console.warn('Background geolocation already tracking');
      return;
    }

    try {
      // Default configuration
      const defaultConfig: BackgroundGeolocationConfig = {
        distanceFilter: 0, // Update on every location change (we'll filter in app)
        stale: false, // Don't use stale/cached locations
        backgroundMessage: 'Tracking your ride - tap to return to app',
        backgroundTitle: 'Ride Tracker Active',
        ...config
      };

      console.log('Starting background geolocation with config:', defaultConfig);

      // Add watcher - this creates the foreground service
      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: defaultConfig.backgroundMessage!,
          backgroundTitle: defaultConfig.backgroundTitle!,
          requestPermissions: true,
          stale: defaultConfig.stale!,
          distanceFilter: defaultConfig.distanceFilter!
        },
        (location: any, error: any) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              console.error('Background location permission not granted');
            } else {
              console.error('Background GPS error:', error);
            }
            return;
          }

          if (location) {
            // Convert to our GpsPoint format
            const point: GpsPoint = {
              latitude: location.latitude,
              longitude: location.longitude,
              altitude: location.altitude ?? undefined,
              accuracy: location.accuracy ?? 0,
              speed: location.speed ?? 0,
              timestamp: location.time ?? Date.now()
            };

            // Call the callback with the GPS point
            callback(point);
          }
        }
      );

      this.isTracking = true;
      console.log('Background geolocation started successfully with watcher ID:', this.watcherId);
    } catch (error) {
      console.error('Failed to start background geolocation:', error);
      throw error;
    }
  }

  /**
   * Stop background GPS tracking and remove the foreground service.
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking || !this.watcherId) {
      console.warn('Background geolocation not tracking');
      return;
    }

    try {
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
      this.isTracking = false;
      console.log('Background geolocation stopped successfully');
    } catch (error) {
      console.error('Failed to stop background geolocation:', error);
      throw error;
    }
  }

  /**
   * Open Android settings to allow user to disable battery optimization.
   * This is important for reliable background tracking.
   */
  async requestBatteryOptimizationExemption(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      await BackgroundGeolocation.openSettings();
      console.log('Opened battery optimization settings');
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  }

  /**
   * Check if background geolocation is currently tracking.
   */
  get isActive(): boolean {
    return this.isTracking;
  }
}
