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

  private locationSubscription?: Subscription;
  private autoPauseSubscription?: Subscription;
  private gpsMonitorSubscription?: Subscription;

  constructor(
    private settings: SettingsService,
    private gpsMonitor: GpsMonitorService,
    private location: LocationService,
    private history: HistoryService,
    private autoPause: AutoPauseService
  ) {}

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
    this.initTrackingSubscriptions();
  }

  private startLocationProcessing() {
    this.location.startTracking();
    this.locationSubscription = this.location.location$.subscribe(point => {
      this.autoPause.evaluateMovement(point.speed);
      if (this.stateSubject.value === RideState.TRACKING) {
        this.processNewPoint(point);
      }
    });
  }

  private initTrackingSubscriptions() {
    // Listen to GPS lost/restored
    this.gpsMonitorSubscription = this.gpsMonitor.status$.subscribe(status => {
      this.handleGpsStatusChange(status.isLost);
    });

    // Listen to Auto-Pause events
    this.autoPauseSubscription = this.autoPause.events$.subscribe(event => {
      if (event.pause) {
        if (this.stateSubject.value === RideState.TRACKING || this.stateSubject.value === RideState.GPS_SIGNAL_LOST) {
          this.pauseRide(event.reason || 'auto:stationary');
        }
      } else {
        if (this.stateSubject.value === RideState.AUTO_PAUSED) {
          this.resumeRide(true);
        }
      }
    });
  }

  private handleGpsStatusChange(isLost: boolean) {
    const currentState = this.stateSubject.value;
    
    if (isLost) {
      if (currentState === RideState.TRACKING) {
        this.stateSubject.next(RideState.GPS_SIGNAL_LOST);
      }
      this.autoPause.handleGpsStatus(true);
    } else {
      if (currentState === RideState.GPS_SIGNAL_LOST) {
        this.stateSubject.next(RideState.TRACKING);
      }
      this.autoPause.handleGpsStatus(false);
    }
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

  pauseRide(reason: PauseReason = 'break') {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const newBreak: RideBreak = {
        startTime: Date.now(),
        reason,
        location: ride.points[ride.points.length - 1]
      };
      const updatedBreaks = [...ride.breaks, newBreak];
      this.currentRideSubject.next({ ...ride, breaks: updatedBreaks });
    }

    const newState = reason.startsWith('auto:') ? RideState.AUTO_PAUSED : RideState.PAUSED;
    this.stateSubject.next(newState);
  }

  resumeRide(isAuto: boolean = false) {
    const ride = this.currentRideSubject.value;
    if (ride && ride.breaks.length > 0) {
      const lastBreak = ride.breaks[ride.breaks.length - 1];
      if (!lastBreak.endTime) {
        lastBreak.endTime = Date.now();
      }
    }

    if (isAuto) {
      this.stateSubject.next(RideState.AUTO_RESUME);
      // Transient state, move immediately to TRACKING or GPS_SIGNAL_LOST
      setTimeout(() => {
        if (this.gpsMonitor.currentStatus.isLost) { // Use currentStatus getter
          this.stateSubject.next(RideState.GPS_SIGNAL_LOST);
        } else {
          this.stateSubject.next(RideState.TRACKING);
        }
      }, 500); // Small delay to simulate transient state
    } else {
      this.stateSubject.next(RideState.TRACKING);
    }
  }

  stopAndSaveRide() {
    const ride = this.currentRideSubject.value;
    if (ride) {
      const finalRide = { ...ride, endTime: Date.now() };
      this.history.saveRide(finalRide);
      this.currentRideSubject.next(finalRide);
    }

    this.cleanupTracking();
    this.stateSubject.next(RideState.RIDE_SUMMARY);
  }

  discardRide() {
    this.cleanupTracking();
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }

  private cleanupTracking() {
    this.location.stopTracking();
    this.locationSubscription?.unsubscribe();
    this.autoPauseSubscription?.unsubscribe();
    this.gpsMonitorSubscription?.unsubscribe();
  }

  finishSummary() {
    this.currentRideSubject.next(null);
    this.stateSubject.next(RideState.IDLE);
  }
}
