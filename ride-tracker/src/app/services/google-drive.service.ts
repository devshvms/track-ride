import { Injectable } from '@angular/core';
import { HistoryService } from './history.service';
import { BehaviorSubject, firstValueFrom, filter, take } from 'rxjs';
import { AuthService } from './auth.service';
import { Ride } from '../models/ride.model';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private readonly SYNC_FILE_NAME = 'ride_tracker_history.json';
  private readonly LAST_SYNC_KEY = 'ride_tracker_last_sync';
  private readonly APP_FOLDER = 'appDataFolder';
  
  private syncStatus = new BehaviorSubject<SyncState>('idle');
  public syncStatus$ = this.syncStatus.asObservable();
  
  private lastSynced = new BehaviorSubject<number | null>(this.loadLastSyncTime());
  public lastSynced$ = this.lastSynced.asObservable();

  private fileId: string | null = null;

  constructor(
    private historyService: HistoryService,
    private authService: AuthService
  ) {
    // Auto-sync when user logs in
    this.authService.user$.pipe(
      filter(user => user !== null),
      take(1)
    ).subscribe(() => {
      this.syncNow();
    });
  }

  private loadLastSyncTime(): number | null {
    const stored = localStorage.getItem(this.LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : null;
  }

  private saveLastSyncTime(time: number): void {
    localStorage.setItem(this.LAST_SYNC_KEY, time.toString());
    this.lastSynced.next(time);
  }

  async syncNow(): Promise<void> {
    const token = this.authService.getStoredToken();
    if (!token) {
      this.syncStatus.next('error');
      return;
    }

    // Refresh token if needed
    const refreshed = await this.authService.refreshTokenIfNeeded();
    if (!refreshed) {
      this.syncStatus.next('error');
      return;
    }

    this.syncStatus.next('syncing');

    try {
      // Step 1: Find or create the sync file
      const existingFile = await this.findSyncFile(token);
      
      // Step 2: Download remote data if file exists
      let remoteRides: Ride[] = [];
      if (existingFile) {
        this.fileId = existingFile.id;
        remoteRides = await this.downloadRides(token, existingFile.id);
      }

      // Step 3: Get local rides
      const localRides = await firstValueFrom(this.historyService.rides$);

      // Step 4: Merge local and remote rides
      const mergedRides = this.mergeRides(localRides, remoteRides);

      // Step 5: Upload merged data
      if (existingFile) {
        await this.updateFile(token, existingFile.id, mergedRides);
      } else {
        this.fileId = await this.createFile(token, mergedRides);
      }

      // Step 6: Update local storage with merged data
      this.historyService.replaceAllRides(mergedRides);

      this.saveLastSyncTime(Date.now());
      this.syncStatus.next('success');
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        if (this.syncStatus.value === 'success') {
          this.syncStatus.next('idle');
        }
      }, 3000);
      
    } catch (error) {
      console.error('Sync error:', error);
      this.syncStatus.next('error');
    }
  }

  private async findSyncFile(token: string): Promise<DriveFile | null> {
    const query = encodeURIComponent(`name='${this.SYNC_FILE_NAME}' and trashed=false`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      // If appDataFolder fails, try regular Drive
      return this.findSyncFileInDrive(token);
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  private async findSyncFileInDrive(token: string): Promise<DriveFile | null> {
    const query = encodeURIComponent(`name='${this.SYNC_FILE_NAME}' and trashed=false`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to search for sync file');
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  private async downloadRides(token: string, fileId: string): Promise<Ride[]> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download rides');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  private mergeRides(localRides: Ride[], remoteRides: Ride[]): Ride[] {
    const rideMap = new Map<string, Ride>();

    // Add remote rides first
    for (const ride of remoteRides) {
      rideMap.set(ride.id, ride);
    }

    // Override with local rides (local takes precedence for same ID)
    // Or add new local rides
    for (const ride of localRides) {
      const existing = rideMap.get(ride.id);
      if (!existing) {
        // New local ride, add it
        rideMap.set(ride.id, ride);
      } else {
        // Both exist - use the one with more recent endTime or startTime
        const localTime = ride.endTime || ride.startTime;
        const remoteTime = existing.endTime || existing.startTime;
        if (localTime >= remoteTime) {
          rideMap.set(ride.id, ride);
        }
      }
    }

    // Sort by startTime descending (newest first)
    return Array.from(rideMap.values()).sort((a, b) => b.startTime - a.startTime);
  }

  private async createFile(token: string, rides: Ride[]): Promise<string> {
    const metadata = {
      name: this.SYNC_FILE_NAME,
      mimeType: 'application/json'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(rides) +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create file');
    }

    const data = await response.json();
    return data.id;
  }

  private async updateFile(token: string, fileId: string, rides: Ride[]): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rides)
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update file');
    }
  }

  async deleteCloudData(): Promise<boolean> {
    const token = this.authService.getStoredToken();
    if (!token || !this.fileId) {
      return false;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${this.fileId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        this.fileId = null;
        localStorage.removeItem(this.LAST_SYNC_KEY);
        this.lastSynced.next(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
