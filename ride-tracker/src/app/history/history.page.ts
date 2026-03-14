import { Component, OnInit } from '@angular/core';
import { HistoryService } from '../services/history.service';
import { Ride } from '../models/ride.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {
  rides$: Observable<Ride[]>;

  constructor(private historyService: HistoryService) {
    this.rides$ = this.historyService.rides$;
  }

  ngOnInit() {}

  deleteRide(id: string) {
    this.historyService.deleteRide(id);
  }

  getTotalDuration(ride: Ride): string {
    if (!ride.endTime) return 'Incomplete';
    const diff = Math.floor((ride.endTime - ride.startTime) / 1000);
    const mins = Math.floor(diff / 60);
    return `${mins} min`;
  }
}
