import { RideUtils } from '../utils/ride-calculations';
import { GpsPoint } from '../models/ride.model';

describe('Speed Calculation - Integration & Edge Cases', () => {

  describe('Real-World Ride Scenarios', () => {
    
    it('should handle typical cycling ride (15-25 km/h)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate 5-minute cycling ride at ~20 km/h (5.56 m/s)
      for (let i = 0; i < 60; i++) {
        points.push({
          latitude: i * 0.00005, // ~5.5m per second
          longitude: 0,
          timestamp: now - (60 - i) * 5000 // 5 seconds apart
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      const speedKph = RideUtils.msToKph(currentSpeed);
      
      expect(speedKph).toBeGreaterThan(10);
      expect(speedKph).toBeLessThan(30);
    });

    it('should handle motorcycle ride (40-60 km/h)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Simulate motorcycle at ~50 km/h (13.89 m/s)
      for (let i = 0; i < 30; i++) {
        points.push({
          latitude: i * 0.00012, // ~13m per second
          longitude: 0,
          timestamp: now - (30 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      const speedKph = RideUtils.msToKph(currentSpeed);
      
      expect(speedKph).toBeGreaterThan(30);
      expect(speedKph).toBeLessThan(70);
    });

    it('should handle stop-and-go traffic scenario', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Moving, stopped, moving pattern
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: i * 0.00005,
          longitude: 0,
          timestamp: now - (30 - i) * 1000
        });
      }
      
      // Stopped for 10 seconds
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: 10 * 0.00005,
          longitude: 0,
          timestamp: now - (20 - i) * 1000
        });
      }
      
      // Moving again
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: (10 + i) * 0.00005,
          longitude: 0,
          timestamp: now - (10 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle acceleration from traffic light', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Stopped
      for (let i = 0; i < 5; i++) {
        points.push({
          latitude: 0,
          longitude: 0,
          timestamp: now - (20 - i) * 1000
        });
      }
      
      // Accelerating
      for (let i = 0; i < 15; i++) {
        const acceleration = (i * i) * 0.000005; // Quadratic acceleration
        points.push({
          latitude: acceleration,
          longitude: 0,
          timestamp: now - (15 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThan(0);
    });

    it('should handle downhill acceleration', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Gradual speed increase
      for (let i = 0; i < 20; i++) {
        const distance = i * 0.00008; // Increasing speed
        points.push({
          latitude: distance,
          longitude: 0,
          altitude: 100 - (i * 5), // Descending
          timestamp: now - (20 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThan(0);
    });

    it('should handle uphill deceleration', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Gradual speed decrease
      for (let i = 0; i < 20; i++) {
        const distance = i * 0.00003; // Decreasing speed
        points.push({
          latitude: distance,
          longitude: 0,
          altitude: 100 + (i * 5), // Ascending
          timestamp: now - (20 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GPS Signal Quality Scenarios', () => {
    
    it('should handle GPS drift while stationary', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Small random movements (GPS drift)
      const baseLatitude = 37.7749;
      for (let i = 0; i < 20; i++) {
        points.push({
          latitude: baseLatitude + (Math.random() - 0.5) * 0.00001,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.00001,
          accuracy: 10 + Math.random() * 5,
          timestamp: now - (20 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeLessThan(2); // Should be very low
    });

    it('should handle poor GPS accuracy (high accuracy values)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000, accuracy: 50 },
        { latitude: 0.001, longitude: 0, timestamp: now - 5000, accuracy: 100 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000, accuracy: 75 }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle GPS signal loss and recovery', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 60000 }, // 1 min ago
        { latitude: 0.001, longitude: 0, timestamp: now - 55000 },
        // GPS lost for 50 seconds
        { latitude: 0.005, longitude: 0, timestamp: now - 5000 }, // Recovered
        { latitude: 0.006, longitude: 0, timestamp: now - 1000 }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle tunnel scenario (no GPS for extended period)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 300000 }, // 5 min ago
        { latitude: 0.001, longitude: 0, timestamp: now - 295000 },
        // In tunnel for 4.5 minutes
        { latitude: 0.02, longitude: 0, timestamp: now - 5000 }, // Exit tunnel
        { latitude: 0.021, longitude: 0, timestamp: now - 1000 }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Boundary Conditions', () => {
    
    it('should handle maximum realistic speed (120 km/h)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // 120 km/h = 33.33 m/s
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: i * 0.0003, // ~33m per second
          longitude: 0,
          timestamp: now - (10 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      const speedKph = RideUtils.msToKph(currentSpeed);
      
      expect(speedKph).toBeGreaterThan(80);
      expect(speedKph).toBeLessThan(150);
    });

    it('should handle minimum detectable speed (< 1 km/h)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      // Very slow movement
      for (let i = 0; i < 10; i++) {
        points.push({
          latitude: i * 0.000001, // ~0.1m per second
          longitude: 0,
          timestamp: now - (10 - i) * 1000
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      const speedKph = RideUtils.msToKph(currentSpeed);
      
      expect(speedKph).toBeLessThan(1);
    });

    it('should handle points at equator vs poles', () => {
      const now = Date.now();
      
      // Equator
      const equatorPoints: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000 },
        { latitude: 0, longitude: 0.001, timestamp: now - 1000 }
      ];
      
      // Near pole
      const polePoints: GpsPoint[] = [
        { latitude: 89, longitude: 0, timestamp: now - 5000 },
        { latitude: 89, longitude: 0.001, timestamp: now - 1000 }
      ];
      
      const equatorSpeed = RideUtils.calculateCurrentSpeed(equatorPoints);
      const poleSpeed = RideUtils.calculateCurrentSpeed(polePoints);
      
      expect(equatorSpeed).toBeGreaterThan(poleSpeed); // Longitude distance varies by latitude
    });

    it('should handle crossing international date line', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 179.9, timestamp: now - 5000 },
        { latitude: 0, longitude: -179.9, timestamp: now - 1000 }
      ];
      
      const distance = RideUtils.calculateDistance(points[0], points[1]);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(50000); // Should be small, not halfway around world
    });

    it('should handle crossing prime meridian', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 51.5, longitude: -0.1, timestamp: now - 5000 },
        { latitude: 51.5, longitude: 0.1, timestamp: now - 1000 }
      ];
      
      const distance = RideUtils.calculateDistance(points[0], points[1]);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(30000);
    });
  });

  describe('Time-Based Edge Cases', () => {
    
    it('should handle points with identical timestamps', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now },
        { latitude: 0.001, longitude: 0, timestamp: now },
        { latitude: 0.002, longitude: 0, timestamp: now }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBe(0); // Zero time span
    });

    it('should handle points out of chronological order', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 5000 } // Out of order
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle very old points (hours ago)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 7200000 }, // 2 hours ago
        { latitude: 0.001, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000 }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid GPS updates (< 1 second apart)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      for (let i = 0; i < 50; i++) {
        points.push({
          latitude: i * 0.00001,
          longitude: 0,
          timestamp: now - (50 - i) * 200 // 200ms apart
        });
      }
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should handle slow GPS updates (> 10 seconds apart)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 60000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 45000 },
        { latitude: 0.002, longitude: 0, timestamp: now - 30000 },
        { latitude: 0.003, longitude: 0, timestamp: now - 15000 }
      ];
      
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Max Speed Tracking Scenarios', () => {
    
    it('should track max speed during entire ride', () => {
      let maxSpeed = 0;
      const speeds = [0, 5, 10, 15, 20, 25, 30, 25, 20, 15, 10, 5, 0];
      
      speeds.forEach(speed => {
        maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, speed);
      });
      
      expect(maxSpeed).toBe(30);
    });

    it('should maintain max speed after multiple stops', () => {
      let maxSpeed = 0;
      const speedSequences = [
        [0, 10, 20, 15, 10, 0], // First segment
        [0, 5, 10, 8, 0],       // Second segment (slower)
        [0, 12, 18, 15, 0]      // Third segment
      ];
      
      speedSequences.forEach(sequence => {
        sequence.forEach(speed => {
          maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, speed);
        });
      });
      
      expect(maxSpeed).toBe(20); // From first segment
    });

    it('should handle max speed with decimal precision', () => {
      let maxSpeed = 0;
      const speeds = [12.34, 12.35, 12.36, 12.37, 12.36, 12.35];
      
      speeds.forEach(speed => {
        maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, speed);
      });
      
      expect(maxSpeed).toBe(12.37);
    });
  });

  describe('Average Speed Calculation Scenarios', () => {
    
    it('should calculate average for ride with multiple pauses', () => {
      const totalDistance = 10000; // 10 km
      const startTime = 0;
      const endTime = 3600000; // 1 hour
      const totalPausedTime = 900000; // 15 minutes paused
      
      // Active time: 45 minutes = 2700 seconds
      const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, startTime, endTime, totalPausedTime);
      
      expect(avgSpeed).toBeCloseTo(3.7, 1); // 10000m / 2700s = ~3.7 m/s
    });

    it('should handle ride with more pause time than active time', () => {
      const totalDistance = 5000; // 5 km
      const startTime = 0;
      const endTime = 3600000; // 1 hour
      const totalPausedTime = 3000000; // 50 minutes paused
      
      // Active time: 10 minutes = 600 seconds
      const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, startTime, endTime, totalPausedTime);
      
      expect(avgSpeed).toBeCloseTo(8.33, 1); // 5000m / 600s = ~8.33 m/s
    });

    it('should handle very short ride (< 1 minute)', () => {
      const totalDistance = 500; // 500 m
      const startTime = 0;
      const endTime = 30000; // 30 seconds
      const totalPausedTime = 0;
      
      const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, startTime, endTime, totalPausedTime);
      
      expect(avgSpeed).toBeCloseTo(16.67, 1); // 500m / 30s = ~16.67 m/s
    });

    it('should handle very long ride (> 5 hours)', () => {
      const totalDistance = 150000; // 150 km
      const startTime = 0;
      const endTime = 21600000; // 6 hours
      const totalPausedTime = 3600000; // 1 hour paused
      
      // Active time: 5 hours = 18000 seconds
      const avgSpeed = RideUtils.calculateAverageSpeed(totalDistance, startTime, endTime, totalPausedTime);
      
      expect(avgSpeed).toBeCloseTo(8.33, 1); // 150000m / 18000s = ~8.33 m/s (30 km/h)
    });
  });

  describe('Performance and Stress Tests', () => {
    
    it('should handle large number of points (1000+)', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      for (let i = 0; i < 1000; i++) {
        points.push({
          latitude: i * 0.00001,
          longitude: 0,
          timestamp: now - (1000 - i) * 1000
        });
      }
      
      const startTime = performance.now();
      const currentSpeed = RideUtils.calculateCurrentSpeed(points);
      const endTime = performance.now();
      
      expect(currentSpeed).toBeGreaterThanOrEqual(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle repeated calculations efficiently', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      
      for (let i = 0; i < 100; i++) {
        points.push({
          latitude: i * 0.00001,
          longitude: 0,
          timestamp: now - (100 - i) * 1000
        });
      }
      
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        RideUtils.calculateCurrentSpeed(points);
      }
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(500); // 100 calculations in < 500ms
    });
  });

  describe('Consistency Checks', () => {
    
    it('should ensure currentSpeed <= maxSpeed at all times', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      let maxSpeed = 0;
      
      for (let i = 0; i < 50; i++) {
        points.push({
          latitude: i * 0.00005,
          longitude: 0,
          timestamp: now - (50 - i) * 1000
        });
        
        const currentSpeed = RideUtils.calculateCurrentSpeed(points);
        maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, currentSpeed);
        
        expect(currentSpeed).toBeLessThanOrEqual(maxSpeed);
      }
    });

    it('should ensure averageSpeed is reasonable compared to currentSpeed', () => {
      const now = Date.now();
      const points: GpsPoint[] = [];
      let totalDistance = 0;
      
      for (let i = 1; i < 30; i++) {
        const newPoint = {
          latitude: i * 0.00005,
          longitude: 0,
          timestamp: now - (30 - i) * 1000
        };
        
        if (points.length > 0) {
          totalDistance += RideUtils.calculateDistance(points[points.length - 1], newPoint);
        }
        
        points.push(newPoint);
        
        const currentSpeed = RideUtils.calculateCurrentSpeed(points);
        const avgSpeed = RideUtils.calculateAverageSpeed(
          totalDistance,
          now - 30000,
          now,
          0
        );
        
        // Both should be in similar range for constant speed
        expect(Math.abs(currentSpeed - avgSpeed)).toBeLessThan(5);
      }
    });

    it('should ensure speed calculations are deterministic', () => {
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000 },
        { latitude: 0.001, longitude: 0, timestamp: now - 5000 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000 }
      ];
      
      const speed1 = RideUtils.calculateCurrentSpeed(points);
      const speed2 = RideUtils.calculateCurrentSpeed(points);
      const speed3 = RideUtils.calculateCurrentSpeed(points);
      
      expect(speed1).toBe(speed2);
      expect(speed2).toBe(speed3);
    });
  });
});
