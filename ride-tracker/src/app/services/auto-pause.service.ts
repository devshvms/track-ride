import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AutoPauseService {
  private autoPauseEvent = new Subject<boolean>(); // true = pause, false = resume

  // Observable for RideService to consume
  autoPauseEvents$: Observable<boolean> = this.autoPauseEvent.asObservable();

  // Logic to be called by GPS location updates
  evaluateMovement(speed: number, accuracy: number): void {
    if (speed < 0.5) { // Threshold for "Stationary"
      this.autoPauseEvent.next(true);
    } else if (speed > 1.0) {
      this.autoPauseEvent.next(false);
    }
  }

  signalLost(): void {
    this.autoPauseEvent.next(true);
  }
}
