import { Injectable } from '@angular/core';
import type { Workspace } from '../../../electron/types/models';
import type { IpcResult } from '../../../electron/types/ipc-result';
import type { WorkspaceCreateEntry } from '../../../electron/ipc/ipc-channels';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  getWorkspaces(): Promise<IpcResult<Workspace[]>> {
    return window.electronAPI.getWorkspaces();
  }

  createWorkspace(name: string, entries: WorkspaceCreateEntry[]): Promise<IpcResult<Workspace>> {
    return window.electronAPI.createWorkspace(name, entries);
  }

  deleteWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.deleteWorkspace(id);
  }

  openWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.openWorkspace(id);
  }
}
