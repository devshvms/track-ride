// src/app/services/ride.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { RideState } from '../models/ride-state.model';
import { Ride, GpsPoint, RideBreak, PauseReason } from '../models/ride.model';

import { GpsMonitorService } from './gps-monitor.service';
import { LocationService } from './location.service';
import { HistoryService } from './history.service';

import { ForegroundServiceService } from './foreground-service.service';

import { PowerManagementService } from './power-management.service';
import { BackgroundGeolocationService } from './background-geolocation.service';
import { RideUtils } from '../utils/ride-calculations';

@Injectable({ providedIn: 'root' })
export class RideService {
  private stateSubject = new BehaviorSubject<RideState>(RideState.IDLE);
  public currentState$ = this.stateSubject.asObservable();

  private currentRideSubject = new BehaviorSubject<Ride | null>(null);
  public currentRide$ = this.currentRideSubject.asObservable();

  /** Emits elapsed tracking seconds (pauses excluded) every second when TRACKING. */
  private elapsedSubject = new BehaviorSubject<number>(0);
  public elapsed$ = this.elapsedSubject.asObservable();

  /** Emits total time in seconds since ride started (includes pauses). */
  private totalTimeSubject = new BehaviorSubject<number>(0);
  public totalTime$ = this.totalTimeSubject.asObservable();

  private locationSub?: Subscription;
  private locationErrorSub?: Subscription;
  private gpsMonitorSub?: Subscription;
  private uiRefreshTimer?: ReturnType<typeof setInterval>;
  private pauseStartTime?: number;
  private bgGeoActive = false;

  constructor(
    private gpsMonitor: GpsMonitorService,
    private location: LocationService,
    private history: HistoryService,
    private foregroundService: ForegroundServiceService,
    private powerManagement: PowerManagementService,
    private bgGeo: BackgroundGeolocationService
  ) {}

  async startRide(): Promise<void> {
    const newRide: Ride = {
      id: Date.now().toString(),
      startTime: Date.now(),
      points: [],
      breaks: [],
      totalDistance: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      currentSpeed: 0,
      totalPausedTime: 0
    };
    this.currentRideSubject.next(newRide);
    this.elapsedSubject.next(0);
    this.totalTimeSubject.next(0);
    this.stateSubject.next(RideState.TRACKING);
    this.stateSubject.next(RideState.TRACKING);
    
    // Acquire wake lock to prevent device sleep during tracking
    this.powerManagement.acquireWakeLock();
    
    // Start background geolocation (true foreground service)
    await this.startBackgroundGeolocation();
    
    // Only start regular location service as fallback if bgGeo failed
    if (!this.bgGeoActive) {
      this.startLocationProcessing();
      // Start legacy foreground service only when bgGeo is not active
      this.foregroundService.startForegroundService(0, 0, 0);
    }
    this.initTrackingSubscriptions();
    this.recalculateElapsed();
    this.startUiRefreshTimer();
    this.gpsMonitor.resetStatus();
  }

  /**
   * Recalculate elapsed and total time from wall-clock timestamps.
   * This is immune to setInterval throttling when screen is off / app backgrounded.
   */
  private recalculateElapsed(): void {
    const ride = this.currentRideSubject.value;
    if (!ride) return;

    const now = Date.now();
    const state = this.stateSubject.value;

    // Total time = wall-clock since ride started
    const totalTimeMs = now - ride.startTime;
    this.totalTimeSubject.next(Math.floor(totalTimeMs / 1000));

    // Elapsed = total time - all completed pause durations - current ongoing pause
    let pausedMs = ride.totalPausedTime ?? 0;
    if (this.pauseStartTime && (state === RideState.PAUSED || state === RideState.AUTO_PAUSED)) {
      pausedMs += (now - this.pauseStartTime);
    }
    const elapsedMs = Math.max(0, totalTimeMs - pausedMs);
    this.elapsedSubject.next(Math.floor(elapsedMs / 1000));
  }

  /**
   * UI refresh timer — only for smooth display updates when app is in foreground.
   * The actual elapsed value is always wall-clock based (survives background).
   */
  private startUiRefreshTimer(): void {
    this.stopUiRefreshTimer();
    this.uiRefreshTimer = setInterval(() => {
      this.recalculateElapsed();
    }, 1000);
  }

  private stopUiRefreshTimer(): void {
    if (this.uiRefreshTimer) {
      clearInterval(this.uiRefreshTimer);
      this.uiRefreshTimer = undefined;
    }
  }

