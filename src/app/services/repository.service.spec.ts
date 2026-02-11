import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RepositoryService } from './repository.service';
import type { IpcResult } from '../../../electron/types/ipc-result';
import type { Repository } from '../../../electron/types/models';

describe('RepositoryService', () => {
  let service: RepositoryService;
  let mockElectronAPI: {
    getRepositories: ReturnType<typeof vi.fn>;
    addRepository: ReturnType<typeof vi.fn>;
    removeRepository: ReturnType<typeof vi.fn>;
    getRemoteBranches: ReturnType<typeof vi.fn>;
    fetchRepository: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockElectronAPI = {
      getRepositories: vi.fn(),
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      getRemoteBranches: vi.fn(),
      fetchRepository: vi.fn(),
    };

    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(RepositoryService);
  });

  const mockRepo: Repository = {
    id: 'repo-1',
    name: 'backend',
    displayName: 'backend',
    remoteUrl: 'https://github.com/org/backend.git',
    registeredAt: '2026-02-08T12:00:00.000Z',
  };

  it('getRepositories() が window.electronAPI.getRepositories() を呼び出す', async () => {
    const expected: IpcResult<Repository[]> = { success: true, data: [mockRepo] };
    mockElectronAPI.getRepositories.mockResolvedValue(expected);

    const result = await service.getRepositories();

    expect(mockElectronAPI.getRepositories).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });

  it('addRepository(url) が window.electronAPI.addRepository(url) を呼び出す', async () => {
    const url = 'https://github.com/org/backend.git';
    const expected: IpcResult<Repository> = { success: true, data: mockRepo };
    mockElectronAPI.addRepository.mockResolvedValue(expected);

    const result = await service.addRepository(url);

    expect(mockElectronAPI.addRepository).toHaveBeenCalledWith(url);
    expect(result).toEqual(expected);
  });

  it('removeRepository(id) が window.electronAPI.removeRepository(id) を呼び出す', async () => {
    const expected: IpcResult<null> = { success: true, data: null };
    mockElectronAPI.removeRepository.mockResolvedValue(expected);

    const result = await service.removeRepository('repo-1');

    expect(mockElectronAPI.removeRepository).toHaveBeenCalledWith('repo-1');
    expect(result).toEqual(expected);
  });

  it('getRemoteBranches(id) が window.electronAPI.getRemoteBranches(id) を呼び出す', async () => {
    const expected: IpcResult<string[]> = { success: true, data: ['main', 'develop'] };
    mockElectronAPI.getRemoteBranches.mockResolvedValue(expected);

    const result = await service.getRemoteBranches('repo-1');

    expect(mockElectronAPI.getRemoteBranches).toHaveBeenCalledWith('repo-1');
    expect(result).toEqual(expected);
  });

  it('fetchRepository(id) が window.electronAPI.fetchRepository(id) を呼び出す', async () => {
    const expected: IpcResult<null> = { success: true, data: null };
    mockElectronAPI.fetchRepository.mockResolvedValue(expected);

    const result = await service.fetchRepository('repo-1');

    expect(mockElectronAPI.fetchRepository).toHaveBeenCalledWith('repo-1');
    expect(result).toEqual(expected);
  });
});
