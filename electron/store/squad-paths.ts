import * as os from 'node:os';
import * as path from 'node:path';

/**
 * `~/.squad` 配下のパス解決を提供するインターフェース。
 *
 * @remarks
 * 静的パス（ディレクトリ・設定ファイル）と動的パス（リポジトリ・Workspace）を提供する。
 */
export interface SquadPaths {
  /** ストアのルートディレクトリ（デフォルト: `~/.squad`） */
  readonly root: string;
  /** 設定ファイル格納ディレクトリ（`<root>/config`） */
  readonly configDir: string;
  /** Bare Repository 格納ディレクトリ（`<root>/repos`） */
  readonly reposDir: string;
  /** Workspace 格納ディレクトリ（`<root>/workspaces`） */
  readonly workspacesDir: string;
  /** リポジトリ設定ファイル（`<root>/config/repos.json`） */
  readonly reposConfig: string;
  /** Workspace 設定ファイル（`<root>/config/workspaces.json`） */
  readonly workspacesConfig: string;

  /**
   * Bare Repository のディレクトリパスを返す。
   *
   * @param name - リポジトリ名
   * @returns `<root>/repos/<name>.git`
   */
  repoDir(name: string): string;

  /**
   * Workspace のディレクトリパスを返す。
   *
   * @param workspaceName - Workspace 名
   * @returns `<root>/workspaces/<workspaceName>`
   */
  workspaceDir(workspaceName: string): string;

  /**
   * Worktree のディレクトリパスを返す。
   *
   * @param workspaceName - Workspace 名
   * @param repoName - リポジトリ名
   * @returns `<root>/workspaces/<workspaceName>/<repoName>`
   */
  worktreeDir(workspaceName: string, repoName: string): string;

  /**
   * VS Code Workspace ファイルのパスを返す。
   *
   * @param workspaceName - Workspace 名
   * @returns `<root>/workspaces/<workspaceName>/<workspaceName>.code-workspace`
   */
  codeWorkspaceFile(workspaceName: string): string;
}

/**
 * {@link SquadPaths} インスタンスを生成する。
 *
 * @param rootPath - ストアのルートパス。省略時は `~/.squad`
 * @returns パス解決オブジェクト
 */
export function createSquadPaths(rootPath?: string): SquadPaths {
  const root = rootPath ?? path.join(os.homedir(), '.squad');

  return {
    root,
    configDir: path.join(root, 'config'),
    reposDir: path.join(root, 'repos'),
    workspacesDir: path.join(root, 'workspaces'),
    reposConfig: path.join(root, 'config', 'repos.json'),
    workspacesConfig: path.join(root, 'config', 'workspaces.json'),

    repoDir(name: string): string {
      return path.join(root, 'repos', `${name}.git`);
    },

    workspaceDir(workspaceName: string): string {
      return path.join(root, 'workspaces', workspaceName);
    },

    worktreeDir(workspaceName: string, repoName: string): string {
      return path.join(root, 'workspaces', workspaceName, repoName);
    },

    codeWorkspaceFile(workspaceName: string): string {
      return path.join(root, 'workspaces', workspaceName, `${workspaceName}.code-workspace`);
    },
  };
}
