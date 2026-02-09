import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'workspaces',
    loadComponent: () =>
      import('./workspaces/workspace-list').then((m) => m.WorkspaceListComponent),
  },
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: '',
    redirectTo: 'workspaces',
    pathMatch: 'full',
  },
];
