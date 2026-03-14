// src/app/services/map-image-export.service.ts
import { Injectable } from '@angular/core';
import { Ride, GpsPoint } from '../models/ride.model';
import { RideUtils } from '../utils/ride-calculations';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface MapExportOptions {
  aspectRatio?: '16:9' | '4:3';
  showDetails?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapImageExportService {

  /**
   * Creates a map image with route, markers, and ride details overlay.
   * Uses Canvas API directly for reliable rendering.
   */
  async exportRideAsImage(ride: Ride, options: MapExportOptions = {}): Promise<void> {
    const { aspectRatio = '16:9', showDetails = true } = options;

    if (!ride.points || ride.points.length === 0) {
      throw new Error('No GPS points to export');
    }

    // Standard dimensions based on aspect ratio
    const width = aspectRatio === '16:9' ? 1280 : 1024;
    const height = aspectRatio === '16:9' ? 720 : 768;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Calculate bounds
    const bounds = this.calculateBounds(ride.points);
    const padding = 60; // pixels

    // Load and draw map tiles
    await this.drawMapTiles(ctx, bounds, width, height, padding);

    // Draw route polyline
    this.drawRoute(ctx, ride.points, bounds, width, height, padding);

    // Draw start marker (green)
    this.drawMarker(ctx, ride.points[0], bounds, width, height, padding, '#2dd36f', 'S');

    // Draw end marker (red)
    this.drawMarker(ctx, ride.points[ride.points.length - 1], bounds, width, height, padding, '#eb445a', 'E');

    // Draw details overlay
    if (showDetails) {
      this.drawDetailsOverlay(ctx, ride, width, height);
    }

    // Convert to blob and share
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image'));
      }, 'image/png', 0.95);
    });

    await this.shareImage(blob, ride);
  }

  private calculateBounds(points: GpsPoint[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const p of points) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }

    // Add some margin
    const latMargin = (maxLat - minLat) * 0.15 || 0.002;
    const lngMargin = (maxLng - minLng) * 0.15 || 0.002;

    return {
      minLat: minLat - latMargin,
      maxLat: maxLat + latMargin,
      minLng: minLng - lngMargin,
      maxLng: maxLng + lngMargin
    };
  }

  private latLngToPixel(
    lat: number, lng: number,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number, padding: number
  ): { x: number; y: number } {
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * drawWidth;
    const y = padding + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * drawHeight;

    return { x, y };
  }

  private async drawMapTiles(
    ctx: CanvasRenderingContext2D,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number, padding: number
  ): Promise<void> {
    // Fill background
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, width, height);

    // Calculate zoom level and tiles needed
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const zoom = this.calculateZoom(bounds, width - padding * 2, height - padding * 2);

    // Get tile coordinates
    const tiles = this.getTilesForBounds(bounds, zoom);

    // Load all tiles
    const tilePromises: Promise<void>[] = [];

    for (const tile of tiles) {
      const url = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;
      const tilePromise = this.loadAndDrawTile(ctx, url, tile, zoom, bounds, width, height, padding);
      tilePromises.push(tilePromise);
    }

    await Promise.all(tilePromises);
  }

  private calculateZoom(
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number
  ): number {
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;

    // Calculate zoom based on bounds
    const latZoom = Math.log2(180 / latDiff) + 1;
    const lngZoom = Math.log2(360 / lngDiff) + 1;

    // Max zoom 16 to prevent over-zooming on short routes
    // OSM zoom levels: 0 = world, 18 = street level
    // 16 = neighborhood level (~150m per tile width)
    const MAX_ZOOM = 16;
    return Math.min(Math.floor(Math.min(latZoom, lngZoom)), MAX_ZOOM);
  }

  private getTilesForBounds(
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    zoom: number
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];

    const minTileX = this.lngToTileX(bounds.minLng, zoom);
    const maxTileX = this.lngToTileX(bounds.maxLng, zoom);
    const minTileY = this.latToTileY(bounds.maxLat, zoom);
    const maxTileY = this.latToTileY(bounds.minLat, zoom);

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  private lngToTileX(lng: number, zoom: number): number {
    return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  }

  private latToTileY(lat: number, zoom: number): number {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  private tileXToLng(x: number, zoom: number): number {
    return x / Math.pow(2, zoom) * 360 - 180;
  }

  private tileYToLat(y: number, zoom: number): number {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  private async loadAndDrawTile(
    ctx: CanvasRenderingContext2D,
    url: string,
    tile: { x: number; y: number },
    zoom: number,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number, padding: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Calculate tile bounds in lat/lng
        const tileLngMin = this.tileXToLng(tile.x, zoom);
        const tileLngMax = this.tileXToLng(tile.x + 1, zoom);
        const tileLatMax = this.tileYToLat(tile.y, zoom);
        const tileLatMin = this.tileYToLat(tile.y + 1, zoom);

        // Convert to pixel coordinates
        const topLeft = this.latLngToPixel(tileLatMax, tileLngMin, bounds, width, height, padding);
        const bottomRight = this.latLngToPixel(tileLatMin, tileLngMax, bounds, width, height, padding);

        const tileWidth = bottomRight.x - topLeft.x;
        const tileHeight = bottomRight.y - topLeft.y;

        ctx.drawImage(img, topLeft.x, topLeft.y, tileWidth, tileHeight);
        resolve();
      };
      img.onerror = () => resolve(); // Skip failed tiles
      img.src = url;
    });
  }

  private drawRoute(
    ctx: CanvasRenderingContext2D,
    points: GpsPoint[],
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number, padding: number
  ): void {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#3880ff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = this.latLngToPixel(points[0].latitude, points[0].longitude, bounds, width, height, padding);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const p = this.latLngToPixel(points[i].latitude, points[i].longitude, bounds, width, height, padding);
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    point: GpsPoint,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    width: number, height: number, padding: number,
    color: string, label: string
  ): void {
    const { x, y } = this.latLngToPixel(point.latitude, point.longitude, bounds, width, height, padding);
    const radius = 14;

    // Outer white circle
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Inner colored circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  private drawDetailsOverlay(ctx: CanvasRenderingContext2D, ride: Ride, width: number, height: number): void {
    const duration = ride.endTime ? ride.endTime - ride.startTime : 0;
    const distKm = (ride.totalDistance / 1000).toFixed(2);
    const avgKph = RideUtils.msToKph(ride.averageSpeed).toFixed(1);
    const maxKph = RideUtils.msToKph(ride.maxSpeed).toFixed(1);
    const durationStr = RideUtils.formatDuration(duration);
    const dateStr = new Date(ride.startTime).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    // Overlay box dimensions
    const boxWidth = 180;
    const boxHeight = 130;
    const boxX = width - boxWidth - 20;
    const boxY = height - boxHeight - 20;
    const borderRadius = 12;

    // Draw rounded rectangle background
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fill();

    // Text settings
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';

    // Distance (large)
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`🚴 ${distKm} km`, boxX + 14, boxY + 28);

    // Duration
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`⏱ ${durationStr}`, boxX + 14, boxY + 52);

    // Avg speed
    ctx.fillText(`⚡ Avg: ${avgKph} km/h`, boxX + 14, boxY + 72);

    // Max speed
    ctx.fillText(`🔝 Max: ${maxKph} km/h`, boxX + 14, boxY + 92);

    // Date
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(dateStr, boxX + 14, boxY + 112);

    // Branding
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('RideTracker', boxX + boxWidth - 14, boxY + 112);
  }

  private async shareImage(blob: Blob, ride: Ride): Promise<void> {
    const fileName = `ride_${new Date(ride.startTime).toISOString().slice(0, 10)}.png`;

    try {
      // Convert blob to base64 for Capacitor
      const base64 = await this.blobToBase64(blob);

      // Save to cache directory
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache
      });

      // Share via native share
      await Share.share({
        title: 'My Ride',
        url: result.uri,
        dialogTitle: 'Share Ride Map'
      });
    } catch {
      // Fallback: download in browser
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
