import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { extractRepoName, registerIpcHandlers } from './ipc-handlers.js';
import { IpcErrorCode } from './ipc-channels.js';
import {
  GitValidationError,
  GitOperationError,
  GitRepositoryExistsError,
} from '../git/git-errors.js';
import type { Repository, Workspace } from '../types/models.js';
import type { IpcHandlerDeps } from './ipc-handlers.js';

// --- vi.hoisted でモック変数を宣言（ホイスト対応） ---

const { execFileMock, fsMock, handlers } = vi.hoisted(() => {
  type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
  return {
    execFileMock: vi.fn(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(null, { stdout: '', stderr: '' });
      },
    ),
    fsMock: {
      rm: vi.fn().mockResolvedValue(undefined),
    },
    handlers: new Map<string, Handler>(),
  };
});

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

// --- モジュールモック ---

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  },
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:fs/promises', () => fsMock);

// --- テスト用ヘルパー ---

const dummyEvent = {} as IpcMainInvokeEvent;

function makeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 'repo-1',
    name: 'backend',
    remoteUrl: 'https://github.com/org/backend.git',
    registeredAt: '2026-02-08T12:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'feature-payment-abcd1234',
    entries: [{ repositoryId: 'repo-1', branch: 'feature/payment' }],
    createdAt: '2026-02-08T12:30:00.000Z',
    updatedAt: '2026-02-08T12:30:00.000Z',
    ...overrides,
  };
}

function createMockDeps(): IpcHandlerDeps {
  return {
    store: {
      getRepositories: vi.fn(),
      getRepository: vi.fn(),
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      getWorkspaces: vi.fn(),
      getWorkspace: vi.fn(),
      addWorkspace: vi.fn(),
      removeWorkspace: vi.fn(),
    } as unknown as IpcHandlerDeps['store'],
    gitService: {
      cloneBare: vi.fn(),
      removeBareRepository: vi.fn(),
      addWorktree: vi.fn(),
      removeWorktree: vi.fn(),
      fetch: vi.fn(),
      getRemoteBranches: vi.fn(),
      createBranch: vi.fn(),
    } as unknown as IpcHandlerDeps['gitService'],
    codeWorkspaceService: {
      generate: vi.fn(),
      remove: vi.fn(),
    } as unknown as IpcHandlerDeps['codeWorkspaceService'],
    paths: {
      codeWorkspaceFile: vi.fn().mockReturnValue('/home/.squad/workspaces/ws/ws.code-workspace'),
      workspaceDir: vi.fn().mockReturnValue('/home/.squad/workspaces/ws'),
    } as unknown as IpcHandlerDeps['paths'],
  };
}

// --- ハンドラー呼び出しヘルパー ---

async function invoke(channel: string, arg?: unknown): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return arg !== undefined ? handler(dummyEvent, arg) : handler(dummyEvent);
}

// ============================================================
// extractRepoName テスト
// ============================================================

describe('extractRepoName', () => {
  it('HTTPS URL（.git 付き）からリポジトリ名を抽出する', () => {
    expect(extractRepoName('https://github.com/org/backend.git')).toBe('backend');
  });

  it('HTTPS URL（.git なし）からリポジトリ名を抽出する', () => {
    expect(extractRepoName('https://github.com/org/backend')).toBe('backend');
  });

  it('SSH URL からリポジトリ名を抽出する', () => {
    expect(extractRepoName('git@github.com:org/frontend.git')).toBe('frontend');
  });

  it('深いパスの URL から末尾のリポジトリ名を抽出する', () => {
    expect(extractRepoName('https://github.com/org/sub/repo.git')).toBe('repo');
  });
});

// ============================================================
// ハンドラーテスト共通セットアップ
// ============================================================

let deps: IpcHandlerDeps;

beforeEach(() => {
  handlers.clear();
  execFileMock.mockReset();
  execFileMock.mockImplementation(
    (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
      cb(null, { stdout: '', stderr: '' });
    },
  );
  fsMock.rm.mockReset().mockResolvedValue(undefined);

  deps = createMockDeps();
  registerIpcHandlers(deps);
});

// ============================================================
// repo:list
// ============================================================

