import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSquadPaths, type SquadPaths } from '../store/squad-paths.js';
import { GitService } from './git-service.js';
import { GitValidationError, GitOperationError, GitRepositoryExistsError } from './git-errors.js';
import * as uuidSuffix from './uuid-suffix.js';
import * as gitValidation from './git-validation.js';

const execFileAsync = promisify(execFile);

let tmpDir: string;
let remoteDir: string;
let squadRoot: string;
let paths: SquadPaths;
let service: GitService;

/**
 * テスト用のローカル Git リポジトリを作成する（リモート代替）。
 */
async function createLocalRemote(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await execFileAsync('git', ['init', '--bare', '--initial-branch=main'], { cwd: dir });

  const workDir = path.join(dir, '..', 'work-tmp');
  await fs.mkdir(workDir, { recursive: true });
  await execFileAsync('git', ['clone', dir, '.'], { cwd: workDir });
  await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: workDir });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: workDir });
  await fs.writeFile(path.join(workDir, 'README.md'), '# Test');
  await execFileAsync('git', ['add', '.'], { cwd: workDir });
  await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: workDir });
  await execFileAsync('git', ['push'], { cwd: workDir });
  await fs.rm(workDir, { recursive: true, force: true });
}

/**
 * テスト用: URL バリデーションをバイパスして直接 bare clone する。
 */
async function cloneBareForTest(
  testPaths: SquadPaths,
  localRemote: string,
  repoName: string,
): Promise<void> {
  const repoDir = testPaths.repoDir(repoName);
  await execFileAsync('git', ['clone', '--bare', localRemote, repoDir]);
  await execFileAsync(
    'git',
    ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
    { cwd: repoDir },
  );
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-git-test-'));
  remoteDir = path.join(tmpDir, 'remote.git');
  await createLocalRemote(remoteDir);
  squadRoot = path.join(tmpDir, 'squad');
  await fs.mkdir(path.join(squadRoot, 'repos'), { recursive: true });
  await fs.mkdir(path.join(squadRoot, 'workspaces'), { recursive: true });
  paths = createSquadPaths(squadRoot);
  service = new GitService(paths);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// --- cloneBare ---

describe('GitService - cloneBare', () => {
  it('有効な URL から Bare Repository をクローンできる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    const repoDir = paths.repoDir('test-repo');
    const stat = await fs.stat(repoDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('クローン先に .git サフィックスのディレクトリが作成される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    expect(paths.repoDir('test-repo').endsWith('.git')).toBe(true);
    const stat = await fs.stat(paths.repoDir('test-repo'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('HEAD ファイルが存在する（Bare Repository の証跡）', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    const headPath = path.join(paths.repoDir('test-repo'), 'HEAD');
    const stat = await fs.stat(headPath);
    expect(stat.isFile()).toBe(true);
  });

  it('同名リポジトリが既に存在する場合でも異なる suffix で作成される', async () => {
    // ローカルパスを使うため URL バリデーションをバイパス
    const spy = vi.spyOn(gitValidation, 'validateRemoteUrl').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
    const name1 = await service.cloneBare(remoteDir, 'test-repo');
    const name2 = await service.cloneBare(remoteDir, 'test-repo');
    expect(name1).not.toBe(name2);
    spy.mockRestore();
  });

  it('不正な URL の場合に GitValidationError がスローされる', async () => {
    await expect(service.cloneBare('', 'test-repo')).rejects.toThrow(GitValidationError);
  });

  it('存在しないリモートの場合に GitOperationError がスローされる', async () => {
    await expect(
      service.cloneBare('https://example.invalid/nonexistent/repo.git', 'test-repo'),
    ).rejects.toThrow(GitOperationError);
  });

  it('3回リトライ後に全て重複した場合 GitRepositoryExistsError がスローされる', async () => {
    const urlSpy = vi.spyOn(gitValidation, 'validateRemoteUrl').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
    const suffixSpy = vi.spyOn(uuidSuffix, 'generateSuffix').mockReturnValue('aaaaaaaa');

    await cloneBareForTest(paths, remoteDir, 'test-repo-aaaaaaaa');

    await expect(service.cloneBare(remoteDir, 'test-repo')).rejects.toThrow(
      GitRepositoryExistsError,
    );

    suffixSpy.mockRestore();
    urlSpy.mockRestore();
  });
});

// --- removeBareRepository ---

describe('GitService - removeBareRepository', () => {
  it('既存の Bare Repository を削除できる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.removeBareRepository('test-repo');
    await expect(fs.stat(paths.repoDir('test-repo'))).rejects.toThrow();
  });

  it('削除後にディレクトリが存在しない', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.removeBareRepository('test-repo');
    const exists = await fs
      .stat(paths.repoDir('test-repo'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('存在しないリポジトリを指定してもエラーにならない（冪等）', async () => {
    await expect(service.removeBareRepository('nonexistent')).resolves.toBeUndefined();
  });
});

// --- addWorktree ---

describe('GitService - addWorktree', () => {
  it('指定ブランチの Worktree を作成できる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const stat = await fs.stat(worktreeDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('Worktree ディレクトリ内にファイルが展開される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const readme = path.join(worktreeDir, 'README.md');
    const stat = await fs.stat(readme);
    expect(stat.isFile()).toBe(true);
  });

  it('Workspace ディレクトリが自動作成される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.addWorktree('test-repo', 'new-workspace', 'main');
    const wsDir = paths.workspaceDir('new-workspace');
    const stat = await fs.stat(wsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('不正なブランチ名の場合に GitValidationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await expect(service.addWorktree('test-repo', 'my-workspace', '')).rejects.toThrow(
      GitValidationError,
    );
  });

  it('存在しないブランチの場合に GitOperationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await expect(
      service.addWorktree('test-repo', 'my-workspace', 'nonexistent-branch'),
    ).rejects.toThrow(GitOperationError);
  });

  it('3回リトライ後に全て重複した場合 GitOperationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    const spy = vi.spyOn(uuidSuffix, 'generateSuffix').mockReturnValue('bbbbbbbb');

    // 先に同名ブランチで worktree を作成しておく
    const repoDir = paths.repoDir('test-repo');
    await execFileAsync('git', ['branch', 'main-bbbbbbbb', 'main'], { cwd: repoDir });
    await execFileAsync(
      'git',
      ['worktree', 'add', paths.worktreeDir('pre-existing', 'test-repo'), 'main-bbbbbbbb'],
      { cwd: repoDir },
    );

    await expect(service.addWorktree('test-repo', 'my-workspace', 'main')).rejects.toThrow(
      GitOperationError,
    );

    spy.mockRestore();
  });
});

// --- removeWorktree ---

describe('GitService - removeWorktree', () => {
  it('既存の Worktree を削除できる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    await service.removeWorktree('test-repo', 'my-workspace');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const exists = await fs
      .stat(worktreeDir)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('削除後に Worktree ディレクトリが存在しない', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    await service.removeWorktree('test-repo', 'my-workspace');
    await expect(fs.stat(paths.worktreeDir('my-workspace', 'test-repo'))).rejects.toThrow();
  });

  it('存在しない Worktree を指定してもエラーにならない（冪等）', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await expect(
      service.removeWorktree('test-repo', 'nonexistent-workspace'),
    ).resolves.toBeUndefined();
  });
});

// --- fetch ---

describe('GitService - fetch', () => {
  it('リモートから最新情報を取得できる（リモートに新ブランチ追加後に反映される）', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    // リモートに新ブランチを追加
    const workDir = path.join(tmpDir, 'work-for-fetch');
    await fs.mkdir(workDir, { recursive: true });
    await execFileAsync('git', ['clone', remoteDir, '.'], { cwd: workDir });
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: workDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: workDir });
    await execFileAsync('git', ['checkout', '-b', 'feature/new-branch'], { cwd: workDir });
    await fs.writeFile(path.join(workDir, 'new.txt'), 'new');
    await execFileAsync('git', ['add', '.'], { cwd: workDir });
    await execFileAsync('git', ['commit', '-m', 'add new'], { cwd: workDir });
    await execFileAsync('git', ['push', 'origin', 'feature/new-branch'], { cwd: workDir });
    await fs.rm(workDir, { recursive: true, force: true });

    await service.fetch('test-repo');

    const branches = await service.getRemoteBranches('test-repo');
    expect(branches).toContain('feature/new-branch');
  });

  it('Bare Repository が存在しない場合にエラー', async () => {
    await expect(service.fetch('nonexistent-repo')).rejects.toThrow();
  });
});

