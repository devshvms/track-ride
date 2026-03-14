// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { GpsPoint } from '../models/ride.model';
import { SettingsService } from './settings.service';
import { BatteryOptimizerService } from './battery-optimizer.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private watchId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private locationSubject = new Subject<GpsPoint>();
  public location$ = this.locationSubject.asObservable();

  private errorSubject = new Subject<GeolocationPositionError>();
  public error$ = this.errorSubject.asObservable();

  private optimizerSub: Subscription | null = null;
  private currentInterval: number = 5;
  private currentAccuracy: 'high' | 'balanced' | 'low' = 'high';

  constructor(
    private settings: SettingsService,
    private batteryOptimizer: BatteryOptimizerService
  ) {}

  /**
   * Starts GPS tracking with battery optimization.
   * Uses adaptive intervals based on battery level and movement state.
   */
  startTracking(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported.');
      return;
    }

    this.batteryOptimizer.reset();
    
    // Subscribe to optimization changes for adaptive tracking
    this.optimizerSub = this.batteryOptimizer.optimizationState$.subscribe(state => {
      // Only restart if settings changed significantly
      if (state.currentInterval !== this.currentInterval || 
          state.currentAccuracy !== this.currentAccuracy) {
        this.currentInterval = state.currentInterval;
        this.currentAccuracy = state.currentAccuracy;
        this.restartWithNewSettings();
      }
    });

    this.startWithCurrentSettings();
  }

  private startWithCurrentSettings(): void {
    const optimized = this.batteryOptimizer.getOptimizedSettings();
    this.currentInterval = optimized.interval;
    this.currentAccuracy = optimized.accuracy;
    
    const highAccuracy = this.currentAccuracy === 'high';
    const options: PositionOptions = {
      enableHighAccuracy: highAccuracy,
      timeout: 10000,
      maximumAge: highAccuracy ? 0 : 3000
    };

    if (this.currentInterval <= 3) {
      // Use watchPosition for real-time tracking (≤3s interval)
      this.watchId = navigator.geolocation.watchPosition(
        pos => this.handlePosition(pos),
        err => this.errorSubject.next(err),
        options
      );
    } else {
      // Use interval-based polling for battery optimisation
      const poll = () => {
        navigator.geolocation.getCurrentPosition(
          pos => this.handlePosition(pos),
          err => this.errorSubject.next(err),
          options
        );
      };
      poll(); // Immediate first read
      this.intervalId = setInterval(poll, this.currentInterval * 1000);
    }
  }

  private handlePosition(pos: GeolocationPosition): void {
    const point = this.toGpsPoint(pos);
    this.locationSubject.next(point);
    // Update battery optimizer with current speed
    this.batteryOptimizer.updateMovementState(point.speed ?? 0);
  }

  private restartWithNewSettings(): void {
    // Clear existing tracking
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Restart with new settings
    this.startWithCurrentSettings();
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.optimizerSub) {
      this.optimizerSub.unsubscribe();
      this.optimizerSub = null;
    }
    this.batteryOptimizer.reset();
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