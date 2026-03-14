import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { HomePageRoutingModule } from './home-routing.module';
import { PauseModalComponent } from './pause-modal/pause-modal.component';
import { StopModalComponent } from './stop-modal/stop-modal.component';
import { RideSummaryComponent } from './ride-summary/ride-summary.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    HomePageRoutingModule
  ],
  declarations: [HomePage, PauseModalComponent, StopModalComponent, RideSummaryComponent]
})
export class HomePageModule {}
