// src/app/services/permissions.service.ts
import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt';
  notifications: 'granted' | 'denied' | 'prompt';
}

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private permissionStatus = new BehaviorSubject<PermissionStatus>({
    location: 'prompt',
    notifications: 'prompt'
  });
  public permissionStatus$ = this.permissionStatus.asObservable();

  /**
   * Request all required permissions on app startup.
   * Should be called from AppComponent initialization.
   */
  async requestAllPermissions(): Promise<PermissionStatus> {
    const status: PermissionStatus = {
      location: 'prompt',
      notifications: 'prompt'
    };

    // Request location permission
    status.location = await this.requestLocationPermission();

    // Request notification permission (only on native platforms)
    if (Capacitor.isNativePlatform()) {
      status.notifications = await this.requestNotificationPermission();
    } else {
      status.notifications = 'granted'; // Web doesn't need explicit permission for local notifications
    }

    this.permissionStatus.next(status);
    return status;
  }

  /**
   * Request location permission with high accuracy for GPS tracking.
   */
  async requestLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    // For web, use browser's geolocation API directly
    if (!Capacitor.isNativePlatform()) {
      return this.requestWebLocationPermission();
    }

    // For native platforms, use Capacitor Geolocation plugin
    try {
      const currentStatus = await Geolocation.checkPermissions();
      
      if (currentStatus.location === 'granted' || currentStatus.coarseLocation === 'granted') {
        return 'granted';
      }

      const result = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation']
      });

      if (result.location === 'granted' || result.coarseLocation === 'granted') {
        return 'granted';
      }

      return 'denied';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return 'denied';
    }
  }

  /**
   * Request location permission for web browsers.
   */
  private async requestWebLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return 'denied';
    }

    try {
      // Trigger browser permission prompt by requesting position
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });
      return 'granted';
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if (geoError.code === GeolocationPositionError.PERMISSION_DENIED) {
        console.error('Location permission denied by user');
        return 'denied';
      }
      // Timeout or position unavailable - permission might still be granted
      console.warn('Geolocation error:', geoError.message);
      return 'prompt';
    }
  }

  /**
   * Request notification permission for background tracking alerts.
   */
  async requestNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!Capacitor.isNativePlatform()) {
      return 'granted';
    }

    try {
      const currentStatus = await LocalNotifications.checkPermissions();
      
      if (currentStatus.display === 'granted') {
        return 'granted';
      }

      const result = await LocalNotifications.requestPermissions();
      
      if (result.display === 'granted') {
        return 'granted';
      }

      return 'denied';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Check if all required permissions are granted.
   */
  async checkAllPermissions(): Promise<PermissionStatus> {
    const status: PermissionStatus = {
      location: 'prompt',
      notifications: 'prompt'
    };

    if (Capacitor.isNativePlatform()) {
      // Native platform - use Capacitor plugins
      try {
        const locationStatus = await Geolocation.checkPermissions();
        status.location = (locationStatus.location === 'granted' || locationStatus.coarseLocation === 'granted') 
          ? 'granted' 
          : 'denied';
      } catch {
        status.location = 'denied';
      }

      try {
        const notifStatus = await LocalNotifications.checkPermissions();
        status.notifications = notifStatus.display === 'granted' ? 'granted' : 'denied';
      } catch {
        status.notifications = 'denied';
      }
    } else {
      // Web - check using Permissions API if available
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          status.location = result.state === 'granted' ? 'granted' : 
                           result.state === 'denied' ? 'denied' : 'prompt';
        } catch {
          status.location = 'prompt';
        }
      } else {
        status.location = 'prompt';
      }
      status.notifications = 'granted';
    }

    this.permissionStatus.next(status);
    return status;
  }

  /**
   * Get current permission status without requesting.
   */
  get currentStatus(): PermissionStatus {
    return this.permissionStatus.value;
  }
}
