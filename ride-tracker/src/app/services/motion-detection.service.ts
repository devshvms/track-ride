import { Injectable, NgZone } from '@angular/core';
import { Motion, AccelListenerEvent } from '@capacitor/motion';
import { Subject } from 'rxjs';
import { GpsPoint } from '../models/ride.model';
import { RideUtils } from '../utils/ride-calculations';

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface MotionEvent {
  significantMovement: boolean;
  acceleration: number;
}

@Injectable({ providedIn: 'root' })
export class MotionDetectionService {
  private motionSubject = new Subject<MotionEvent>();
  public motion$ = this.motionSubject.asObservable();

  private isListening = false;
  private listenerHandle: PluginListenerHandle | null = null;

  private accelerationBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private readonly MOVEMENT_THRESHOLD = 2.0;

  private pauseLocation: GpsPoint | null = null;
  private readonly DISTANCE_THRESHOLD = 50;

  private lastCheckTime = 0;
  private readonly CHECK_COOLDOWN = 5000;

  constructor(private zone: NgZone) {}

  async startMonitoring(pauseLocation: GpsPoint): Promise<void> {
    if (this.isListening) {
      return;
    }

    this.pauseLocation = pauseLocation;
    this.accelerationBuffer = [];
    this.lastCheckTime = 0;

    try {
      this.listenerHandle = await Motion.addListener('accel', (event: AccelListenerEvent) => {
        this.zone.run(() => {
          this.handleAcceleration(event.acceleration);
        });
      });

      this.isListening = true;
      console.log('Motion monitoring started');
    } catch (error) {
      console.error('Failed to start motion monitoring:', error);
    }
  }

  stopMonitoring(): void {
    if (this.listenerHandle) {
      this.listenerHandle.remove();
      this.listenerHandle = null;
    }
    this.isListening = false;
    this.accelerationBuffer = [];
    this.pauseLocation = null;
    console.log('Motion monitoring stopped');
  }

  private handleAcceleration(accel: { x: number; y: number; z: number }): void {
    const magnitude = Math.sqrt(
      accel.x * accel.x +
      accel.y * accel.y +
      accel.z * accel.z
    );

    const normalizedMagnitude = Math.abs(magnitude - 9.81);

    this.accelerationBuffer.push(normalizedMagnitude);
    if (this.accelerationBuffer.length > this.BUFFER_SIZE) {
      this.accelerationBuffer.shift();
    }

    if (this.accelerationBuffer.length === this.BUFFER_SIZE) {
      const avgAcceleration = this.accelerationBuffer.reduce((a, b) => a + b, 0) / this.BUFFER_SIZE;

      const now = Date.now();
      if (avgAcceleration > this.MOVEMENT_THRESHOLD &&
          (now - this.lastCheckTime) > this.CHECK_COOLDOWN) {
        this.lastCheckTime = now;
        this.motionSubject.next({
          significantMovement: true,
          acceleration: avgAcceleration
        });
      }
    }
  }

  shouldResumeBasedOnDistance(currentLocation: GpsPoint): boolean {
    if (!this.pauseLocation) {
      return false;
    }

    const distance = RideUtils.calculateDistance(this.pauseLocation, currentLocation);
    return distance >= this.DISTANCE_THRESHOLD;
  }

  get isMonitoring(): boolean {
    return this.isListening;
  }

  get currentPauseLocation(): GpsPoint | null {
    return this.pauseLocation;
  }
}
