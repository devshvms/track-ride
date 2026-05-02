// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { GpsPoint, IntervalPreset } from '../models/ride.model';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private locationSubject = new Subject<GpsPoint>();
  public location$ = this.locationSubject.asObservable();

  private errorSubject = new Subject<GeolocationPositionError>();
  public error$ = this.errorSubject.asObservable();

  private settingsSub: Subscription | null = null;
  private currentInterval: IntervalPreset = 30;
  private currentAccuracy: 'high' | 'balanced' | 'low' = 'high';
  private isTracking = false;

  constructor(private settings: SettingsService) {}

  /**
   * Starts GPS tracking with explicit intervals.
   * Uses setInterval() with getCurrentPosition() for reliable, predictable location updates.
   * Interval presets: 10s, 30s, 1min, 5min based on tracking mode.
   */
  startTracking(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported.');
      return;
    }

    if (this.isTracking) {
      console.warn('Tracking already active - ignoring duplicate start request');
      return;
    }

    this.isTracking = true;
    
    // Clean up any existing subscriptions/intervals first
    if (this.settingsSub) {
      this.settingsSub.unsubscribe();
      this.settingsSub = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Start with current settings first
    this.startWithCurrentSettings();
    
    // Then subscribe to settings changes (skip first emission since we just started)
    let isFirstEmission = true;
    this.settingsSub = this.settings.settings$.subscribe(settings => {
      if (isFirstEmission) {
        isFirstEmission = false;
        return; // Skip first emission to avoid duplicate start
      }
      
      const newInterval = this.getIntervalForMode(settings.trackingMode, settings.readingInterval);
      const newAccuracy = settings.gpsAccuracy;
      
      if (newInterval !== this.currentInterval || newAccuracy !== this.currentAccuracy) {
        this.currentInterval = newInterval;
        this.currentAccuracy = newAccuracy;
        this.restartWithNewSettings();
      }
    });
  }

  /**
   * Determines the GPS interval based on tracking mode.
   * Normal mode: 30s default (high accuracy)
   * Battery Saver mode: 60s default (high accuracy)
   */
  private getIntervalForMode(mode: 'normal' | 'battery_saver', userInterval: IntervalPreset): IntervalPreset {
    if (mode === 'battery_saver') {
      return 60; // 1 min for battery saver
    }
    return userInterval; // Use user's selected interval for normal mode
  }

  private startWithCurrentSettings(): void {
    const userSettings = this.settings.currentSettings;
    this.currentInterval = this.getIntervalForMode(userSettings.trackingMode, userSettings.readingInterval);
    this.currentAccuracy = userSettings.gpsAccuracy;
    
    // Clear any existing interval first (safety check)
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    const highAccuracy = this.currentAccuracy === 'high';
    const options: PositionOptions = {
      enableHighAccuracy: highAccuracy,
      timeout: 30000, // Increased to 30s for better reliability in background
      maximumAge: 5000 // Allow slightly cached location (5s) to prevent timeouts
    };

    // Get initial position immediately
    this.requestPosition(options);

    // Set up interval-based polling with getCurrentPosition()
    // This provides predictable, explicit intervals for smooth tracking
    const intervalMs = this.currentInterval * 1000;
    this.intervalId = setInterval(() => {
      this.requestPosition(options);
    }, intervalMs);
    
    console.log(`GPS tracking started with ${this.currentInterval}s interval (${userSettings.trackingMode} mode)`);
    console.log('Background GPS enabled - ensure battery optimization is disabled');
  }

  /**
   * Requests a single GPS position using getCurrentPosition().
   * This is called on interval for predictable location updates.
   */
  private requestPosition(options: PositionOptions): void {
    navigator.geolocation.getCurrentPosition(
      pos => this.handlePosition(pos),
      err => this.handleError(err),
      options
    );
  }

  private handleError(err: GeolocationPositionError): void {
    console.warn('GPS Error:', err.code, err.message);
    
    // Error codes:
    // 1 = PERMISSION_DENIED
    // 2 = POSITION_UNAVAILABLE
    // 3 = TIMEOUT
    
    if (err.code === 1) {
      console.error('GPS permission denied - tracking may fail');
    } else if (err.code === 3) {
      console.warn('GPS timeout - will retry on next interval');
    }
    
    this.errorSubject.next(err);
    
    // Don't stop tracking on errors - interval will retry on next tick
    // This prevents "GPS Signal Lost" from stopping the entire tracking
  }

  private handlePosition(pos: GeolocationPosition): void {
    const point = this.toGpsPoint(pos);
    this.locationSubject.next(point);
  }

  private restartWithNewSettings(): void {
    if (!this.isTracking) return;
    
    console.log(`Restarting GPS with new settings: ${this.currentInterval}s interval, ${this.currentAccuracy} accuracy`);
    
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.startWithCurrentSettings();
  }

  stopTracking(): void {
    this.isTracking = false;
    
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.settingsSub) {
      this.settingsSub.unsubscribe();
      this.settingsSub = null;
    }
    
    console.log('GPS tracking stopped');
  }

  private toGpsPoint(pos: GeolocationPosition): GpsPoint {
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed ?? 0,
      timestamp: pos.timestamp
    };
  }
}