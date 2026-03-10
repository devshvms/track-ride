import { Component, OnInit } from '@angular/core';
import { RideService } from '../services/ride.service';
import { Ride } from '../models/ride.model';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false
})
export class Tab1Page implements OnInit {
  currentRide: Ride | null = null;
  isTracking = false;
  isPaused = false;

  constructor(
    private rideService: RideService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.rideService.currentRide$.subscribe(ride => {
      this.currentRide = ride;
    });
  }

  async startRide() {
    await this.rideService.startRide();
    this.isTracking = true;
    this.isPaused = false;
  }

  async pauseRide() {
    const alert = await this.alertController.create({
      header: 'Pause Reason',
      inputs: [
        { name: 'reason', type: 'radio', label: 'Break', value: 'break', checked: true },
        { name: 'reason', type: 'radio', label: 'Refreshment', value: 'refreshment' },
        { name: 'reason', type: 'radio', label: 'Traffic', value: 'traffic' },
        { name: 'reason', type: 'radio', label: 'Other', value: 'other' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Pause',
          handler: (data) => {
            this.rideService.pauseRide(data);
            this.isPaused = true;
          }
        }
      ]
    });
    await alert.present();
  }

  resumeRide() {
    this.rideService.resumeRide();
    this.isPaused = false;
  }

  async stopRide() {
    const ride = await this.rideService.stopRide();
    this.isTracking = false;
    this.isPaused = false;
    console.log('Ride saved:', ride);
    // TODO: Navigate to history or show summary
  }

  formatDistance(meters: number): string {
    return (meters / 1000).toFixed(2) + ' km';
  }

  formatSpeed(mps: number): string {
    return (mps * 3.6).toFixed(1) + ' km/h';
  }
}
