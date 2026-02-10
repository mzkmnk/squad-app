import { Injectable } from '@angular/core';
import type { Workspace } from '../../../electron/types/models';
import type { IpcResult } from '../../../electron/types/ipc-result';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  getWorkspaces(): Promise<IpcResult<Workspace[]>> {
    return window.electronAPI.getWorkspaces();
  }

  createWorkspace(
    name: string,
    entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
  ): Promise<IpcResult<Workspace>> {
    return window.electronAPI.createWorkspace(name, entries);
  }

  deleteWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.deleteWorkspace(id);
  }

  openWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.openWorkspace(id);
  }
}
