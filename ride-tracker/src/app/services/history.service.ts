import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Ride } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly HISTORY_KEY = 'ride_tracker_history';
  private ridesSubject = new BehaviorSubject<Ride[]>(this.loadHistory());
  public rides$ = this.ridesSubject.asObservable();

  private loadHistory(): Ride[] {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (!stored) return [];
      
      const rides: Ride[] = JSON.parse(stored);
      // Migration: Add currentSpeed field to older rides that don't have it
      return rides.map(ride => ({
        ...ride,
        currentSpeed: ride.currentSpeed ?? 0
      }));
    } catch (err) {
      console.error('Failed to load ride history from localStorage:', err);
      return [];
    }
  }

  saveRide(ride: Ride): void {
    const currentRides = this.ridesSubject.value;
    const updatedRides = [ride, ...currentRides]; // Newest first
    this.ridesSubject.next(updatedRides);
    this.persistRides(updatedRides);
  }

  getRideById(id: string): Ride | undefined {
    return this.ridesSubject.value.find(r => r.id === id);
  }

  deleteRide(id: string): void {
    const updated = this.ridesSubject.value.filter(r => r.id !== id);
    this.ridesSubject.next(updated);
    this.persistRides(updated);
  }

  replaceAllRides(rides: Ride[]): void {
    this.ridesSubject.next(rides);
    this.persistRides(rides);
  }

  private persistRides(rides: Ride[]): void {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(rides));
    } catch (err) {
      console.error('Failed to save ride history to localStorage (storage may be full):', err);
    }
  }
}
