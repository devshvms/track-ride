// src/app/home/ride-summary/ride-summary.component.ts
import { Component, EventEmitter, Output, AfterViewInit, OnDestroy } from '@angular/core';
import { RideService } from '../../services/ride.service';
import { SettingsService } from '../../services/settings.service';
import { Ride } from '../../models/ride.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RideUtils } from '../../utils/ride-calculations';
import { SpeedPipe, DistancePipe, DurationPipe } from '../../pipes/duration.pipe';
import * as L from 'leaflet';
import { MapImageExportService } from '../../services/map-image-export.service';

@Component({
  selector: 'app-ride-summary',
  templateUrl: './ride-summary.component.html',
  styleUrls: ['./ride-summary.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, SpeedPipe, DistancePipe, DurationPipe]
})
export class RideSummaryComponent implements AfterViewInit, OnDestroy {
  private map: L.Map | null = null;
  /** FIX: emit event so parent (HomePage) can navigate to history tab */
  @Output() viewHistory = new EventEmitter<void>();

  ride$: Observable<Ride | null>;
  units$: Observable<'km' | 'miles'>;

  constructor(
    private rideService: RideService,
    private mapImageExport: MapImageExportService,
    private settingsService: SettingsService
  ) {
    this.ride$ = this.rideService.currentRide$;
    this.units$ = this.settingsService.settings$.pipe(map(s => s.units));
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    this.ride$.subscribe(ride => {
      if (!ride || ride.points.length === 0) return;
      if (this.map) return; // Already initialized

      const mapElement = document.getElementById('summary-map');
      if (!mapElement) return;

      const latlngs: L.LatLngExpression[] = ride.points.map(p => [p.latitude, p.longitude]);

      this.map = L.map('summary-map', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

      const routeLine = L.polyline(latlngs, {
        color: '#2dd36f',
        weight: 4,
        opacity: 0.9
      }).addTo(this.map);

      // Add start/end markers
      const points = ride.points;
      L.circleMarker([points[0].latitude, points[0].longitude], {
        radius: 8, color: '#2dd36f', fillColor: '#2dd36f', fillOpacity: 1
      }).addTo(this.map);
      L.circleMarker([points[points.length-1].latitude, points[points.length-1].longitude], {
        radius: 8, color: '#eb445a', fillColor: '#eb445a', fillOpacity: 1
      }).addTo(this.map);

      this.map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
    }).unsubscribe;
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

  async shareAsImage(ride: Ride): Promise<void> {
    try {
      const mapElement = document.getElementById('summary-map');
      await this.mapImageExport.exportRideAsImage(ride, { mapElement: mapElement ?? undefined });
    } catch (err) {
      console.error('Share image error:', err);
      alert('Could not create map image.');
    }
  }
}