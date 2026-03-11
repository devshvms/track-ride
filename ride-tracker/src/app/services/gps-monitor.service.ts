import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { GpsStatus } from '../models/ride.model';
import { LocationService } from './location.service';

@Injectable({ providedIn: 'root' })
export class GpsMonitorService {
    private statusSubject = new BehaviorSubject<GpsStatus>({ isLost: false, retryCount: 0 });
    public status$ = this.statusSubject.asObservable();

    private timeoutSubscription?: Subscription;
    private readonly GPS_TIMEOUT_THRESHOLD = 60000; // 60 seconds (Workflow Line 301)

    constructor(private locationService: LocationService) {
        this.locationService.location$.subscribe(() => this.resetTimeout());
        this.locationService.error$.subscribe(() => this.handleGpsError());
    }

    private resetTimeout() {
        this.timeoutSubscription?.unsubscribe();
        if (this.statusSubject.value.isLost) {
            this.statusSubject.next({ isLost: false, retryCount: 0 });
        }

        // If no signal for 60 seconds, trigger "Lost" state
        this.timeoutSubscription = timer(this.GPS_TIMEOUT_THRESHOLD).subscribe(() => {
            this.handleGpsError();
        });
    }

    private handleGpsError() {
        const current = this.statusSubject.value;
        const newStatus: GpsStatus = {
            isLost: true,
            lastFixTimestamp: current.lastFixTimestamp || Date.now(),
            retryCount: current.retryCount + 1
        };
        this.statusSubject.next(newStatus);
    }

    /**
     * Logic to determine if the user is 'Stationary' based on speed threshold
     * defined in AppSettings (Line 52 of ride.model.ts)
     */
    isStationary(speed: number | undefined, minSpeedThreshold: number): boolean {
        if (speed === undefined || speed === null) return true;
        return speed < minSpeedThreshold;
    }

    /**
     * Manual reset if needed by the UI
     */
    resetStatus() {
        this.statusSubject.next({ isLost: false, retryCount: 0 });
        this.resetTimeout();
    }
}

