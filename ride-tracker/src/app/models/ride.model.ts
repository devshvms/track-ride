export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number; // meters per second
}

export interface RideBreak {
  timestamp: number;
  reason: string;
  duration?: number;
}

export interface Ride {
  id: string;
  startTime: number;
  endTime?: number;
  points: GpsPoint[];
  breaks: RideBreak[];
  totalDistance: number; // meters
  averageSpeed: number; // meters per second
  mapSnapshot?: string; // base64 image or file path
}

export interface AppSettings {
  gpsAccuracy: 'high' | 'balanced' | 'low';
  readingInterval: number; // seconds
  syncWithGoogle: boolean;
}
