import { Injectable } from '@angular/core';
import { HistoryService } from './history.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private syncStatus = new BehaviorSubject<SyncState>('idle');
  public syncStatus$ = this.syncStatus.asObservable();
  
  private lastSynced = new BehaviorSubject<number | null>(null);
  public lastSynced$ = this.lastSynced.asObservable();

  constructor(private historyService: HistoryService, private authService: AuthService) {}

  async syncNow(): Promise<void> {
    const token = this.authService.getStoredToken();
    if (!token) {
      this.syncStatus.next('error');
      return;
    }
  
    this.syncStatus.next('syncing');
  
    try {
      const rides = await firstValueFrom(this.historyService.rides$);
      
      // Create the multipart request for Google Drive API
      const metadata = {
        name: 'ride_history.json',
        mimeType: 'application/json'
      };
  
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', new Blob([JSON.stringify(rides)], { type: 'application/json' }));
  
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
  
      if (response.ok) {
        this.lastSynced.next(Date.now());
        this.syncStatus.next('success');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      this.syncStatus.next('error');
    }
  }
  
}
