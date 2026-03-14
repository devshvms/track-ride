// src/app/utils/ride-calculations.ts
import { GpsPoint } from '../models/ride.model';

export class RideUtils {
  /**
   * Calculates distance between two GPS points using Haversine formula.
   * @returns distance in meters
   */
  static calculateDistance(p1: GpsPoint, p2: GpsPoint): number {
    const R = 6371e3;
    const lat1Rad = (p1.latitude * Math.PI) / 180;
    const lat2Rad = (p2.latitude * Math.PI) / 180;
    const deltaLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const deltaLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts m/s to km/h.
   */
  static msToKph(ms: number): number {
    return ms * 3.6;
  }

  /**
   * Calculates average speed.
   * FIX: Now returns m/s (was returning km/h, causing inconsistency with maxSpeed).
   * @returns speed in m/s
   */
  static calculateAverageSpeed(
    totalDistanceMeters: number,
    startTimeMs: number,
    endTimeMs: number,
    totalPausedMs = 0
  ): number {
    const durationSeconds = (endTimeMs - startTimeMs - totalPausedMs) / 1000;
    if (durationSeconds <= 0) return 0;
    return totalDistanceMeters / durationSeconds; // m/s
  }

  /**
   * Formats a duration in milliseconds into a human-readable string.
   */
  static formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /**
   * Formats elapsed seconds as HH:MM:SS.
   */
  static formatElapsed(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0
      ? `${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}`;
  }

  /**
   * Simplifies a GPS path array to at most maxPoints for URL-safe map rendering.
   */
  static simplifyPath(points: GpsPoint[], maxPoints: number): GpsPoint[] {
    if (points.length <= maxPoints) return points;
    const step = Math.floor(points.length / maxPoints);
    const simplified: GpsPoint[] = [];
    for (let i = 0; i < points.length; i += step) {
      simplified.push(points[i]);
    }
    const last = points[points.length - 1];
    if (simplified[simplified.length - 1] !== last) {
      simplified.push(last);
    }
    return simplified;
  }

  /**
   * Generates a Google Static Maps URL for a ride route.
   * Returns a placeholder path if no API key is configured.
   */
  static getStaticMapUrl(
    points: GpsPoint[],
    apiKey: string,
    size = '600x300'
  ): string {
    if (!points || points.length === 0) return '';
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      // Use OpenStreetMap static tile as a free fallback visual
      const center = points[Math.floor(points.length / 2)];
      return `https://staticmap.openstreetmap.de/staticmap.php?center=${center.latitude},${center.longitude}&zoom=13&size=${size.replace('x', 'x')}`;
    }
    const simplified = RideUtils.simplifyPath(points, 100);
    const path = simplified.map(p => `${p.latitude},${p.longitude}`).join('|');
    const start = points[0];
    const end = points[points.length - 1];
    return (
      `https://maps.googleapis.com/maps/api/staticmap?size=${size}` +
      `&path=color:0xff0000ff|weight:5|${path}` +
      `&markers=color:green%7Clabel:S%7C${start.latitude},${start.longitude}` +
      `&markers=color:red%7Clabel:E%7C${end.latitude},${end.longitude}` +
      `&key=${apiKey}`
    );
  }
}