import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Ride } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly HISTORY_KEY = 'ride_tracker_history';
  private ridesSubject = new BehaviorSubject<Ride[]>(this.loadHistory());
  public rides$ = this.ridesSubject.asObservable();

  private loadHistory(): Ride[] {
    const stored = localStorage.getItem(this.HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  saveRide(ride: Ride): void {
    const currentRides = this.ridesSubject.value;
    const updatedRides = [ride, ...currentRides]; // Newest first
    this.ridesSubject.next(updatedRides);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updatedRides));
  }

  getRideById(id: string): Ride | undefined {
    return this.ridesSubject.value.find(r => r.id === id);
  }

  deleteRide(id: string): void {
    const updated = this.ridesSubject.value.filter(r => r.id !== id);
    this.ridesSubject.next(updated);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updated));
  }

  replaceAllRides(rides: Ride[]): void {
    this.ridesSubject.next(rides);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(rides));
  }
}
