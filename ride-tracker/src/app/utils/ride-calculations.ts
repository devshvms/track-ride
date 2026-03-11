import { GpsPoint } from '../models/ride.model';

export class RideUtils {
  /**
   * Calculates distance between two points using Haversine formula (meters)
   */
  static calculateDistance(p1: GpsPoint, p2: GpsPoint): number {
    const R = 6371e3; // Earth radius in meters
    const lat1Rad = (p1.latitude * Math.PI) / 180;
    const lat2Rad = (p2.latitude * Math.PI) / 180;
    const deltaLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const deltaLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts meters per second to kilometers per hour
   */
  static msToKph(ms: number): number {
    return ms * 3.6;
  }

  static calculateAverageSpeed(totalDistanceMeters: number, startTimeMs: number, endTimeMs: number): number {
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;
    if (durationSeconds <= 0) return 0;
    const speedMs = totalDistanceMeters / durationSeconds;
    return this.msToKph(speedMs);
  }
}
