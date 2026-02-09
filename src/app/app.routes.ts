import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.DashboardComponent),
  },
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: 'workspaces/new',
    loadComponent: () =>
      import('./workspaces/workspace-create').then((m) => m.WorkspaceCreateComponent),
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
