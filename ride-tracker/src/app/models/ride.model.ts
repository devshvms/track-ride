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
  | 'other'
  | 'auto:gps_lost'
  | 'auto:stationary'
  | 'auto:backgrounded'
  | 'auto:low_speed';

export interface GpsStatus {
  isLost: boolean;
  lastFixTimestamp?: number;
  retryCount: number;
}

export interface AppSettings {
  gpsAccuracy: 'high' | 'balanced' | 'low';
  readingInterval: number; // seconds
  autoPause: {
    enabled: boolean;
    stationaryThreshold: number; // seconds
    minSpeedThreshold: number;   // m/s
    pauseOnBackground: boolean;
    pauseOnGpsLost: boolean;
    gpsLostTimeout: number;      // seconds ← FIXED: was ms, now seconds (multiply by 1000 in service)
  };
  units: 'km' | 'miles';
  theme: 'light' | 'dark' | 'system'; // NEW
  mapType: 'street' | 'satellite' | 'terrain'; // NEW
  pushNotifications: boolean; // NEW
  syncWithGoogle: boolean;
}