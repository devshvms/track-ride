import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare const google: any;

export interface GoogleUser {
  name: string;
  email: string;
  photoUrl: string;
  token: string;
  tokenExpiry: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'ride_tracker_google_user';
  private readonly TOKEN_EXPIRY_KEY = 'ride_tracker_token_expiry';
  
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private userSubject = new BehaviorSubject<GoogleUser | null>(null);
  public user$ = this.userSubject.asObservable();

  private readonly DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  private readonly PROFILE_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
  
  // Replace with your actual Google Cloud Console client ID
  private readonly CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

  private tokenClient: any = null;
  private isGsiLoaded = false;

  constructor() {
    this.loadStoredUser();
    this.waitForGsi();
  }

  private waitForGsi(): void {
    const checkGsi = () => {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        this.isGsiLoaded = true;
        this.initializeTokenClient();
      } else {
        setTimeout(checkGsi, 100);
      }
    };
    checkGsi();
  }

  private initializeTokenClient(): void {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: `${this.DRIVE_SCOPE} ${this.PROFILE_SCOPE}`,
      callback: (response: any) => this.handleTokenResponse(response),
    });
  }

  private loadStoredUser(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      
      if (stored && expiry) {
        const user: GoogleUser = JSON.parse(stored);
        const expiryTime = parseInt(expiry, 10);
        
        // Check if token is still valid (with 5 min buffer)
        if (Date.now() < expiryTime - 300000) {
          this.accessToken = user.token;
          this.tokenExpiry = expiryTime;
          this.userSubject.next(user);
        } else {
          // Token expired, clear storage
          this.clearStorage();
        }
      }
    } catch (e) {
      this.clearStorage();
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  private handleTokenResponse(response: any): void {
    if (response.error) {
      console.error('OAuth error:', response.error);
      return;
    }

    if (response.access_token) {
      this.accessToken = response.access_token;
      // Google tokens typically expire in 1 hour (3600 seconds)
      const expiresIn = response.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);
      
      this.fetchUserProfile(response.access_token);
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (!this.isGsiLoaded) {
      console.error('Google Identity Services not loaded yet');
      return;
    }

    if (!this.tokenClient) {
      this.initializeTokenClient();
    }

    // Request access token - this triggers the popup
    this.tokenClient.requestAccessToken();
  }

  private async fetchUserProfile(token: string): Promise<void> {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!resp.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const profile = await resp.json();
      const user: GoogleUser = {
        name: profile.name,
        email: profile.email,
        photoUrl: profile.picture,
        token: token,
        tokenExpiry: this.tokenExpiry!
      };
      
      // Persist user data
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, this.tokenExpiry!.toString());
      
      this.userSubject.next(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      this.logout();
    }
  }

  getStoredToken(): string | null {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }
    return null;
  }

  isLoggedIn(): boolean {
    return this.getStoredToken() !== null;
  }

  async refreshTokenIfNeeded(): Promise<boolean> {
    // If token is about to expire (within 5 minutes), request a new one
    if (this.tokenExpiry && Date.now() > this.tokenExpiry - 300000) {
      return new Promise((resolve) => {
        if (!this.tokenClient) {
          resolve(false);
          return;
        }
        
        // Request new token silently (prompt: 'none' for silent refresh)
        const originalCallback = this.tokenClient.callback;
        this.tokenClient.callback = (response: any) => {
          this.handleTokenResponse(response);
          resolve(!response.error);
        };
        
        this.tokenClient.requestAccessToken({ prompt: '' });
      });
    }
    return true;
  }

  logout(): void {
    if (this.accessToken) {
      // Revoke the token on Google's side
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Token revoked');
      });
    }
    
    this.accessToken = null;
    this.tokenExpiry = null;
    this.userSubject.next(null);
    this.clearStorage();
  }
}
