import { Component, OnInit } from '@angular/core';
import { HistoryService } from '../services/history.service';
import { Ride } from '../models/ride.model';
import { Share } from '@capacitor/share';

@Component({
  selector: 'app-history',
  templateUrl: 'history.page.html',
  styleUrls: ['history.page.scss'],
  standalone: false
})
export class HistoryPage implements OnInit {
  rides: Ride[] = [];
  filteredRides: Ride[] = [];
  
  startDate: string | null = null;
  endDate: string | null = null;

  constructor(private historyService: HistoryService) {}

  ngOnInit() {
    this.historyService.rides$.subscribe(rides => {
      this.rides = rides;
      this.applyFilters();
    });
  }

  applyFilters() {
    this.filteredRides = this.rides.filter(ride => {
      let matches = true;
      if (this.startDate) {
        matches = matches && ride.startTime >= new Date(this.startDate).getTime();
      }
      if (this.endDate) {
        matches = matches && ride.startTime <= new Date(this.endDate).getTime();
      }
      return matches;
    });
  }

  async shareRide(ride: Ride) {
    await Share.share({
      title: 'My Ride Summary',
      text: `I completed a ride of ${(ride.totalDistance / 1000).toFixed(2)}km with an average speed of ${(ride.averageSpeed * 3.6).toFixed(1)}km/h!`,
      url: 'https://ride-tracker-app.example.com',
      dialogTitle: 'Share Ride'
    });
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
}
