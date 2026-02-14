import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import type { SquadPaths } from '../store/squad-paths.js';
import { validateRemoteUrl, validateBranchName, validateRepoName } from './git-validation.js';
import { GitOperationError, GitRepositoryExistsError } from './git-errors.js';
import { generateSuffix, appendSuffix, MAX_SUFFIX_RETRY } from './uuid-suffix.js';

const execFileAsync = promisify(execFile);

export class GitService {
  constructor(private readonly paths: SquadPaths) {}

  /** Bare Repository をクローンする。suffix 付きリポジトリ名を返す */
  async cloneBare(remoteUrl: string, repoName: string): Promise<string> {
    validateRemoteUrl(remoteUrl);
    validateRepoName(repoName);

    for (let attempt = 0; attempt < MAX_SUFFIX_RETRY; attempt++) {
      const suffix = generateSuffix();
      const actualName = appendSuffix(repoName, suffix);
      const repoDir = this.paths.repoDir(actualName);

      const exists = await fs
        .stat(repoDir)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        continue;
      }

      await this.execGit(['clone', '--bare', remoteUrl, repoDir]);

      // bare clone は fetch refspec を設定しないため、手動で追加する。
      // これにより git fetch が refs/remotes/origin/* にマッピングされ、
      // git branch -r でリモートブランチ一覧が取得可能になる。
      await this.execGit(
        ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
        repoDir,
      );

      return actualName;
    }

