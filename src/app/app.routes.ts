import { Routes } from '@angular/router';

export const routes: Routes = [
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
    redirectTo: 'repos',
    pathMatch: 'full',
  },
];
