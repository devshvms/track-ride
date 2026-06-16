// src/app/services/power-management.service.ts
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

declare const cordova: any;

@Injectable({ providedIn: 'root' })
export class PowerManagementService {
  private wakeLockActive = false;

  /**
   * Request to disable battery optimization for the app.
   * This is critical for background GPS tracking on Android.
   */
  async requestBatteryOptimizationExemption(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      // Use Capacitor's native bridge to request battery optimization exemption
      const { value } = await Capacitor.isPluginAvailable('PowerManagement') 
        ? await this.checkBatteryOptimization()
        : { value: false };

      if (!value) {
        console.log('Requesting battery optimization exemption...');
        // This will open Android settings for the user to manually disable battery optimization
        await this.openBatteryOptimizationSettings();
      }
    } catch (error) {
      console.error('Failed to request battery optimization exemption:', error);
    }
  }

  /**
   * Acquire a wake lock to keep CPU running during ride tracking.
   * This prevents the device from entering deep sleep and killing GPS.
   */
  async acquireWakeLock(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (this.wakeLockActive) {
      console.log('Wake lock already active');
      return;
    }

    try {
      // For Android, use Cordova PowerManagement plugin if available
      if (typeof cordova !== 'undefined' && cordova.plugins?.powerManagement) {
        await new Promise<void>((resolve, reject) => {
          cordova.plugins.powerManagement.acquire(
            () => {
              this.wakeLockActive = true;
              console.log('Wake lock acquired');
              resolve();
            },
            (error: any) => {
              console.error('Failed to acquire wake lock:', error);
              reject(error);
            }
          );
        });
      } else {
        // Fallback: Use native WakeLock API if available (modern browsers/PWA)
        if ('wakeLock' in navigator) {
          try {
            await (navigator as any).wakeLock.request('screen');
            this.wakeLockActive = true;
            console.log('Wake lock acquired (native API)');
          } catch (err) {
            console.warn('Wake lock request failed:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
    }
  }

  /**
   * Release the wake lock when ride tracking stops.
   */
  async releaseWakeLock(): Promise<void> {
    if (!this.wakeLockActive) {
      return;
    }

    try {
      if (typeof cordova !== 'undefined' && cordova.plugins?.powerManagement) {
        await new Promise<void>((resolve, reject) => {
          cordova.plugins.powerManagement.release(
            () => {
              this.wakeLockActive = false;
              console.log('Wake lock released');
              resolve();
            },
            (error: any) => {
              console.error('Failed to release wake lock:', error);
              reject(error);
            }
          );
        });
      }
    } catch (error) {
      console.error('Failed to release wake lock:', error);
    }
  }

  private async checkBatteryOptimization(): Promise<{ value: boolean }> {
    // This would need a native plugin implementation
    // For now, return false to always show the prompt
    return { value: false };
  }

  private async openBatteryOptimizationSettings(): Promise<void> {
    // This would need a native plugin to open Android settings
    // For now, just log the instruction
    console.warn(
      'Please disable battery optimization for this app in Android Settings:\n' +
      'Settings > Apps > Ride Tracker > Battery > Unrestricted'
    );
  }

  get isWakeLockActive(): boolean {
    return this.wakeLockActive;
  }
}