describe('repo:list', () => {
  it('ストアの結果が IpcResult でラップされて返る', async () => {
    const repos = [makeRepo()];
    vi.mocked(deps.store.getRepositories).mockResolvedValue(repos);

    const result = await invoke('repo:list');

    expect(result).toEqual({ success: true, data: repos });
  });

  it('ストアがエラーをスローした場合に INTERNAL_ERROR が返る', async () => {
    vi.mocked(deps.store.getRepositories).mockRejectedValue(new Error('DB error'));

    const result = await invoke('repo:list');

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.INTERNAL_ERROR, message: 'DB error' },
    });
  });
});

// ============================================================
// repo:get
// ============================================================

describe('repo:get', () => {
  it('存在する ID で Repository が返る', async () => {
    const repo = makeRepo();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);

    const result = await invoke('repo:get', { id: 'repo-1' });

    expect(result).toEqual({ success: true, data: repo });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getRepository).mockResolvedValue(undefined);

    const result = await invoke('repo:get', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Repository not found: missing' },
    });
  });
});

// ============================================================
// repo:add
// ============================================================

describe('repo:add', () => {
  it('正常系: cloneBare → addRepository の順で呼ばれ、登録結果が返る', async () => {
    const repo = makeRepo();
    vi.mocked(deps.gitService.cloneBare).mockResolvedValue('backend-abcd1234');
    vi.mocked(deps.store.addRepository).mockResolvedValue(repo);

    const result = await invoke('repo:add', { remoteUrl: 'https://github.com/org/backend.git' });

    expect(deps.gitService.cloneBare).toHaveBeenCalledWith(
      'https://github.com/org/backend.git',
      'backend',
    );
    expect(deps.store.addRepository).toHaveBeenCalledWith({
      name: 'backend-abcd1234',
      remoteUrl: 'https://github.com/org/backend.git',
    });
    expect(result).toEqual({ success: true, data: repo });
  });

  it('cloneBare が GitValidationError をスローした場合に VALIDATION_ERROR が返る', async () => {
    vi.mocked(deps.gitService.cloneBare).mockRejectedValue(
      new GitValidationError('Invalid remote URL'),
    );

    const result = await invoke('repo:add', {
      remoteUrl: 'https://github.com/org/bad-repo.git',
    });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.VALIDATION_ERROR, message: 'Invalid remote URL' },
    });
  });

  it('cloneBare が GitRepositoryExistsError をスローした場合に REPOSITORY_EXISTS が返る', async () => {
    vi.mocked(deps.gitService.cloneBare).mockRejectedValue(new GitRepositoryExistsError('backend'));

    const result = await invoke('repo:add', {
      remoteUrl: 'https://github.com/org/backend.git',
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.REPOSITORY_EXISTS,
        message: "Repository 'backend' already exists",
      },
    });
  });

  it('cloneBare が GitOperationError をスローした場合に GIT_OPERATION_FAILED が返る', async () => {
    vi.mocked(deps.gitService.cloneBare).mockRejectedValue(
      new GitOperationError('clone failed', 128, 'fatal: repo not found'),
    );

    const result = await invoke('repo:add', {
      remoteUrl: 'https://github.com/org/backend.git',
    });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.GIT_OPERATION_FAILED, message: 'fatal: repo not found' },
    });
  });

  it('cloneBare 成功後に addRepository が失敗した場合、Bare Repository がクリーンアップされる', async () => {
    vi.mocked(deps.gitService.cloneBare).mockResolvedValue('backend-abcd1234');
    vi.mocked(deps.store.addRepository).mockRejectedValue(new Error('Store write failed'));

    const result = await invoke('repo:add', {
      remoteUrl: 'https://github.com/org/backend.git',
    });

    expect(deps.gitService.removeBareRepository).toHaveBeenCalledWith('backend-abcd1234');
    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.INTERNAL_ERROR, message: 'Store write failed' },
    });
  });
});

// ============================================================
// repo:remove
// ============================================================

