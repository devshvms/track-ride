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

  private locationSub?: Subscription;
  private autoPauseSub?: Subscription;
  private gpsMonitorSub?: Subscription;
  private elapsedTimer?: ReturnType<typeof setInterval>;
  private pauseStartTime?: number;

  constructor(
    private settings: SettingsService,
    private gpsMonitor: GpsMonitorService,
    private location: LocationService,
    private history: HistoryService,
    private autoPause: AutoPauseService
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
      totalPausedTime: 0
    };
    this.currentRideSubject.next(newRide);
    this.elapsedSubject.next(0);
    this.stateSubject.next(RideState.TRACKING);
    this.autoPause.startListening();
    this.startLocationProcessing();
    this.initTrackingSubscriptions();
    this.startElapsedTimer();
    this.gpsMonitor.resetStatus();
  }

  private startElapsedTimer(): void {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const state = this.stateSubject.value;
      if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
        this.elapsedSubject.next(this.elapsedSubject.value + 1);
      }
    }, 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = undefined;
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
    // FIX: maxSpeed stored in m/s (raw from GPS) — consistent with averageSpeed fix
    const maxSpeed = Math.max(ride.maxSpeed, newPoint.speed ?? 0);
    // FIX: calculateAverageSpeed now returns m/s
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
    this.stateSubject.next(RideState.IDLE);
  }

  private cleanupTracking(): void {
    this.location.stopTracking();
    this.autoPause.stopListening();
    this.stopElapsedTimer();
    this.locationSub?.unsubscribe();
    this.autoPauseSub?.unsubscribe();
    this.gpsMonitorSub?.unsubscribe();
  }
}