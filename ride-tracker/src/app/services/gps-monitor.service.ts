import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { GpsStatus } from '../models/ride.model';
import { LocationService } from './location.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class GpsMonitorService {
    private statusSubject = new BehaviorSubject<GpsStatus>({ isLost: false, retryCount: 0 });
    public status$ = this.statusSubject.asObservable();

    private timeoutSubscription?: Subscription;

    constructor(
        private locationService: LocationService,
        private settings: SettingsService
    ) {
        this.locationService.location$.subscribe(() => this.resetTimeout());
        this.locationService.error$.subscribe(() => this.handleGpsError());
    }

    get currentStatus(): GpsStatus {
        return this.statusSubject.value;
    }

    private resetTimeout() {
        this.timeoutSubscription?.unsubscribe();
        if (this.statusSubject.value.isLost) {
            this.statusSubject.next({ 
                isLost: false, 
                retryCount: 0,
                lastFixTimestamp: Date.now()
            });
        }

        const timeout = this.settings.currentSettings.autoPause.gpsLostTimeout || 10000;

        // If no signal for configured seconds, trigger "Lost" state
        this.timeoutSubscription = timer(timeout).subscribe(() => {
            this.handleGpsError();
        });
    }

    private handleGpsError() {
        if (this.statusSubject.value.isLost) return;
        
        const current = this.statusSubject.value;
        const newStatus: GpsStatus = {
            isLost: true,
            lastFixTimestamp: current.lastFixTimestamp || Date.now(),
            retryCount: current.retryCount + 1
        };
        this.statusSubject.next(newStatus);
    }

    resetStatus() {
        this.statusSubject.next({ isLost: false, retryCount: 0 });
        this.resetTimeout();
    }
}
