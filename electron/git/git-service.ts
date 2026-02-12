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

  /** リモートから最新情報を取得する */
  async fetch(repoName: string): Promise<void> {
    const repoDir = this.paths.repoDir(repoName);
    await this.execGit(['fetch', '--all', '--prune'], repoDir);
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
