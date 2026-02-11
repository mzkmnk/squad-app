import { describe, it, expect } from 'vitest';
import {
  runMigrations,
  reposMigrations,
  workspacesMigrations,
  REPOS_CURRENT_VERSION,
  WORKSPACES_CURRENT_VERSION,
  type MigrationMap,
} from './migrations.js';

// ============================================================
// runMigrations ランナーテスト
// ============================================================

describe('runMigrations', () => {
  const testMigrations: MigrationMap = {
    1: (data) => ({ ...data, version: 2, added_v2: true }),
    2: (data) => ({ ...data, version: 3, added_v3: true }),
  };

  it('同じバージョンならマイグレーションを実行しない', () => {
    const data = { version: 3, items: [] };
    const { result, migrated } = runMigrations(data, testMigrations, 3);

    expect(migrated).toBe(false);
    expect(result).toEqual(data);
  });

  it('1段階のマイグレーションが正しく実行される', () => {
    const data = { version: 1, items: ['a'] };
    const { result, migrated } = runMigrations(data, testMigrations, 2);

    expect(migrated).toBe(true);
    expect(result.version).toBe(2);
    expect(result.added_v2).toBe(true);
  });

  it('複数段階のマイグレーションが順次実行される', () => {
    const data = { version: 1, items: ['a'] };
    const { result, migrated } = runMigrations(data, testMigrations, 3);

    expect(migrated).toBe(true);
    expect(result.version).toBe(3);
    expect(result.added_v2).toBe(true);
    expect(result.added_v3).toBe(true);
  });

  it('バージョンが targetVersion より大きい場合エラーがスローされる', () => {
    const data = { version: 5, items: [] };

    expect(() => runMigrations(data, testMigrations, 3)).toThrow(/newer than supported/);
  });

  it('マイグレーション関数が見つからない場合エラーがスローされる', () => {
    const incompleteMigrations: MigrationMap = {
      1: (data) => ({ ...data, version: 2 }),
      // v2 → v3 が欠落
    };
    const data = { version: 1, items: [] };

    expect(() => runMigrations(data, incompleteMigrations, 3)).toThrow(/No migration found/);
  });

  it('バージョンが不正な値の場合エラーがスローされる', () => {
    expect(() => runMigrations({ version: 0 }, testMigrations, 3)).toThrow(/Invalid/);
    expect(() => runMigrations({ version: -1 }, testMigrations, 3)).toThrow(/Invalid/);
    expect(() => runMigrations({} as Record<string, unknown>, testMigrations, 3)).toThrow(
      /Invalid/,
    );
  });
});

// ============================================================
// repos.json マイグレーション (v1 → v2)
// ============================================================

describe('reposMigrations - v1 → v2', () => {
  it('displayName が name から suffix を除去して追加される', () => {
    const v1Data = {
      version: 1,
      repositories: [
        {
          id: 'repo-1',
          name: 'backend-a1b2c3d4',
          remoteUrl: 'https://example.com/backend.git',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { result } = runMigrations(v1Data, reposMigrations, REPOS_CURRENT_VERSION);

    expect(result.version).toBe(2);
    const repos = result.repositories as Record<string, unknown>[];
    expect(repos[0].displayName).toBe('backend');
    expect(repos[0].name).toBe('backend-a1b2c3d4');
  });

  it('suffix がない name はそのまま displayName になる', () => {
    const v1Data = {
      version: 1,
      repositories: [
        {
          id: 'repo-1',
          name: 'simple-repo',
          remoteUrl: 'https://example.com/simple-repo.git',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { result } = runMigrations(v1Data, reposMigrations, REPOS_CURRENT_VERSION);

    const repos = result.repositories as Record<string, unknown>[];
    expect(repos[0].displayName).toBe('simple-repo');
  });

  it('空のリポジトリ配列でもマイグレーションが成功する', () => {
    const v1Data = { version: 1, repositories: [] };

    const { result } = runMigrations(v1Data, reposMigrations, REPOS_CURRENT_VERSION);

    expect(result.version).toBe(2);
    expect(result.repositories).toEqual([]);
  });
});

// ============================================================
// workspaces.json マイグレーション (v1 → v2)
// ============================================================

describe('workspacesMigrations - v1 → v2', () => {
  it('displayName が name から suffix を除去して追加される', () => {
    const v1Data = {
      version: 1,
      workspaces: [
        {
          id: 'ws-1',
          name: 'feature-payment-a1b2c3d4',
          entries: [{ repositoryId: 'repo-1', branch: 'main' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { result } = runMigrations(v1Data, workspacesMigrations, WORKSPACES_CURRENT_VERSION);

    expect(result.version).toBe(2);
    const workspaces = result.workspaces as Record<string, unknown>[];
    expect(workspaces[0].displayName).toBe('feature-payment');
    expect(workspaces[0].name).toBe('feature-payment-a1b2c3d4');
  });

  it('空の Workspace 配列でもマイグレーションが成功する', () => {
    const v1Data = { version: 1, workspaces: [] };

    const { result } = runMigrations(v1Data, workspacesMigrations, WORKSPACES_CURRENT_VERSION);

    expect(result.version).toBe(2);
    expect(result.workspaces).toEqual([]);
  });
});
