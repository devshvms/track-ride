import { TestBed } from '@angular/core/testing';
import { RideService } from './ride.service';
import { SettingsService } from './settings.service';
import { GpsMonitorService } from './gps-monitor.service';
import { LocationService } from './location.service';
import { HistoryService } from './history.service';
import { AutoPauseService } from './auto-pause.service';
import { MotionDetectionService } from './motion-detection.service';
import { ForegroundServiceService } from './foreground-service.service';
import { BackgroundTaskService } from './background-task.service';
import { RideState } from '../models/ride-state.model';
import { GpsPoint, Ride } from '../models/ride.model';
import { BehaviorSubject } from 'rxjs';

describe('RideService - Speed Tracking', () => {
  let service: RideService;
  let locationService: jasmine.SpyObj<LocationService>;
  let historyService: jasmine.SpyObj<HistoryService>;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let gpsMonitorService: jasmine.SpyObj<GpsMonitorService>;
  let autoPauseService: jasmine.SpyObj<AutoPauseService>;
  let motionDetectionService: jasmine.SpyObj<MotionDetectionService>;
  let foregroundService: jasmine.SpyObj<ForegroundServiceService>;
  let backgroundTaskService: jasmine.SpyObj<BackgroundTaskService>;

  beforeEach(() => {
    const locationSpy = jasmine.createSpyObj('LocationService', 
      ['startTracking', 'stopTracking'], 
      { 
        location$: new BehaviorSubject<GpsPoint>({ latitude: 0, longitude: 0, timestamp: Date.now() }),
        error$: new BehaviorSubject<any>(null)
      }
    );
    
    const historySpy = jasmine.createSpyObj('HistoryService', ['saveRide']);
    const settingsSpy = jasmine.createSpyObj('SettingsService', ['getSettings']);
    const gpsMonitorSpy = jasmine.createSpyObj('GpsMonitorService', 
      ['resetStatus', 'reportError'], 
      { 
        status$: new BehaviorSubject({ isLost: false, retryCount: 0 }),
        currentStatus: { isLost: false, retryCount: 0 }
      }
    );
    const autoPauseSpy = jasmine.createSpyObj('AutoPauseService', 
      ['startListening', 'stopListening', 'evaluateMovement', 'handleGpsStatus'], 
      { events$: new BehaviorSubject({ pause: false }) }
    );
    const motionDetectionSpy = jasmine.createSpyObj('MotionDetectionService', 
      ['startMonitoring', 'stopMonitoring', 'shouldResumeBasedOnDistance'], 
      { motion$: new BehaviorSubject({ significantMovement: false }) }
    );
    const foregroundSpy = jasmine.createSpyObj('ForegroundServiceService', 
      ['startForegroundService', 'updateForegroundService', 'stopForegroundService']
    );
    const backgroundTaskSpy = jasmine.createSpyObj('BackgroundTaskService', ['start', 'stop']);

    TestBed.configureTestingModule({
      providers: [
        RideService,
        { provide: LocationService, useValue: locationSpy },
        { provide: HistoryService, useValue: historySpy },
        { provide: SettingsService, useValue: settingsSpy },
        { provide: GpsMonitorService, useValue: gpsMonitorSpy },
        { provide: AutoPauseService, useValue: autoPauseSpy },
        { provide: MotionDetectionService, useValue: motionDetectionSpy },
        { provide: ForegroundServiceService, useValue: foregroundSpy },
        { provide: BackgroundTaskService, useValue: backgroundTaskSpy }
      ]
    });

    service = TestBed.inject(RideService);
    locationService = TestBed.inject(LocationService) as jasmine.SpyObj<LocationService>;
    historyService = TestBed.inject(HistoryService) as jasmine.SpyObj<HistoryService>;
    settingsService = TestBed.inject(SettingsService) as jasmine.SpyObj<SettingsService>;
    gpsMonitorService = TestBed.inject(GpsMonitorService) as jasmine.SpyObj<GpsMonitorService>;
    autoPauseService = TestBed.inject(AutoPauseService) as jasmine.SpyObj<AutoPauseService>;
    motionDetectionService = TestBed.inject(MotionDetectionService) as jasmine.SpyObj<MotionDetectionService>;
    foregroundService = TestBed.inject(ForegroundServiceService) as jasmine.SpyObj<ForegroundServiceService>;
    backgroundTaskService = TestBed.inject(BackgroundTaskService) as jasmine.SpyObj<BackgroundTaskService>;
  });

  describe('Initial State', () => {
    it('should initialize with currentSpeed = 0', (done) => {
      service.startRide();
      
      service.currentRide$.subscribe(ride => {
        if (ride) {
          expect(ride.currentSpeed).toBe(0);
          expect(ride.maxSpeed).toBe(0);
          expect(ride.averageSpeed).toBe(0);
          done();
        }
      });
    });

    it('should be in TRACKING state after starting ride', (done) => {
      service.startRide();
      
      service.currentState$.subscribe(state => {
        if (state === RideState.TRACKING) {
          done();
        }
      });
    });
  });

  describe('Speed Calculation on New Points', () => {
    it('should update currentSpeed when new GPS point is added', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 5 },
        { latitude: 0.0001, longitude: 0, timestamp: now - 3000, speed: 5 },
        { latitude: 0.0002, longitude: 0, timestamp: now - 1000, speed: 5 }
      ];

      let updateCount = 0;
      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length > 0) {
          updateCount++;
          expect(ride.currentSpeed).toBeDefined();
          expect(ride.currentSpeed).toBeGreaterThanOrEqual(0);
          
          if (updateCount === 3) {
            expect(ride.currentSpeed).toBeGreaterThan(0);
            done();
          }
        }
      });

      // Simulate GPS points coming in
      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });

    it('should update maxSpeed when currentSpeed exceeds it', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000, speed: 2 },
        { latitude: 0.0001, longitude: 0, timestamp: now - 8000, speed: 5 },
        { latitude: 0.0003, longitude: 0, timestamp: now - 6000, speed: 10 },
        { latitude: 0.0006, longitude: 0, timestamp: now - 4000, speed: 15 }
      ];

      let maxSpeedSeen = 0;
      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length > 0) {
          expect(ride.maxSpeed).toBeGreaterThanOrEqual(maxSpeedSeen);
          maxSpeedSeen = ride.maxSpeed;
          
          if (ride.points.length === 4) {
            expect(ride.maxSpeed).toBeGreaterThan(0);
            done();
          }
        }
      });

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });

    it('should maintain maxSpeed even when currentSpeed decreases', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000, speed: 5 },
        { latitude: 0.0005, longitude: 0, timestamp: now - 8000, speed: 15 }, // High speed
        { latitude: 0.0006, longitude: 0, timestamp: now - 6000, speed: 10 }, // Slowing down
        { latitude: 0.0007, longitude: 0, timestamp: now - 4000, speed: 5 }   // Slow
      ];

      let peakMaxSpeed = 0;
      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length > 0) {
          peakMaxSpeed = Math.max(peakMaxSpeed, ride.maxSpeed);
          
          if (ride.points.length === 4) {
            expect(ride.maxSpeed).toBe(peakMaxSpeed);
            expect(ride.currentSpeed).toBeLessThan(ride.maxSpeed);
            done();
          }
        }
      });

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });

    it('should calculate averageSpeed over entire ride duration', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 10000, speed: 5 },
        { latitude: 0.001, longitude: 0, timestamp: now - 5000, speed: 5 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000, speed: 5 }
      ];

      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length === 3) {
          expect(ride.averageSpeed).toBeGreaterThanOrEqual(0);
          expect(ride.averageSpeed).toBeLessThanOrEqual(ride.maxSpeed);
          done();
        }
      });

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });
  });

  describe('Speed During Pause/Resume', () => {
    it('should maintain speed values when ride is paused', (done) => {
      service.startRide();
      
      const now = Date.now();
      const point: GpsPoint = { latitude: 0, longitude: 0, timestamp: now, speed: 10 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
      
      setTimeout(() => {
        service.currentRide$.subscribe(ride => {
          if (ride && ride.points.length > 0) {
            const speedBeforePause = ride.currentSpeed;
            const maxSpeedBeforePause = ride.maxSpeed;
            
            service.pauseRide('break');
            
            service.currentRide$.subscribe(pausedRide => {
              if (pausedRide) {
                expect(pausedRide.currentSpeed).toBe(speedBeforePause);
                expect(pausedRide.maxSpeed).toBe(maxSpeedBeforePause);
                done();
              }
            });
          }
        });
      }, 100);
    });

    it('should not update speed when ride is paused', (done) => {
      service.startRide();
      
      const now = Date.now();
      const point1: GpsPoint = { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 5 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point1);
      
      setTimeout(() => {
        service.pauseRide('break');
        
        service.currentRide$.subscribe(ride => {
          if (ride) {
            const speedDuringPause = ride.currentSpeed;
            
            // Try to add point while paused
            const point2: GpsPoint = { latitude: 0.001, longitude: 0, timestamp: now, speed: 10 };
            (locationService.location$ as BehaviorSubject<GpsPoint>).next(point2);
            
            setTimeout(() => {
              service.currentRide$.subscribe(stillPausedRide => {
                if (stillPausedRide) {
                  expect(stillPausedRide.currentSpeed).toBe(speedDuringPause);
                  done();
                }
              });
            }, 100);
          }
        });
      }, 100);
    });

    it('should resume speed calculation after resume', (done) => {
      service.startRide();
      
      const now = Date.now();
      const point1: GpsPoint = { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 5 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point1);
      
      setTimeout(() => {
        service.pauseRide('break');
        
        setTimeout(() => {
          service.resumeRide(false);
          
          setTimeout(() => {
            const point2: GpsPoint = { latitude: 0.001, longitude: 0, timestamp: Date.now(), speed: 10 };
            (locationService.location$ as BehaviorSubject<GpsPoint>).next(point2);
            
            service.currentRide$.subscribe(ride => {
              if (ride && ride.points.length > 1) {
                expect(ride.currentSpeed).toBeGreaterThanOrEqual(0);
                done();
              }
            });
          }, 100);
        }, 100);
      }, 100);
    });
  });

  describe('Foreground Service Integration', () => {
    it('should update foreground service with currentSpeed', (done) => {
      service.startRide();
      
      const now = Date.now();
      const point: GpsPoint = { latitude: 0, longitude: 0, timestamp: now, speed: 10 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
      
      setTimeout(() => {
        expect(foregroundService.startForegroundService).toHaveBeenCalled();
        
        // Wait for elapsed timer to trigger update
        setTimeout(() => {
          expect(foregroundService.updateForegroundService).toHaveBeenCalled();
          const calls = foregroundService.updateForegroundService.calls.mostRecent();
          const speedArg = calls.args[2]; // Third argument is speed
          expect(speedArg).toBeGreaterThanOrEqual(0);
          done();
        }, 1100); // Wait for timer tick
      }, 100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle ride with no movement (currentSpeed = 0)', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 0 },
        { latitude: 0, longitude: 0, timestamp: now - 3000, speed: 0 },
        { latitude: 0, longitude: 0, timestamp: now - 1000, speed: 0 }
      ];

      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length === 3) {
          expect(ride.currentSpeed).toBe(0);
          expect(ride.maxSpeed).toBe(0);
          expect(ride.totalDistance).toBe(0);
          done();
        }
      });

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });

    it('should handle single GPS point (currentSpeed = 0)', (done) => {
      service.startRide();
      
      const point: GpsPoint = { latitude: 0, longitude: 0, timestamp: Date.now(), speed: 5 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
      
      setTimeout(() => {
        service.currentRide$.subscribe(ride => {
          if (ride && ride.points.length === 1) {
            expect(ride.currentSpeed).toBe(0);
            expect(ride.maxSpeed).toBe(0);
            done();
          }
        });
      }, 100);
    });

    it('should handle GPS points with very high accuracy errors', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 5, accuracy: 100 },
        { latitude: 0.0001, longitude: 0, timestamp: now - 3000, speed: 5, accuracy: 100 },
        { latitude: 0.0002, longitude: 0, timestamp: now - 1000, speed: 5, accuracy: 100 }
      ];

      service.currentRide$.subscribe(ride => {
        if (ride && ride.points.length === 3) {
          expect(ride.currentSpeed).toBeGreaterThanOrEqual(0);
          expect(ride.points.every(p => p.accuracy === 100)).toBe(true);
          done();
        }
      });

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });
    });
  });

  describe('Save and Load Scenarios', () => {
    it('should save ride with currentSpeed field', (done) => {
      service.startRide();
      
      const now = Date.now();
      const point: GpsPoint = { latitude: 0, longitude: 0, timestamp: now, speed: 10 };
      
      (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
      
      setTimeout(() => {
        service.stopAndSaveRide();
        
        expect(historyService.saveRide).toHaveBeenCalled();
        const savedRide: Ride = historyService.saveRide.calls.mostRecent().args[0];
        expect(savedRide.currentSpeed).toBeDefined();
        expect(savedRide.currentSpeed).toBeGreaterThanOrEqual(0);
        done();
      }, 100);
    });

    it('should include all speed fields in saved ride', (done) => {
      service.startRide();
      
      const now = Date.now();
      const points: GpsPoint[] = [
        { latitude: 0, longitude: 0, timestamp: now - 5000, speed: 5 },
        { latitude: 0.001, longitude: 0, timestamp: now - 3000, speed: 10 },
        { latitude: 0.002, longitude: 0, timestamp: now - 1000, speed: 8 }
      ];

      points.forEach((point, index) => {
        setTimeout(() => {
          (locationService.location$ as BehaviorSubject<GpsPoint>).next(point);
        }, index * 100);
      });

      setTimeout(() => {
        service.stopAndSaveRide();
        
        const savedRide: Ride = historyService.saveRide.calls.mostRecent().args[0];
        expect(savedRide.currentSpeed).toBeDefined();
        expect(savedRide.maxSpeed).toBeDefined();
        expect(savedRide.averageSpeed).toBeDefined();
        expect(savedRide.maxSpeed).toBeGreaterThanOrEqual(savedRide.averageSpeed);
        done();
      }, 500);
    });
  });
});
