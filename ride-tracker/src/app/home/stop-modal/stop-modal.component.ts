// src/app/home/stop-modal/stop-modal.component.ts
import { Component } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';

/**
 * FIX: Workflow STOP_CONFIRMATION state requires three actions:
 *   [Discard Ride] → discards all data, returns to IDLE
 *   [Cancel]       → returns to PAUSED (ride preserved)
 *   [Save Ride]    → saves and shows RIDE_SUMMARY
 * Previously only had cancel/confirm — Discard was missing.
 */
@Component({
  selector: 'app-stop-modal',
  standalone: true,
  imports: [IonicModule],
  template: `
    <ion-content class="ion-padding ion-text-center">
      <div class="modal-header">
        <ion-icon name="stop-circle" color="danger" style="font-size: 64px;"></ion-icon>
        <h2>Finish Ride?</h2>
        <p>Your ride will be saved to history.</p>
      </div>

      <div class="modal-actions">
        <ion-button expand="block" color="success" (click)="save()">
          <ion-icon slot="start" name="save-outline"></ion-icon>
          Save Ride
        </ion-button>
        <ion-button expand="block" fill="outline" color="medium" (click)="cancel()">
          <ion-icon slot="start" name="arrow-back-outline"></ion-icon>
          Continue Riding
        </ion-button>
        <ion-button expand="block" fill="clear" color="danger" (click)="discard()">
          <ion-icon slot="start" name="trash-outline"></ion-icon>
          Discard Ride
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-header { margin-top: 20px; margin-bottom: 30px; }
    .modal-header h2 { font-size: 1.5rem; font-weight: 700; margin: 8px 0 4px; }
    .modal-header p { color: var(--ion-color-medium); margin: 0; }
    .modal-actions { display: flex; flex-direction: column; gap: 10px; }
  `]
})
export class StopModalComponent {
  constructor(private modalCtrl: ModalController) {}

  cancel(): Promise<boolean>   { return this.modalCtrl.dismiss(null, 'cancel'); }
  save(): Promise<boolean>     { return this.modalCtrl.dismiss(null, 'save'); }
  discard(): Promise<boolean>  { return this.modalCtrl.dismiss(null, 'discard'); }
}