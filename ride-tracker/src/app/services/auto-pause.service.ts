import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { App } from '@capacitor/app';
import { SettingsService } from './settings.service';
import { GpsMonitorService } from './gps-monitor.service';

export type AutoPauseReason = 'auto:stationary' | 'auto:backgrounded' | 'auto:gps_lost' | 'auto:low_speed';

@Injectable({ providedIn: 'root' })
export class AutoPauseService {
  private eventSubject = new Subject<{ pause: boolean, reason?: AutoPauseReason }>();
  public events$ = this.eventSubject.asObservable();

  private stationaryTimer: any;
  private isCurrentlyStationary = false;

  constructor(
    private settings: SettingsService,
    private zone: NgZone
  ) {
    this.initLifecycleListeners();
  }

  private initLifecycleListeners() {
    App.addListener('appStateChange', ({ isActive }) => {
      this.zone.run(() => {
        const s = this.settings.currentSettings;
        if (s.autoPause.enabled && s.autoPause.pauseOnBackground) {
          if (!isActive) {
            this.eventSubject.next({ pause: true, reason: 'auto:backgrounded' });
          } else {
            this.eventSubject.next({ pause: false });
          }
        }
      });
    });
  }

  evaluateMovement(speed: number | undefined): void {
    const s = this.settings.currentSettings;
    if (!s.autoPause.enabled) return;

    const threshold = s.autoPause.minSpeedThreshold; // e.g., 0.55 m/s (~2 km/h)
    const isMoving = speed !== undefined && speed > threshold;

    if (!isMoving) {
      if (!this.isCurrentlyStationary && !this.stationaryTimer) {
        // Start stationary timer
        this.stationaryTimer = setTimeout(() => {
          this.isCurrentlyStationary = true;
          this.eventSubject.next({ pause: true, reason: 'auto:stationary' });
          this.stationaryTimer = null;
        }, s.autoPause.stationaryThreshold * 1000);
      }
    } else {
      // We are moving
      if (this.stationaryTimer) {
        clearTimeout(this.stationaryTimer);
        this.stationaryTimer = null;
      }

      if (this.isCurrentlyStationary) {
        this.isCurrentlyStationary = false;
        this.eventSubject.next({ pause: false });
      }
    }
  }

  handleGpsStatus(isLost: boolean) {
    const s = this.settings.currentSettings;
    if (s.autoPause.enabled && s.autoPause.pauseOnGpsLost) {
      if (isLost) {
        this.eventSubject.next({ pause: true, reason: 'auto:gps_lost' });
      } else {
        this.eventSubject.next({ pause: false });
      }
    }
  }
}