  /**
   * Start background geolocation with true Android foreground service.
   * This prevents the app from being killed in background.
   */
  private async startBackgroundGeolocation(): Promise<void> {
    try {
      await this.bgGeo.startTracking((point: GpsPoint) => {
        // Report successful GPS fix to monitor (critical when LocationService is not started)
        this.gpsMonitor.reportFix();
        
        // Recalculate elapsed from wall-clock (survives background/screen-off)
        this.recalculateElapsed();
        
        // Process GPS points from background geolocation
        const state = this.stateSubject.value;
        if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
          this.processNewPoint(point);
        }
      });
      this.bgGeoActive = true;
      console.log('Background geolocation started - foreground service active');
    } catch (error) {
      console.error('Failed to start background geolocation, falling back to LocationService:', error);
      this.bgGeoActive = false;
    }
  }

  private startLocationProcessing(): void {
    this.location.startTracking();
    this.locationSub = this.location.location$.subscribe(point => {
      // Recalculate elapsed from wall-clock on each GPS fix
      this.recalculateElapsed();
      
      // Update legacy foreground service notification (only active when bgGeo failed)
      const ride = this.currentRideSubject.value;
      if (ride) {
        this.foregroundService.updateForegroundService(
          ride.totalDistance,
          this.elapsedSubject.value,
          ride.currentSpeed
        );
      }
      
      const state = this.stateSubject.value;
      if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
        this.processNewPoint(point);
      }
    });
    // Handle location errors gracefully
    this.locationErrorSub = this.location.error$.subscribe(err => {
      console.warn('GPS Error:', err.code, err.message || 'Location unavailable');
      const state = this.stateSubject.value;
      
      // Trigger GPS signal lost state for tracking
      if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
        this.gpsMonitor.reportError();
      }
    });
  }

  private initTrackingSubscriptions(): void {
    this.gpsMonitorSub = this.gpsMonitor.status$.subscribe(status =>
      this.handleGpsStatusChange(status.isLost)
    );
  }

  private handleGpsStatusChange(isLost: boolean): void {
    const state = this.stateSubject.value;
    if (isLost && state === RideState.TRACKING) {
      this.stateSubject.next(RideState.GPS_SIGNAL_LOST);
    } else if (!isLost && state === RideState.GPS_SIGNAL_LOST) {
      this.stateSubject.next(RideState.TRACKING);
    }
  }

  private processNewPoint(newPoint: GpsPoint): void {
    const ride = this.currentRideSubject.value;
    if (!ride) return;

    const updatedPoints = [...ride.points, newPoint];
    let addedDistance = 0;
    if (ride.points.length > 0) {
      addedDistance = RideUtils.calculateDistance(
        ride.points[ride.points.length - 1],
        newPoint
      );
    }

    const totalDistance = ride.totalDistance + addedDistance;
    
    // Calculate current speed using rolling average (speedometer-like)
    const currentSpeed = RideUtils.calculateCurrentSpeed(updatedPoints);
    
    // Update max speed based on current speed (not raw GPS speed)
    const maxSpeed = RideUtils.updateMaxSpeed(ride.maxSpeed, currentSpeed);
    
    // Calculate average speed over entire active ride duration
    const averageSpeed = RideUtils.calculateAverageSpeed(
      totalDistance,
      ride.startTime,
      Date.now(),
      ride.totalPausedTime ?? 0
    );

    this.currentRideSubject.next({
      ...ride,
      points: updatedPoints,
      totalDistance,
      maxSpeed,
      currentSpeed,
      averageSpeed
    });
  }

  pauseRide(reason: PauseReason = 'break'): void {
    const ride = this.currentRideSubject.value;
    this.pauseStartTime = Date.now();
    if (ride) {
      const newBreak: RideBreak = {
        startTime: this.pauseStartTime,
        reason,
        location: ride.points[ride.points.length - 1]
      };
      this.currentRideSubject.next({ ...ride, breaks: [...ride.breaks, newBreak] });
    }
    this.stateSubject.next(RideState.PAUSED);
  }

  resumeRide(): void {
    const ride = this.currentRideSubject.value;
    const now = Date.now();
    if (ride && ride.breaks.length > 0) {
      const updatedBreaks = [...ride.breaks];
      const last = updatedBreaks[updatedBreaks.length - 1];
      if (!last.endTime) {
        const duration = now - last.startTime;
        updatedBreaks[updatedBreaks.length - 1] = { ...last, endTime: now, duration };
        const totalPausedTime = (ride.totalPausedTime ?? 0) + duration;
        this.currentRideSubject.next({ ...ride, breaks: updatedBreaks, totalPausedTime });
      }
    }
    this.pauseStartTime = undefined;

    this.stateSubject.next(RideState.TRACKING);
  }

  async stopAndSaveRide(): Promise<void> {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const finalRide: Ride = { ...ride, endTime: Date.now() };
      this.history.saveRide(finalRide);
      this.currentRideSubject.next(finalRide);
    }
    await this.cleanupTracking();
    this.stateSubject.next(RideState.RIDE_SUMMARY);
  }

  async discardRide(): Promise<void> {
    await this.cleanupTracking();
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }

  finishSummary(): void {
    this.currentRideSubject.next(null);
    this.elapsedSubject.next(0);
    this.totalTimeSubject.next(0);
    this.stateSubject.next(RideState.IDLE);
  }

  private async cleanupTracking(): Promise<void> {
    // Stop background geolocation (true foreground service)
    if (this.bgGeoActive) {
      try {
        await this.bgGeo.stopTracking();
        this.bgGeoActive = false;
        console.log('Background geolocation stopped');
      } catch (error) {
        console.error('Error stopping background geolocation:', error);
      }
    }
    
    this.location.stopTracking();
    this.stopUiRefreshTimer();
    this.locationSub?.unsubscribe();
    this.locationErrorSub?.unsubscribe();
    this.gpsMonitorSub?.unsubscribe();
    
    // Stop foreground service notification (legacy)
    this.foregroundService.stopForegroundService();
    
    // Release wake lock to save battery
    this.powerManagement.releaseWakeLock();
  }
}