// --- getRemoteBranches ---

describe('GitService - getRemoteBranches', () => {
  it('リモートブランチ一覧を取得できる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');
    const branches = await service.getRemoteBranches('test-repo');
    expect(branches).toContain('main');
  });

  it('origin/HEAD が結果に含まれない', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');
    const branches = await service.getRemoteBranches('test-repo');
    expect(branches.every((b) => b !== 'HEAD')).toBe(true);
    expect(branches.every((b) => !b.includes('origin/'))).toBe(true);
  });

  it('origin/ プレフィックスが除去される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');
    const branches = await service.getRemoteBranches('test-repo');
    for (const b of branches) {
      expect(b.startsWith('origin/')).toBe(false);
    }
  });

  it('ブランチが存在しない場合（空リポジトリ）は空配列を返す', async () => {
    // 空の bare リポジトリを作成（コミットなし）
    const emptyRemote = path.join(tmpDir, 'empty-remote.git');
    await fs.mkdir(emptyRemote, { recursive: true });
    await execFileAsync('git', ['init', '--bare', '--initial-branch=main'], { cwd: emptyRemote });

    // 空リモートを直接 clone --bare
    const repoDir = paths.repoDir('empty-repo');
    await execFileAsync('git', ['clone', '--bare', emptyRemote, repoDir]);

    const branches = await service.getRemoteBranches('empty-repo');
    expect(branches).toEqual([]);
  });
});
