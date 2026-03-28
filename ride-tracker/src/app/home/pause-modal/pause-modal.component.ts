import { Component } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { PauseReason } from '../../models/ride.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pause-modal',
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Pause Ride</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list lines="none">
        <ion-radio-group [(ngModel)]="selectedReason">
          <ion-item *ngFor="let r of reasons">
            <ion-label>{{ r.label }}</ion-label>
            <ion-radio slot="start" [value]="r.value"></ion-radio>
          </ion-item>
        </ion-radio-group>
      </ion-list>
      <ion-button expand="block" (click)="confirm()" [disabled]="!selectedReason">
        Confirm Pause
      </ion-button>
    </ion-content>
  `
})
export class PauseModalComponent {
  selectedReason: PauseReason = 'break';
  reasons: { label: string, value: PauseReason }[] = [
    { label: 'Short Break', value: 'break' },
    { label: 'Food/Refreshment', value: 'refreshment' },
    { label: 'Traffic/Wait', value: 'traffic' },
    { label: 'Fuel Stop', value: 'fuel' },
    { label: 'Photo Stop', value: 'photo' },
    { label: 'Other', value: 'other' }
  ];

  constructor(private modalCtrl: ModalController) {}

  cancel() { return this.modalCtrl.dismiss(null, 'cancel'); }
  confirm() { return this.modalCtrl.dismiss(this.selectedReason, 'confirm'); }
}
