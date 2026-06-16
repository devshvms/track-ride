// src/app/services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'ride_tracker_settings';

  private defaultSettings: AppSettings = {
    trackingMode: 'normal',       // normal mode by default
    readingInterval: 30,          // 30s default for normal mode
    units: 'km',
    theme: 'system',              // NEW
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
          ...parsed
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
      ...updates
    };
    this.settingsSubject.next(updated);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  resetToDefaults(): void {
    this.settingsSubject.next(this.defaultSettings);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.defaultSettings));
  }
}