// src/app/home/live-map/live-map.component.ts
import { Component, Input, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { GpsPoint } from '../../models/ride.model';
import * as L from 'leaflet';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="live-map-container">
      <div #liveMapEl class="live-map"></div>
      @if (points.length > 0) {
        <div class="map-stats-overlay">
          <div class="tracking-indicator" [class.active]="isTracking">
            <div class="pulse-ring"></div>
            <ion-icon name="navigate"></ion-icon>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .live-map-container {
      width: 100%;
      height: 300px;
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      margin-bottom: 16px;
    }
    
    .live-map {
      width: 100%;
      height: 100%;
      background: #f0f0f0;
    }
    
    .map-stats-overlay {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
    }
    
    .tracking-indicator {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.95);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      position: relative;
    }
    
    .tracking-indicator ion-icon {
      font-size: 20px;
      color: var(--ion-color-primary);
    }
    
    .tracking-indicator.active ion-icon {
      color: var(--ion-color-success);
    }
    
    .tracking-indicator.active .pulse-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 2px solid var(--ion-color-success);
      border-radius: 50%;
      animation: pulse-ring 1.5s ease-out infinite;
    }
    
    @keyframes pulse-ring {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }
    
    /* Custom marker styles */
    :host ::ng-deep .start-position-marker {
      background: #4285F4;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    
    :host ::ng-deep .current-position-marker {
      background: transparent;
      border: none;
    }
    
    :host ::ng-deep .pulse-dot {
      width: 16px;
      height: 16px;
      background: #4285F4;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      position: relative;
    }
    
    :host ::ng-deep .pulse-dot::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100%;
      height: 100%;
      background: #4285F4;
      border-radius: 50%;
      animation: pulse 2s ease-out infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.5);
        opacity: 0;
      }
    }
  `]
})
export class LiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('liveMapEl') mapElementRef!: ElementRef<HTMLDivElement>;
  @Input() points: GpsPoint[] = [];
  @Input() isTracking = false;

  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
  private startMarker: L.Marker | null = null;
  private currentMarker: L.Marker | null = null;
  private initialized = false;

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.initialized) {
      this.updateRoute();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }


  private initMap(): void {
    const mapElement = this.mapElementRef?.nativeElement;
    if (!mapElement || this.map) return;

    this.map = L.map(mapElement, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: false
    }).setView([0, 0], 15);

    // Use OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(this.map);

    // Initialize route line with purple color (like in the image)
    this.routeLine = L.polyline([], {
      color: '#8B5CF6',  // Purple color
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);

    // Start position marker (blue dot)
    const startIcon = L.divIcon({
      className: 'start-position-marker',
      html: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    this.startMarker = L.marker([0, 0], { icon: startIcon });

    // Current position marker (blue dot with pulse)
    const currentIcon = L.divIcon({
      className: 'current-position-marker',
      html: '<div class="pulse-dot"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    this.currentMarker = L.marker([0, 0], { icon: currentIcon }).addTo(this.map);

    this.initialized = true;
    this.updateRoute();
  }

  private updateRoute(): void {
    if (!this.map || !this.routeLine || !this.currentMarker || this.points.length === 0) return;

    const latlngs: L.LatLngExpression[] = this.points.map(p => [p.latitude, p.longitude]);
    this.routeLine.setLatLngs(latlngs);

    // Show start marker on first point
    if (this.points.length > 0 && this.startMarker) {
      const firstPoint = this.points[0];
      this.startMarker.setLatLng([firstPoint.latitude, firstPoint.longitude]);
      if (!this.map.hasLayer(this.startMarker)) {
        this.startMarker.addTo(this.map);
      }
    }

    // Update current position marker
    const lastPoint = this.points[this.points.length - 1];
    this.currentMarker.setLatLng([lastPoint.latitude, lastPoint.longitude]);

    // Auto-fit bounds to show entire route with padding
    if (this.points.length > 1) {
      const bounds = L.latLngBounds(latlngs);
      this.map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 16,
        animate: true
      });
    } else {
      // Single point - just center on it
      this.map.setView([lastPoint.latitude, lastPoint.longitude], 16);
    }
  }
}
