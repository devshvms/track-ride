// src/app/services/battery-optimizer.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SettingsService } from './settings.service';

export interface BatteryState {
  level: number;
  isCharging: boolean;
  isLowPowerMode: boolean;
}

export interface OptimizationState {
  currentInterval: number;
  currentAccuracy: 'high' | 'balanced' | 'low';
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class BatteryOptimizerService {
  private batteryState = new BehaviorSubject<BatteryState>({
    level: 100,
    isCharging: false,
    isLowPowerMode: false
  });
  public batteryState$ = this.batteryState.asObservable();

  private optimizationState = new BehaviorSubject<OptimizationState>({
    currentInterval: 5,
    currentAccuracy: 'high',
    reason: 'Default settings'
  });
  public optimizationState$ = this.optimizationState.asObservable();

  private lastSpeed = 0;
  private consecutiveStationaryCount = 0;
  private readonly STATIONARY_THRESHOLD = 0.5; // m/s

  constructor(private settings: SettingsService) {
    this.initBatteryMonitoring();
  }

  private async initBatteryMonitoring(): Promise<void> {
    // Use Battery Status API if available
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.updateBatteryState(battery);
        
        battery.addEventListener('levelchange', () => this.updateBatteryState(battery));
        battery.addEventListener('chargingchange', () => this.updateBatteryState(battery));
      } catch (e) {
        console.warn('Battery API not available');
      }
    }
  }

  private updateBatteryState(battery: any): void {
    this.batteryState.next({
      level: Math.round(battery.level * 100),
      isCharging: battery.charging,
      isLowPowerMode: battery.level < 0.2
    });
    this.recalculateOptimization();
  }

  updateMovementState(speed: number): void {
    this.lastSpeed = speed;
    
    if (speed < this.STATIONARY_THRESHOLD) {
      this.consecutiveStationaryCount++;
    } else {
      this.consecutiveStationaryCount = 0;
    }
    
    this.recalculateOptimization();
  }

  private recalculateOptimization(): void {
    const battery = this.batteryState.value;
    const userSettings = this.settings.currentSettings;
    
    let interval = userSettings.readingInterval;
    let accuracy = userSettings.gpsAccuracy;
    let reason = 'User settings';

    // Battery-based adjustments
    if (!battery.isCharging) {
      if (battery.level < 15) {
        // Critical battery - maximum power saving
        interval = Math.max(interval, 30);
        accuracy = 'low';
        reason = 'Critical battery (<15%)';
      } else if (battery.level < 30) {
        // Low battery - moderate power saving
        interval = Math.max(interval, 10);
        if (accuracy === 'high') accuracy = 'balanced';
        reason = 'Low battery (<30%)';
      }
    }

    // Movement-based adjustments (only reduce accuracy when stationary)
    if (this.consecutiveStationaryCount > 5) {
      // Been stationary for a while - reduce polling
      interval = Math.max(interval, 10);
      reason = `${reason} + Stationary`;
    }

    // High speed - ensure we have good accuracy
    if (this.lastSpeed > 10) { // > 36 km/h
      if (battery.level > 30 || battery.isCharging) {
        interval = Math.min(interval, 5);
        accuracy = userSettings.gpsAccuracy; // Respect user's accuracy preference
        reason = 'High speed detected';
      }
    }

    this.optimizationState.next({
      currentInterval: interval,
      currentAccuracy: accuracy,
      reason
    });
  }

  getOptimizedSettings(): { interval: number; accuracy: 'high' | 'balanced' | 'low' } {
    const state = this.optimizationState.value;
    return {
      interval: state.currentInterval,
      accuracy: state.currentAccuracy
    };
  }

  reset(): void {
    this.lastSpeed = 0;
    this.consecutiveStationaryCount = 0;
    const userSettings = this.settings.currentSettings;
    this.optimizationState.next({
      currentInterval: userSettings.readingInterval,
      currentAccuracy: userSettings.gpsAccuracy,
      reason: 'Reset to user settings'
    });
  }
}
