// src/app/services/notification.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { RideService } from './ride.service';
import { RideState } from '../models/ride-state.model';
import { RideUtils } from '../utils/ride-calculations';

const TRACKING_NOTIFICATION_ID = 1001;

export interface NotificationData {
  elapsed: number;
  distance: number;
  speed: number;
  state: RideState;
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private isTracking = false;
  private stateSub?: Subscription;
  private rideSub?: Subscription;
  private elapsedSub?: Subscription;
  
  private currentData: NotificationData = {
    elapsed: 0,
    distance: 0,
    speed: 0,
    state: RideState.IDLE
  };

  private lastNotificationContent: { title: string; body: string; actionTypeId: string } | null = null;

  constructor(private rideService: RideService) {
    this.initStateListener();
    this.initNotificationActionListener();
  }

  ngOnDestroy(): void {
    this.stopTrackingNotification();
    this.stateSub?.unsubscribe();
    this.rideSub?.unsubscribe();
    this.elapsedSub?.unsubscribe();
    LocalNotifications.removeAllListeners();
  }

  private initNotificationActionListener(): void {
    if (!Capacitor.isNativePlatform()) return;

    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const actionId = notification.actionId;
      
      switch (actionId) {
        case 'pause':
          this.rideService.pauseRide();
          break;
        case 'resume':
          this.rideService.resumeRide();
          break;
        case 'stop':
          this.rideService.stopAndSaveRide();
          break;
      }
    });
  }

  private initStateListener(): void {
    this.stateSub = this.rideService.currentState$.subscribe(state => {
      this.currentData.state = state;
      
      if (state === RideState.TRACKING || state === RideState.PAUSED || 
          state === RideState.AUTO_PAUSED || state === RideState.GPS_SIGNAL_LOST) {
        if (!this.isTracking) {
          this.startTrackingNotification();
        }
        this.updateNotificationForState(state);
      } else {
        this.stopTrackingNotification();
      }
    });

    this.rideSub = this.rideService.currentRide$.subscribe(ride => {
      if (ride && this.isTracking) {
        // Just update internal data, don't trigger notification
        this.currentData.distance = ride.totalDistance;
        this.currentData.speed = ride.currentSpeed;
      }
    });

    this.elapsedSub = this.rideService.elapsed$.subscribe(elapsed => {
      if (this.isTracking) {
        // Just update internal data, don't trigger notification
        this.currentData.elapsed = elapsed;
      }
    });
  }

  private async startTrackingNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    this.isTracking = true;
    await this.showNotification();
    
    // Static persistent foreground notification
    // Only updates on state changes (pause/resume/GPS lost)
    // No updates for distance or time - completely silent
  }

  private stopTrackingNotification(): void {
    this.isTracking = false;
    this.lastNotificationContent = null;
    
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.cancel({ notifications: [{ id: TRACKING_NOTIFICATION_ID }] });
    }
  }

  private updateNotificationForState(state: RideState): void {
    switch (state) {
      case RideState.GPS_SIGNAL_LOST:
        this.currentData.warning = '⚠️ GPS Signal Lost';
        break;
      case RideState.AUTO_PAUSED:
        this.currentData.warning = '⏸️ Auto-Paused';
        break;
      case RideState.PAUSED:
        this.currentData.warning = '⏸️ Paused';
        break;
      default:
        this.currentData.warning = undefined;
    }
    this.showNotification();
  }

  private async showNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { elapsed, distance, speed, state, warning } = this.currentData;
    
    const elapsedStr = RideUtils.formatElapsed(elapsed);
    const distanceKm = (distance / 1000).toFixed(2);
    const speedKph = RideUtils.msToKph(speed).toFixed(1);
    
    let title = '🚴 Ride Tracker';
    let body = `⏱ ${elapsedStr} | 📏 ${distanceKm} km | ⚡ ${speedKph} km/h`;
    
    if (warning) {
      title = warning;
    }
    
    if (state === RideState.PAUSED || state === RideState.AUTO_PAUSED) {
      body = `⏱ ${elapsedStr} | 📏 ${distanceKm} km | Tap to resume`;
    }

    // Determine which action buttons to show based on state
    const actionTypeId = (state === RideState.PAUSED || state === RideState.AUTO_PAUSED) 
      ? 'RIDE_ACTIONS_PAUSED' 
      : 'RIDE_ACTIONS_TRACKING';

    // Only update if content has changed
    if (this.lastNotificationContent && 
        this.lastNotificationContent.title === title && 
        this.lastNotificationContent.body === body &&
        this.lastNotificationContent.actionTypeId === actionTypeId) {
      return;
    }

    this.lastNotificationContent = { title, body, actionTypeId };

    const options: ScheduleOptions = {
      notifications: [{
        id: TRACKING_NOTIFICATION_ID,
        title,
        body,
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        channelId: 'ride_tracking',
        actionTypeId,
        extra: {
          state: state.toString()
        },
        // Lockscreen visibility settings
        silent: true,
        // Android specific - show on lockscreen with actions
        ...(Capacitor.getPlatform() === 'android' && {
          visibility: 1, // PUBLIC - visible on lockscreen
          priority: 1 // HIGH priority
        })
      }]
    };

    try {
      await LocalNotifications.schedule(options);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Create notification channel for Android (call once on app init)
   */
  async createNotificationChannel(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.createChannel({
        id: 'ride_tracking',
        name: 'Ride Tracking',
        description: 'Shows ride tracking status and controls',
        importance: 4, // HIGH - ensures visibility on lockscreen
        visibility: 1, // PUBLIC - shows full content on lockscreen
        vibration: false,
        sound: undefined,
        lights: false
      });

      // Register action types for notification buttons
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'RIDE_ACTIONS_TRACKING',
            actions: [
              {
                id: 'pause',
                title: '⏸ Pause'
              },
              {
                id: 'stop',
                title: '⏹ Stop'
              }
            ]
          },
          {
            id: 'RIDE_ACTIONS_PAUSED',
            actions: [
              {
                id: 'resume',
                title: '▶ Resume'
              },
              {
                id: 'stop',
                title: '⏹ Stop'
              }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error creating notification channel:', error);
    }
  }

  /**
   * Show a one-time warning notification
   */
  async showWarningNotification(title: string, body: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title,
          body,
          smallIcon: 'ic_stat_icon',
          channelId: 'ride_tracking'
        }]
      });
    } catch (error) {
      console.error('Error showing warning notification:', error);
    }
  }
}
