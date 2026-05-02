// src/app/services/auto-pause.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { App } from '@capacitor/app';
import { SettingsService } from './settings.service';

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
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyStationary = false;
  private isTrackingActive = false;
  
  // Track consecutive movement readings for refined auto-resume
  private consecutiveMovementCount = 0;
  private readonly RESUME_MOVEMENT_THRESHOLD = 3; // Require 3 consecutive readings above threshold
  private readonly RESUME_SPEED_MULTIPLIER = 1.5; // Require higher speed to resume than to pause

  constructor(private settings: SettingsService, private zone: NgZone) {
    this.initLifecycleListeners();
  }

  /** Call when a ride starts to enable lifecycle-based auto-pause. */
  startListening(): void {
    this.isTrackingActive = true;
    this.consecutiveMovementCount = 0;
  }

  /** Call when a ride stops/finishes. */
  stopListening(): void {
    this.isTrackingActive = false;
    this.clearStationaryTimer();
    this.clearResumeTimer();
    this.isCurrentlyStationary = false;
    this.consecutiveMovementCount = 0;
  }

  private initLifecycleListeners(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      this.zone.run(() => {
        if (!this.isTrackingActive) return;
        // DISABLED: Don't pause on background to allow continuous GPS tracking
        // The foreground service will keep GPS active in background
        // Users can manually pause if needed
        console.log(`App state changed: ${isActive ? 'active' : 'background'}`);
      });
    });
  }

  evaluateMovement(speed: number | undefined): void {
    const s = this.settings.currentSettings;
    if (!s.autoPause.enabled || !this.isTrackingActive) return;

    const pauseThreshold = s.autoPause.minSpeedThreshold;
    // Use higher threshold for resuming to avoid false positives
    const resumeThreshold = pauseThreshold * this.RESUME_SPEED_MULTIPLIER;
    
    const isMoving = speed !== undefined && speed > pauseThreshold;
    const isMovingFast = speed !== undefined && speed > resumeThreshold;

    if (!isMoving) {
      // Reset consecutive movement count when stopped
      this.consecutiveMovementCount = 0;
      this.clearResumeTimer();
      
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
        // Require sustained movement above higher threshold to resume
        if (isMovingFast) {
          this.consecutiveMovementCount++;
          
          if (this.consecutiveMovementCount >= this.RESUME_MOVEMENT_THRESHOLD) {
            // Confirmed sustained movement - resume tracking
            this.isCurrentlyStationary = false;
            this.consecutiveMovementCount = 0;
            this.eventSubject.next({ pause: false });
          } else if (!this.resumeTimer) {
            // Start a timer to reset count if movement stops
            this.resumeTimer = setTimeout(() => {
              this.consecutiveMovementCount = 0;
              this.resumeTimer = null;
            }, 5000); // Reset after 5s of no fast movement
          }
        } else {
          // Moving but not fast enough - don't count towards resume
          // Keep some count to allow gradual acceleration
          this.consecutiveMovementCount = Math.max(0, this.consecutiveMovementCount - 1);
        }
      }
    }
  }

  handleGpsStatus(isLost: boolean): void {
    // GPS Signal Lost is handled by RideService via GPS_SIGNAL_LOST state.
    // Do NOT trigger auto-pause here — doing so would freeze the elapsed timer
    // because AUTO_PAUSED stops the timer, but the user expects tracking to continue.
    // The GPS_SIGNAL_LOST state keeps the timer running while searching for signal.
    if (!this.isTrackingActive) return;
    
    if (isLost) {
      // When GPS is lost, clear any pending stationary timer to avoid
      // false auto-pause from lack of speed readings
      this.clearStationaryTimer();
    }
  }

  private clearStationaryTimer(): void {
    if (this.stationaryTimer) {
      clearTimeout(this.stationaryTimer);
      this.stationaryTimer = null;
    }
  }

  private clearResumeTimer(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }
}