    throw new GitRepositoryExistsError(repoName);
  }

  /** Bare Repository をディスクから削除する */
  async removeBareRepository(repoName: string): Promise<void> {
    validateRepoName(repoName);
    const repoDir = this.paths.repoDir(repoName);
    await fs.rm(repoDir, { recursive: true, force: true });
  }

  /**
   * 起点ブランチから新規ブランチを作成する。
   *
   * リモート追跡ブランチ（refs/remotes/origin/*）を起点として使用する。
   * Bare Repository では git fetch で refs/remotes/origin/* のみが更新され、
   * refs/heads/* は clone 時点のまま更新されないため、常にリモート参照を使う。
   *
   * @param repoName - Bare Repository 名（suffix 付き）
   * @param newBranch - 作成するブランチ名
   * @param sourceBranch - 起点ブランチ名（例: develop）。origin/ プレフィックスなしで指定する。
   */
  async createBranch(repoName: string, newBranch: string, sourceBranch: string): Promise<void> {
    validateBranchName(newBranch);
    validateBranchName(sourceBranch);

    const repoDir = this.paths.repoDir(repoName);
    await this.execGit(['branch', newBranch, `refs/remotes/origin/${sourceBranch}`], repoDir);
  }

  /** 指定ブランチの Worktree を作成する。suffix 付きブランチ名を返す */
  async addWorktree(
    repoName: string,
    workspaceName: string,
    branch: string,
    sourceBranch?: string,
  ): Promise<string> {
    validateBranchName(branch);
    if (sourceBranch !== undefined) {
      validateBranchName(sourceBranch);
    }

    const repoDir = this.paths.repoDir(repoName);
    const worktreeDir = this.paths.worktreeDir(workspaceName, repoName);

    // Workspace ディレクトリを自動作成
    await fs.mkdir(this.paths.workspaceDir(workspaceName), { recursive: true });

    for (let attempt = 0; attempt < MAX_SUFFIX_RETRY; attempt++) {
      const suffix = generateSuffix();
      const actualBranch = appendSuffix(branch, suffix);

      try {
        // createBranch() に委譲（sourceBranch 省略時は branch 自身が起点）
        await this.createBranch(repoName, actualBranch, sourceBranch ?? branch);
      } catch {
        // ブランチ名が重複した場合はリトライ
        continue;
      }

      // 作成したブランチで worktree を追加
      await this.execGit(['worktree', 'add', worktreeDir, actualBranch], repoDir);
      return actualBranch;
    }

    throw new GitOperationError(
      `Failed to create worktree after ${String(MAX_SUFFIX_RETRY)} retries: branch '${branch}' suffix collision`,
      null,
      '',
    );
  }

  /** Worktree を削除する */
  async removeWorktree(repoName: string, workspaceName: string): Promise<void> {
    validateRepoName(repoName);

    const repoDir = this.paths.repoDir(repoName);
    const worktreeDir = this.paths.worktreeDir(workspaceName, repoName);

    const exists = await fs
      .stat(worktreeDir)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return;
    }

    await this.execGit(['worktree', 'remove', worktreeDir, '--force'], repoDir);
  }

  /** リモートから最新情報を取得する。fast-forward 可能なローカルブランチも同期する。 */
  async fetch(repoName: string): Promise<void> {
    const repoDir = this.paths.repoDir(repoName);
    await this.execGit(['fetch', '--all', '--prune'], repoDir);
    await this.syncLocalBranches(repoDir);
  }

  /**
   * ローカルブランチを対応する origin/* に fast-forward 同期する。
   *
   * Bare Repository では `git pull` が使えないため、fetch 後に
   * refs/heads/* を refs/remotes/origin/* に合わせて明示的に更新する。
   * fast-forward 不可能なブランチ（diverged）はスキップする。
   * worktree でチェックアウト中のブランチもスキップする
   * （update-ref でブランチ参照だけ進めるとワーキングツリーとの不整合が発生するため）。
   */
  private async syncLocalBranches(repoDir: string): Promise<void> {
    // ローカルブランチ一覧を取得
    const localOutput = await this.execGit(['branch', '--format=%(refname:short)'], repoDir);

    const localBranches = localOutput
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    // worktree でチェックアウト中のブランチを取得
    // （update-ref でブランチ参照だけ進めるとワーキングツリーとの不整合が発生するため除外）
    const checkedOutBranches = await this.getWorktreeCheckedOutBranches(repoDir);

    for (const branch of localBranches) {
      if (checkedOutBranches.has(branch)) {
        continue;
      }

      try {
        // 対応するリモートブランチが存在するか確認
        await this.execGit(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repoDir);

        // fast-forward 可能か確認（ローカルがリモートの祖先であること）
        await this.execGit(
          ['merge-base', '--is-ancestor', `refs/heads/${branch}`, `refs/remotes/origin/${branch}`],
          repoDir,
        );

        // fast-forward 更新
        await this.execGit(
          ['update-ref', `refs/heads/${branch}`, `refs/remotes/origin/${branch}`],
          repoDir,
        );
      } catch {
        // リモートブランチが存在しない、fast-forward 不可能、
        // またはその他のエラーの場合はスキップ（ベストエフォート）
        continue;
      }
    }
  }

  /**
   * worktree でチェックアウト中のブランチ名のセットを返す。
   */
  private async getWorktreeCheckedOutBranches(repoDir: string): Promise<Set<string>> {
    try {
      const output = await this.execGit(['worktree', 'list', '--porcelain'], repoDir);
      const branches = new Set<string>();
      for (const line of output.split('\n')) {
        // "branch refs/heads/feature/xxx" 形式の行からブランチ名を抽出
        if (line.startsWith('branch refs/heads/')) {
          branches.add(line.replace('branch refs/heads/', ''));
        }
      }
      return branches;
    } catch {
      return new Set();
    }
  }

  /** リモートブランチ一覧を取得する */
  async getRemoteBranches(repoName: string): Promise<string[]> {
    const repoDir = this.paths.repoDir(repoName);

    const stdout = await this.execGit(['branch', '-r', '--format=%(refname:short)'], repoDir);

    if (stdout.trim().length === 0) {
      return [];
    }

    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .filter((line) => !line.endsWith('/HEAD'))
      .filter((line) => line.includes('/'))
      .map((line) => line.replace(/^origin\//, ''));
  }

  /** Git コマンドを execFile で実行する */
  private async execGit(args: string[], cwd?: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd });
      return stdout;
    } catch (error: unknown) {
      // execFile のエラーオブジェクト:
      // - code: プロセス終了コード (number) またはスポーン失敗時のエラーコード (string, e.g. 'ENOENT')
      // - stderr: 標準エラー出力
      const err = error as { code?: number | string; stderr?: string; message?: string };
      throw new GitOperationError(
        err.message ?? 'Git command failed',
        typeof err.code === 'number' ? err.code : null,
        err.stderr ?? '',
      );
    }
  }
}