describe('repo:remove', () => {
  it('存在するリポジトリが正常に削除される', async () => {
    const repo = makeRepo();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.removeBareRepository).mockResolvedValue(undefined);
    vi.mocked(deps.store.removeRepository).mockResolvedValue(undefined);

    const result = await invoke('repo:remove', { id: 'repo-1' });

    expect(deps.gitService.removeBareRepository).toHaveBeenCalledWith('backend');
    expect(deps.store.removeRepository).toHaveBeenCalledWith('repo-1');
    expect(result).toEqual({ success: true, data: null });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getRepository).mockResolvedValue(undefined);

    const result = await invoke('repo:remove', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Repository not found: missing' },
    });
  });
});

// ============================================================
// repo:branches
// ============================================================

describe('repo:branches', () => {
  it('存在するリポジトリのブランチ一覧が返る', async () => {
    const repo = makeRepo();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.getRemoteBranches).mockResolvedValue(['main', 'develop']);

    const result = await invoke('repo:branches', { id: 'repo-1' });

    expect(deps.gitService.getRemoteBranches).toHaveBeenCalledWith('backend');
    expect(result).toEqual({ success: true, data: ['main', 'develop'] });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getRepository).mockResolvedValue(undefined);

    const result = await invoke('repo:branches', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Repository not found: missing' },
    });
  });

  it('getRemoteBranches がエラーをスローした場合に GIT_OPERATION_FAILED が返る', async () => {
    const repo = makeRepo();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.getRemoteBranches).mockRejectedValue(
      new GitOperationError('branch list failed', 1, 'fatal: not a git repo'),
    );

    const result = await invoke('repo:branches', { id: 'repo-1' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.GIT_OPERATION_FAILED, message: 'fatal: not a git repo' },
    });
  });
});

// ============================================================
// repo:fetch
// ============================================================

describe('repo:fetch', () => {
  it('存在するリポジトリの fetch が成功する', async () => {
    const repo = makeRepo();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.fetch).mockResolvedValue(undefined);

    const result = await invoke('repo:fetch', { id: 'repo-1' });

    expect(deps.gitService.fetch).toHaveBeenCalledWith('backend');
    expect(result).toEqual({ success: true, data: null });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getRepository).mockResolvedValue(undefined);

    const result = await invoke('repo:fetch', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Repository not found: missing' },
    });
  });
});

// ============================================================
// workspace:list
// ============================================================

describe('workspace:list', () => {
  it('ストアの結果が IpcResult でラップされて返る', async () => {
    const workspaces = [makeWorkspace()];
    vi.mocked(deps.store.getWorkspaces).mockResolvedValue(workspaces);

    const result = await invoke('workspace:list');

    expect(result).toEqual({ success: true, data: workspaces });
  });
});

// ============================================================
// workspace:get
// ============================================================

describe('workspace:get', () => {
  it('存在する ID で Workspace が返る', async () => {
    const ws = makeWorkspace();
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(ws);

    const result = await invoke('workspace:get', { id: 'ws-1' });

    expect(result).toEqual({ success: true, data: ws });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:get', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Workspace not found: missing' },
    });
  });
});

// ============================================================
// workspace:create
// ============================================================

