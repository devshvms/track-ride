// src/app/services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'ride_tracker_settings';

  private defaultSettings: AppSettings = {
    gpsAccuracy: 'high',
    readingInterval: 5, // seconds
    autoPause: {
      enabled: true,
      stationaryThreshold: 30,    // seconds
      minSpeedThreshold: 0.55,    // m/s (~2 km/h)
      pauseOnBackground: true,
      pauseOnGpsLost: true,
      gpsLostTimeout: 60          // FIX: was 10000 (ms confused as seconds) — now 60 seconds
    },
    units: 'km',
    theme: 'system',              // NEW
    mapType: 'street',            // NEW
    pushNotifications: true,      // NEW
    syncWithGoogle: false
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(this.loadSettings());
  public settings$ = this.settingsSubject.asObservable();

  get currentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  private loadSettings(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        return {
          ...this.defaultSettings,
          ...parsed,
          autoPause: {
            ...this.defaultSettings.autoPause,
            ...(parsed.autoPause ?? {})
          }
        };
      } catch {
        return this.defaultSettings;
      }
    }
    return this.defaultSettings;
  }

  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.settingsSubject.value;
    const updated: AppSettings = {
      ...current,
      ...updates,
      autoPause: updates.autoPause
        ? { ...current.autoPause, ...updates.autoPause }
        : current.autoPause
    };
    this.settingsSubject.next(updated);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  resetToDefaults(): void {
    this.settingsSubject.next(this.defaultSettings);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.defaultSettings));
  }
}