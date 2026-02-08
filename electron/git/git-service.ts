import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import type { SquadPaths } from '../store/squad-paths.js';
import { validateRemoteUrl, validateBranchName, validateRepoName } from './git-validation.js';
import { GitOperationError, GitRepositoryExistsError } from './git-errors.js';

const execFileAsync = promisify(execFile);

export class GitService {
  constructor(private readonly paths: SquadPaths) {}

  /** Bare Repository をクローンする */
  async cloneBare(remoteUrl: string, repoName: string): Promise<void> {
    validateRemoteUrl(remoteUrl);
    validateRepoName(repoName);

    const repoDir = this.paths.repoDir(repoName);

    const exists = await fs
      .stat(repoDir)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      throw new GitRepositoryExistsError(repoName);
    }

    await this.execGit(['clone', '--bare', remoteUrl, repoDir]);

    // bare clone は fetch refspec を設定しないため、手動で追加する。
    // これにより git fetch が refs/remotes/origin/* にマッピングされ、
    // git branch -r でリモートブランチ一覧が取得可能になる。
    await this.execGit(
      ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
      repoDir,
    );
  }

  /** Bare Repository をディスクから削除する */
  async removeBareRepository(repoName: string): Promise<void> {
    validateRepoName(repoName);
    const repoDir = this.paths.repoDir(repoName);
    await fs.rm(repoDir, { recursive: true, force: true });
  }

  /** 指定ブランチの Worktree を作成する */
  async addWorktree(repoName: string, workspaceName: string, branch: string): Promise<void> {
    validateBranchName(branch);

    const repoDir = this.paths.repoDir(repoName);
    const worktreeDir = this.paths.worktreeDir(workspaceName, repoName);

    // Workspace ディレクトリを自動作成
    await fs.mkdir(this.paths.workspaceDir(workspaceName), { recursive: true });

    await this.execGit(['worktree', 'add', worktreeDir, branch], repoDir);
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
