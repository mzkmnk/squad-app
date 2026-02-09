import { Injectable } from '@angular/core';
import type { Repository } from '../../../electron/types/models';
import type { IpcResult } from '../../../electron/types/ipc-result';

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  getRepositories(): Promise<IpcResult<Repository[]>> {
    return window.electronAPI.getRepositories();
  }

  addRepository(remoteUrl: string): Promise<IpcResult<Repository>> {
    return window.electronAPI.addRepository(remoteUrl);
  }

  removeRepository(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.removeRepository(id);
  }

  getRemoteBranches(repositoryId: string): Promise<IpcResult<string[]>> {
    return window.electronAPI.getRemoteBranches(repositoryId);
  }

  fetchRepository(repositoryId: string): Promise<IpcResult<null>> {
    return window.electronAPI.fetchRepository(repositoryId);
  }
}
