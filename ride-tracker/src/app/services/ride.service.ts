import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { GpsPoint, Ride, RideBreak } from '../models/ride.model';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private currentRideSubject = new BehaviorSubject<Ride | null>(null);
  public currentRide$ = this.currentRideSubject.asObservable();

  private trackingInterval: any;
  private lastPosition: GpsPoint | null = null;

  constructor() {}

  async startRide() {
    const ride: Ride = {
      id: Date.now().toString(),
      startTime: Date.now(),
      points: [],
      breaks: [],
      totalDistance: 0,
      averageSpeed: 0
    };
    this.currentRideSubject.next(ride);
    this.startTracking();
  }

  private async startTracking() {
    // Configurable interval
    this.trackingInterval = setInterval(async () => {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true
        });
        this.addPoint(position);
      } catch (e) {
        console.error('Error getting location', e);
      }
    }, 5000); // Default 5 seconds
  }

  private addPoint(position: Position) {
    const currentRide = this.currentRideSubject.value;
    if (!currentRide) return;

    const newPoint: GpsPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp,
      speed: position.coords.speed || 0
    };

    if (this.lastPosition) {
      const dist = this.calculateDistance(
        this.lastPosition.latitude,
        this.lastPosition.longitude,
        newPoint.latitude,
        newPoint.longitude
      );
      currentRide.totalDistance += dist;
    }

    currentRide.points.push(newPoint);
    this.lastPosition = newPoint;
    
    // Update average speed
    const durationInSeconds = (Date.now() - currentRide.startTime) / 1000;
    if (durationInSeconds > 0) {
      currentRide.averageSpeed = currentRide.totalDistance / durationInSeconds;
    }

    this.currentRideSubject.next({ ...currentRide });
  }

  pauseRide(reason: string) {
    const currentRide = this.currentRideSubject.value;
    if (!currentRide) return;

    const rideBreak: RideBreak = {
      timestamp: Date.now(),
      reason: reason
    };
    currentRide.breaks.push(rideBreak);
    clearInterval(this.trackingInterval);
    this.currentRideSubject.next({ ...currentRide });
  }

  resumeRide() {
    this.startTracking();
  }

  async stopRide(): Promise<Ride | null> {
    const currentRide = this.currentRideSubject.value;
    if (!currentRide) return null;

    clearInterval(this.trackingInterval);
    currentRide.endTime = Date.now();
    
    // Here we would typically generate the map snapshot
    // For now, just clear the current ride
    this.currentRideSubject.next(null);
    this.lastPosition = null;
    
    return currentRide;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
