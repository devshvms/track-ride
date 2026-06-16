// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { GpsPoint, IntervalPreset } from '../models/ride.model';
import { BatteryOptimizerService } from './battery-optimizer.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private locationSubject = new Subject<GpsPoint>();
  public location$ = this.locationSubject.asObservable();

  private errorSubject = new Subject<GeolocationPositionError>();
  public error$ = this.errorSubject.asObservable();

  private settingsSub: Subscription | null = null;
  private currentInterval: IntervalPreset = 30;
  private enableHighAccuracy: boolean = true;
  private isTracking = false;

  constructor(
    private batteryOptimizer: BatteryOptimizerService
  ) {}

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
    
    // Then subscribe to battery optimization changes (skip first emission since we just started)
    let isFirstEmission = true;
    this.settingsSub = this.batteryOptimizer.optimizationState$.subscribe(opt => {
      if (isFirstEmission) {
        isFirstEmission = false;
        return; // Skip first emission to avoid duplicate start
      }
      
      const newInterval = opt.currentInterval;
      const newAccuracy = opt.enableHighAccuracy;
      
      if (newInterval !== this.currentInterval || newAccuracy !== this.enableHighAccuracy) {
        this.currentInterval = newInterval;
        this.enableHighAccuracy = newAccuracy;
        this.restartWithNewSettings();
      }
    });
  }

  private startWithCurrentSettings(): void {
    const opt = this.batteryOptimizer.getOptimizedSettings();
    this.currentInterval = opt.interval;
    this.enableHighAccuracy = opt.enableHighAccuracy;
    
    // Clear any existing interval first (safety check)
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    const options: PositionOptions = {
      enableHighAccuracy: this.enableHighAccuracy,
      timeout: 30000, // Increased to 30s for better reliability in background
      maximumAge: 5000 // Allow slightly cached location (5s) to prevent timeouts
    };

    // Get initial position immediately
    this.requestPosition(options);

    const intervalMs = this.currentInterval * 1000;
    this.intervalId = setInterval(() => {
      this.requestPosition(options);
    }, intervalMs);
    
    console.log(`GPS tracking started with ${this.currentInterval}s interval`);
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
    
    console.log(`Restarting GPS with new settings: ${this.currentInterval}s interval, High Accuracy: ${this.enableHighAccuracy}`);
    
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