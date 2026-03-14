// src/app/history/ride-detail/ride-detail.page.ts
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../services/history.service';
import { Ride, GpsPoint } from '../../models/ride.model';
import { RideUtils } from '../../utils/ride-calculations';
import { SpeedPipe, DistancePipe, DurationPipe } from '../../pipes/duration.pipe';
import { GpxExportService } from '../../services/gpx-export.service';
import { MapImageExportService } from '../../services/map-image-export.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-ride-detail',
  templateUrl: './ride-detail.page.html',
  styleUrls: ['./ride-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, SpeedPipe, DistancePipe, DurationPipe]
})
export class RideDetailPage implements OnInit, AfterViewInit, OnDestroy {
  ride: Ride | null = null;
  private map: L.Map | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private historyService: HistoryService,
    private alertCtrl: AlertController,
    private gpxExport: GpxExportService,
    private mapImageExport: MapImageExportService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ride = this.historyService.getRideById(id) ?? null;
    }
    if (!this.ride) {
      this.router.navigate(['/tabs/history']);
    }
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
    if (!this.ride || this.ride.points.length === 0) return;

    const mapElement = document.getElementById('ride-map');
    if (!mapElement) return;

    // Calculate bounds from points
    const points = this.ride.points;
    const latlngs: L.LatLngExpression[] = points.map(p => [p.latitude, p.longitude]);

    // Initialize map
    this.map = L.map('ride-map', {
      zoomControl: true,
      attributionControl: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Draw route polyline
    const routeLine = L.polyline(latlngs, {
      color: '#3880ff',
      weight: 4,
      opacity: 0.8
    }).addTo(this.map);

    // Add start marker
    const startIcon = L.divIcon({
      className: 'custom-marker start-marker',
      html: '<div class="marker-pin start"><ion-icon name="flag"></ion-icon></div>',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
    L.marker([points[0].latitude, points[0].longitude], { icon: startIcon })
      .bindPopup('Start')
      .addTo(this.map);

    // Add end marker
    const endIcon = L.divIcon({
      className: 'custom-marker end-marker',
      html: '<div class="marker-pin end"><ion-icon name="checkmark-circle"></ion-icon></div>',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
    L.marker([points[points.length - 1].latitude, points[points.length - 1].longitude], { icon: endIcon })
      .bindPopup('End')
      .addTo(this.map);

    // Fit map to route bounds
    this.map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
  }

  // ── Computed values ──────────────────────────────────────────
  get duration(): number {
    if (!this.ride) return 0;
    return this.ride.endTime ? this.ride.endTime - this.ride.startTime : 0;
  }

  get activeDuration(): number {
    if (!this.ride) return 0;
    return this.duration - (this.ride.totalPausedTime ?? 0);
  }

  getBreakDuration(brk: { startTime: number; endTime?: number }): number {
    return brk.endTime ? brk.endTime - brk.startTime : 0;
  }

  formatPauseReason(reason: string): string {
    if (reason.startsWith('auto:')) {
      const type = reason.replace('auto:', '');
      const labels: Record<string, string> = {
        'gps_lost': 'GPS Lost',
        'stationary': 'Stationary',
        'backgrounded': 'App Backgrounded',
        'low_speed': 'Low Speed'
      };
      return `Auto: ${labels[type] || type}`;
    }
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  // ── Actions ──────────────────────────────────────────────────
  async shareRide(): Promise<void> {
    if (!this.ride) return;
    const distKm = (this.ride.totalDistance / 1000).toFixed(2);
    const avgKph = RideUtils.msToKph(this.ride.averageSpeed).toFixed(1);
    const maxKph = RideUtils.msToKph(this.ride.maxSpeed).toFixed(1);
    const durationStr = RideUtils.formatDuration(this.duration);
    const text = `🚴 Ride Summary\n📏 ${distKm} km\n⏱ ${durationStr}\n⚡ Avg: ${avgKph} km/h\n🔝 Max: ${maxKph} km/h\n☕ ${this.ride.breaks.length} breaks\n#RideTracker`;

    if (navigator.share) {
      await navigator.share({ title: 'My Ride', text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  async exportGpx(): Promise<void> {
    if (!this.ride) return;
    try {
      await this.gpxExport.exportRide(this.ride);
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Export Failed',
        message: 'Could not export GPX file.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async shareAsImage(): Promise<void> {
    if (!this.ride) return;
    try {
      await this.mapImageExport.exportRideAsImage(this.ride);
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Export Failed',
        message: 'Could not create map image.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async deleteRide(): Promise<void> {
    if (!this.ride) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete Ride',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.historyService.deleteRide(this.ride!.id);
            this.router.navigate(['/tabs/history']);
          }
        }
      ]
    });
    await alert.present();
  }

  goBack(): void {
    this.router.navigate(['/tabs/history']);
  }
}
