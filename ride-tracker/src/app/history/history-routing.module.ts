import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HistoryPage } from './history.page';

const routes: Routes = [
  {
    path: '',
    component: HistoryPage,
  },
  {
    path: ':id',
    loadComponent: () => import('./ride-detail/ride-detail.page').then(m => m.RideDetailPage)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HistoryPageRoutingModule {}
