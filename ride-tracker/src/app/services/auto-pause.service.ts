// src/app/services/auto-pause.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { App } from '@capacitor/app';
import { SettingsService } from './settings.service';

// FIX: Removed unused GpsMonitorService import

export type AutoPauseReason =
  | 'auto:stationary'
  | 'auto:backgrounded'
  | 'auto:gps_lost'
  | 'auto:low_speed';

@Injectable({ providedIn: 'root' })
export class AutoPauseService {
  private eventSubject = new Subject<{ pause: boolean; reason?: AutoPauseReason }>();
  public events$ = this.eventSubject.asObservable();

  private stationaryTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyStationary = false;
  private isTrackingActive = false;

  constructor(private settings: SettingsService, private zone: NgZone) {
    this.initLifecycleListeners();
  }

  /** Call when a ride starts to enable lifecycle-based auto-pause. */
  startListening(): void {
    this.isTrackingActive = true;
  }

  /** Call when a ride stops/finishes. */
  stopListening(): void {
    this.isTrackingActive = false;
    this.clearStationaryTimer();
    this.isCurrentlyStationary = false;
  }

  private initLifecycleListeners(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      this.zone.run(() => {
        if (!this.isTrackingActive) return;
        const s = this.settings.currentSettings;
        if (s.autoPause.enabled && s.autoPause.pauseOnBackground) {
          this.eventSubject.next({
            pause: !isActive,
            reason: !isActive ? 'auto:backgrounded' : undefined
          });
        }
      });
    });
  }

  evaluateMovement(speed: number | undefined): void {
    const s = this.settings.currentSettings;
    if (!s.autoPause.enabled || !this.isTrackingActive) return;

    const threshold = s.autoPause.minSpeedThreshold;
    const isMoving = speed !== undefined && speed > threshold;

    if (!isMoving) {
      if (!this.isCurrentlyStationary && !this.stationaryTimer) {
        this.stationaryTimer = setTimeout(() => {
          this.isCurrentlyStationary = true;
          this.stationaryTimer = null;
          this.eventSubject.next({ pause: true, reason: 'auto:stationary' });
        }, s.autoPause.stationaryThreshold * 1000);
      }
    } else {
      this.clearStationaryTimer();
      if (this.isCurrentlyStationary) {
        this.isCurrentlyStationary = false;
        this.eventSubject.next({ pause: false });
      }
    }
  }

  handleGpsStatus(isLost: boolean): void {
    if (!this.isTrackingActive) return;
    const s = this.settings.currentSettings;
    if (s.autoPause.enabled && s.autoPause.pauseOnGpsLost) {
      this.eventSubject.next({
        pause: isLost,
        reason: isLost ? 'auto:gps_lost' : undefined
      });
    }
  }

  private clearStationaryTimer(): void {
    if (this.stationaryTimer) {
      clearTimeout(this.stationaryTimer);
      this.stationaryTimer = null;
    }
  }
}