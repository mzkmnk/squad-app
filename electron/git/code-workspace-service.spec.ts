import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSquadPaths, type SquadPaths } from '../store/squad-paths.js';
import { CodeWorkspaceService, type CodeWorkspaceFile } from './code-workspace-service.js';

let tmpDir: string;
let paths: SquadPaths;
let service: CodeWorkspaceService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-cws-test-'));
  const squadRoot = path.join(tmpDir, 'squad');
  await fs.mkdir(path.join(squadRoot, 'workspaces'), { recursive: true });
  paths = createSquadPaths(squadRoot);
  service = new CodeWorkspaceService(paths);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// --- generate ---

describe('CodeWorkspaceService - generate', () => {
  it('.code-workspace ファイルが正しいパスに生成される', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }]);
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('folders に各リポジトリの相対パス（"./<repoName>"）が含まれる', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }]);
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8')) as CodeWorkspaceFile;
    expect(content.folders).toEqual([{ path: './backend' }]);
  });

  it('settings が空オブジェクトである', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }]);
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8')) as CodeWorkspaceFile;
    expect(content.settings).toEqual({});
  });

  it('JSON が整形（2スペースインデント）されている', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }]);
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const raw = await fs.readFile(filePath, 'utf-8');
    const expected = JSON.stringify(
      {
        folders: [{ path: './backend' }],
        settings: {},
      },
      null,
      2,
    );
    expect(raw).toBe(expected + '\n');
  });

  it('複数エントリの場合に全リポジトリが含まれる', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }, { repoName: 'frontend' }]);
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8')) as CodeWorkspaceFile;
    expect(content.folders).toEqual([{ path: './backend' }, { path: './frontend' }]);
  });

  it('Workspace ディレクトリが存在しない場合に自動作成される', async () => {
    // workspaces ディレクトリ配下のサブディレクトリを事前に削除
    const wsDir = paths.workspaceDir('new-workspace');
    await service.generate('new-workspace', [{ repoName: 'backend' }]);
    const stat = await fs.stat(wsDir);
    expect(stat.isDirectory()).toBe(true);
  });
});

// --- remove ---

describe('CodeWorkspaceService - remove', () => {
  it('.code-workspace ファイルが削除される', async () => {
    await service.generate('my-workspace', [{ repoName: 'backend' }]);
    await service.remove('my-workspace');
    const filePath = paths.codeWorkspaceFile('my-workspace');
    const exists = await fs
      .stat(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('ファイルが存在しない場合でもエラーにならない（冪等）', async () => {
    await expect(service.remove('nonexistent')).resolves.toBeUndefined();
  });
});
