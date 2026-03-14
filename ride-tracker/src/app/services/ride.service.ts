import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { RideState } from '../models/ride-state.model';
import { Ride, GpsPoint, RideBreak, PauseReason } from '../models/ride.model';
import { SettingsService } from './settings.service';
import { GpsMonitorService } from './gps-monitor.service';
import { LocationService } from './location.service';
import { HistoryService } from './history.service';
import { RideUtils } from '../utils/ride-calculations';

@Injectable({ providedIn: 'root' })
export class RideService {
  private stateSubject = new BehaviorSubject<RideState>(RideState.IDLE);
  public currentState$ = this.stateSubject.asObservable();

  private currentRideSubject = new BehaviorSubject<Ride | null>(null);
  public currentRide$ = this.currentRideSubject.asObservable();

  private locationSubscription?: Subscription;

  constructor(
    private settings: SettingsService,
    private gpsMonitor: GpsMonitorService,
    private location: LocationService,
    private history: HistoryService
  ) {
    this.initAutoPauseLogic();
  }

  startRide() {
    const newRide: Ride = {
      id: Date.now().toString(),
      startTime: Date.now(),
      points: [],
      breaks: [],
      totalDistance: 0,
      averageSpeed: 0,
      maxSpeed: 0
    };
    this.currentRideSubject.next(newRide);
    this.stateSubject.next(RideState.TRACKING);
    this.startLocationProcessing();
  }

  private startLocationProcessing() {
    this.location.startTracking();
    this.locationSubscription = this.location.location$.subscribe(point => {
      if (this.stateSubject.value === RideState.TRACKING) {
        this.processNewPoint(point);
      }
    });
  }

  private processNewPoint(newPoint: GpsPoint) {
    const ride = this.currentRideSubject.value;
    if (!ride) return;

    const updatedPoints = [...ride.points, newPoint];
    let addedDistance = 0;

    if (ride.points.length > 0) {
      const lastPoint = ride.points[ride.points.length - 1];
      addedDistance = RideUtils.calculateDistance(lastPoint, newPoint);
    }

    const totalDistance = ride.totalDistance + addedDistance;
    const maxSpeed = Math.max(ride.maxSpeed, newPoint.speed || 0);
    const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, ride.startTime, Date.now());

    this.currentRideSubject.next({
      ...ride,
      points: updatedPoints,
      totalDistance,
      maxSpeed,
      averageSpeed: avgSpeed
    });
  }

  /**
   * Transitions to PAUSED state and records a break entry
   */
  pauseRide(reason: PauseReason = 'break') {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const newBreak: RideBreak = {
        startTime: Date.now(),
        reason,
        location: ride.points[ride.points.length - 1] // Last known position
      };
      const updatedBreaks = [...ride.breaks, newBreak];
      this.currentRideSubject.next({ ...ride, breaks: updatedBreaks });
    }

    // Determine if this was a manual pause or auto-pause
    const newState = reason.startsWith('auto:') ? RideState.AUTO_PAUSED : RideState.PAUSED;
    this.stateSubject.next(newState);
  }

  resumeRide() {
    const ride = this.currentRideSubject.value;
    if (ride && ride.breaks.length > 0) {
      const lastBreak = ride.breaks[ride.breaks.length - 1];
      if (!lastBreak.endTime) {
        lastBreak.endTime = Date.now();
      }
    }
    this.stateSubject.next(RideState.TRACKING);
  }

  stopAndSaveRide() {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const finalRide = { ...ride, endTime: Date.now() };
      this.history.saveRide(finalRide);
      this.currentRideSubject.next(finalRide);
    }

    this.location.stopTracking();
    this.locationSubscription?.unsubscribe();
    this.stateSubject.next(RideState.RIDE_SUMMARY);
  }

  resetToIdle() {
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }
  /**
 * Clears the current ride and returns to the home screen start state
 */
  finishSummary() {
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }

  private initAutoPauseLogic() {
    combineLatest([
      this.gpsMonitor.status$,
      this.currentState$
    ]).subscribe(([gpsStatus, state]) => {
      const s = this.settings.currentSettings;

      // Workflow Logic: Pause if GPS is lost and setting is enabled
      if (s.autoPause.enabled && state === RideState.TRACKING) {
        if (gpsStatus.isLost && s.autoPause.pauseOnGpsLost) {
          this.pauseRide('auto:gps_lost');
        }
      }

      // Workflow Logic: Resume if GPS is restored while in AUTO_PAUSED
      if (state === RideState.AUTO_PAUSED && !gpsStatus.isLost) {
        this.resumeRide();
      }
    });
  }
}
