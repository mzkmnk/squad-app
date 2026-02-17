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

/**
 * テスト用: リモートに新しいコミットを push するヘルパー関数
 * テスト内で何度も出現する git クローン → コミット → push パターンを抽出
 */
async function pushNewCommitToRemote(
  remote: string,
  fileName: string,
  message: string,
  branchName?: string,
): Promise<void> {
  const workDir = path.join(tmpDir, `work-for-${fileName}`);
  await fs.mkdir(workDir, { recursive: true });
  await execFileAsync('git', ['clone', remote, '.'], { cwd: workDir });
  await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: workDir });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: workDir });

  if (branchName) {
    await execFileAsync('git', ['checkout', '-b', branchName], { cwd: workDir });
  }

  await fs.writeFile(path.join(workDir, fileName), fileName);
  await execFileAsync('git', ['add', '.'], { cwd: workDir });
  await execFileAsync('git', ['commit', '-m', message], { cwd: workDir });

  if (branchName) {
    await execFileAsync('git', ['push', 'origin', branchName], { cwd: workDir });
  } else {
    await execFileAsync('git', ['push'], { cwd: workDir });
  }

  await fs.rm(workDir, { recursive: true, force: true });
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
    await service.fetch('test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const stat = await fs.stat(worktreeDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('Worktree ディレクトリ内にファイルが展開される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');
    await service.addWorktree('test-repo', 'my-workspace', 'main');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const readme = path.join(worktreeDir, 'README.md');
    const stat = await fs.stat(readme);
    expect(stat.isFile()).toBe(true);
  });

  it('Workspace ディレクトリが自動作成される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');
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
    await service.fetch('test-repo');
    await expect(
      service.addWorktree('test-repo', 'my-workspace', 'nonexistent-branch'),
    ).rejects.toThrow(GitOperationError);
  });

  it('3回リトライ後に全て重複した場合 GitOperationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const spy = vi.spyOn(uuidSuffix, 'generateSuffix').mockReturnValue('bbbbbbbb');

    // 先に同名ブランチで worktree を作成しておく
    const repoDir = paths.repoDir('test-repo');
    await execFileAsync('git', ['branch', 'main-bbbbbbbb', 'refs/remotes/origin/main'], {
      cwd: repoDir,
    });
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
    await service.fetch('test-repo');
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
    await service.fetch('test-repo');
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
    await pushNewCommitToRemote(remoteDir, 'new.txt', 'add new', 'feature/new-branch');

    await service.fetch('test-repo');

    const branches = await service.getRemoteBranches('test-repo');
    expect(branches).toContain('feature/new-branch');
  });

  it('Bare Repository が存在しない場合にエラー', async () => {
    await expect(service.fetch('nonexistent-repo')).rejects.toThrow();
  });

  it('fetch 後にローカルブランチが origin に fast-forward 同期される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const repoDir = paths.repoDir('test-repo');

    // リモートに新コミットを push
    await pushNewCommitToRemote(remoteDir, 'sync.txt', 'sync commit');

    // 再度 fetch（syncLocalBranches が実行される）
    await service.fetch('test-repo');

    // ローカルの refs/heads/main が refs/remotes/origin/main と同じコミットを指す
    const { stdout: localRef } = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], {
      cwd: repoDir,
    });
    const { stdout: remoteRef } = await execFileAsync(
      'git',
      ['rev-parse', 'refs/remotes/origin/main'],
      { cwd: repoDir },
    );
    expect(localRef.trim()).toBe(remoteRef.trim());
  });

  it('fast-forward 不可能なブランチ（diverged）はスキップされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const repoDir = paths.repoDir('test-repo');

    // ローカルブランチに独自コミットを作成して diverge させる
    // commit-tree は author/committer 情報が必要（CI 環境にはグローバル設定がない）
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
    // 空のツリーを使って独自コミットを作成
    const { stdout: treeHash } = await execFileAsync('git', ['write-tree'], { cwd: repoDir });
    const { stdout: commitHash } = await execFileAsync(
      'git',
      ['commit-tree', treeHash.trim(), '-m', 'diverged local commit'],
      { cwd: repoDir },
    );
    await execFileAsync('git', ['update-ref', 'refs/heads/main', commitHash.trim()], {
      cwd: repoDir,
    });

    // リモートにも新コミットを push
    await pushNewCommitToRemote(remoteDir, 'diverge.txt', 'remote diverge commit');

    // fetch 実行
    await service.fetch('test-repo');

    // ローカルの refs/heads/main は diverged コミットのまま（更新されない）
    const { stdout: afterRef } = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], {
      cwd: repoDir,
    });
    expect(afterRef.trim()).toBe(commitHash.trim());
    // リモートとは異なることを確認
    const { stdout: remoteRef } = await execFileAsync(
      'git',
      ['rev-parse', 'refs/remotes/origin/main'],
      { cwd: repoDir },
    );
    expect(afterRef.trim()).not.toBe(remoteRef.trim());
  });

  it('worktree でチェックアウト中のブランチはスキップされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const repoDir = paths.repoDir('test-repo');

    // main ブランチで worktree を作成（チェックアウト状態にする）
    const worktreeDir = path.join(tmpDir, 'worktree-checkout');
    await execFileAsync('git', ['worktree', 'add', worktreeDir, 'main'], { cwd: repoDir });

    // チェックアウト前のローカル refs/heads/main を記録
    const { stdout: beforeRef } = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], {
      cwd: repoDir,
    });

    // リモートに新コミットを push
    await pushNewCommitToRemote(remoteDir, 'worktree-test.txt', 'worktree test commit');

    // fetch 実行
    await service.fetch('test-repo');

    // チェックアウト中の main は更新されない
    const { stdout: afterRef } = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], {
      cwd: repoDir,
    });
    expect(afterRef.trim()).toBe(beforeRef.trim());

    // リモートは更新されていることを確認
    const { stdout: remoteRef } = await execFileAsync(
      'git',
      ['rev-parse', 'refs/remotes/origin/main'],
      { cwd: repoDir },
    );
    expect(remoteRef.trim()).not.toBe(beforeRef.trim());

    // クリーンアップ: worktree を削除
    await execFileAsync('git', ['worktree', 'remove', worktreeDir, '--force'], { cwd: repoDir });
  });

  it('リモートに対応するブランチがないローカルブランチはスキップされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const repoDir = paths.repoDir('test-repo');

    // ローカルのみのブランチを作成（リモートには存在しない）
    await execFileAsync('git', ['branch', 'local-only-branch', 'refs/remotes/origin/main'], {
      cwd: repoDir,
    });

    // ブランチの現在のコミットを記録
    const { stdout: beforeRef } = await execFileAsync(
      'git',
      ['rev-parse', 'refs/heads/local-only-branch'],
      { cwd: repoDir },
    );

    // fetch 実行（エラーなく完了すること）
    await service.fetch('test-repo');

    // ローカルのみのブランチがそのまま残っている
    const { stdout: afterRef } = await execFileAsync(
      'git',
      ['rev-parse', 'refs/heads/local-only-branch'],
      { cwd: repoDir },
    );
    expect(afterRef.trim()).toBe(beforeRef.trim());
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

// --- createBranch ---

describe('GitService - createBranch', () => {
  it('起点ブランチから新規ブランチを作成できる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    await service.createBranch('test-repo', 'feature/new', 'main');

    // ブランチが作成されたことを確認
    const repoDir = paths.repoDir('test-repo');
    const { stdout } = await execFileAsync('git', ['branch', '--list', 'feature/new'], {
      cwd: repoDir,
    });
    expect(stdout.trim()).toContain('feature/new');
  });

  it('正しい repoDir が cwd として使用される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    await service.createBranch('test-repo', 'test-branch', 'main');

    const repoDir = paths.repoDir('test-repo');
    const { stdout } = await execFileAsync('git', ['branch', '--list', 'test-branch'], {
      cwd: repoDir,
    });
    expect(stdout.trim()).toContain('test-branch');
  });

  it('newBranch が空文字の場合に GitValidationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    await expect(service.createBranch('test-repo', '', 'main')).rejects.toThrow(GitValidationError);
  });

  it('sourceBranch が空文字の場合に GitValidationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    await expect(service.createBranch('test-repo', 'feature/new', '')).rejects.toThrow(
      GitValidationError,
    );
  });

  it('newBranch が Git 命名規則に違反する場合に GitValidationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    await expect(service.createBranch('test-repo', '..invalid', 'main')).rejects.toThrow(
      GitValidationError,
    );
  });

  it('起点ブランチが存在しない場合に GitOperationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    await expect(
      service.createBranch('test-repo', 'feature/new', 'nonexistent-branch'),
    ).rejects.toThrow(GitOperationError);
  });
});

