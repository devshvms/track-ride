// ride-tracker/src/app/models/ride.model.ts

export interface GpsPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number; // meters per second
  timestamp: number;
}

export interface RideBreak {
  startTime: number;
  endTime?: number;
  reason: PauseReason;
  location?: GpsPoint;
}

export interface Ride {
  id: string;
  startTime: number;
  endTime?: number;
  points: GpsPoint[];
  breaks: RideBreak[];
  totalDistance: number; // in meters
  averageSpeed: number;
  maxSpeed: number;
}

export type PauseReason = 
  | 'break' 
  | 'refreshment' 
  | 'traffic' 
  | 'fuel'
  | 'photo'
  | 'auto:gps_lost' 
  | 'auto:stationary' 
  | 'other';

export interface GpsStatus {
  isLost: boolean;
  lastFixTimestamp?: number;
  retryCount: number;
}

export interface AppSettings {
  gpsAccuracy: 'high' | 'balanced' | 'low';
  readingInterval: number;
  autoPause: {
    enabled: boolean;
    stationaryThreshold: number; // seconds
    minSpeedThreshold: number;   // meters per second
    pauseOnBackground: boolean;
    pauseOnGpsLost: boolean;
    gpsLostTimeout: number;      // seconds
  };
  units: 'km' | 'miles';
  syncWithGoogle: boolean;
}