describe('workspace:create', () => {
  const createRequest = {
    name: 'feature-payment',
    entries: [{ repositoryId: 'repo-1', branch: 'feature/payment' }],
  };

  it('正常系: Worktree 作成 → .code-workspace 生成 → ストア登録 → VS Code 起動の順で実行される', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree).mockResolvedValue('feature/payment-abcd1234');
    vi.mocked(deps.codeWorkspaceService.generate).mockResolvedValue(undefined);

    const result = await invoke('workspace:create', createRequest);

    expect(deps.store.addWorkspace).toHaveBeenCalledWith({
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'feature/payment' }],
    });
    expect(deps.gitService.addWorktree).toHaveBeenCalledWith(
      'backend',
      'feature-payment-abcd1234',
      'feature/payment',
      undefined,
    );
    expect(deps.codeWorkspaceService.generate).toHaveBeenCalledWith('feature-payment-abcd1234', [
      { repoName: 'backend' },
    ]);
    expect(result).toEqual({ success: true, data: ws });
  });

  it('存在しない repositoryId が含まれる場合に NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getRepository).mockResolvedValue(undefined);

    const result = await invoke('workspace:create', createRequest);

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Repository not found: repo-1' },
    });
    // addWorkspace は呼ばれない
    expect(deps.store.addWorkspace).not.toHaveBeenCalled();
  });

  it('2番目の Worktree 作成でエラーが発生した場合、1番目の Worktree がロールバック削除される', async () => {
    const repo1 = makeRepo({ id: 'repo-1', name: 'backend' });
    const repo2 = makeRepo({ id: 'repo-2', name: 'frontend' });
    const ws = makeWorkspace({
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'develop' },
      ],
    });

    vi.mocked(deps.store.getRepository).mockResolvedValueOnce(repo1).mockResolvedValueOnce(repo2);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree)
      .mockResolvedValueOnce('main-11111111')
      .mockRejectedValueOnce(new GitOperationError('worktree failed', 1, 'error'));
    vi.mocked(deps.gitService.removeWorktree).mockResolvedValue(undefined);
    vi.mocked(deps.codeWorkspaceService.remove).mockResolvedValue(undefined);
    vi.mocked(deps.store.removeWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'develop' },
      ],
    });

    // 1番目の Worktree がロールバック削除される
    expect(deps.gitService.removeWorktree).toHaveBeenCalledWith('backend', ws.name);
    // ストアからも削除される
    expect(deps.store.removeWorkspace).toHaveBeenCalledWith(ws.id);
    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.GIT_OPERATION_FAILED, message: 'error' },
    });
  });

  it('ロールバック中のエラーは無視される（ベストエフォート）', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();

    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree)
      .mockResolvedValueOnce('feature/payment-11111111')
      .mockRejectedValueOnce(new GitOperationError('second failed', 1, 'err'));
    // ロールバック自体も失敗
    vi.mocked(deps.gitService.removeWorktree).mockRejectedValue(new Error('cleanup failed'));
    vi.mocked(deps.codeWorkspaceService.remove).mockRejectedValue(new Error('cleanup failed'));
    vi.mocked(deps.store.removeWorkspace).mockRejectedValue(new Error('cleanup failed'));

    const result = await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [
        { repositoryId: 'repo-1', branch: 'feature/payment' },
        { repositoryId: 'repo-1', branch: 'develop' },
      ],
    });

    // ロールバックエラーは無視され、元のエラーが返る
    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.GIT_OPERATION_FAILED, message: 'err' },
    });
  });

  it('sourceBranch 未指定のエントリは addWorktree が sourceBranch=undefined で呼ばれる', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree).mockResolvedValue('feature/payment-abcd1234');
    vi.mocked(deps.codeWorkspaceService.generate).mockResolvedValue(undefined);

    await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'feature/payment' }],
    });

    expect(deps.gitService.addWorktree).toHaveBeenCalledWith(
      'backend',
      ws.name,
      'feature/payment',
      undefined,
    );
  });

  it('sourceBranch 指定のエントリは addWorktree が sourceBranch 付きで呼ばれる', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree).mockResolvedValue('feature/new-abcd1234');
    vi.mocked(deps.codeWorkspaceService.generate).mockResolvedValue(undefined);

    await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'feature/new', sourceBranch: 'develop' }],
    });

    expect(deps.gitService.addWorktree).toHaveBeenCalledWith(
      'backend',
      ws.name,
      'feature/new',
      'develop',
    );
  });

  it('混在エントリ（既存ブランチ + 新規ブランチ）が正しく処理される', async () => {
    const repo1 = makeRepo({ id: 'repo-1', name: 'backend' });
    const repo2 = makeRepo({ id: 'repo-2', name: 'frontend' });
    const ws = makeWorkspace({
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'feature/new' },
      ],
    });

    vi.mocked(deps.store.getRepository).mockResolvedValueOnce(repo1).mockResolvedValueOnce(repo2);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree)
      .mockResolvedValueOnce('main-11111111')
      .mockResolvedValueOnce('feature/new-22222222');
    vi.mocked(deps.codeWorkspaceService.generate).mockResolvedValue(undefined);

    const result = await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-2', branch: 'feature/new', sourceBranch: 'develop' },
      ],
    });

    expect(deps.gitService.addWorktree).toHaveBeenNthCalledWith(
      1,
      'backend',
      ws.name,
      'main',
      undefined,
    );
    expect(deps.gitService.addWorktree).toHaveBeenNthCalledWith(
      2,
      'frontend',
      ws.name,
      'feature/new',
      'develop',
    );
    expect(result).toEqual({ success: true, data: ws });
  });

  it('新規ブランチ作成失敗時にロールバックが実行される', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();

    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.store.addWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.gitService.addWorktree).mockRejectedValue(
      new GitOperationError('branch create failed', 128, 'fatal: not a valid ref'),
    );
    vi.mocked(deps.codeWorkspaceService.remove).mockResolvedValue(undefined);
    vi.mocked(deps.store.removeWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:create', {
      name: 'feature-payment',
      entries: [{ repositoryId: 'repo-1', branch: 'feature/new', sourceBranch: 'nonexistent' }],
    });

    expect(deps.store.removeWorkspace).toHaveBeenCalledWith(ws.id);
    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.GIT_OPERATION_FAILED,
        message: 'fatal: not a valid ref',
      },
    });
  });
});

