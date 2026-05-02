// src/app/services/ride.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { RideState } from '../models/ride-state.model';
import { Ride, GpsPoint, RideBreak, PauseReason } from '../models/ride.model';
import { SettingsService } from './settings.service';
import { GpsMonitorService } from './gps-monitor.service';
import { LocationService } from './location.service';
import { HistoryService } from './history.service';
import { AutoPauseService } from './auto-pause.service';
import { MotionDetectionService } from './motion-detection.service';
import { ForegroundServiceService } from './foreground-service.service';
import { BackgroundTaskService } from './background-task.service';
import { PowerManagementService } from './power-management.service';
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
  private autoPauseSub?: Subscription;
  private gpsMonitorSub?: Subscription;
  private motionSub?: Subscription;
  private elapsedTimer?: ReturnType<typeof setInterval>;
  private totalTimeTimer?: ReturnType<typeof setInterval>;
  private pauseStartTime?: number;
  private motionCheckInProgress = false;

  constructor(
    private settings: SettingsService,
    private gpsMonitor: GpsMonitorService,
    private location: LocationService,
    private history: HistoryService,
    private autoPause: AutoPauseService,
    private motionDetection: MotionDetectionService,
    private foregroundService: ForegroundServiceService,
    private backgroundTask: BackgroundTaskService,
    private powerManagement: PowerManagementService
  ) {}

  startRide(): void {
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
    this.autoPause.startListening();
    
    // Acquire wake lock to prevent device sleep during tracking
    this.powerManagement.acquireWakeLock();
    
    this.startLocationProcessing();
    this.initTrackingSubscriptions();
    this.startElapsedTimer();
    this.startTotalTimeTimer();
    this.gpsMonitor.resetStatus();
    
    // Start foreground service for background GPS tracking
    this.foregroundService.startForegroundService(0, 0, 0);
  }

  private startElapsedTimer(): void {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const state = this.stateSubject.value;
      if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
        this.elapsedSubject.next(this.elapsedSubject.value + 1);
        
        // Update foreground service notification
        const ride = this.currentRideSubject.value;
        if (ride) {
          this.foregroundService.updateForegroundService(
            ride.totalDistance,
            this.elapsedSubject.value,
            ride.currentSpeed
          );
        }
      }
    }, 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = undefined;
    }
  }

  private startTotalTimeTimer(): void {
    this.stopTotalTimeTimer();
    this.totalTimeTimer = setInterval(() => {
      const state = this.stateSubject.value;
      // Count total time in all states except IDLE and RIDE_SUMMARY
      if (state !== RideState.IDLE && state !== RideState.RIDE_SUMMARY) {
        this.totalTimeSubject.next(this.totalTimeSubject.value + 1);
      }
    }, 1000);
  }

  private stopTotalTimeTimer(): void {
    if (this.totalTimeTimer) {
      clearInterval(this.totalTimeTimer);
      this.totalTimeTimer = undefined;
    }
  }

  private startLocationProcessing(): void {
    this.location.startTracking();
    this.locationSub = this.location.location$.subscribe(point => {
      this.autoPause.evaluateMovement(point.speed ?? undefined);
      if (this.stateSubject.value === RideState.TRACKING) {
        this.processNewPoint(point);
      }
    });
    // Handle location errors gracefully
    this.locationErrorSub = this.location.error$.subscribe(err => {
      console.warn('GPS Error:', err.code, err.message || 'Location unavailable');
      // Trigger GPS signal lost state for tracking
      if (this.stateSubject.value === RideState.TRACKING) {
        this.gpsMonitor.reportError();
      }
    });
  }

  private initTrackingSubscriptions(): void {
    this.gpsMonitorSub = this.gpsMonitor.status$.subscribe(status =>
      this.handleGpsStatusChange(status.isLost)
    );

    this.autoPauseSub = this.autoPause.events$.subscribe(event => {
      const state = this.stateSubject.value;
      if (event.pause) {
        if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
          this.pauseRide(event.reason ?? 'auto:stationary');
        }
      } else {
        if (state === RideState.AUTO_PAUSED) {
          this.resumeRide(true);
        }
      }
    });

    this.motionSub = this.motionDetection.motion$.subscribe(event => {
      if (event.significantMovement && this.stateSubject.value === RideState.AUTO_PAUSED) {
        this.handleMotionDetected();
      }
    });
  }

  private handleGpsStatusChange(isLost: boolean): void {
    const state = this.stateSubject.value;
    if (isLost && state === RideState.TRACKING) {
      this.stateSubject.next(RideState.GPS_SIGNAL_LOST);
      this.autoPause.handleGpsStatus(true);
    } else if (!isLost && state === RideState.GPS_SIGNAL_LOST) {
      this.stateSubject.next(RideState.TRACKING);
      this.autoPause.handleGpsStatus(false);
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
      
      if (reason.startsWith('auto:') && ride.points.length > 0) {
        const lastPoint = ride.points[ride.points.length - 1];
        this.motionDetection.startMonitoring(lastPoint);
      }
    }
    const newState = reason.startsWith('auto:') ? RideState.AUTO_PAUSED : RideState.PAUSED;
    this.stateSubject.next(newState);
  }

  resumeRide(isAuto = false): void {
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
    this.motionDetection.stopMonitoring();

    if (isAuto) {
      this.stateSubject.next(RideState.AUTO_RESUME);
      setTimeout(() => {
        const nextState = this.gpsMonitor.currentStatus.isLost
          ? RideState.GPS_SIGNAL_LOST
          : RideState.TRACKING;
        this.stateSubject.next(nextState);
      }, 500);
    } else {
      this.stateSubject.next(RideState.TRACKING);
    }
  }

  stopAndSaveRide(): void {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const finalRide: Ride = { ...ride, endTime: Date.now() };
      this.history.saveRide(finalRide);
      this.currentRideSubject.next(finalRide);
    }
    this.cleanupTracking();
    this.stateSubject.next(RideState.RIDE_SUMMARY);
  }

  discardRide(): void {
    this.cleanupTracking();
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }

  finishSummary(): void {
    this.currentRideSubject.next(null);
    this.elapsedSubject.next(0);
    this.totalTimeSubject.next(0);
    this.stateSubject.next(RideState.IDLE);
  }

  private handleMotionDetected(): void {
    if (this.motionCheckInProgress) {
      return;
    }

    this.motionCheckInProgress = true;
    console.log('Motion detected during pause, checking GPS location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? 0,
          timestamp: position.timestamp
        };

        if (this.motionDetection.shouldResumeBasedOnDistance(currentLocation)) {
          console.log('Distance threshold exceeded (>50m), auto-resuming ride');
          this.resumeRide(true);
        } else {
          console.log('Distance below threshold, continuing to monitor motion');
        }
        this.motionCheckInProgress = false;
      },
      (error) => {
        console.warn('GPS check failed during motion detection:', error);
        this.motionCheckInProgress = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  private cleanupTracking(): void {
    this.location.stopTracking();
    this.autoPause.stopListening();
    this.motionDetection.stopMonitoring();
    this.stopElapsedTimer();
    this.stopTotalTimeTimer();
    this.locationSub?.unsubscribe();
    this.locationErrorSub?.unsubscribe();
    this.autoPauseSub?.unsubscribe();
    this.gpsMonitorSub?.unsubscribe();
    this.motionSub?.unsubscribe();
    
    // Stop foreground service
    this.foregroundService.stopForegroundService();
    
    // Release wake lock to save battery
    this.powerManagement.releaseWakeLock();
  }
}