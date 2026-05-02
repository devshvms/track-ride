// src/app/services/storage.service.ts
import { Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Ride, GpsPoint } from '../models/ride.model';

export interface StorageStats {
  totalRides: number;
  totalSize: number;
  gpxFiles: number;
  images: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly RIDES_DIR = 'rides';
  private readonly GPX_DIR = 'gpx';
  private readonly IMAGES_DIR = 'images';
  private readonly INDEX_FILE = 'rides_index.json';

  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize storage directories
   */
  private async initializeStorage(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Using localStorage fallback for web platform');
      return;
    }

    try {
      // Create directories if they don't exist
      await this.ensureDirectory(this.RIDES_DIR);
      await this.ensureDirectory(this.GPX_DIR);
      await this.ensureDirectory(this.IMAGES_DIR);
      
      console.log('Storage directories initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDirectory(path: string): Promise<void> {
    try {
      await Filesystem.mkdir({
        path,
        directory: Directory.Data,
        recursive: true
      });
    } catch (error: any) {
      // Directory might already exist, ignore error
      if (!error.message?.includes('already exists')) {
        console.warn(`Failed to create directory ${path}:`, error);
      }
    }
  }

  /**
   * Save ride data to persistent storage
   */
  async saveRide(ride: Ride): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to localStorage for web
      this.saveRideToLocalStorage(ride);
      return;
    }

    try {
      const fileName = `${ride.id}.json`;
      const filePath = `${this.RIDES_DIR}/${fileName}`;

      await Filesystem.writeFile({
        path: filePath,
        data: JSON.stringify(ride, null, 2),
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      // Update index
      await this.updateIndex(ride);

      console.log(`Ride ${ride.id} saved to filesystem`);
    } catch (error) {
      console.error('Failed to save ride:', error);
      // Fallback to localStorage
      this.saveRideToLocalStorage(ride);
    }
  }

  /**
   * Load all rides from persistent storage
   */
  async loadAllRides(): Promise<Ride[]> {
    if (!Capacitor.isNativePlatform()) {
      return this.loadRidesFromLocalStorage();
    }

    try {
      const index = await this.loadIndex();
      const rides: Ride[] = [];

      for (const rideId of index) {
        const ride = await this.loadRide(rideId);
        if (ride) {
          rides.push(ride);
        }
      }

      return rides.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    } catch (error) {
      console.error('Failed to load rides from filesystem:', error);
      return this.loadRidesFromLocalStorage();
    }
  }

  /**
   * Load single ride by ID
   */
  async loadRide(rideId: string): Promise<Ride | null> {
    if (!Capacitor.isNativePlatform()) {
      const rides = this.loadRidesFromLocalStorage();
      return rides.find(r => r.id === rideId) || null;
    }

    try {
      const filePath = `${this.RIDES_DIR}/${rideId}.json`;
      const result = await Filesystem.readFile({
        path: filePath,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      return JSON.parse(result.data as string) as Ride;
    } catch (error) {
      console.error(`Failed to load ride ${rideId}:`, error);
      return null;
    }
  }

  /**
   * Delete ride from storage
   */
  async deleteRide(rideId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.deleteRideFromLocalStorage(rideId);
      return;
    }

    try {
      // Delete ride file
      const filePath = `${this.RIDES_DIR}/${rideId}.json`;
      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Data
      });

      // Delete associated GPX file if exists
      try {
        await this.deleteGPX(rideId);
      } catch (e) {
        // GPX might not exist
      }

      // Update index
      await this.removeFromIndex(rideId);

      console.log(`Ride ${rideId} deleted`);
    } catch (error) {
      console.error('Failed to delete ride:', error);
      this.deleteRideFromLocalStorage(rideId);
    }
  }

  /**
   * Export ride as GPX file
   */
  async exportToGPX(ride: Ride): Promise<string> {
    const gpxContent = this.generateGPX(ride);
    const fileName = `ride_${ride.id}.gpx`;

    if (!Capacitor.isNativePlatform()) {
      // For web, return as data URL
      return `data:application/gpx+xml;charset=utf-8,${encodeURIComponent(gpxContent)}`;
    }

    try {
      const filePath = `${this.GPX_DIR}/${fileName}`;
      await Filesystem.writeFile({
        path: filePath,
        data: gpxContent,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      const uri = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Data
      });

      console.log(`GPX exported: ${uri.uri}`);
      return uri.uri;
    } catch (error) {
      console.error('Failed to export GPX:', error);
      throw error;
    }
  }

  /**
   * Delete GPX file
   */
  async deleteGPX(rideId: string): Promise<void> {
    const fileName = `ride_${rideId}.gpx`;
    const filePath = `${this.GPX_DIR}/${fileName}`;

    await Filesystem.deleteFile({
      path: filePath,
      directory: Directory.Data
    });
  }

  /**
   * Save image to storage
   */
  async saveImage(rideId: string, imageData: string, index: number): Promise<string> {
    const fileName = `ride_${rideId}_${index}.jpg`;
    const filePath = `${this.IMAGES_DIR}/${fileName}`;

    if (!Capacitor.isNativePlatform()) {
      // For web, return the data URL as-is
      return imageData;
    }

    try {
      await Filesystem.writeFile({
        path: filePath,
        data: imageData,
        directory: Directory.Data
      });

      const uri = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Data
      });

