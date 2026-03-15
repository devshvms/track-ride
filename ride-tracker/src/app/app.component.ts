import { Component, OnInit } from '@angular/core';
import { PermissionsService } from './services/permissions.service';
import { NotificationService } from './services/notification.service';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private permissions: PermissionsService,
    private notifications: NotificationService,
    private platform: Platform
  ) {}

  async ngOnInit(): Promise<void> {
    await this.platform.ready();
    // Request all permissions on app startup
    await this.permissions.requestAllPermissions();
    // Create notification channel for Android
    await this.notifications.createNotificationChannel();
  }
}
