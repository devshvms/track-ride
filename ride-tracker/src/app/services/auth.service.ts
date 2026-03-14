import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken: string | null = null;
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  // The specific scope required to write to the user's Drive
  private readonly DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

  async loginWithGoogle() {
    // 1. Initialize the Google Identity Services client
    // @ts-ignore (assuming gsi script is loaded in index.html)
    const client = google.accounts.oauth2.initTokenClient({
      client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
      scope: this.DRIVE_SCOPE,
      callback: (response: any) => {
        if (response.access_token) {
          this.accessToken = response.access_token;
          // Fetch user profile using the token to populate the UI
          this.fetchUserProfile(response.access_token);
        }
      },
    });

    // 2. This triggers the browser popup asking for Drive permissions
    client.requestAccessToken();
  }

  private async fetchUserProfile(token: string) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profile = await resp.json();
    this.userSubject.next({
      name: profile.name,
      email: profile.email,
      photoUrl: profile.picture,
      token: token // Store token for GoogleDriveService to use
    });
  }

  getStoredToken() {
    return this.accessToken;
  }

  logout() {
    this.accessToken = null;
    this.userSubject.next(null);
    // Optionally, revoke the token on Google's side if needed
    // google.accounts.oauth2.revoke(this.accessToken, () => console.log('token revoked'));
  }
}
