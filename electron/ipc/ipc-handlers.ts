import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { IpcChannels } from './ipc-channels.js';
import type {
  RepoAddRequest,
  RepoGetRequest,
  RepoRemoveRequest,
  RepoBranchesRequest,
  RepoFetchRequest,
  WorkspaceGetRequest,
  WorkspaceCreateRequest,
  WorkspaceDeleteRequest,
  WorkspaceOpenRequest,
  WorkspaceAddEntryRequest,
  WorkspaceRemoveEntryRequest,
  SettingsUpdateRequest,
} from './ipc-channels.js';
import type { IpcResult } from '../types/ipc-result.js';
import { mapErrorToIpcResult, notFoundResult, successResult } from './ipc-error-mapper.js';
import type { SquadStore } from '../store/squad-store.js';
import type { GitService } from '../git/git-service.js';
import type { CodeWorkspaceService } from '../git/code-workspace-service.js';
import type { SquadPaths } from '../store/squad-paths.js';
import type { Repository, Workspace, Settings } from '../types/models.js';
import { settingsSchema } from '../types/models.js';
import { IpcErrorCode } from '../types/ipc-error-code.js';
import type { IdeDetectionResult } from '../ide/ide-detector.js';
import { getIdeCommand, IDE_DEFINITIONS } from '../ide/ide-detector.js';

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
  /** IDE 検出サービス */
  ideDetector: {
    detectInstalledIdes: () => Promise<IdeDetectionResult[]>;
  };
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
    async (_event, { id }: RepoGetRequest): Promise<IpcResult<Repository>> => {
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
    async (_event, { remoteUrl }: RepoAddRequest): Promise<IpcResult<Repository>> => {
      let actualName: string | undefined;
      try {
        const repoName = extractRepoName(remoteUrl);
        actualName = await gitService.cloneBare(remoteUrl, repoName);
        const newRepo = await store.addRepository({
          name: actualName,
          displayName: repoName,
          remoteUrl,
        });
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
    async (_event, { id }: RepoRemoveRequest): Promise<IpcResult<null>> => {
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
    async (_event, { id }: RepoBranchesRequest): Promise<IpcResult<string[]>> => {
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
    async (_event, { id }: RepoFetchRequest): Promise<IpcResult<null>> => {
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
    async (_event, { id }: WorkspaceGetRequest): Promise<IpcResult<Workspace>> => {
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
    async (_event, { name, entries }: WorkspaceCreateRequest): Promise<IpcResult<Workspace>> => {
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
    async (_event, { id }: WorkspaceDeleteRequest): Promise<IpcResult<null>> => {
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
    async (_event, { id }: WorkspaceOpenRequest): Promise<IpcResult<null>> => {
      try {
        const ws = await store.getWorkspace(id);
        if (!ws) {
          return notFoundResult('Workspace', id);
        }
        const codeWorkspaceFilePath = paths.codeWorkspaceFile(ws.name);

        // 1. 設定から選択された IDE を取得
        const settings = await store.getSettings();
        const command = getIdeCommand(settings.selectedIde);
        const definition = IDE_DEFINITIONS.find((d) => d.id === settings.selectedIde);
        const displayName = definition?.displayName ?? settings.selectedIde;

        // 2. IDE コマンドの存在チェック
        if (!command) {
          return {
            success: false,
            error: { code: IpcErrorCode.IDE_NOT_FOUND, message: `${displayName} is not installed` },
          };
        }

        // 3. which で IDE のインストール確認
        try {
          await execFileAsync('which', [command]);
        } catch {
          return {
            success: false,
            error: { code: IpcErrorCode.IDE_NOT_FOUND, message: `${displayName} is not installed` },
          };
        }

        // 4. IDE 起動
        try {
          await execFileAsync(command, [codeWorkspaceFilePath]);
        } catch {
          return {
            success: false,
            error: {
              code: IpcErrorCode.IDE_LAUNCH_FAILED,
              message: `Failed to launch ${displayName}`,
            },
          };
        }

        return successResult(null);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  // --- Workspace エントリ操作 ---

  ipcMain.handle(
    IpcChannels.WORKSPACE_ADD_ENTRY,
    async (_event, { id, entries }: WorkspaceAddEntryRequest): Promise<IpcResult<Workspace>> => {
      // 1. Workspace 存在確認
      const ws = await store.getWorkspace(id);
      if (!ws) {
        return notFoundResult('Workspace', id);
      }

      // 2. 各エントリの Repository 存在確認
      const resolvedEntries: ResolvedWorkspaceEntry[] = [];
      for (const entry of entries) {
        const repo = await store.getRepository(entry.repositoryId);
        if (!repo) {
          return notFoundResult('Repository', entry.repositoryId);
        }
        resolvedEntries.push({ repo, branch: entry.branch, sourceBranch: entry.sourceBranch });
      }

      // 3. 重複チェック
      const existingRepoIds = new Set(ws.entries.map((e) => e.repositoryId));
      for (const entry of entries) {
        if (existingRepoIds.has(entry.repositoryId)) {
          return {
            success: false,
            error: {
              code: IpcErrorCode.DUPLICATE_ENTRY,
              message: `Entry for repository already exists: ${entry.repositoryId}`,
            },
          };
        }
      }

      const createdWorktrees: CreatedWorktree[] = [];
      const originalEntries = [...ws.entries];

      try {
        // 4. 各エントリに対して fetch → Worktree 作成
        for (const resolved of resolvedEntries) {
          await gitService.fetch(resolved.repo.name);
          await gitService.addWorktree(
            resolved.repo.name,
            ws.name,
            resolved.branch,
            resolved.sourceBranch,
          );
          createdWorktrees.push({
            repoName: resolved.repo.name,
            workspaceName: ws.name,
          });
        }

        // 5. ストア更新
        const newEntries = entries.map((e) => ({
          repositoryId: e.repositoryId,
          branch: e.branch,
        }));
        const updated = await store.updateWorkspace(id, {
          entries: [...originalEntries, ...newEntries],
        });

        if (!updated) {
          return notFoundResult('Workspace', id);
        }

        // 6. .code-workspace 再生成
        try {
          const allResolvedEntries: { repoName: string }[] = [];
          for (const entry of updated.entries) {
            const repo = await store.getRepository(entry.repositoryId);
            if (repo) {
              allResolvedEntries.push({ repoName: repo.name });
            }
          }
          await codeWorkspaceService.generate(ws.name, allResolvedEntries);
        } catch (error) {
          // .code-workspace 再生成失敗時はストアを元に戻す
          await store.updateWorkspace(id, { entries: originalEntries });
          throw error;
        }

        return successResult(updated);
      } catch (error) {
        // ロールバック: 作成済み Worktree を逆順で削除
        for (const wt of [...createdWorktrees].reverse()) {
          try {
            await gitService.removeWorktree(wt.repoName, wt.workspaceName);
          } catch {
            // ベストエフォート
          }
        }
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_REMOVE_ENTRY,
    async (
      _event,
      { id, repositoryIds }: WorkspaceRemoveEntryRequest,
    ): Promise<IpcResult<Workspace>> => {
      try {
        // 1. Workspace 存在確認
        const ws = await store.getWorkspace(id);
        if (!ws) {
          return notFoundResult('Workspace', id);
        }

        // 2. 削除対象の検証
        const existingRepoIds = new Set(ws.entries.map((e) => e.repositoryId));
        for (const repoId of repositoryIds) {
          if (!existingRepoIds.has(repoId)) {
            return {
              success: false,
              error: {
                code: IpcErrorCode.VALIDATION_ERROR,
                message: `Entry for repository not found: ${repoId}`,
              },
            };
          }
        }

        // 3. 各削除対象エントリの Worktree 削除（ベストエフォート）
        for (const repoId of repositoryIds) {
          const repo = await store.getRepository(repoId);
          if (repo) {
            try {
              await gitService.removeWorktree(repo.name, ws.name);
            } catch {
              // ベストエフォート
            }
          }
        }

        // 4. ストア更新
        const removeSet = new Set(repositoryIds);
        const remaining = ws.entries.filter((e) => !removeSet.has(e.repositoryId));
        const updated = await store.updateWorkspace(id, { entries: remaining });

        if (!updated) {
          return notFoundResult('Workspace', id);
        }

        // 5. .code-workspace 再生成
        const remainingResolved: { repoName: string }[] = [];
        for (const entry of remaining) {
          const repo = await store.getRepository(entry.repositoryId);
          if (repo) {
            remainingResolved.push({ repoName: repo.name });
          }
        }
        await codeWorkspaceService.generate(ws.name, remainingResolved);

        return successResult(updated);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  // --- 設定操作 ---

  ipcMain.handle(IpcChannels.SETTINGS_GET, async (): Promise<IpcResult<Settings>> => {
    try {
      const settings = await store.getSettings();
      return successResult(settings);
    } catch (error) {
      return mapErrorToIpcResult(error);
    }
  });

  ipcMain.handle(
    IpcChannels.SETTINGS_UPDATE,
    async (_event, { settings }: SettingsUpdateRequest): Promise<IpcResult<Settings>> => {
      try {
        const parsed = settingsSchema.safeParse(settings);
        if (!parsed.success) {
          return {
            success: false,
            error: {
              code: IpcErrorCode.VALIDATION_ERROR,
              message: parsed.error.issues.map((i) => i.message).join(', '),
            },
          };
        }
        const updated = await store.updateSettings(parsed.data);
        return successResult(updated);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.SETTINGS_DETECT_IDES,
    async (): Promise<IpcResult<IdeDetectionResult[]>> => {
      try {
        const results = await deps.ideDetector.detectInstalledIdes();
        return successResult(results);
      } catch (error) {
        return mapErrorToIpcResult(error);
      }
    },
  );
}
