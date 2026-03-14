// src/app/pipes/duration.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { RideUtils } from '../utils/ride-calculations';

/**
 * Formats a millisecond duration into a human-readable string.
 * Usage: {{ durationMs | duration }}  → "1h 23m" or "45m 12s"
 */
@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null || ms <= 0) return '—';
    return RideUtils.formatDuration(ms);
  }
}

/**
 * Converts m/s to km/h and formats to 1 decimal.
 * Usage: {{ speedMs | speed }}  → "42.5 km/h"
 */
@Pipe({ name: 'speed', standalone: true })
export class SpeedPipe implements PipeTransform {
  transform(ms: number | null | undefined, unit: 'km' | 'miles' = 'km'): string {
    if (ms == null) return '0.0';
    const kph = ms * 3.6;
    if (unit === 'miles') return (kph * 0.621371).toFixed(1);
    return kph.toFixed(1);
  }
}

/**
 * Converts meters to km or miles.
 * Usage: {{ distanceM | distance }}  → "12.34"
 */
@Pipe({ name: 'distance', standalone: true })
export class DistancePipe implements PipeTransform {
  transform(meters: number | null | undefined, unit: 'km' | 'miles' = 'km'): string {
    if (meters == null) return '0.00';
    const km = meters / 1000;
    if (unit === 'miles') return (km * 0.621371).toFixed(2);
    return km.toFixed(2);
  }
}