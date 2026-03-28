// src/app/services/map-image-export.service.ts
import { Injectable } from '@angular/core';
import { Ride } from '../models/ride.model';
import { RideUtils } from '../utils/ride-calculations';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import html2canvas from 'html2canvas';

export interface MapExportOptions {
  mapElement?: HTMLElement;
  showDetails?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapImageExportService {

  /**
   * Captures the actual rendered Leaflet map view and adds ride details overlay.
   * User should adjust the map zoom/pan before calling this for best results.
   */
  async exportRideAsImage(ride: Ride, options: MapExportOptions = {}): Promise<void> {
    const { mapElement, showDetails = true } = options;

    if (!ride.points || ride.points.length === 0) {
      throw new Error('No GPS points to export');
    }

    // Find the map element if not provided
    const mapEl = mapElement || document.getElementById('ride-map');
    if (!mapEl) {
      throw new Error('Map element not found');
    }

    // Force Leaflet to recalculate dimensions and invalidate size
    await this.prepareMapForCapture(mapEl);

    // Wait for tiles to load
    await this.waitForTilesToLoad(mapEl);

    // Use device pixel ratio for proper scaling
    const pixelRatio = window.devicePixelRatio || 1;

    // Capture the map using html2canvas
    const mapCanvas = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      scale: pixelRatio,
      logging: false,
      backgroundColor: '#f2efe9',
      width: mapEl.offsetWidth,
      height: mapEl.offsetHeight,
      windowWidth: mapEl.offsetWidth,
      windowHeight: mapEl.offsetHeight
    });

    // Create final canvas with map + details overlay
    const finalWidth = mapCanvas.width;
    const finalHeight = mapCanvas.height + (showDetails ? 160 : 0);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;
    const ctx = finalCanvas.getContext('2d')!;

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalWidth, finalHeight);

    // Draw the captured map
    ctx.drawImage(mapCanvas, 0, 0);

    // Draw details overlay below the map
    if (showDetails) {
      this.drawDetailsOverlay(ctx, ride, finalWidth, mapCanvas.height);
    }

    // Convert to blob and share
    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image'));
      }, 'image/png', 0.95);
    });

    await this.shareImage(blob, ride);
  }

  /**
   * Alternative method: capture map element directly from the page.
   * Call this from ride-detail page with the map container reference.
   */
  async captureMapSnapshot(
    mapContainer: HTMLElement,
    ride: Ride,
    showDetails = true
  ): Promise<void> {
    // Prepare map for capture
    await this.prepareMapForCapture(mapContainer);

    // Wait for any pending tile loads
    await this.waitForTilesToLoad(mapContainer);

    // Use device pixel ratio for proper scaling
    const pixelRatio = window.devicePixelRatio || 1;

    // Capture with html2canvas
    const mapCanvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      scale: pixelRatio,
      logging: false,
      backgroundColor: '#f2efe9',
      width: mapContainer.offsetWidth,
      height: mapContainer.offsetHeight,
      windowWidth: mapContainer.offsetWidth,
      windowHeight: mapContainer.offsetHeight,
      onclone: (clonedDoc) => {
        // Ensure map tiles are visible in clone
        const clonedMap = clonedDoc.getElementById('ride-map');
        if (clonedMap) {
          clonedMap.style.overflow = 'visible';
        }
      }
    });

    // Create final canvas
    const padding = 20;
    const detailsHeight = showDetails ? 140 : 0;
    const finalWidth = mapCanvas.width + padding * 2;
    const finalHeight = mapCanvas.height + detailsHeight + padding * 2;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;
    const ctx = finalCanvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalWidth, finalHeight);

    // Draw map with padding
    ctx.drawImage(mapCanvas, padding, padding);

    // Draw details below map
    if (showDetails) {
      this.drawDetailsOverlay(ctx, ride, finalWidth, mapCanvas.height + padding);
    }

    // Convert and share
    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image'));
      }, 'image/png', 0.95);
    });

    await this.shareImage(blob, ride);
  }

  private async prepareMapForCapture(mapEl: HTMLElement): Promise<void> {
    // Get the Leaflet map instance from the element
    const leafletMap = (mapEl as any)._leaflet_map;
    
    if (leafletMap) {
      // Force Leaflet to recalculate its size and invalidate
      leafletMap.invalidateSize({ pan: false });
      
      // Wait for the map to finish rendering
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  private async waitForTilesToLoad(mapEl: HTMLElement): Promise<void> {
    // Wait for tile images to load
    const tiles = mapEl.querySelectorAll('.leaflet-tile');
    const loadPromises: Promise<void>[] = [];

    tiles.forEach(tile => {
      if (tile instanceof HTMLImageElement && !tile.complete) {
        loadPromises.push(new Promise(resolve => {
          tile.onload = () => resolve();
          tile.onerror = () => resolve();
          // Timeout after 3s
          setTimeout(resolve, 3000);
        }));
      }
    });

    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }

    // Additional delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private drawDetailsOverlay(
    ctx: CanvasRenderingContext2D,
    ride: Ride,
    width: number,
    yOffset: number
  ): void {
    const duration = ride.endTime ? ride.endTime - ride.startTime : 0;
    const activeDuration = duration - (ride.totalPausedTime ?? 0);
    const distKm = (ride.totalDistance / 1000).toFixed(2);
    const avgKph = RideUtils.msToKph(ride.averageSpeed).toFixed(1);
    const maxKph = RideUtils.msToKph(ride.maxSpeed).toFixed(1);
    const durationStr = RideUtils.formatDuration(activeDuration);
    const dateStr = new Date(ride.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const boxY = yOffset + 20;
    const boxPadding = 30;

    // Stats row background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, boxY, width, 120);

    // Stats - 4 columns
    const colWidth = width / 4;
    const stats = [
      { value: distKm, unit: 'km', label: 'Distance' },
      { value: durationStr, unit: '', label: 'Duration' },
      { value: avgKph, unit: 'km/h', label: 'Avg Speed' },
      { value: maxKph, unit: 'km/h', label: 'Max Speed' }
    ];

    ctx.textAlign = 'center';

    stats.forEach((stat, i) => {
      const x = colWidth * i + colWidth / 2;

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(stat.value, x, boxY + 45);

      // Unit
      if (stat.unit) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(stat.unit, x, boxY + 65);
      }

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(stat.label.toUpperCase(), x, boxY + 95);
    });

    // Date and branding at bottom
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dateStr, boxPadding, boxY + 110);

    ctx.textAlign = 'right';
    ctx.fillText('🚴 RideTracker', width - boxPadding, boxY + 110);
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
