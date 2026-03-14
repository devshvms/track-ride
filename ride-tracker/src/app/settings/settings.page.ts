import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../services/settings.service';
import { AuthService } from '../services/auth.service';
import { AppSettings } from '../models/ride.model';
import { Observable } from 'rxjs';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SettingsPage implements OnInit {
  settings$: Observable<AppSettings>;
  user$ = this.authService.user$;

  constructor(
    private settingsService: SettingsService,
    private authService: AuthService
  ) {
    this.settings$ = this.settingsService.settings$;
  }

  ngOnInit() {}

  onToggleChange(key: keyof AppSettings | 'autoPauseEnabled', event: any) {
    const value = event.detail.checked;
    
    if (key === 'autoPauseEnabled') {
      this.settingsService.updateSettings({ autoPause: { ...this.settingsService.currentSettings.autoPause, enabled: value } });
    } else {
      this.settingsService.updateSettings({ [key]: value });
    }
  }

  onSelectChange(key: keyof AppSettings, event: any) {
    const value = event.detail.value;
    this.settingsService.updateSettings({ [key]: value });
  }

  resetSettings() {
    this.settingsService.resetToDefaults();
  }

  login() {
    this.authService.loginWithGoogle();
  }

  logout() {
    this.authService.logout();
  }
}
