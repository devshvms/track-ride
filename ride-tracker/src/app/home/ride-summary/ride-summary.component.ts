import { Component, OnInit } from '@angular/core';
import { RideService } from '../../services/ride.service';
import { Ride } from '../../models/ride.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-ride-summary',
  templateUrl: './ride-summary.component.html',
  styleUrls: ['./ride-summary.component.scss']
})
export class RideSummaryComponent implements OnInit {
  ride$: Observable<Ride | null>;

  constructor(private rideService: RideService) {
    this.ride$ = this.rideService.currentRide$;
  }

  ngOnInit() {}

  closeSummary() {
    // Reset the service state back to IDLE for the next ride
    this.rideService.resetToIdle(); 
  }

  getBreakCount(ride: Ride): number {
    return ride.breaks ? ride.breaks.length : 0;
  }
}
