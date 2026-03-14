// src/app/home/ride-summary/ride-summary.component.ts
import { Component, EventEmitter, Output } from '@angular/core';
import { RideService } from '../../services/ride.service';
import { Ride } from '../../models/ride.model';
import { Observable } from 'rxjs';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RideUtils } from '../../utils/ride-calculations';
import { SpeedPipe, DistancePipe, DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-ride-summary',
  templateUrl: './ride-summary.component.html',
  styleUrls: ['./ride-summary.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, SpeedPipe, DistancePipe, DurationPipe]
})
export class RideSummaryComponent {
  /** FIX: emit event so parent (HomePage) can navigate to history tab */
  @Output() viewHistory = new EventEmitter<void>();

  ride$: Observable<Ride | null>;

  constructor(private rideService: RideService) {
    this.ride$ = this.rideService.currentRide$;
  }

  closeSummary(): void {
    this.rideService.finishSummary();
  }

  onViewInHistory(): void {
    this.rideService.finishSummary(); // clears state first
    this.viewHistory.emit();          // parent navigates
  }

  getBreakCount(ride: Ride): number {
    return ride.breaks?.length ?? 0;
  }

  getRideDuration(ride: Ride): number {
    return ride.endTime ? ride.endTime - ride.startTime : 0;
  }

  getStaticMapUrl(ride: Ride): string {
    return RideUtils.getStaticMapUrl(ride.points, 'YOUR_GOOGLE_MAPS_API_KEY');
  }

  onMapError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/icon/favicon.png';
  }

  async shareRide(ride: Ride): Promise<void> {
    const distKm     = (ride.totalDistance / 1000).toFixed(2);
    const avgKph     = RideUtils.msToKph(ride.averageSpeed).toFixed(1);
    const maxKph     = RideUtils.msToKph(ride.maxSpeed).toFixed(1);
    const duration   = RideUtils.formatDuration(this.getRideDuration(ride));
    const breakCount = this.getBreakCount(ride);

    const text =
      `🚴 Ride Summary\n` +
      `📏 ${distKm} km in ${duration}\n` +
      `⚡ Avg: ${avgKph} km/h  |  Max: ${maxKph} km/h\n` +
      `☕ ${breakCount} break${breakCount !== 1 ? 's' : ''}\n` +
      `#RideTracker`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Ride Summary', text });
      } catch { /* user cancelled */ }
    } else {
      // Fallback
      await navigator.clipboard.writeText(text).catch(() => {});
      alert('Summary copied to clipboard!');
    }
  }
}