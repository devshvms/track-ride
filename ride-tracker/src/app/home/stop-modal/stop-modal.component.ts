import { Component } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-stop-modal',
  standalone: true,
  imports: [IonicModule],
  template: `
    <ion-content class="ion-padding ion-text-center">
      <div class="modal-header">
        <ion-icon name="stop-circle" color="danger" style="font-size: 64px;"></ion-icon>
        <h2>Finish Ride?</h2>
        <p>This will stop tracking and save your stats to history.</p>
      </div>

      <div class="modal-actions">
        <ion-button expand="block" color="danger" (click)="confirm()">
          Stop & Save
        </ion-button>
        <ion-button expand="block" fill="clear" color="medium" (click)="cancel()">
          Continue Riding
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-header { margin-top: 20px; margin-bottom: 30px; }
    .modal-actions { display: flex; flex-direction: column; gap: 10px; }
  `]
})
export class StopModalComponent {
  constructor(private modalCtrl: ModalController) {}
  cancel() { return this.modalCtrl.dismiss(null, 'cancel'); }
  confirm() { return this.modalCtrl.dismiss(true, 'confirm'); }
}
