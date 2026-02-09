import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WorkspaceService } from './workspace.service';
import type { IpcResult } from '../../../electron/types/ipc-result';
import type { Workspace } from '../../../electron/types/models';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let mockElectronAPI: {
    getWorkspaces: ReturnType<typeof vi.fn>;
    createWorkspace: ReturnType<typeof vi.fn>;
    deleteWorkspace: ReturnType<typeof vi.fn>;
    openWorkspace: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockElectronAPI = {
      getWorkspaces: vi.fn(),
      createWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
    };

    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkspaceService);
  });

  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: 'feature-payment-a3f2b1c9',
    entries: [
      { repositoryId: 'repo-1', branch: 'feature/payment' },
      { repositoryId: 'repo-2', branch: 'main' },
    ],
    createdAt: '2026-02-09T12:00:00.000Z',
    updatedAt: '2026-02-09T12:00:00.000Z',
  };

  it('getWorkspaces() が window.electronAPI.getWorkspaces() を呼び出す', async () => {
    const expected: IpcResult<Workspace[]> = { success: true, data: [mockWorkspace] };
    mockElectronAPI.getWorkspaces.mockResolvedValue(expected);

    const result = await service.getWorkspaces();

    expect(mockElectronAPI.getWorkspaces).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });

  it('createWorkspace(name, entries) が window.electronAPI.createWorkspace(name, entries) を呼び出す', async () => {
    const name = 'feature-payment';
    const entries = [
      { repositoryId: 'repo-1', branch: 'feature/payment' },
      { repositoryId: 'repo-2', branch: 'main' },
    ];
    const expected: IpcResult<Workspace> = { success: true, data: mockWorkspace };
    mockElectronAPI.createWorkspace.mockResolvedValue(expected);

    const result = await service.createWorkspace(name, entries);

    expect(mockElectronAPI.createWorkspace).toHaveBeenCalledWith(name, entries);
    expect(result).toEqual(expected);
  });

  it('deleteWorkspace(id) が window.electronAPI.deleteWorkspace(id) を呼び出す', async () => {
    const expected: IpcResult<null> = { success: true, data: null };
    mockElectronAPI.deleteWorkspace.mockResolvedValue(expected);

    const result = await service.deleteWorkspace('ws-1');

    expect(mockElectronAPI.deleteWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });

  it('openWorkspace(id) が window.electronAPI.openWorkspace(id) を呼び出す', async () => {
    const expected: IpcResult<null> = { success: true, data: null };
    mockElectronAPI.openWorkspace.mockResolvedValue(expected);

    const result = await service.openWorkspace('ws-1');

    expect(mockElectronAPI.openWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });
});
