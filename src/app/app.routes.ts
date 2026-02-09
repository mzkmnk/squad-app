import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: '',
    redirectTo: 'repos',
    pathMatch: 'full',
  },
];
