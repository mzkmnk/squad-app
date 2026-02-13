import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'workspaces',
    loadComponent: () =>
      import('./workspaces/workspace-list').then((m) => m.WorkspaceListComponent),
  },
  {
    path: 'workspaces/:id/edit',
    loadComponent: () =>
      import('./workspaces/workspace-edit').then((m) => m.WorkspaceEditComponent),
  },
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings').then((m) => m.SettingsComponent),
  },
  {
    path: '',
    redirectTo: 'workspaces',
    pathMatch: 'full',
  },
];
