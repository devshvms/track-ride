import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserProfile {
  name: string;
  email: string;
  photoUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserProfile | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor() {}

  async loginWithGoogle(): Promise<void> {
    // Placeholder for Firebase/Google Identity Services logic
    const mockUser: UserProfile = {
      name: 'Rider User',
      email: 'user@example.com'
    };
    this.userSubject.next(mockUser);
  }

  logout(): void {
    this.userSubject.next(null);
  }
}
