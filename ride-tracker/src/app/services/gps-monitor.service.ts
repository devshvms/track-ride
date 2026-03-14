// src/app/services/gps-monitor.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { GpsStatus } from '../models/ride.model';
import { LocationService } from './location.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class GpsMonitorService {
  private statusSubject = new BehaviorSubject<GpsStatus>({
    isLost: false,
    retryCount: 0
  });
  public status$ = this.statusSubject.asObservable();

  private timeoutSubscription?: Subscription;

  constructor(
    private locationService: LocationService,
    private settings: SettingsService
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
    if (this.statusSubject.value.isLost) {
      this.statusSubject.next({
        isLost: false,
        retryCount: 0,
        lastFixTimestamp: Date.now()
      });
    }
    this.scheduleTimeout();
  }

  private onSignalError(): void {
    this.markLost();
  }

  private scheduleTimeout(): void {
    this.timeoutSubscription?.unsubscribe();
    // FIX: gpsLostTimeout is now in seconds — multiply by 1000 for ms
    const timeoutMs = (this.settings.currentSettings.autoPause.gpsLostTimeout ?? 60) * 1000;
    this.timeoutSubscription = timer(timeoutMs).subscribe(() => this.markLost());
  }

  private markLost(): void {
    if (this.statusSubject.value.isLost) return;
    const current = this.statusSubject.value;
    this.statusSubject.next({
      isLost: true,
      lastFixTimestamp: current.lastFixTimestamp ?? Date.now(),
      retryCount: current.retryCount + 1
    });
  }
}