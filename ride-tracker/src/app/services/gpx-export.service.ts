// src/app/services/gpx-export.service.ts
import { Injectable } from '@angular/core';
import { Ride, GpsPoint } from '../models/ride.model';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

@Injectable({ providedIn: 'root' })
export class GpxExportService {

  /**
   * Exports a ride as a GPX file and triggers native share/download.
   */
  async exportRide(ride: Ride): Promise<void> {
    const gpxContent = this.generateGpx(ride);
    const fileName = `ride_${new Date(ride.startTime).toISOString().slice(0, 10)}_${ride.id.slice(0, 8)}.gpx`;

    try {
      // Try Capacitor Filesystem (mobile)
      const result = await Filesystem.writeFile({
        path: fileName,
        data: gpxContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      // Share the file
      await Share.share({
        title: 'Export Ride GPX',
        url: result.uri,
        dialogTitle: 'Share GPX File'
      });
    } catch {
      // Fallback for web: trigger download
      this.downloadAsFile(gpxContent, fileName, 'application/gpx+xml');
    }
  }

  /**
   * Generates GPX XML string from a Ride.
   */
  generateGpx(ride: Ride): string {
    const startDate = new Date(ride.startTime).toISOString();
    const trackPoints = ride.points.map(p => this.pointToTrkpt(p)).join('\n      ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideTracker"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Ride ${startDate.slice(0, 10)}</name>
    <time>${startDate}</time>
    <desc>Distance: ${(ride.totalDistance / 1000).toFixed(2)} km, Avg Speed: ${(ride.averageSpeed * 3.6).toFixed(1)} km/h</desc>
  </metadata>
  <trk>
    <name>Ride Track</name>
    <trkseg>
      ${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
  }

  private pointToTrkpt(point: GpsPoint): string {
    const time = new Date(point.timestamp).toISOString();
    let trkpt = `<trkpt lat="${point.latitude}" lon="${point.longitude}">`;
    trkpt += `\n        <time>${time}</time>`;
    if (point.altitude != null) {
      trkpt += `\n        <ele>${point.altitude.toFixed(1)}</ele>`;
    }
    if (point.speed != null) {
      trkpt += `\n        <extensions><speed>${point.speed.toFixed(2)}</speed></extensions>`;
    }
    trkpt += `\n      </trkpt>`;
    return trkpt;
  }

  private downloadAsFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
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
