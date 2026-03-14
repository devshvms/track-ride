// src/app/home/live-map/live-map.component.ts
import { Component, Input, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
    <div class="live-map-container" [class.expanded]="expanded" (click)="toggleExpand()">
      <div id="live-map" class="live-map"></div>
      <div class="map-overlay">
        <ion-icon [name]="expanded ? 'contract-outline' : 'expand-outline'"></ion-icon>
      </div>
    </div>
  `,
  styles: [`
    .live-map-container {
      width: 100%;
      height: 140px;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: height 0.3s ease;
    }
    
    .live-map-container.expanded {
      height: 280px;
    }
    
    .live-map {
      width: 100%;
      height: 100%;
    }
    
    .map-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(255,255,255,0.9);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    
    .map-overlay ion-icon {
      font-size: 18px;
      color: var(--ion-color-dark);
    }
  `]
})
export class LiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() points: GpsPoint[] = [];
  @Input() isTracking = false;

  expanded = false;
  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
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

  toggleExpand(): void {
    this.expanded = !this.expanded;
    setTimeout(() => {
      this.map?.invalidateSize();
      if (this.points.length > 0) {
        const last = this.points[this.points.length - 1];
        this.map?.setView([last.latitude, last.longitude], this.map.getZoom());
      }
    }, 350);
  }

  private initMap(): void {
    const mapElement = document.getElementById('live-map');
    if (!mapElement || this.map) return;

    this.map = L.map('live-map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false
    }).setView([0, 0], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Initialize empty route line
    this.routeLine = L.polyline([], {
      color: '#3880ff',
      weight: 4,
      opacity: 0.8
    }).addTo(this.map);

    // Current position marker
    const pulseIcon = L.divIcon({
      className: 'current-position-marker',
      html: '<div class="pulse-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.currentMarker = L.marker([0, 0], { icon: pulseIcon }).addTo(this.map);

    this.initialized = true;
    this.updateRoute();
  }

  private updateRoute(): void {
    if (!this.map || !this.routeLine || !this.currentMarker || this.points.length === 0) return;

    const latlngs: L.LatLngExpression[] = this.points.map(p => [p.latitude, p.longitude]);
    this.routeLine.setLatLngs(latlngs);

    const lastPoint = this.points[this.points.length - 1];
    this.currentMarker.setLatLng([lastPoint.latitude, lastPoint.longitude]);

    // Center on current position
    this.map.setView([lastPoint.latitude, lastPoint.longitude], this.map.getZoom());
  }
}
