import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-battery-optimization-prompt',
  template: `
    <ion-card *ngIf="shouldShowPrompt" color="warning">
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="battery-charging-outline"></ion-icon>
          Background Tracking Setup Required
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p>For reliable GPS tracking in background, please disable battery optimization:</p>
        <ol>
          <li>Open Android Settings</li>
          <li>Apps → Ride Tracker → Battery</li>
          <li>Select "Unrestricted"</li>
        </ol>
        <ion-button expand="block" (click)="dismiss()">
          Got It
        </ion-button>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    ion-card {
      margin: 16px;
    }
    ol {
      margin: 12px 0;
      padding-left: 20px;
    }
    li {
      margin: 4px 0;
    }
  `]
})
export class BatteryOptimizationPromptComponent implements OnInit {
  shouldShowPrompt = false;
  private readonly PROMPT_KEY = 'battery_optimization_prompt_shown';

  constructor(private alertController: AlertController) {}

  ngOnInit() {
    this.checkIfShouldShow();
  }

  private checkIfShouldShow() {
    // Only show on Android
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    // Check if already shown
    const alreadyShown = localStorage.getItem(this.PROMPT_KEY);
    if (!alreadyShown) {
      this.shouldShowPrompt = true;
    }
  }

  dismiss() {
    localStorage.setItem(this.PROMPT_KEY, 'true');
    this.shouldShowPrompt = false;
  }

  async showDetailedInstructions() {
    const alert = await this.alertController.create({
      header: 'Disable Battery Optimization',
      message: `
        <p><strong>Why is this needed?</strong></p>
        <p>Android kills background apps to save battery. This prevents GPS tracking when the screen is off.</p>
        
        <p><strong>Steps:</strong></p>
        <ol>
          <li>Open <strong>Android Settings</strong></li>
          <li>Go to <strong>Apps</strong></li>
          <li>Find and tap <strong>Ride Tracker</strong></li>
          <li>Tap <strong>Battery</strong></li>
          <li>Select <strong>Unrestricted</strong></li>
        </ol>
        
        <p><em>This ensures your rides are tracked completely, even with the phone in your pocket.</em></p>
      `,
      buttons: ['OK']
    });

    await alert.present();
  }
}
