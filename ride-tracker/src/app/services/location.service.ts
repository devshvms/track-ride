// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { GpsPoint } from '../models/ride.model';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private watchId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private locationSubject = new Subject<GpsPoint>();
  public location$ = this.locationSubject.asObservable();

  private errorSubject = new Subject<GeolocationPositionError>();
  public error$ = this.errorSubject.asObservable();

  constructor(private settings: SettingsService) {}

  /**
   * Starts GPS tracking.
   * FIX: Reads accuracy from settings instead of hardcoding enableHighAccuracy=true.
   * FIX: Uses interval-based polling when readingInterval > 3s to conserve battery;
   *      falls back to watchPosition for high-frequency tracking.
   */
  startTracking(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported.');
      return;
    }

    const s = this.settings.currentSettings;
    const highAccuracy = s.gpsAccuracy === 'high';
    const options: PositionOptions = {
      enableHighAccuracy: highAccuracy,
      timeout: 10000,
      maximumAge: highAccuracy ? 0 : 3000
    };

    if (s.readingInterval <= 3) {
      // Use watchPosition for real-time tracking (≤3s interval)
      this.watchId = navigator.geolocation.watchPosition(
        pos => this.locationSubject.next(this.toGpsPoint(pos)),
        err => this.errorSubject.next(err),
        options
      );
    } else {
      // Use interval-based polling for battery optimisation
      const poll = () => {
        navigator.geolocation.getCurrentPosition(
          pos => this.locationSubject.next(this.toGpsPoint(pos)),
          err => this.errorSubject.next(err),
          options
        );
      };
      poll(); // Immediate first read
      this.intervalId = setInterval(poll, s.readingInterval * 1000);
    }
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