import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSquadPaths } from './squad-paths.js';

import { SquadStore } from './squad-store.js';
import type { ReposConfig, WorkspacesConfig } from '../types/models.js';

let tmpDir: string;
let store: SquadStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-test-'));
  store = new SquadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// --- SquadStore 初期化テスト ---

describe('SquadStore - initialize', () => {
  it('initialize() でディレクトリ構造が作成される', async () => {
    await store.initialize();
    const paths = createSquadPaths(tmpDir);

    const configStat = await fs.stat(paths.configDir);
    const reposStat = await fs.stat(paths.reposDir);
    const workspacesStat = await fs.stat(paths.workspacesDir);

    expect(configStat.isDirectory()).toBe(true);
    expect(reposStat.isDirectory()).toBe(true);
    expect(workspacesStat.isDirectory()).toBe(true);
  });

  it('initialize() で repos.json と workspaces.json が空の初期状態で作成される', async () => {
    await store.initialize();
    const paths = createSquadPaths(tmpDir);

    const reposData = JSON.parse(await fs.readFile(paths.reposConfig, 'utf-8')) as ReposConfig;
    const workspacesData = JSON.parse(
      await fs.readFile(paths.workspacesConfig, 'utf-8'),
    ) as WorkspacesConfig;

    expect(reposData).toEqual({ version: 1, repositories: [] });
    expect(workspacesData).toEqual({ version: 1, workspaces: [] });
  });

  it('initialize() を複数回呼び出しても既存データが上書きされない（冪等性）', async () => {
    await store.initialize();
    await store.addRepository({ name: 'test', remoteUrl: 'https://example.com/test.git' });

    await store.initialize();

    const repos = await store.getRepositories();
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('test');
  });

  it('既に設定ファイルが存在する場合、内容が保持される', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.mkdir(paths.configDir, { recursive: true });

    const existingData: ReposConfig = {
      version: 1,
      repositories: [
        {
          id: 'existing-id',
          name: 'existing',
          remoteUrl: 'https://example.com/existing.git',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    await fs.writeFile(paths.reposConfig, JSON.stringify(existingData, null, 2));

    await store.initialize();

    const repos = await store.getRepositories();
    expect(repos).toHaveLength(1);
    expect(repos[0].id).toBe('existing-id');
  });
});

// --- リポジトリ CRUD テスト ---

describe('SquadStore - Repository CRUD', () => {
  beforeEach(async () => {
    await store.initialize();
  });

  it('addRepository() でリポジトリが追加され、id と registeredAt が自動付与される', async () => {
    const repo = await store.addRepository({
      name: 'backend',
      remoteUrl: 'https://github.com/org/backend.git',
    });

    expect(repo.id).toBeDefined();
    expect(repo.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(repo.registeredAt).toBeDefined();
    expect(new Date(repo.registeredAt).toISOString()).toBe(repo.registeredAt);
    expect(repo.name).toBe('backend');
    expect(repo.remoteUrl).toBe('https://github.com/org/backend.git');
  });

  it('addRepository() の結果が repos.json に永続化される', async () => {
    const repo = await store.addRepository({
      name: 'backend',
      remoteUrl: 'https://github.com/org/backend.git',
    });

    // 新しい SquadStore インスタンスで読み込み直す
    const store2 = new SquadStore(tmpDir);
    const repos = await store2.getRepositories();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual(repo);
  });

  it('getRepositories() で全リポジトリが取得できる', async () => {
    await store.addRepository({ name: 'backend', remoteUrl: 'https://example.com/backend.git' });
    await store.addRepository({ name: 'frontend', remoteUrl: 'https://example.com/frontend.git' });

    const repos = await store.getRepositories();
    expect(repos).toHaveLength(2);
    expect(repos.map((r) => r.name)).toEqual(['backend', 'frontend']);
  });

  it('getRepository(id) で特定のリポジトリが取得できる', async () => {
    const repo = await store.addRepository({
      name: 'backend',
      remoteUrl: 'https://example.com/backend.git',
    });

    const found = await store.getRepository(repo.id);
    expect(found).toEqual(repo);
  });

  it('getRepository() に存在しないIDを渡すと undefined が返る', async () => {
    const found = await store.getRepository('non-existent-id');
    expect(found).toBeUndefined();
  });

  it('removeRepository(id) でリポジトリが削除され、repos.json から消える', async () => {
    const repo = await store.addRepository({
      name: 'backend',
      remoteUrl: 'https://example.com/backend.git',
    });

    await store.removeRepository(repo.id);

    const repos = await store.getRepositories();
    expect(repos).toHaveLength(0);

    // 永続化の確認
    const store2 = new SquadStore(tmpDir);
    const repos2 = await store2.getRepositories();
    expect(repos2).toHaveLength(0);
  });

  it('removeRepository() に存在しないIDを渡してもエラーにならない', async () => {
    await expect(store.removeRepository('non-existent-id')).resolves.toBeUndefined();
  });
});

// --- Workspace CRUD テスト ---

describe('SquadStore - Workspace CRUD', () => {
  beforeEach(async () => {
    await store.initialize();
  });

  it('addWorkspace() でWorkspaceが追加され、id, createdAt, updatedAt が自動付与される', async () => {
    const ws = await store.addWorkspace({
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'feature/payment' }],
    });

    expect(ws.id).toBeDefined();
    expect(ws.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ws.createdAt).toBeDefined();
    expect(ws.updatedAt).toBeDefined();
    expect(ws.name).toBe('feature-payment');
    expect(ws.entries).toEqual([{ repositoryId: 'repo-1', branch: 'feature/payment' }]);
  });

  it('addWorkspace() で createdAt と updatedAt が同じ値になる', async () => {
    const ws = await store.addWorkspace({
      name: 'feature-payment',
      entries: [],
    });

    expect(ws.createdAt).toBe(ws.updatedAt);
  });

  it('addWorkspace() の結果が workspaces.json に永続化される', async () => {
    const ws = await store.addWorkspace({
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'main' }],
    });

    const store2 = new SquadStore(tmpDir);
    const workspaces = await store2.getWorkspaces();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toEqual(ws);
  });

  it('getWorkspaces() で全Workspaceが取得できる', async () => {
    await store.addWorkspace({ name: 'ws-1', entries: [] });
    await store.addWorkspace({ name: 'ws-2', entries: [] });

    const workspaces = await store.getWorkspaces();
    expect(workspaces).toHaveLength(2);
    expect(workspaces.map((w) => w.name)).toEqual(['ws-1', 'ws-2']);
  });

  it('getWorkspace(id) で特定のWorkspaceが取得できる', async () => {
    const ws = await store.addWorkspace({ name: 'ws-1', entries: [] });

    const found = await store.getWorkspace(ws.id);
    expect(found).toEqual(ws);
  });

  it('getWorkspace() に存在しないIDを渡すと undefined が返る', async () => {
    const found = await store.getWorkspace('non-existent-id');
    expect(found).toBeUndefined();
  });

  it('updateWorkspace() で entries が更新され、updatedAt が更新される', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const ws = await store.addWorkspace({
      name: 'ws-1',
      entries: [{ repositoryId: 'repo-1', branch: 'main' }],
    });

    vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));

    const updated = await store.updateWorkspace(ws.id, {
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'develop' },
      ],
    });

    expect(updated).toBeDefined();
    expect(updated?.entries).toEqual([
      { repositoryId: 'repo-1', branch: 'main' },
      { repositoryId: 'repo-2', branch: 'develop' },
    ]);
    expect(updated?.updatedAt).toBe('2026-01-01T00:01:00.000Z');
    expect(updated?.updatedAt).not.toBe(ws.updatedAt);

    vi.useRealTimers();
  });

  it('updateWorkspace() で createdAt は変更されない', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const ws = await store.addWorkspace({ name: 'ws-1', entries: [] });

    vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));

    const updated = await store.updateWorkspace(ws.id, {
      entries: [{ repositoryId: 'repo-1', branch: 'main' }],
    });

    expect(updated?.createdAt).toBe('2026-01-01T00:00:00.000Z');

    vi.useRealTimers();
  });

  it('updateWorkspace() の結果が workspaces.json に永続化される', async () => {
    const ws = await store.addWorkspace({
      name: 'ws-1',
      entries: [{ repositoryId: 'repo-1', branch: 'main' }],
    });

    const updated = await store.updateWorkspace(ws.id, {
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'develop' },
      ],
    });

    const store2 = new SquadStore(tmpDir);
    const workspaces = await store2.getWorkspaces();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toEqual(updated);
  });

  it('updateWorkspace() に存在しないIDを渡すと undefined が返る', async () => {
    const result = await store.updateWorkspace('non-existent-id', { entries: [] });
    expect(result).toBeUndefined();
  });

  it('removeWorkspace(id) でWorkspaceが削除され、workspaces.json から消える', async () => {
    const ws = await store.addWorkspace({ name: 'ws-1', entries: [] });

    await store.removeWorkspace(ws.id);

    const workspaces = await store.getWorkspaces();
    expect(workspaces).toHaveLength(0);

    // 永続化の確認
    const store2 = new SquadStore(tmpDir);
    const workspaces2 = await store2.getWorkspaces();
    expect(workspaces2).toHaveLength(0);
  });

  it('removeWorkspace() に存在しないIDを渡してもエラーにならない', async () => {
    await expect(store.removeWorkspace('non-existent-id')).resolves.toBeUndefined();
  });
});