      return uri.uri;
    } catch (error) {
      console.error('Failed to save image:', error);
      return imageData;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!Capacitor.isNativePlatform()) {
      const rides = this.loadRidesFromLocalStorage();
      return {
        totalRides: rides.length,
        totalSize: new Blob([JSON.stringify(rides)]).size,
        gpxFiles: 0,
        images: 0
      };
    }

    try {
      const index = await this.loadIndex();
      
      // Count GPX files
      const gpxList = await Filesystem.readdir({
        path: this.GPX_DIR,
        directory: Directory.Data
      });

      // Count images
      const imagesList = await Filesystem.readdir({
        path: this.IMAGES_DIR,
        directory: Directory.Data
      });

      return {
        totalRides: index.length,
        totalSize: 0, // Would need to calculate individual file sizes
        gpxFiles: gpxList.files.length,
        images: imagesList.files.length
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalRides: 0,
        totalSize: 0,
        gpxFiles: 0,
        images: 0
      };
    }
  }

  /**
   * Clear all storage (use with caution!)
   */
  async clearAllStorage(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      localStorage.removeItem('ride_tracker_history');
      return;
    }

    try {
      // Delete all directories
      await Filesystem.rmdir({
        path: this.RIDES_DIR,
        directory: Directory.Data,
        recursive: true
      });

      await Filesystem.rmdir({
        path: this.GPX_DIR,
        directory: Directory.Data,
        recursive: true
      });

      await Filesystem.rmdir({
        path: this.IMAGES_DIR,
        directory: Directory.Data,
        recursive: true
      });

      // Recreate directories
      await this.initializeStorage();

      console.log('All storage cleared');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ────────────────────────────────────────────────────────────

  /**
   * Load/update ride index (list of ride IDs)
   */
  private async loadIndex(): Promise<string[]> {
    try {
      const result = await Filesystem.readFile({
        path: this.INDEX_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      return JSON.parse(result.data as string) as string[];
    } catch (error) {
      // Index doesn't exist yet
      return [];
    }
  }

  private async saveIndex(index: string[]): Promise<void> {
    await Filesystem.writeFile({
      path: this.INDEX_FILE,
      data: JSON.stringify(index),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
  }

  private async updateIndex(ride: Ride): Promise<void> {
    const index = await this.loadIndex();
    if (!index.includes(ride.id)) {
      index.unshift(ride.id); // Add to beginning (newest first)
      await this.saveIndex(index);
    }
  }

  private async removeFromIndex(rideId: string): Promise<void> {
    const index = await this.loadIndex();
    const updated = index.filter(id => id !== rideId);
    await this.saveIndex(updated);
  }

  /**
   * Generate GPX XML from ride data
   */
  private generateGPX(ride: Ride): string {
    const startTime = new Date(ride.startTime).toISOString();
    const endTime = ride.endTime ? new Date(ride.endTime).toISOString() : new Date().toISOString();

    let trackPoints = '';
    for (const point of ride.points) {
      const time = new Date(point.timestamp).toISOString();
      const ele = point.altitude !== undefined ? `    <ele>${point.altitude}</ele>\n` : '';
      
      trackPoints += `  <trkpt lat="${point.latitude}" lon="${point.longitude}">\n`;
      trackPoints += ele;
      trackPoints += `    <time>${time}</time>\n`;
      trackPoints += `  </trkpt>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ride Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Ride ${ride.id}</name>
    <time>${startTime}</time>
  </metadata>
  <trk>
    <name>Ride ${ride.id}</name>
    <type>cycling</type>
    <trkseg>
${trackPoints}    </trkseg>
  </trk>
</gpx>`;
  }

  // ────────────────────────────────────────────────────────────
  // LOCALSTORAGE FALLBACK (for web platform)
  // ────────────────────────────────────────────────────────────

  private saveRideToLocalStorage(ride: Ride): void {
    try {
      const stored = localStorage.getItem('ride_tracker_history');
      const rides: Ride[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing ride with same ID
      const filtered = rides.filter(r => r.id !== ride.id);
      filtered.unshift(ride);
      
      localStorage.setItem('ride_tracker_history', JSON.stringify(filtered));
    } catch (error) {
      console.error('LocalStorage save failed:', error);
    }
  }

  private loadRidesFromLocalStorage(): Ride[] {
    try {
      const stored = localStorage.getItem('ride_tracker_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('LocalStorage load failed:', error);
      return [];
    }
  }

  private deleteRideFromLocalStorage(rideId: string): void {
    try {
      const stored = localStorage.getItem('ride_tracker_history');
      const rides: Ride[] = stored ? JSON.parse(stored) : [];
      const filtered = rides.filter(r => r.id !== rideId);
      localStorage.setItem('ride_tracker_history', JSON.stringify(filtered));
    } catch (error) {
      console.error('LocalStorage delete failed:', error);
    }
  }
}
