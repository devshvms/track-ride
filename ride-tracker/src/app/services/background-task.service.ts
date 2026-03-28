// src/app/services/background-task.service.ts
import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

declare const BackgroundTask: any;

@Injectable({ providedIn: 'root' })
export class BackgroundTaskService {
  private taskId: string | null = null;
  private isInBackground = false;

  constructor() {
    this.initializeAppStateListener();
  }

  private initializeAppStateListener(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      this.isInBackground = !isActive;
      
      if (!isActive) {
        this.startBackgroundTask();
      } else {
        this.stopBackgroundTask();
      }
    });
  }

  private startBackgroundTask(): void {
    if (!Capacitor.isNativePlatform() || this.taskId) {
      return;
    }

    // For Android, the foreground service handles this
    // For iOS, we need to use background task
    if (Capacitor.getPlatform() === 'ios') {
      try {
        // Request extended background execution time
        if (typeof BackgroundTask !== 'undefined') {
          this.taskId = BackgroundTask.beforeExit(() => {
            console.log('Background task started');
          });
        }
      } catch (error) {
        console.error('Failed to start background task:', error);
      }
    }
  }

  private stopBackgroundTask(): void {
    if (this.taskId && Capacitor.getPlatform() === 'ios') {
      try {
        if (typeof BackgroundTask !== 'undefined') {
          BackgroundTask.finish(this.taskId);
          this.taskId = null;
        }
      } catch (error) {
        console.error('Failed to stop background task:', error);
      }
    }
  }

  getIsInBackground(): boolean {
    return this.isInBackground;
  }
}