// ============================================================
// workspace:delete
// ============================================================

describe('workspace:delete', () => {
  it('正常系: Worktree 削除 → .code-workspace 削除 → ディレクトリ削除 → ストア削除の順で実行される', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace();
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.removeWorktree).mockResolvedValue(undefined);
    vi.mocked(deps.codeWorkspaceService.remove).mockResolvedValue(undefined);
    vi.mocked(deps.store.removeWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:delete', { id: 'ws-1' });

    expect(deps.gitService.removeWorktree).toHaveBeenCalledWith('backend', ws.name);
    expect(deps.codeWorkspaceService.remove).toHaveBeenCalledWith(ws.name);
    expect(fsMock.rm).toHaveBeenCalledWith('/home/.squad/workspaces/ws', {
      recursive: true,
      force: true,
    });
    expect(deps.store.removeWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ success: true, data: null });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:delete', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Workspace not found: missing' },
    });
  });

  it('一部の Worktree 削除が失敗しても処理が継続される（ベストエフォート）', async () => {
    const repo = makeRepo();
    const ws = makeWorkspace({
      entries: [
        { repositoryId: 'repo-1', branch: 'main' },
        { repositoryId: 'repo-1', branch: 'develop' },
      ],
    });
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(ws);
    vi.mocked(deps.store.getRepository).mockResolvedValue(repo);
    vi.mocked(deps.gitService.removeWorktree)
      .mockRejectedValueOnce(new Error('worktree removal failed'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(deps.codeWorkspaceService.remove).mockResolvedValue(undefined);
    vi.mocked(deps.store.removeWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:delete', { id: 'ws-1' });

    // 1回目の失敗にもかかわらず、2回目の removeWorktree が呼ばれる
    expect(deps.gitService.removeWorktree).toHaveBeenCalledTimes(2);
    expect(deps.store.removeWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ success: true, data: null });
  });
});

// ============================================================
// workspace:open
// ============================================================

describe('workspace:open', () => {
  it('存在する Workspace の .code-workspace ファイルパスで code コマンドが実行される', async () => {
    const ws = makeWorkspace();
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(ws);

    const result = await invoke('workspace:open', { id: 'ws-1' });

    expect(deps.paths.codeWorkspaceFile).toHaveBeenCalledWith(ws.name);
    expect(execFileMock).toHaveBeenCalledWith(
      'code',
      ['/home/.squad/workspaces/ws/ws.code-workspace'],
      expect.any(Function),
    );
    expect(result).toEqual({ success: true, data: null });
  });

  it('存在しない ID で NOT_FOUND エラーが返る', async () => {
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(undefined);

    const result = await invoke('workspace:open', { id: 'missing' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.NOT_FOUND, message: 'Workspace not found: missing' },
    });
  });

  it('code コマンドが失敗した場合にエラーが返る', async () => {
    const ws = makeWorkspace();
    vi.mocked(deps.store.getWorkspace).mockResolvedValue(ws);
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(new Error('code command not found'), null);
      },
    );

    const result = await invoke('workspace:open', { id: 'ws-1' });

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.INTERNAL_ERROR, message: 'code command not found' },
    });
  });
});