// --- データ復元テスト (AC10) ---

describe('SquadStore - データ復元', () => {
  it('repos.json に事前データがある状態で initialize() → getRepositories() でデータが復元される', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.mkdir(paths.configDir, { recursive: true });

    const existingData: ReposConfig = {
      version: 1,
      repositories: [
        {
          id: 'pre-existing-id',
          name: 'pre-existing',
          remoteUrl: 'https://example.com/pre-existing.git',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    await fs.writeFile(paths.reposConfig, JSON.stringify(existingData, null, 2));

    await store.initialize();
    const repos = await store.getRepositories();

    expect(repos).toHaveLength(1);
    expect(repos[0].id).toBe('pre-existing-id');
    expect(repos[0].name).toBe('pre-existing');
  });

  it('workspaces.json に事前データがある状態で initialize() → getWorkspaces() でデータが復元される', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.mkdir(paths.configDir, { recursive: true });

    const existingData: WorkspacesConfig = {
      version: 1,
      workspaces: [
        {
          id: 'pre-existing-ws',
          name: 'old-workspace',
          entries: [{ repositoryId: 'repo-1', branch: 'main' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    await fs.writeFile(paths.workspacesConfig, JSON.stringify(existingData, null, 2));

    await store.initialize();
    const workspaces = await store.getWorkspaces();

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].id).toBe('pre-existing-ws');
    expect(workspaces[0].name).toBe('old-workspace');
  });
});

// --- エッジケース ---

describe('SquadStore - エッジケース', () => {
  beforeEach(async () => {
    await store.initialize();
  });

  it('空のリポジトリ一覧に対する操作が正常に動作する', async () => {
    const repos = await store.getRepositories();
    expect(repos).toEqual([]);
  });

  it('空のWorkspace一覧に対する操作が正常に動作する', async () => {
    const workspaces = await store.getWorkspaces();
    expect(workspaces).toEqual([]);
  });

  it('JSON ファイルが不正（パースエラー）の場合、適切なエラーがスローされる', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.writeFile(paths.reposConfig, 'invalid json content');

    await expect(store.getRepositories()).rejects.toThrow();
  });

  it('version が未知の値の場合、適切なエラーがスローされる', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.writeFile(paths.reposConfig, JSON.stringify({ version: 999, repositories: [] }));

    await expect(store.getRepositories()).rejects.toThrow(/version/i);
  });

  it('version が未知の値の場合 (workspaces)、適切なエラーがスローされる', async () => {
    const paths = createSquadPaths(tmpDir);
    await fs.writeFile(paths.workspacesConfig, JSON.stringify({ version: 999, workspaces: [] }));

    await expect(store.getWorkspaces()).rejects.toThrow(/version/i);
  });
});
