import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { GpsPoint } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private watchId: number | null = null;
  private locationSubject = new Subject<GpsPoint>();
  public location$ = this.locationSubject.asObservable();

  private errorSubject = new Subject<GeolocationPositionError>();
  public error$ = this.errorSubject.asObservable();

  /**
   * Starts watching the device position.
   * High accuracy is requested as per workflow requirements for ride tracking.
   */
  startTracking() {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          timestamp: position.timestamp
        };
        this.locationSubject.next(point);
      },
      (error) => {
        this.errorSubject.next(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
