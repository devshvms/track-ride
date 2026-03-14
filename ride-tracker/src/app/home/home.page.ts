import { Component, OnInit } from '@angular/core';
import { RideService } from '../services/ride.service';
import { RideState } from '../models/ride-state.model';
import { Observable } from 'rxjs';
import { Ride } from '../models/ride.model';
import { ModalController } from '@ionic/angular';
import { PauseModalComponent } from './pause-modal/pause-modal.component';
import { StopModalComponent } from './stop-modal/stop-modal.component';
import { RideSummaryComponent } from "./ride-summary/ride-summary.component";


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RideSummaryComponent],
})
export class HomePage implements OnInit {
  currentState$: Observable<RideState> = this.rideService.currentState$;

  RideState = RideState; // Allow access to enum in template

  constructor(
    private rideService: RideService,
    private modalCtrl: ModalController // Inject ModalController
  ) {}
  
  async pauseRide() {
    const modal = await this.modalCtrl.create({
      component: PauseModalComponent,
      breakpoints: [0, 0.5], // Half-sheet behavior
      initialBreakpoint: 0.5
    });
    
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    
    if (role === 'confirm' && data) {
      this.rideService.pauseRide(data); // Pass the specific reason
    }
  }

  ngOnInit() {}

  startRide() {
    this.rideService.startRide();
  }

  resumeRide() {
    this.rideService.resumeRide();
  }

  async stopRide() {
    const modal = await this.modalCtrl.create({
      component: StopModalComponent,
      cssClass: 'auto-height-modal', // Optional: define this in global.scss for small modals
      breakpoints: [0, 0.4],
      initialBreakpoint: 0.4
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      this.rideService.stopAndSaveRide();
    }
  }
}
