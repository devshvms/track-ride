// src/app/home/home.page.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RideService } from '../services/ride.service';
import { RideState } from '../models/ride-state.model';
import { Observable, Subscription } from 'rxjs';
import { Ride } from '../models/ride.model';
import { ModalController, IonicModule } from '@ionic/angular';
import { PauseModalComponent } from './pause-modal/pause-modal.component';
import { StopModalComponent } from './stop-modal/stop-modal.component';
import { RideSummaryComponent } from './ride-summary/ride-summary.component';
import { LiveMapComponent } from './live-map/live-map.component';
import { CommonModule } from '@angular/common';
import { SpeedPipe, DistancePipe } from '../pipes/duration.pipe';
import { ApplyPipe } from '../pipes/apply.pipe';
import { RideUtils } from '../utils/ride-calculations';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule, RideSummaryComponent, LiveMapComponent, CommonModule, SpeedPipe, DistancePipe, ApplyPipe]
})
export class HomePage implements OnInit, OnDestroy {
  currentState$: Observable<RideState> = this.rideService.currentState$;
  currentRide$: Observable<Ride | null> = this.rideService.currentRide$;
  elapsed$: Observable<number> = this.rideService.elapsed$;

  RideState = RideState;

  // For template: format elapsed seconds
  formatElapsed = RideUtils.formatElapsed;

  constructor(
    private rideService: RideService,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  ngOnInit(): void {}
  ngOnDestroy(): void {}

  startRide(): void {
    this.rideService.startRide();
  }

  resumeRide(): void {
    this.rideService.resumeRide();
  }

  async pauseRide(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PauseModalComponent,
      breakpoints: [0, 0.55],
      initialBreakpoint: 0.55
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.rideService.pauseRide(data);
    }
  }

  async stopRide(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: StopModalComponent,
      breakpoints: [0, 0.45],
      initialBreakpoint: 0.45
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();

    if (role === 'save') {
      // FIX: was 'confirm', now matches StopModalComponent role
      this.rideService.stopAndSaveRide();
    } else if (role === 'discard') {
      // FIX: NEW — Discard Ride action per workflow STOP_CONFIRMATION state
      this.rideService.discardRide();
    }
    // 'cancel' → do nothing, ride remains active
  }

  onViewInHistory(): void {
    this.router.navigateByUrl('/tabs/history');
  }
}