// src/app/history/history.page.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HistoryService } from '../services/history.service';
import { SettingsService } from '../services/settings.service';
import { Ride } from '../models/ride.model';
import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DurationPipe, DistancePipe, SpeedPipe } from '../pipes/duration.pipe';
import { RideUtils } from '../utils/ride-calculations';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, DurationPipe, DistancePipe, SpeedPipe]
})
export class HistoryPage implements OnInit {

  // ── Filter state ──────────────────────────────────────────
  searchText = '';
  dateFrom: string | null = null;
  dateTo: string | null = null;
  minDistanceKm: number | null = null;
  minAvgSpeedKph: number | null = null;

  private filtersSubject = new BehaviorSubject<void>(undefined);

  filteredRides$: Observable<Ride[]>;
  units$: Observable<'km' | 'miles'>;

  constructor(
    private historyService: HistoryService,
    private router: Router,
    private alertCtrl: AlertController,
    private settingsService: SettingsService
  ) {
    // Combine rides + filter changes reactively
    this.filteredRides$ = combineLatest([
      this.historyService.rides$,
      this.filtersSubject
    ]).pipe(
      map(([rides]) => this.applyFilters(rides))
    );
    this.units$ = this.settingsService.settings$.pipe(map(s => s.units));
  }

  ngOnInit(): void {}

  applyFilters(rides: Ride[]): Ride[] {
    return rides.filter(ride => {
      // Date from
      if (this.dateFrom) {
        const from = new Date(this.dateFrom).getTime();
        if (ride.startTime < from) return false;
      }
      // Date to
      if (this.dateTo) {
        const to = new Date(this.dateTo).getTime() + 86400000; // include full day
        if (ride.startTime > to) return false;
      }
      // Min distance
      if (this.minDistanceKm != null) {
        if (ride.totalDistance / 1000 < this.minDistanceKm) return false;
      }
      // Min avg speed
      if (this.minAvgSpeedKph != null) {
        if (RideUtils.msToKph(ride.averageSpeed) < this.minAvgSpeedKph) return false;
      }
      // Text search (searches date string)
      if (this.searchText.trim()) {
        const q = this.searchText.toLowerCase();
        const dateStr = new Date(ride.startTime).toLocaleDateString().toLowerCase();
        if (!dateStr.includes(q)) return false;
      }
      return true;
    });
  }

  onFilterChange(): void {
    this.filtersSubject.next();
  }

  clearFilters(): void {
    this.searchText = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.minDistanceKm = null;
    this.minAvgSpeedKph = null;
    this.filtersSubject.next();
  }

  openDetail(ride: Ride): void {
    this.router.navigate(['/tabs/history', ride.id]);
  }

  getDuration(ride: Ride): number {
    return ride.endTime ? ride.endTime - ride.startTime : 0;
  }

  async deleteRide(ride: Ride, event: Event): Promise<void> {
    event.stopPropagation(); // prevent row navigation
    const alert = await this.alertCtrl.create({
      header: 'Delete Ride',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.historyService.deleteRide(ride.id)
        }
      ]
    });
    await alert.present();
  }

  async shareRide(ride: Ride, event: Event): Promise<void> {
    event.stopPropagation();
    const distKm   = (ride.totalDistance / 1000).toFixed(2);
    const avgKph   = RideUtils.msToKph(ride.averageSpeed).toFixed(1);
    const duration = RideUtils.formatDuration(this.getDuration(ride));
    const text = `🚴 ${distKm} km in ${duration} · Avg ${avgKph} km/h #RideTracker`;
    if (navigator.share) {
      await navigator.share({ title: 'My Ride', text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  goHome(): void {
    this.router.navigate(['/tabs/home']);
  }

  getStaticMapThumb(ride: Ride): string {
    return RideUtils.getStaticMapUrl(ride.points, 'YOUR_GOOGLE_MAPS_API_KEY', '200x120');
  }
}