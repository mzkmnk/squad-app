import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { IpcChannels } from './ipc-channels.js';
import type { IpcResult } from '../types/ipc-result.js';
import { mapErrorToIpcResult, notFoundResult, successResult } from './ipc-error-mapper.js';
import type { SquadStore } from '../store/squad-store.js';
import type { GitService } from '../git/git-service.js';
import type { CodeWorkspaceService } from '../git/code-workspace-service.js';
import type { SquadPaths } from '../store/squad-paths.js';
import type { Repository, Workspace } from '../types/models.js';

const execFileAsync = promisify(execFile);

/** {@link registerIpcHandlers} 内で repositoryId を解決済みの Workspace エントリ */
interface ResolvedWorkspaceEntry {
  /** 解決済みのリポジトリオブジェクト */
  repo: Repository;
  /** チェックアウト対象のブランチ名 */
  branch: string;
  /** 新規ブランチの起点ブランチ名 */
  sourceBranch?: string;
}

/** ロールバック時に削除対象となる作成済み Worktree の識別情報 */
interface CreatedWorktree {
  /** Worktree が属するリポジトリ名 */
  repoName: string;
  /** Worktree が属する Workspace 名 */
  workspaceName: string;
}

/**
 * リモート URL からリポジトリ名を抽出する。
 *
 * @remarks
 * URL 末尾のパスセグメントを取得し、`.git` サフィックスを除去する。
 * HTTPS 形式と SSH 形式（`git@host:path`）の両方に対応する。
 *
 * @param remoteUrl - リモートリポジトリの URL
 * @returns 抽出されたリポジトリ名
 *
 * @example
 * ```typescript
 * extractRepoName('https://github.com/org/backend.git'); // => 'backend'
 * extractRepoName('git@github.com:org/frontend.git');     // => 'frontend'
 * extractRepoName('https://github.com/org/repo');         // => 'repo'
 * ```
 */
// TODO: セキュリティ強化 — file:// や javascript: 等の危険なスキームを拒否するホワイトリストチェックを追加する
// TODO: URL パースエラー時に INTERNAL_ERROR ではなく VALIDATION_ERROR を返すよう GitValidationError に変換する
export function extractRepoName(remoteUrl: string): string {
  let pathPart: string;
  if (remoteUrl.startsWith('git@') && remoteUrl.includes(':')) {
    const segments = remoteUrl.split(':');
    pathPart = segments[segments.length - 1] ?? '';
  } else {
    pathPart = new URL(remoteUrl).pathname;
  }

  const parts = pathPart.split('/');
  const basename = parts[parts.length - 1] ?? '';
  return basename.replace(/\.git$/, '');
}

/**
 * {@link registerIpcHandlers} に注入する依存オブジェクト。
 *
 * @remarks
 * テスト時にモック差し替えが可能な設計。全ハンドラーはこのインターフェースを通じて
 * ストア・Git サービス・パス解決にアクセスする。
 */
export interface IpcHandlerDeps {
  /** リポジトリ・Workspace の永続化ストア */
  store: SquadStore;
  /** Git コマンド操作サービス */
  gitService: GitService;
  /** .code-workspace ファイル操作サービス */
  codeWorkspaceService: CodeWorkspaceService;
  /** パス解決オブジェクト */
  paths: SquadPaths;
}

/**
 * 全 IPC ハンドラーを `ipcMain.handle` に登録する。
 *
 * @remarks
 * アプリ起動時に一度だけ呼び出す。全ハンドラーは `try/catch` + {@link mapErrorToIpcResult}
 * パターンで統一され、例外がレンダラーに漏れることはない。
 *
 * @param deps - 依存オブジェクト（{@link IpcHandlerDeps}）
 */
