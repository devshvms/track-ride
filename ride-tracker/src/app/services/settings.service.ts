import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from '../models/ride.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'ride_tracker_settings';

  private defaultSettings: AppSettings = {
    gpsAccuracy: 'high',
    readingInterval: 5,
    autoPause: {
      enabled: true,
      stationaryThreshold: 30,
      minSpeedThreshold: 0.55, // ~2 km/h
      pauseOnBackground: true,
      pauseOnGpsLost: true,
      gpsLostTimeout: 10000
    },
    units: 'km',
    syncWithGoogle: false
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(this.loadSettings());
  public settings$ = this.settingsSubject.asObservable();

  constructor() { }

  get currentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  /**
   * Loads settings from localStorage or returns defaults
   */
  private loadSettings(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle cases where new properties 
        // were added to the interface but aren't in the user's storage yet
        return { ...this.defaultSettings, ...parsed };
      } catch (e) {
        console.error('Failed to parse settings from storage', e);
        return this.defaultSettings;
      }
    }
    return this.defaultSettings;
  }

  /**
   * Updates specific settings and persists them
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.settingsSubject.value;
    const updated = { 
      ...current, 
      ...updates,
      // Handle nested autoPause updates correctly
      autoPause: updates.autoPause ? { ...current.autoPause, ...updates.autoPause } : current.autoPause
    };
    
    this.settingsSubject.next(updated);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  /**
   * Reset to factory defaults (useful for troubleshooting)
   */
  resetToDefaults(): void {
    this.updateSettings(this.defaultSettings);
  }
}
