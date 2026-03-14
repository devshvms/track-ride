import { Component, OnInit } from '@angular/core';
import { RideService } from '../../services/ride.service';
import { GpsPoint, Ride } from '../../models/ride.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ride-summary',
  templateUrl: './ride-summary.component.html',
  styleUrls: ['./ride-summary.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class RideSummaryComponent implements OnInit {
  ride$: Observable<Ride | null>;

  constructor(private rideService: RideService) {
    this.ride$ = this.rideService.currentRide$;
  }

  ngOnInit() {}

  closeSummary() {
    this.rideService.finishSummary(); 
  }

  getBreakCount(ride: Ride): number {
    return ride.breaks ? ride.breaks.length : 0;
  }

  /**
   * Generates a static map URL representing the ride path.
   * Using Google Static Maps API format.
   */
  getStaticMapUrl(ride: Ride): string {
    if (!ride.points || ride.points.length === 0) {
      return 'assets/map-placeholder.png';
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    const size = '600x300';
    const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // !!! IMPORTANT: Replace with your actual Google Maps API Key !!!
    
    // Create a simplified path string from GPS points
    // We pick a maximum of 100 points to keep the URL length safe and map visually clear
    const maxPathPoints = 100;
    const pathPoints = this.simplifyPath(ride.points, maxPathPoints);
    const pathParam = `path=color:0xff0000ff|weight:5|${pathPoints}`;

    // Add markers for start and end points
    const startPoint = ride.points[0];
    const endPoint = ride.points[ride.points.length - 1];
    const markersParam = `markers=color:green%7Clabel:S%7C${startPoint.latitude},${startPoint.longitude}&markers=color:red%7Clabel:E%7C${endPoint.latitude},${endPoint.longitude}`;

    return `${baseUrl}?size=${size}&${pathParam}&${markersParam}&key=${apiKey}`;
  }

  private simplifyPath(points: GpsPoint[], maxPoints: number): string {
    if (points.length <= maxPoints) {
      return points.map(p => `${p.latitude},${p.longitude}`).join('|');
    }
    const step = Math.floor(points.length / maxPoints);
    const simplified = [];
    for (let i = 0; i < points.length; i += step) {
      simplified.push(points[i]);
    }
    // Ensure the last point is always included
    if (simplified[simplified.length - 1] !== points[points.length - 1]) {
      simplified.push(points[points.length - 1]);
    }
    return simplified.map(p => `${p.latitude},${p.longitude}`).join('|');
  }

  onMapError(event: any) {
    console.error('Error loading map image:', event);
    // Optionally, replace with a local placeholder image
    event.target.src = 'assets/map-placeholder.png'; 
  }

  async shareRide(ride: Ride) {
    const totalDistanceKm = (ride.totalDistance / 1000).toFixed(2);
    const avgSpeedKmh = (ride.averageSpeed * 3.6).toFixed(1);
    const rideDuration = this.getRideDurationFormatted(ride);

    const summary = `I just finished a ${totalDistanceKm} km ride in ${rideDuration}! Average Speed: ${avgSpeedKmh} km/h. #RideTracker`;
    
    // You might want to generate a specific URL for the ride if it's hosted online
    // For now, we'll use a placeholder or the current page URL
    const shareUrl = window.location.href; // Placeholder, ideally a unique ride URL

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Ride Summary',
          text: summary,
          url: shareUrl
        });
      } catch (err) {
        console.error('Error sharing ride:', err);
      }
    } else {
      // Fallback for browsers that do not support Web Share API
      alert(`Share this ride:\n\n${summary}\n${shareUrl}`);
    }
  }

  private getRideDurationFormatted(ride: Ride): string {
    if (!ride.endTime) return 'N/A';
    const durationSeconds = (ride.endTime - ride.startTime) / 1000;
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = Math.floor(durationSeconds % 60);

    let durationString = '';
    if (hours > 0) durationString += `${hours}h `;
    if (minutes > 0) durationString += `${minutes}m `;
    durationString += `${seconds}s`;
    return durationString.trim();
  }
}
