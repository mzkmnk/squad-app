import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundFetchService } from './background-fetch-service.js';
import type { GitService } from './git-service.js';
import type { SquadStore } from '../store/squad-store.js';
import type { Repository } from '../types/models.js';

function makeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 'repo-1',
    name: 'backend',
    displayName: 'backend',
    remoteUrl: 'https://github.com/org/backend.git',
    registeredAt: '2026-02-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('BackgroundFetchService', () => {
  let gitService: { fetch: ReturnType<typeof vi.fn> };
  let store: { getRepositories: ReturnType<typeof vi.fn> };
  let service: BackgroundFetchService;

  beforeEach(() => {
    vi.useFakeTimers();
    gitService = { fetch: vi.fn().mockResolvedValue(undefined) };
    store = { getRepositories: vi.fn().mockResolvedValue([]) };
    service = new BackgroundFetchService(
      gitService as unknown as GitService,
      store as unknown as SquadStore,
      1000,
    );
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('start() で即時 fetchAll が実行される', async () => {
    const repos = [makeRepo(), makeRepo({ id: 'repo-2', name: 'frontend' })];
    store.getRepositories.mockResolvedValue(repos);

    service.start();
    // 即時実行の microtask を flush
    await vi.advanceTimersByTimeAsync(0);

    expect(gitService.fetch).toHaveBeenCalledWith('backend');
    expect(gitService.fetch).toHaveBeenCalledWith('frontend');
  });

  it('インターバル経過後に再度 fetchAll が実行される', async () => {
    const repos = [makeRepo()];
    store.getRepositories.mockResolvedValue(repos);

    service.start();
    await vi.advanceTimersByTimeAsync(0);
    gitService.fetch.mockClear();

    // インターバル経過
    await vi.advanceTimersByTimeAsync(1000);

    expect(gitService.fetch).toHaveBeenCalledWith('backend');
  });

  it('stop() で定期実行が停止する', async () => {
    const repos = [makeRepo()];
    store.getRepositories.mockResolvedValue(repos);

    service.start();
    await vi.advanceTimersByTimeAsync(0);
    gitService.fetch.mockClear();

    service.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(gitService.fetch).not.toHaveBeenCalled();
  });

  it('個別リポジトリの fetch 失敗は他に影響しない', async () => {
    const repos = [
      makeRepo({ id: 'repo-1', name: 'backend' }),
      makeRepo({ id: 'repo-2', name: 'frontend' }),
    ];
    store.getRepositories.mockResolvedValue(repos);
    gitService.fetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.fetchAll();

    expect(gitService.fetch).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith('Background fetch failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('リポジトリが0件の場合は fetch が呼ばれない', async () => {
    store.getRepositories.mockResolvedValue([]);

    await service.fetchAll();

    expect(gitService.fetch).not.toHaveBeenCalled();
  });

  it('start() を複数回呼んでもタイマーは1つだけ', async () => {
    const repos = [makeRepo()];
    store.getRepositories.mockResolvedValue(repos);

    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(0);

    // 即時実行は1回のみ（2回目の start は無視される）
    expect(store.getRepositories).toHaveBeenCalledTimes(1);
  });

  it('getRepositories 失敗時はエラーログを出力し fetch をスキップする', async () => {
    store.getRepositories.mockRejectedValue(new Error('store read failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.fetchAll();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Background fetch: failed to get repositories:',
      expect.any(Error),
    );
    expect(gitService.fetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
