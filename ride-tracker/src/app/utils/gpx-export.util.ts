// src/app/utils/gpx-export.util.ts
import { Ride } from '../models/ride.model';
import { RideUtils } from './ride-calculations';

export class GpxExportUtil {
  /**
   * Generates a GPX XML string from a Ride object.
   */
  static toGpx(ride: Ride): string {
    const date = new Date(ride.startTime).toISOString();
    const totalDistKm = (ride.totalDistance / 1000).toFixed(2);
    const avgSpeedKph = RideUtils.msToKph(ride.averageSpeed).toFixed(1);

    const trackPoints = ride.points
      .map(p => {
        const time = new Date(p.timestamp).toISOString();
        const ele = p.altitude != null ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
        const speed =
          p.speed != null
            ? `<extensions><speed>${p.speed.toFixed(2)}</speed></extensions>`
            : '';
        return `      <trkpt lat="${p.latitude}" lon="${p.longitude}">
        ${ele}
        <time>${time}</time>
        ${speed}
      </trkpt>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideTracker"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Ride ${date}</name>
    <desc>Distance: ${totalDistKm} km, Avg Speed: ${avgSpeedKph} km/h</desc>
    <time>${date}</time>
  </metadata>
  <trk>
    <name>Ride on ${date}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
  }

  /**
   * Downloads a GPX file to the user's device (web fallback).
   */
  static downloadGpx(ride: Ride): void {
    const gpxContent = GpxExportUtil.toGpx(ride);
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ride_${ride.id}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}