export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { store, gitService, codeWorkspaceService, paths } = deps;

  // --- リポジトリ操作 ---

  ipcMain.handle(IpcChannels.REPO_LIST, async (): Promise<IpcResult<Repository[]>> => {
    try {
      const repos = await store.getRepositories();
      return successResult(repos);
    } catch (error) {
      return mapErrorToIpcResult(error);
    }
  });

  ipcMain.handle(
    IpcChannels.REPO_GET,
    async (_event, { id }: { id: string }): Promise<IpcResult<Repository>> => {
      try {
        const repo = await store.getRepository(id);
        if (!repo) {
          return notFoundResult('Repository', id);
        }
        return successResult(repo);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.REPO_ADD,
    async (_event, { remoteUrl }: { remoteUrl: string }): Promise<IpcResult<Repository>> => {
      let actualName: string | undefined;
      try {
        const repoName = extractRepoName(remoteUrl);
        actualName = await gitService.cloneBare(remoteUrl, repoName);
        const newRepo = await store.addRepository({ name: actualName, remoteUrl });
        return successResult(newRepo);
      } catch (error) {
        // cloneBare 成功後に addRepository が失敗した場合、Bare Repository をクリーンアップ
        if (actualName) {
          try {
            await gitService.removeBareRepository(actualName);
          } catch {
            // クリーンアップ失敗は無視（ベストエフォート）
          }
        }
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.REPO_REMOVE,
    async (_event, { id }: { id: string }): Promise<IpcResult<null>> => {
      try {
        const repo = await store.getRepository(id);
        if (!repo) {
          return notFoundResult('Repository', id);
        }
        // TODO: このリポジトリを参照している Workspace が存在する場合、削除を拒否するか
        //       カスケード削除を実装する（孤立 Worktree の防止）
        await gitService.removeBareRepository(repo.name);
        await store.removeRepository(id);
        return successResult(null);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.REPO_BRANCHES,
    async (_event, { id }: { id: string }): Promise<IpcResult<string[]>> => {
      try {
        const repo = await store.getRepository(id);
        if (!repo) {
          return notFoundResult('Repository', id);
        }
        const branches = await gitService.getRemoteBranches(repo.name);
        return successResult(branches);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.REPO_FETCH,
    async (_event, { id }: { id: string }): Promise<IpcResult<null>> => {
      try {
        const repo = await store.getRepository(id);
        if (!repo) {
          return notFoundResult('Repository', id);
        }
        await gitService.fetch(repo.name);
        return successResult(null);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  // --- Workspace 操作 ---

  ipcMain.handle(IpcChannels.WORKSPACE_LIST, async (): Promise<IpcResult<Workspace[]>> => {
    try {
      const workspaces = await store.getWorkspaces();
      return successResult(workspaces);
    } catch (error) {
      return mapErrorToIpcResult(error);
    }
  });

  ipcMain.handle(
    IpcChannels.WORKSPACE_GET,
    async (_event, { id }: { id: string }): Promise<IpcResult<Workspace>> => {
      try {
        const ws = await store.getWorkspace(id);
        if (!ws) {
          return notFoundResult('Workspace', id);
        }
        return successResult(ws);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_CREATE,
    async (
      _event,
      {
        name,
        entries,
      }: {
        name: string;
        entries: { repositoryId: string; branch: string; sourceBranch?: string }[];
      },
    ): Promise<IpcResult<Workspace>> => {
      // TODO: セキュリティ強化 — name に ../ や特殊文字が含まれた場合のパストラバーサルを防止するため、
      //       英数字・ハイフン・アンダースコアのみ許可するバリデーションを追加する
      // 1. 各 entry の repositoryId を解決
      const resolvedEntries: ResolvedWorkspaceEntry[] = [];
      for (const entry of entries) {
        const repo = await store.getRepository(entry.repositoryId);
        if (!repo) {
          return notFoundResult('Repository', entry.repositoryId);
        }
        resolvedEntries.push({ repo, branch: entry.branch, sourceBranch: entry.sourceBranch });
      }

      // 作成済み Worktree を追跡（ロールバック用）
      const createdWorktrees: CreatedWorktree[] = [];
      let workspace: Workspace | undefined;

      try {
        // 2. Workspace をストアに登録（suffix 付き名前を取得）
        workspace = await store.addWorkspace({ name, entries });

        // 3. 各エントリに対して Worktree を作成
        for (const resolved of resolvedEntries) {
          await gitService.addWorktree(
            resolved.repo.name,
            workspace.name,
            resolved.branch,
            resolved.sourceBranch,
          );
          createdWorktrees.push({
            repoName: resolved.repo.name,
            workspaceName: workspace.name,
          });
        }

        // 4. .code-workspace ファイルを生成
        const codeWorkspaceEntries = resolvedEntries.map((e) => ({ repoName: e.repo.name }));
        await codeWorkspaceService.generate(workspace.name, codeWorkspaceEntries);

        // 5. VS Code を起動
        const codeWorkspaceFilePath = paths.codeWorkspaceFile(workspace.name);
        try {
          await execFileAsync('code', [codeWorkspaceFilePath]);
        } catch {
          // VS Code 起動失敗は Workspace 作成自体の失敗とはしない
        }

        return successResult(workspace);
      } catch (error) {
        // ロールバック: 作成済み Worktree を逆順で削除
        for (const wt of [...createdWorktrees].reverse()) {
          try {
            await gitService.removeWorktree(wt.repoName, wt.workspaceName);
          } catch {
            // TODO: ロールバック失敗時に console.error でログ出力を追加する（不整合状態のデバッグ用）
          }
        }

        // .code-workspace ファイルが生成済みの場合は削除
        if (workspace) {
          try {
            await codeWorkspaceService.remove(workspace.name);
          } catch {
            // TODO: ロールバック失敗時に console.error でログ出力を追加する
          }

          // ストアから Workspace を削除
          try {
            await store.removeWorkspace(workspace.id);
          } catch {
            // TODO: ロールバック失敗時に console.error でログ出力を追加する
          }
        }

        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_DELETE,
    async (_event, { id }: { id: string }): Promise<IpcResult<null>> => {
      try {
        const ws = await store.getWorkspace(id);
        if (!ws) {
          return notFoundResult('Workspace', id);
        }

        // 各エントリの Worktree を削除（ベストエフォート）
        for (const entry of ws.entries) {
          const repo = await store.getRepository(entry.repositoryId);
          if (repo) {
            try {
              await gitService.removeWorktree(repo.name, ws.name);
            } catch {
              // 一部の Worktree 削除失敗は無視して継続
            }
          }
        }

        // .code-workspace ファイル削除
        try {
          await codeWorkspaceService.remove(ws.name);
        } catch {
          // ベストエフォート
        }

        // Workspace ディレクトリ削除
        try {
          const wsDir = paths.workspaceDir(ws.name);
          await fs.rm(wsDir, { recursive: true, force: true });
        } catch {
          // ベストエフォート
        }

        // ストアから削除
        await store.removeWorkspace(id);
        return successResult(null);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_OPEN,
    async (_event, { id }: { id: string }): Promise<IpcResult<null>> => {
      try {
        const ws = await store.getWorkspace(id);
        if (!ws) {
          return notFoundResult('Workspace', id);
        }
        const codeWorkspaceFilePath = paths.codeWorkspaceFile(ws.name);
        await execFileAsync('code', [codeWorkspaceFilePath]);
        return successResult(null);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );
}
