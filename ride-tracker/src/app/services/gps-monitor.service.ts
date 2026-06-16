// src/app/services/gps-monitor.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, timer, interval } from 'rxjs';
import { GpsStatus } from '../models/ride.model';
import { LocationService } from './location.service';


@Injectable({ providedIn: 'root' })
export class GpsMonitorService {
  private statusSubject = new BehaviorSubject<GpsStatus>({
    isLost: false,
    retryCount: 0
  });
  public status$ = this.statusSubject.asObservable();

  private timeoutSubscription?: Subscription;
  private retrySubscription?: Subscription;
  private readonly RETRY_INTERVAL_MS = 10000; // Retry every 10 seconds when lost

  constructor(
    private locationService: LocationService
  ) {
    this.locationService.location$.subscribe(() => this.onSignalReceived());
    this.locationService.error$.subscribe(() => this.onSignalError());
  }

  get currentStatus(): GpsStatus {
    return this.statusSubject.value;
  }

  resetStatus(): void {
    this.statusSubject.next({ isLost: false, retryCount: 0, lastFixTimestamp: Date.now() });
    this.scheduleTimeout();
  }

  private onSignalReceived(): void {
    this.timeoutSubscription?.unsubscribe();
    this.retrySubscription?.unsubscribe();
    
    const wasLost = this.statusSubject.value.isLost;
    if (wasLost) {
      console.log('GPS signal recovered!');
      this.statusSubject.next({
        isLost: false,
        retryCount: 0,
        lastFixTimestamp: Date.now()
      });
    } else {
      // Update timestamp even if not lost
      const current = this.statusSubject.value;
      this.statusSubject.next({
        ...current,
        lastFixTimestamp: Date.now()
      });
    }
    this.scheduleTimeout();
  }

  private onSignalError(): void {
    this.markLost();
  }

  /** Public method to report GPS errors from external sources */
  reportError(): void {
    this.markLost();
  }

  /** Public method to report a successful GPS fix from external sources (e.g. BackgroundGeolocation) */
  reportFix(): void {
    this.onSignalReceived();
  }

  private scheduleTimeout(): void {
    this.timeoutSubscription?.unsubscribe();
    // Default to 60 seconds
    const timeoutMs = 60 * 1000;
    this.timeoutSubscription = timer(timeoutMs).subscribe(() => this.markLost());
  }

  private markLost(): void {
    if (this.statusSubject.value.isLost) {
      // Already lost, increment retry count
      const current = this.statusSubject.value;
      this.statusSubject.next({
        ...current,
        retryCount: current.retryCount + 1
      });
      return;
    }
    
    const current = this.statusSubject.value;
    this.statusSubject.next({
      isLost: true,
      lastFixTimestamp: current.lastFixTimestamp ?? Date.now(),
      retryCount: current.retryCount + 1
    });
    
    console.log('GPS signal lost - starting active recovery attempts');
    this.startRetryAttempts();
  }
  
  /**
   * Actively attempt to recover GPS signal by forcing location checks
   * This helps when the app is in background and normal polling might be suspended
   */
  private startRetryAttempts(): void {
    this.retrySubscription?.unsubscribe();
    
    // Attempt recovery every 10 seconds
    this.retrySubscription = interval(this.RETRY_INTERVAL_MS).subscribe(() => {
      if (!this.statusSubject.value.isLost) {
        this.retrySubscription?.unsubscribe();
        return;
      }
      
      console.log(`GPS recovery attempt ${this.statusSubject.value.retryCount}...`);
      
      // Force a location check
      navigator.geolocation.getCurrentPosition(
        (_position) => {
          console.log('GPS recovery successful!');
          // This will trigger onSignalReceived via location service
        },
        (error) => {
          console.warn(`GPS recovery attempt failed: ${error.message}`);
          // Increment retry count
          const current = this.statusSubject.value;
          this.statusSubject.next({
            ...current,
            retryCount: current.retryCount + 1
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }
}