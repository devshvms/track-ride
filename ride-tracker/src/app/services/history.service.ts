import { Injectable } from '@angular/core';
import { Ride } from '../models/ride.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private ridesSubject = new BehaviorSubject<Ride[]>([]);
  public rides$ = this.ridesSubject.asObservable();

  constructor() {
    this.loadHistory();
  }

  private async loadHistory() {
    // In a real app, load from Storage or API
    const saved = localStorage.getItem('ride_history');
    if (saved) {
      this.ridesSubject.next(JSON.parse(saved));
    }
  }

  async saveRide(ride: Ride) {
    const currentRides = this.ridesSubject.value;
    const updatedRides = [ride, ...currentRides];
    this.ridesSubject.next(updatedRides);
    localStorage.setItem('ride_history', JSON.stringify(updatedRides));
  }

  async deleteRide(id: string) {
    const updatedRides = this.ridesSubject.value.filter(r => r.id !== id);
    this.ridesSubject.next(updatedRides);
    localStorage.setItem('ride_history', JSON.stringify(updatedRides));
  }
}
