// src/app/models/ride.model.ts

export interface GpsPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number; // meters per second (raw from GPS)
  timestamp: number;
}

export interface RideBreak {
  startTime: number;
  endTime?: number;
  reason: PauseReason;
  duration?: number; // ms - calculated on resume
  location?: GpsPoint;
}

export interface Ride {
  id: string;
  startTime: number;
  endTime?: number;
  points: GpsPoint[];
  breaks: RideBreak[];
  totalDistance: number;   // meters
  averageSpeed: number;    // m/s  ← FIXED: was km/h, now consistent with maxSpeed
  maxSpeed: number;        // m/s
  currentSpeed: number;    // m/s - rolling average for speedometer display
  totalPausedTime?: number; // ms (sum of all break durations)
}

export type PauseReason =
  | 'break'
  | 'refreshment'
  | 'traffic'
  | 'fuel'
  | 'photo'
  | 'other';

export interface GpsStatus {
  isLost: boolean;
  lastFixTimestamp?: number;
  retryCount: number;
}

export type TrackingMode = 'normal' | 'battery_saver';
export type IntervalPreset = 10 | 30 | 60 | 300; // 10s, 30s, 1min, 5min

export interface AppSettings {
  trackingMode: TrackingMode; // normal or battery_saver
  readingInterval: IntervalPreset; // seconds - preset values only
  units: 'km' | 'miles';
  theme: 'light' | 'dark' | 'system'; // NEW
  pushNotifications: boolean; // NEW
  syncWithGoogle: boolean;
}