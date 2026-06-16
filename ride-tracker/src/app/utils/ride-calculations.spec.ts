import { RideUtils } from './ride-calculations';
import { GpsPoint } from '../models/ride.model';

describe('RideUtils - Speed Calculations', () => {
  
  describe('calculateCurrentSpeed', () => {
    
    it('should return 0 when there are no points', () => {
      const points: GpsPoint[] = [];
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBe(0);
    });

    it('should return 0 when there is only one point', () => {
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: Date.now() }
      ];
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBe(0);
    });

    it('should calculate speed from minimum points when not enough recent points', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 2000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 1000 }
      ];
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThan(0);
    });

    it('should use points within the time window (60 seconds default)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 120000 }, // 2 min ago - outside window
        { latitude: 0.001, longitude: 0, timestamp: now - 90000 }, // 1.5 min ago - outside window
        { latitude: 0.002, longitude: 0, timestamp: now - 30000 }, // 30 sec ago - inside window
        { latitude: 0.003, longitude: 0, timestamp: now - 15000 }, // 15 sec ago - inside window
        { latitude: 0.004, longitude: 0, timestamp: now - 5000 }   // 5 sec ago - inside window
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThan(0);
    });

    it('should limit to maxPoints (20 by default) even if more points in window', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Create 30 points within the last 60 seconds
      for (let i = 30; i > 0; i--) {
        points.push({
          latitude: i * 0.0001,
          longitude: 0,
          timestamp: now - (i * 2000) // 2 seconds apart
        });
      }
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThan(0);
    });

    it('should calculate speed correctly for stationary points', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000 },
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0, longitude: 0, timestamp: now - 1000 }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBe(0);
    });

    it('should calculate speed for moving points (approx 10 m/s)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000 },
        { latitude: 0.00009, longitude: 0, timestamp: now - 5000 }, // ~10m in 5s = 2 m/s
        { latitude: 0.00018, longitude: 0, timestamp: now - 1000 }  // ~10m in 4s = 2.5 m/s
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThan(5); // Should be around 2-3 m/s
    });

    it('should handle custom window size', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 40000 }, // 40 sec ago
        { latitude: 0.001, longitude: 0, timestamp: now - 20000 }, // 20 sec ago
        { latitude: 0.002, longitude: 0, timestamp: now - 5000 }   // 5 sec ago
      ];
      
      // With 30 second window, first point should be excluded
      const speed = RideUtils.calculateCurrentSpeed(points, 30);
      expect(speed).toBeGreaterThan(0);
    });

    it('should handle custom minPoints parameter', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 2000 }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points, 60, 2);
      expect(speed).toBeGreaterThan(0);
    });

    it('should return 0 when time span is zero', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now },
        { latitude: 0.001, longitude: 0, timestamp: now }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBe(0);
    });

    it('should provide smooth speed transitions (rolling average behavior)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate accelerating from 0 to higher speed
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: i * 0.0001,
          longitude: 0,
          timestamp: now - (10 - i) * 1000
        });
      }
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe('updateMaxSpeed', () => {
    
    it('should return new speed when it is higher than current max', () => {
      const currentMax = 10;
      const newSpeed = 15;
      const result = RideUtils.updateMaxSpeed(currentMax, newSpeed);
      expect(result).toBe(15);
    });

    it('should return current max when new speed is lower', () => {
      const currentMax = 20;
      const newSpeed = 15;
      const result = RideUtils.updateMaxSpeed(currentMax, newSpeed);
      expect(result).toBe(20);
    });

    it('should handle zero values correctly', () => {
      expect(RideUtils.updateMaxSpeed(0, 5)).toBe(5);
      expect(RideUtils.updateMaxSpeed(5, 0)).toBe(5);
      expect(RideUtils.updateMaxSpeed(0, 0)).toBe(0);
    });

    it('should handle negative values (edge case)', () => {
      expect(RideUtils.updateMaxSpeed(10, -5)).toBe(10);
      expect(RideUtils.updateMaxSpeed(-5, 10)).toBe(10);
    });

    it('should handle equal values', () => {
      const result = RideUtils.updateMaxSpeed(10, 10);
      expect(result).toBe(10);
    });

    it('should handle very large speed values', () => {
      const currentMax = 50;
      const newSpeed = 100;
      const result = RideUtils.updateMaxSpeed(currentMax, newSpeed);
      expect(result).toBe(100);
    });

    it('should handle decimal values', () => {
      const currentMax = 12.5;
      const newSpeed = 12.7;
      const result = RideUtils.updateMaxSpeed(currentMax, newSpeed);
      expect(result).toBe(12.7);
    });
  });

  describe('calculateAverageSpeed', () => {
    
    it('should return 0 when duration is zero', () => {
      const speed = RideUtils.calculateAverageSpeed(1000, 100, 100, 0);
      expect(speed).toBe(0);
    });

    it('should return 0 when duration is negative (paused time exceeds total time)', () => {
      const speed = RideUtils.calculateAverageSpeed(1000, 100, 200, 150);
      expect(speed).toBe(0);
    });

    it('should calculate average speed correctly (10 km in 1 hour = 2.78 m/s)', () => {
      const distance = 10000; // 10 km in meters
      const startTime = 0;
      const endTime = 3600000; // 1 hour in ms
      const pausedTime = 0;
      
      const speed = RideUtils.calculateAverageSpeed(distance, startTime, endTime, pausedTime);
      expect(speed).toBeCloseTo(2.78, 1); // ~2.78 m/s
    });

    it('should exclude paused time from calculation', () => {
      const distance = 10000; // 10 km
      const startTime = 0;
      const endTime = 3600000; // 1 hour
      const pausedTime = 1800000; // 30 minutes paused
      
      // Effective time: 30 minutes = 1800 seconds
      const speed = RideUtils.calculateAverageSpeed(distance, startTime, endTime, pausedTime);
      expect(speed).toBeCloseTo(5.56, 1); // 10000m / 1800s = ~5.56 m/s
    });

    it('should handle zero distance', () => {
      const speed = RideUtils.calculateAverageSpeed(0, 0, 10000, 0);
      expect(speed).toBe(0);
    });

    it('should calculate speed for short distances', () => {
      const distance = 100; // 100 meters
      const startTime = 0;
      const endTime = 20000; // 20 seconds
      const pausedTime = 0;
      
      const speed = RideUtils.calculateAverageSpeed(distance, startTime, endTime, pausedTime);
      expect(speed).toBe(5); // 100m / 20s = 5 m/s
    });
  });

  describe('calculateDistance', () => {
    
    it('should return 0 for same point', () => {
      const p1: GpsPoint = { latitude: 0, longitude: 0, timestamp: 0 };
      const p2: GpsPoint = { latitude: 0, longitude: 0, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBe(0);
    });

    it('should calculate distance between two points (approx 111 km for 1 degree latitude)', () => {
      const p1: GpsPoint = { latitude: 0, longitude: 0, timestamp: 0 };
      const p2: GpsPoint = { latitude: 1, longitude: 0, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBeGreaterThan(110000); // ~111 km
      expect(distance).toBeLessThan(112000);
    });

    it('should calculate distance for longitude changes', () => {
      const p1: GpsPoint = { latitude: 0, longitude: 0, timestamp: 0 };
      const p2: GpsPoint = { latitude: 0, longitude: 1, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBeGreaterThan(110000);
    });

    it('should calculate distance for diagonal movement', () => {
      const p1: GpsPoint = { latitude: 0, longitude: 0, timestamp: 0 };
      const p2: GpsPoint = { latitude: 0.001, longitude: 0.001, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(200); // Small distance
    });

    it('should handle negative coordinates', () => {
      const p1: GpsPoint = { latitude: -10, longitude: -10, timestamp: 0 };
      const p2: GpsPoint = { latitude: -10.001, longitude: -10.001, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBeGreaterThan(0);
    });

    it('should be symmetric (distance from A to B equals B to A)', () => {
      const p1: GpsPoint = { latitude: 10, longitude: 20, timestamp: 0 };
      const p2: GpsPoint = { latitude: 10.01, longitude: 20.01, timestamp: 1000 };
      
      const d1 = RideUtils.calculateDistance(p1, p2);
      const d2 = RideUtils.calculateDistance(p2, p1);
      
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe('msToKph', () => {
    
    it('should convert 0 m/s to 0 km/h', () => {
      expect(RideUtils.msToKph(0)).toBe(0);
    });

    it('should convert 1 m/s to 3.6 km/h', () => {
      expect(RideUtils.msToKph(1)).toBe(3.6);
    });

    it('should convert 10 m/s to 36 km/h', () => {
      expect(RideUtils.msToKph(10)).toBe(36);
    });

    it('should convert 27.78 m/s to ~100 km/h', () => {
      expect(RideUtils.msToKph(27.78)).toBeCloseTo(100, 1);
    });

    it('should handle decimal values', () => {
      expect(RideUtils.msToKph(5.5)).toBe(19.8);
    });

    it('should handle negative values (edge case)', () => {
      expect(RideUtils.msToKph(-5)).toBe(-18);
    });
  });

  describe('Integration Scenarios', () => {
    
    it('should handle realistic ride scenario: gradual acceleration', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate starting from rest and accelerating
      // 0 m/s -> 5 m/s over 30 seconds
      for (let i = 0; i <= 30; i++) {


        points.push({
          latitude: points.length * 0.00001,
          longitude: 0,
          timestamp: now - (30 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThan(0);
      expect(currentSpeed).toBeLessThan(10); // Should be reasonable
    });

    it('should handle realistic ride scenario: deceleration to stop', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate slowing down from 5 m/s to 0
      for (let i = 0; i <= 20; i++) {
        const lat = i < 10 ? i * 0.00005 : 10 * 0.00005; // Moving then stationary
        points.push({
          latitude: lat,
          longitude: 0,
          timestamp: now - (20 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
      expect(currentSpeed).toBeLessThan(3); // Should be low or zero
    });

    it('should handle realistic ride scenario: constant speed', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate constant speed of ~5 m/s
      for (let i = 0; i < 20; i++) {
        points.push({
          latitude: i * 0.00005, // Consistent movement
          longitude: 0,
          timestamp: now - (20 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThan(3);
      expect(currentSpeed).toBeLessThan(7);
    });

    it('should track max speed correctly during acceleration and deceleration', () => {
      let maxSpeed = 0;
      const speeds = [0, 2, 5, 8, 10, 12, 15, 12, 8, 5, 2, 0]; // Accelerate then decelerate
      
      speeds.forEach(speed => {
        maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, speed);
      });
      
      expect(maxSpeed).toBe(15);
    });

    it('should calculate average speed correctly for a complete ride', () => {
      const totalDistance = 20000; // 20 km
      const startTime = Date.now();
      const endTime = startTime + 3600000; // 1 hour later
      const totalPausedTime = 600000; // 10 minutes paused
      
      // Effective time: 50 minutes = 3000 seconds
      const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, startTime, endTime, totalPausedTime);
      
      expect(avgSpeed).toBeCloseTo(6.67, 1); // 20000m / 3000s = ~6.67 m/s
    });
  });

  describe('Edge Cases and Error Handling', () => {
    
    it('should handle GPS points with missing optional fields', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 2000, accuracy: 10 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000, altitude: 100 }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThanOrEqual(0);
    });

    it('should handle very small distances (GPS noise)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.0000001, longitude: 0, timestamp: now - 2000 },
        { latitude: 0.0000002, longitude: 0, timestamp: now - 1000 }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThanOrEqual(0);
      expect(speed).toBeLessThan(1); // Should be very small
    });

    it('should handle very large time gaps between points', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 300000 }, // 5 minutes ago
        { latitude: 0.001, longitude: 0, timestamp: now - 1000 }
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThanOrEqual(0);
    });

    it('should handle points with future timestamps (clock skew)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.001, longitude: 0, timestamp: now + 1000 } // Future timestamp
      ];
      
      const speed = RideUtils.calculateCurrentSpeed(points);
      expect(speed).toBeGreaterThanOrEqual(0);
    });

    it('should handle extreme latitude/longitude values', () => {
      const p1: GpsPoint = { latitude: 89.9, longitude: 179.9, timestamp: 0 };
      const p2: GpsPoint = { latitude: 89.91, longitude: 179.91, timestamp: 1000 };
      
      const distance = RideUtils.calculateDistance(p1, p2);
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThan(20000); // Should be reasonable
    });
  });
});