// --- addWorktree with sourceBranch ---

describe('GitService - addWorktree (sourceBranch)', () => {
  /**
   * リモートに develop ブランチを追加するヘルパー
   */
  async function addDevelopBranch(): Promise<void> {
    await pushNewCommitToRemote(remoteDir, 'develop.txt', 'add develop', 'develop');
  }

  it('sourceBranch 省略時は branch 自身が起点として使用される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const actualBranch = await service.addWorktree('test-repo', 'my-workspace', 'main');

    expect(actualBranch).toContain('main');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const stat = await fs.stat(worktreeDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('sourceBranch 指定時は sourceBranch から新規ブランチが作成される', async () => {
    await addDevelopBranch();
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const actualBranch = await service.addWorktree(
      'test-repo',
      'my-workspace',
      'feature/from-develop',
      'develop',
    );

    expect(actualBranch).toContain('feature/from-develop');
    const worktreeDir = paths.worktreeDir('my-workspace', 'test-repo');
    const stat = await fs.stat(worktreeDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('sourceBranch 指定時に suffix 付きブランチ名が返される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const actualBranch = await service.addWorktree(
      'test-repo',
      'my-workspace',
      'feature/new',
      'main',
    );

    // suffix が付与されている（元のブランチ名 + '-' + 8文字）
    expect(actualBranch).toMatch(/^feature\/new-[a-f0-9]{8}$/);
  });

  it('sourceBranch 指定時に Workspace ディレクトリが自動作成される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    await service.addWorktree('test-repo', 'new-ws', 'feature/new', 'main');

    const wsDir = paths.workspaceDir('new-ws');
    const stat = await fs.stat(wsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('sourceBranch が Git 命名規則に違反する場合に GitValidationError がスローされる', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');

    await expect(
      service.addWorktree('test-repo', 'my-workspace', 'feature/new', ''),
    ).rejects.toThrow(GitValidationError);
  });

  it('sourceBranch 省略時も upstream が自身に設定される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const actualBranch = await service.addWorktree('test-repo', 'my-workspace', 'main');

    const repoDir = paths.repoDir('test-repo');
    const { stdout } = await execFileAsync(
      'git',
      ['for-each-ref', '--format=%(upstream:short)', `refs/heads/${actualBranch}`],
      { cwd: repoDir },
    );
    expect(stdout.trim()).toBe(`origin/${actualBranch}`);
  });

  it('sourceBranch 指定時も upstream が起点ブランチではなく自身に設定される', async () => {
    await cloneBareForTest(paths, remoteDir, 'test-repo');
    await service.fetch('test-repo');

    const actualBranch = await service.addWorktree(
      'test-repo',
      'my-workspace',
      'feature/upstream-test',
      'main',
    );

    const repoDir = paths.repoDir('test-repo');
    const { stdout } = await execFileAsync(
      'git',
      ['for-each-ref', '--format=%(upstream:short)', `refs/heads/${actualBranch}`],
      { cwd: repoDir },
    );
    // origin/main ではなく origin/<actualBranch> であること
    expect(stdout.trim()).toBe(`origin/${actualBranch}`);
  });
});
