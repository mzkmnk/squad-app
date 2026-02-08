# Design: ipc_bridge

## 概要

Electron の IPC（Inter-Process Communication）チャネル定義・メインプロセスハンドラー・preload API を実装する。レンダラープロセス（Angular）とメインプロセス（Node.js）間の型安全な通信基盤を構築し、Unit 1（data_model）と Unit 2（git_operations）の機能をフロントエンドに公開する。

セキュリティ要件として `contextIsolation: true` / `nodeIntegration: false` を維持し、全ての Node.js 操作は `contextBridge` 経由の IPC 通信を通じてのみ実行可能とする。

## ドメインモデル

### IPC チャネル設計方針

IPC チャネルは「ドメイン:操作」の命名規則で統一する。型安全性を確保するため、チャネル名・リクエスト型・レスポンス型を一元管理する共有型定義を導入する。

#### チャネル一覧

| チャネル名         | 方向            | 説明                                                      |
| ------------------ | --------------- | --------------------------------------------------------- |
| `repo:list`        | renderer → main | 登録済みリポジトリ一覧取得                                |
| `repo:get`         | renderer → main | ID でリポジトリ取得                                       |
| `repo:add`         | renderer → main | リポジトリ登録（clone --bare + ストア保存）               |
| `repo:remove`      | renderer → main | リポジトリ削除（Bare Repository + ストア削除）            |
| `repo:branches`    | renderer → main | リモートブランチ一覧取得                                  |
| `repo:fetch`       | renderer → main | リモートから最新情報取得                                  |
| `workspace:list`   | renderer → main | Workspace 一覧取得                                        |
| `workspace:get`    | renderer → main | ID で Workspace 取得                                      |
| `workspace:create` | renderer → main | Workspace 作成（Worktree + .code-workspace 生成）         |
| `workspace:delete` | renderer → main | Workspace 削除（Worktree + .code-workspace + ストア削除） |
| `workspace:open`   | renderer → main | Workspace を VS Code で開く                               |

### 値オブジェクト

#### IpcResult\<T\>

- **用途**: 全 IPC レスポンスの統一ラッパー。成功/失敗を明示的に表現する
- **属性**:
  - `success`: `boolean` - 操作の成否
  - `data`: `T` - 成功時のデータ（`success: true` の場合のみ）
  - `error`: `{ code: string; message: string }` - 失敗時のエラー情報（`success: false` の場合のみ）
- **設計理由**: IPC 通信ではメインプロセスの例外がレンダラーに伝播しないため、エラーを明示的にシリアライズして返す必要がある。Discriminated Union パターンにより型安全なエラーハンドリングを実現する。

```typescript
type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

#### エラーコード定義

| コード                      | 説明                                             | 発生元                        |
| --------------------------- | ------------------------------------------------ | ----------------------------- |
| `VALIDATION_ERROR`          | 入力値バリデーション失敗                         | GitValidationError            |
| `REPOSITORY_EXISTS`         | 同名リポジトリが既に存在                         | GitRepositoryExistsError      |
| `GIT_OPERATION_FAILED`      | Git コマンド実行失敗                             | GitOperationError             |
| `NOT_FOUND`                 | 指定された ID のリソースが見つからない           | ストア検索結果                |
| `DUPLICATE_WORKSPACE_ERROR` | 同名 Workspace の重複が3回リトライ後も解決しない | workspace:create リトライ上限 |
| `INTERNAL_ERROR`            | 予期しないエラー                                 | その他の例外                  |

## DBスキーマ

本 Unit は新たなデータスキーマを追加しない。Unit 1 の `SquadStore` と Unit 2 の `GitService` / `CodeWorkspaceService` をそのまま利用する。

## API仕様

### IPC チャネル詳細

#### `repo:list` — リポジトリ一覧取得

**リクエスト**: なし（引数なし）

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "backend",
      "remoteUrl": "https://github.com/org/backend.git",
      "registeredAt": "2026-02-08T12:00:00.000Z"
    }
  ]
}
```

#### `repo:get` — リポジトリ取得

**リクエスト**: `{ id: string }`

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "backend",
    "remoteUrl": "https://github.com/org/backend.git",
    "registeredAt": "2026-02-08T12:00:00.000Z"
  }
}
```

**レスポンス（失敗: NOT_FOUND）**:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Repository not found: <id>" }
}
```

#### `repo:add` — リポジトリ登録

**リクエスト**: `{ remoteUrl: string }`

**処理フロー**:

1. `remoteUrl` からリポジトリ名を抽出（URL 末尾のパスセグメント、`.git` サフィックス除去）
2. `GitService.cloneBare(remoteUrl, repoName)` で Bare Repository をクローン
3. `SquadStore.addRepository({ name: repoName, remoteUrl })` でストアに登録
4. 登録された `Repository` を返す

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "backend",
    "remoteUrl": "https://github.com/org/backend.git",
    "registeredAt": "2026-02-08T12:00:00.000Z"
  }
}
```

**レスポンス（失敗: VALIDATION_ERROR）**:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid remote URL: ..." }
}
```

**レスポンス（失敗: REPOSITORY_EXISTS）**:

```json
{
  "success": false,
  "error": { "code": "REPOSITORY_EXISTS", "message": "Repository 'backend' already exists" }
}
```

#### `repo:remove` — リポジトリ削除

**リクエスト**: `{ id: string }`

**処理フロー**:

1. `SquadStore.getRepository(id)` でリポジトリ情報を取得
2. 見つからない場合は `NOT_FOUND` エラー
3. `GitService.removeBareRepository(repo.name)` で Bare Repository を削除
4. `SquadStore.removeRepository(id)` でストアから削除

**レスポンス（成功）**:

```json
{ "success": true, "data": null }
```

#### `repo:branches` — リモートブランチ一覧取得

**リクエスト**: `{ id: string }`

**処理フロー**:

1. `SquadStore.getRepository(id)` でリポジトリ情報を取得
2. `GitService.getRemoteBranches(repo.name)` でブランチ一覧を取得

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": ["main", "develop", "feature/payment"]
}
```

#### `repo:fetch` — リモート情報更新

**リクエスト**: `{ id: string }`

**処理フロー**:

1. `SquadStore.getRepository(id)` でリポジトリ情報を取得
2. `GitService.fetch(repo.name)` で fetch 実行

**レスポンス（成功）**:

```json
{ "success": true, "data": null }
```

#### `workspace:list` — Workspace 一覧取得

**リクエスト**: なし（引数なし）

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "feature-payment",
      "entries": [
        { "repositoryId": "550e8400-...", "branch": "feature/payment" },
        { "repositoryId": "550e8400-...", "branch": "main" }
      ],
      "createdAt": "2026-02-08T12:30:00.000Z",
      "updatedAt": "2026-02-08T12:30:00.000Z"
    }
  ]
}
```

#### `workspace:get` — Workspace 取得

**リクエスト**: `{ id: string }`

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": { "id": "...", "name": "feature-payment", "entries": [...], "createdAt": "...", "updatedAt": "..." }
}
```

**レスポンス（失敗: NOT_FOUND）**:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Workspace not found: <id>" }
}
```

#### `workspace:create` — Workspace 作成

**リクエスト**:

```typescript
{
  name: string;
  entries: {
    repositoryId: string;
    branch: string;
  }
  [];
}
```

**処理フロー**:

1. 各 `entry.repositoryId` に対して `SquadStore.getRepository()` でリポジトリ情報を取得
2. 見つからないリポジトリがあれば `NOT_FOUND` エラー
3. 各エントリに対して `GitService.addWorktree(repo.name, workspaceName, entry.branch)` で Worktree 作成
4. `CodeWorkspaceService.generate(workspaceName, entries)` で `.code-workspace` ファイル生成
5. `SquadStore.addWorkspace({ name, entries })` でストアに登録
6. VS Code を起動（`code` コマンドで `.code-workspace` を開く）
7. 登録された `Workspace` を返す

**同名 Workspace・同一ブランチ Worktree の重複対応**:

- suffix の生成・付与は `SquadStore.addWorkspace` と `GitService.addWorktree` の内部責務
- IPC ハンドラーはユーザー入力の生の名前をそのまま渡すだけ
- 各メソッドが独立して UUID v4 先頭8文字の suffix を生成し、重複時は最大3回リトライする
- 3回リトライしても解決しない場合はエラーが返る

**レスポンス（失敗: 重複エラー — 3回リトライ後）**:

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_WORKSPACE_ERROR",
    "message": "Failed to create workspace 'feature-payment': duplicate not resolved after 3 retries"
  }
}
```

**レスポンス（失敗: ブランチ派生エラー）**:

```json
{
  "success": false,
  "error": {
    "code": "GIT_OPERATION_FAILED",
    "message": "Failed to create branch 'feature/payment-a3f2b1c9' from 'feature/payment'"
  }
}
```

**エラー時のロールバック**:

- Worktree 作成途中でエラーが発生した場合、作成済みの Worktree を `removeWorktree` で削除する
- `.code-workspace` ファイルが生成済みの場合は削除する
- ストアへの登録は最後に行うため、ロールバック対象外

**レスポンス（成功）**:

```json
{
  "success": true,
  "data": {
    "id": "660e8400-...",
    "name": "feature-payment",
    "entries": [...],
    "createdAt": "2026-02-08T12:30:00.000Z",
    "updatedAt": "2026-02-08T12:30:00.000Z"
  }
}
```

#### `workspace:delete` — Workspace 削除

**リクエスト**: `{ id: string }`

**処理フロー**:

1. `SquadStore.getWorkspace(id)` で Workspace 情報を取得
2. 見つからない場合は `NOT_FOUND` エラー
3. 各エントリに対して:
   a. `SquadStore.getRepository(entry.repositoryId)` でリポジトリ名を解決
   b. `GitService.removeWorktree(repo.name, workspace.name)` で Worktree 削除
4. `CodeWorkspaceService.remove(workspace.name)` で `.code-workspace` ファイル削除
5. Workspace ディレクトリを削除（`fs.rm(workspaceDir, { recursive: true, force: true })`）
6. `SquadStore.removeWorkspace(id)` でストアから削除

**レスポンス（成功）**:

```json
{ "success": true, "data": null }
```

#### `workspace:open` — Workspace を VS Code で開く

**リクエスト**: `{ id: string }`

**処理フロー**:

1. `SquadStore.getWorkspace(id)` で Workspace 情報を取得
2. 見つからない場合は `NOT_FOUND` エラー
3. `.code-workspace` ファイルのパスを `SquadPaths.codeWorkspaceFile(workspace.name)` で解決
4. `child_process.execFile('code', [codeWorkspaceFilePath])` で VS Code を起動

**レスポンス（成功）**:

```json
{ "success": true, "data": null }
```

## コンポーネント構成

```
electron/
├── ipc/
│   ├── ipc-channels.ts           # チャネル名定数・型定義
│   ├── ipc-handlers.ts           # メインプロセス側ハンドラー登録
│   ├── ipc-handlers.spec.ts      # ハンドラー ユニットテスト
│   └── ipc-error-mapper.ts       # エラー → IpcResult 変換ユーティリティ
├── types/
│   └── models.ts                 # 既存（変更なし）
├── store/
│   ├── squad-paths.ts            # 既存（変更なし）
│   └── squad-store.ts            # 既存（変更なし）
├── git/
│   ├── git-service.ts            # 既存（変更なし）
│   ├── code-workspace-service.ts # 既存（変更なし）
│   ├── git-errors.ts             # 既存（変更なし）
│   └── git-validation.ts         # 既存（変更なし）
├── main.ts                       # 変更: IPC ハンドラー登録を追加
├── preload.ts                    # 変更: electronAPI を拡張
└── electron.d.ts                 # 変更: ElectronAPI 型定義を拡張
```

### ファイル詳細

#### `electron/ipc/ipc-channels.ts` — チャネル名定数・型定義

IPC チャネル名を定数として一元管理し、リクエスト/レスポンスの型マッピングを提供する。

```typescript
// --- チャネル名定数 ---

export const IpcChannels = {
  // リポジトリ操作
  REPO_LIST: 'repo:list',
  REPO_GET: 'repo:get',
  REPO_ADD: 'repo:add',
  REPO_REMOVE: 'repo:remove',
  REPO_BRANCHES: 'repo:branches',
  REPO_FETCH: 'repo:fetch',

  // Workspace 操作
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_OPEN: 'workspace:open',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// --- レスポンスラッパー ---

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// --- エラーコード ---

export const IpcErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REPOSITORY_EXISTS: 'REPOSITORY_EXISTS',
  GIT_OPERATION_FAILED: 'GIT_OPERATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_WORKSPACE_ERROR: 'DUPLICATE_WORKSPACE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

// --- リクエスト型 ---

export interface RepoGetRequest {
  id: string;
}

export interface RepoAddRequest {
  remoteUrl: string;
}

export interface RepoRemoveRequest {
  id: string;
}

export interface RepoBranchesRequest {
  id: string;
}

export interface RepoFetchRequest {
  id: string;
}

export interface WorkspaceGetRequest {
  id: string;
}

export interface WorkspaceCreateRequest {
  name: string;
  entries: { repositoryId: string; branch: string }[];
}

export interface WorkspaceDeleteRequest {
  id: string;
}

export interface WorkspaceOpenRequest {
  id: string;
}
```

**設計ポイント**:

- チャネル名を定数化することで、メインプロセス（`ipcMain.handle`）と preload（`ipcRenderer.invoke`）で同じ定数を参照し、タイポを防止する。
- `IpcResult<T>` の Discriminated Union により、レンダラー側で `if (result.success)` による型の絞り込みが可能。

#### `electron/ipc/ipc-error-mapper.ts` — エラー変換ユーティリティ

メインプロセスで発生した例外を `IpcResult` の失敗形式に変換する。

```typescript
import {
  GitValidationError,
  GitOperationError,
  GitRepositoryExistsError,
} from '../git/git-errors.js';
import { IpcErrorCode, type IpcResult } from './ipc-channels.js';

/**
 * 例外を IpcResult の失敗形式に変換する。
 *
 * エラー種別に応じて適切な IpcErrorCode をマッピングする。
 * 未知のエラーは INTERNAL_ERROR として処理する。
 */
export function mapErrorToIpcResult(error: unknown): IpcResult<never> {
  if (error instanceof GitValidationError) {
    return {
      success: false,
      error: { code: IpcErrorCode.VALIDATION_ERROR, message: error.message },
    };
  }

  if (error instanceof GitRepositoryExistsError) {
    return {
      success: false,
      error: { code: IpcErrorCode.REPOSITORY_EXISTS, message: error.message },
    };
  }

  if (error instanceof GitOperationError) {
    return {
      success: false,
      error: {
        code: IpcErrorCode.GIT_OPERATION_FAILED,
        message: error.stderr.length > 0 ? error.stderr : error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    success: false,
    error: { code: IpcErrorCode.INTERNAL_ERROR, message },
  };
}

/**
 * NOT_FOUND エラーの IpcResult を生成する。
 */
export function notFoundResult(resourceType: string, id: string): IpcResult<never> {
  return {
    success: false,
    error: {
      code: IpcErrorCode.NOT_FOUND,
      message: `${resourceType} not found: ${id}`,
    },
  };
}

/**
 * 成功の IpcResult を生成する。
 */
export function successResult<T>(data: T): IpcResult<T> {
  return { success: true, data };
}
```

**設計ポイント**:

- ハンドラー内の `try/catch` ブロックで `mapErrorToIpcResult` を呼ぶだけでエラー変換が完了する。
- `GitOperationError` の場合は `stderr` を優先的にメッセージとして返す（ユーザーにとって有用な情報が含まれるため）。
- `notFoundResult` と `successResult` はヘルパーとして提供し、ハンドラーコードの冗長性を削減する。

#### `electron/ipc/ipc-handlers.ts` — メインプロセス側ハンドラー

`ipcMain.handle` で各チャネルのハンドラーを登録する。全ハンドラーは `IpcResult<T>` を返す。

```typescript
import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { IpcChannels, type IpcResult } from './ipc-channels.js';
import { mapErrorToIpcResult, notFoundResult, successResult } from './ipc-error-mapper.js';
import type { SquadStore } from '../store/squad-store.js';
import type { GitService } from '../git/git-service.js';
import type { CodeWorkspaceService } from '../git/code-workspace-service.js';
import type { SquadPaths } from '../store/squad-paths.js';
import type { Repository } from '../types/models.js';

const execFileAsync = promisify(execFile);

/**
 * URL からリポジトリ名を抽出する。
 *
 * 例:
 * - `https://github.com/org/backend.git` → `backend`
 * - `git@github.com:org/frontend.git` → `frontend`
 * - `https://github.com/org/repo` → `repo`
 */
export function extractRepoName(remoteUrl: string): string {
  // SSH 形式: git@host:path の場合、`:` 以降をパスとして扱う
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

export interface IpcHandlerDeps {
  store: SquadStore;
  gitService: GitService;
  codeWorkspaceService: CodeWorkspaceService;
  paths: SquadPaths;
}

/**
 * 全 IPC ハンドラーを登録する。
 *
 * アプリ起動時に一度だけ呼び出す。
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

  ipcMain.handle(IpcChannels.REPO_GET, async (_event, { id }) => {
    // ... 省略（設計パターンは REPO_LIST と同様）
  });

  ipcMain.handle(IpcChannels.REPO_ADD, async (_event, { remoteUrl }) => {
    // 1. URL からリポジトリ名を抽出
    // 2. GitService.cloneBare() で Bare Repository をクローン
    // 3. SquadStore.addRepository() でストアに登録
    // 4. 成功時: successResult(newRepo)
    // 5. 失敗時: mapErrorToIpcResult(error)
  });

  ipcMain.handle(IpcChannels.REPO_REMOVE, async (_event, { id }) => {
    // 1. SquadStore.getRepository(id) で取得
    // 2. 見つからない場合: notFoundResult('Repository', id)
    // 3. GitService.removeBareRepository(repo.name)
    // 4. SquadStore.removeRepository(id)
  });

  ipcMain.handle(IpcChannels.REPO_BRANCHES, async (_event, { id }) => {
    // 1. SquadStore.getRepository(id) で取得
    // 2. GitService.getRemoteBranches(repo.name)
  });

  ipcMain.handle(IpcChannels.REPO_FETCH, async (_event, { id }) => {
    // 1. SquadStore.getRepository(id) で取得
    // 2. GitService.fetch(repo.name)
  });

  // --- Workspace 操作 ---

  ipcMain.handle(IpcChannels.WORKSPACE_LIST, async () => {
    // SquadStore.getWorkspaces()
  });

  ipcMain.handle(IpcChannels.WORKSPACE_GET, async (_event, { id }) => {
    // SquadStore.getWorkspace(id)
  });

  ipcMain.handle(IpcChannels.WORKSPACE_CREATE, async (_event, { name, entries }) => {
    // 1. 各 entry の repositoryId を解決
    // 2. 各 entry に対して GitService.addWorktree()
    // 3. CodeWorkspaceService.generate()
    // 4. SquadStore.addWorkspace()
    // 5. VS Code 起動
    // ※ エラー時ロールバック処理あり
  });

  ipcMain.handle(IpcChannels.WORKSPACE_DELETE, async (_event, { id }) => {
    // 1. SquadStore.getWorkspace(id) で取得
    // 2. 各 entry の Worktree を削除
    // 3. .code-workspace ファイル削除
    // 4. Workspace ディレクトリ削除
    // 5. SquadStore.removeWorkspace(id)
  });

  ipcMain.handle(IpcChannels.WORKSPACE_OPEN, async (_event, { id }) => {
    // 1. SquadStore.getWorkspace(id) で取得
    // 2. execFile('code', [codeWorkspaceFilePath])
  });
}
```

**設計ポイント**:

- 依存性注入（`IpcHandlerDeps`）により、テスト時にモック差し替えが可能。
- 全ハンドラーが `try/catch` + `mapErrorToIpcResult` パターンで統一され、例外がレンダラーに漏れない。
- `extractRepoName` はユーティリティ関数として export し、単体テスト可能にする。
- `workspace:create` のロールバック処理は、作成済み Worktree のリストを保持し、エラー発生時に逆順で削除する。

#### `electron/main.ts` — 変更内容

既存の `main.ts` に IPC ハンドラー登録とサービス初期化を追加する。

```typescript
// 追加する import
import { SquadStore } from './store/squad-store.js';
import { createSquadPaths } from './store/squad-paths.js';
import { GitService } from './git/git-service.js';
import { CodeWorkspaceService } from './git/code-workspace-service.js';
import { registerIpcHandlers } from './ipc/ipc-handlers.js';

// app.on('ready', ...) 内で以下を追加:

// 1. サービス初期化
const paths = createSquadPaths();
const store = new SquadStore();
await store.initialize();
const gitService = new GitService(paths);
const codeWorkspaceService = new CodeWorkspaceService(paths);

// 2. IPC ハンドラー登録
registerIpcHandlers({ store, gitService, codeWorkspaceService, paths });

// 3. 既存の ping ハンドラーは削除（ipc-handlers.ts に統合しても良い）
```

**変更方針**:

- `createWindow` を `async` 関数に変更し、`store.initialize()` を `await` する。
- サービスインスタンスはモジュールスコープで保持し、アプリのライフサイクル全体で共有する。
- 既存の `ipcMain.handle('ping', ...)` は開発用のため、当面残しても良い。

#### `electron/preload.ts` — 変更内容

`contextBridge.exposeInMainWorld` で公開する API を拡張する。

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './ipc/ipc-channels.js';

contextBridge.exposeInMainWorld('electronAPI', {
  // 既存
  ping: () => ipcRenderer.invoke('ping'),

  // --- リポジトリ操作 ---
  getRepositories: () => ipcRenderer.invoke(IpcChannels.REPO_LIST),

  getRepository: (id: string) => ipcRenderer.invoke(IpcChannels.REPO_GET, { id }),

  addRepository: (remoteUrl: string) => ipcRenderer.invoke(IpcChannels.REPO_ADD, { remoteUrl }),

  removeRepository: (id: string) => ipcRenderer.invoke(IpcChannels.REPO_REMOVE, { id }),

  getRemoteBranches: (repositoryId: string) =>
    ipcRenderer.invoke(IpcChannels.REPO_BRANCHES, { id: repositoryId }),

  fetchRepository: (repositoryId: string) =>
    ipcRenderer.invoke(IpcChannels.REPO_FETCH, { id: repositoryId }),

  // --- Workspace 操作 ---
  getWorkspaces: () => ipcRenderer.invoke(IpcChannels.WORKSPACE_LIST),

  getWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_GET, { id }),

  createWorkspace: (name: string, entries: { repositoryId: string; branch: string }[]) =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_CREATE, { name, entries }),

  deleteWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_DELETE, { id }),

  openWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_OPEN, { id }),
});
```

**設計ポイント**:

- preload スクリプトは引数を受け取り、チャネル名と共にオブジェクトとして `ipcRenderer.invoke` に渡す。
- レンダラー側は `window.electronAPI.addRepository(url)` のようにメソッド呼び出しするだけで IPC 通信が完了する。
- `IpcChannels` 定数を import することで、チャネル名のタイポを防止する。

**注意**: preload スクリプトは Electron のサンドボックス環境で実行されるため、`electron/ipc/ipc-channels.ts` を直接 import できるかはビルド構成に依存する。import が不可能な場合は、チャネル名の文字列リテラルを直接使用し、型定義のみ `electron.d.ts` で管理する代替案を採用する。

#### `electron/electron.d.ts` — 変更内容

`ElectronAPI` インターフェースを拡張し、全 IPC メソッドの型定義を追加する。

```typescript
import type { Repository, Workspace } from './types/models.js';

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface ElectronAPI {
  ping: () => Promise<string>;

  // --- リポジトリ操作 ---
  getRepositories: () => Promise<IpcResult<Repository[]>>;
  getRepository: (id: string) => Promise<IpcResult<Repository>>;
  addRepository: (remoteUrl: string) => Promise<IpcResult<Repository>>;
  removeRepository: (id: string) => Promise<IpcResult<null>>;
  getRemoteBranches: (repositoryId: string) => Promise<IpcResult<string[]>>;
  fetchRepository: (repositoryId: string) => Promise<IpcResult<null>>;

  // --- Workspace 操作 ---
  getWorkspaces: () => Promise<IpcResult<Workspace[]>>;
  getWorkspace: (id: string) => Promise<IpcResult<Workspace>>;
  createWorkspace: (
    name: string,
    entries: { repositoryId: string; branch: string }[],
  ) => Promise<IpcResult<Workspace>>;
  deleteWorkspace: (id: string) => Promise<IpcResult<null>>;
  openWorkspace: (id: string) => Promise<IpcResult<null>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**設計ポイント**:

- `IpcResult<T>` を `electron.d.ts` にも定義することで、Angular 側（レンダラー）から型安全に IPC レスポンスを扱える。
- `tsconfig.app.json` の `include` に `electron/electron.d.ts` が既に含まれているため、Angular コンポーネントから `window.electronAPI` の型補完が効く。
- `Repository` と `Workspace` の型は `electron/types/models.ts` から import し、型の二重定義を避ける。

## preload スクリプトのビルド戦略

### 課題

Electron の preload スクリプトはサンドボックス環境で実行され、通常の Node.js モジュール解決とは異なる制約がある。`electron/ipc/ipc-channels.ts` を preload から直接 import すると、ビルド時にバンドルが必要になる可能性がある。

### 採用方針: チャネル名文字列リテラル + 型定義分離

preload スクリプトでは `IpcChannels` 定数を import せず、チャネル名を文字列リテラルとして直接記述する。型安全性は `electron.d.ts` の `ElectronAPI` インターフェースで担保する。

**理由**:

- preload スクリプトのビルド構成を複雑化させない（現在は `tsc` のみでビルド）
- チャネル名の一致は `ipc-handlers.spec.ts` のテストで検証する
- メインプロセス側（`ipc-handlers.ts`）では `IpcChannels` 定数を使用し、ハンドラー登録の正確性を保証する

**代替案（将来検討）**:

- esbuild / Vite で preload スクリプトをバンドルし、`IpcChannels` を直接 import 可能にする
- この場合、`electron/tsconfig.json` のビルド構成変更が必要

## テスト計画

### テスト環境の方針

- `ipc-handlers.spec.ts`: `SquadStore`, `GitService`, `CodeWorkspaceService` をモック化した単体テスト。`ipcMain` はモック不要（ハンドラー関数を直接テストする）。
- `ipc-error-mapper` のテスト: `ipc-handlers.spec.ts` 内に含める（小規模なユーティリティのため独立ファイル不要）。
- `extractRepoName` のテスト: `ipc-handlers.spec.ts` 内に含める。
- テスト実行: `pnpm exec vitest run electron/ipc/`

### テスト方針: ハンドラーの直接テスト

`ipcMain.handle` に渡すコールバック関数を直接テストする。`ipcMain` 自体のモックは不要。

```typescript
// テスト方針のイメージ
// registerIpcHandlers 内のハンドラーロジックを、
// テスト可能な関数として抽出するか、
// ipcMain.handle のモックを通じてコールバックを取得してテストする。

// 推奨: ハンドラーロジックを純粋関数として抽出
// registerIpcHandlers は薄いラッパーとして ipcMain.handle に登録するだけ
```

**テスト容易性のための設計**:

- 各ハンドラーのビジネスロジックは `IpcHandlerDeps` に依存する純粋な async 関数として実装可能。
- `registerIpcHandlers` は各関数を `ipcMain.handle` に登録するだけの薄いラッパー。
- テスト時は `IpcHandlerDeps` のモックを注入し、ハンドラー関数を直接呼び出す。

### ユニットテスト

#### extractRepoName のテスト

- [ ] HTTPS URL（`https://github.com/org/backend.git`）から `backend` を抽出する
- [ ] HTTPS URL（`.git` なし: `https://github.com/org/backend`）から `backend` を抽出する
- [ ] SSH URL（`git@github.com:org/frontend.git`）から `frontend` を抽出する
- [ ] 深いパス（`https://github.com/org/sub/repo.git`）から `repo` を抽出する

#### ipc-error-mapper のテスト

- [ ] `GitValidationError` が `VALIDATION_ERROR` コードにマッピングされる
- [ ] `GitRepositoryExistsError` が `REPOSITORY_EXISTS` コードにマッピングされる
- [ ] `GitOperationError` が `GIT_OPERATION_FAILED` コードにマッピングされる
- [ ] `GitOperationError` で `stderr` が空の場合は `message` がフォールバックされる
- [ ] 未知の `Error` が `INTERNAL_ERROR` コードにマッピングされる
- [ ] `Error` でないオブジェクトが `INTERNAL_ERROR` + `'Unknown error'` にマッピングされる
- [ ] `notFoundResult` が正しい形式の `IpcResult` を返す
- [ ] `successResult` が正しい形式の `IpcResult` を返す

#### repo:list ハンドラーのテスト

- [ ] `SquadStore.getRepositories()` の結果が `IpcResult` でラップされて返る
- [ ] ストアがエラーをスローした場合に `INTERNAL_ERROR` が返る

#### repo:get ハンドラーのテスト

- [ ] 存在する ID で `Repository` が返る
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る

#### repo:add ハンドラーのテスト

- [ ] 正常系: `cloneBare` → `addRepository` の順で呼ばれ、登録結果が返る
- [ ] URL からリポジトリ名が正しく抽出される
- [ ] `cloneBare` が `GitValidationError` をスローした場合に `VALIDATION_ERROR` が返る
- [ ] `cloneBare` が `GitRepositoryExistsError` をスローした場合に `REPOSITORY_EXISTS` が返る
- [ ] `cloneBare` が `GitOperationError` をスローした場合に `GIT_OPERATION_FAILED` が返る
- [ ] `cloneBare` 成功後に `addRepository` が失敗した場合、Bare Repository のクリーンアップが行われる

#### repo:remove ハンドラーのテスト

- [ ] 存在するリポジトリが正常に削除される（`removeBareRepository` + `removeRepository` が呼ばれる）
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る

#### repo:branches ハンドラーのテスト

- [ ] 存在するリポジトリのブランチ一覧が返る
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る
- [ ] `getRemoteBranches` がエラーをスローした場合に `GIT_OPERATION_FAILED` が返る

#### repo:fetch ハンドラーのテスト

- [ ] 存在するリポジトリの fetch が成功する
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る

#### workspace:list ハンドラーのテスト

- [ ] `SquadStore.getWorkspaces()` の結果が `IpcResult` でラップされて返る

#### workspace:get ハンドラーのテスト

- [ ] 存在する ID で `Workspace` が返る
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る

#### workspace:create ハンドラーのテスト

- [ ] 正常系: 全 Worktree 作成 → `.code-workspace` 生成 → ストア登録 → VS Code 起動の順で実行される
- [ ] 各 `entry.repositoryId` が正しく解決される
- [ ] 存在しない `repositoryId` が含まれる場合に `NOT_FOUND` エラーが返る
- [ ] 2番目の Worktree 作成でエラーが発生した場合、1番目の Worktree がロールバック削除される
- [ ] ロールバック中のエラーは無視される（ベストエフォート）
- [ ] `addWorktree` が `GitValidationError` をスローした場合に `VALIDATION_ERROR` が返る

#### workspace:delete ハンドラーのテスト

- [ ] 正常系: 全 Worktree 削除 → `.code-workspace` 削除 → ディレクトリ削除 → ストア削除の順で実行される
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る
- [ ] 一部の Worktree 削除が失敗しても処理が継続される（ベストエフォート削除）

#### workspace:open ハンドラーのテスト

- [ ] 存在する Workspace の `.code-workspace` ファイルパスで `code` コマンドが実行される
- [ ] 存在しない ID で `NOT_FOUND` エラーが返る
- [ ] `code` コマンドが失敗した場合に `GIT_OPERATION_FAILED` が返る

### チャネル名一致テスト

- [ ] `IpcChannels` の全チャネル名に対して `ipcMain.handle` が登録されている（登録漏れ防止）
- [ ] preload スクリプトの文字列リテラルと `IpcChannels` 定数が一致する（手動確認 or スナップショットテスト）

## 非機能要件

### パフォーマンス

- IPC 通信のオーバーヘッド: Electron の IPC は同一マシン内のプロセス間通信であり、レイテンシは無視できるレベル（< 1ms）
- `workspace:create` の全体処理時間: 5秒以内（Unit 仕様の AC3 に準拠。ボトルネックは `git worktree add` のディスク I/O）
- `repo:fetch` はバックグラウンド非同期実行を前提とし、UI をブロックしない（呼び出し側の Angular サービスで制御）

### セキュリティ

- `contextIsolation: true` / `nodeIntegration: false` を維持（既存の `main.ts` 設定を変更しない）
- preload スクリプトは `contextBridge.exposeInMainWorld` のみを使用し、`ipcRenderer` を直接レンダラーに公開しない
- 全ての IPC ハンドラーは入力値を信頼せず、`SquadStore` / `GitService` 内のバリデーションに委譲する
- `workspace:open` で実行する `code` コマンドのパスは `SquadPaths` から生成された安全なパスのみを使用する
- IPC チャネルのホワイトリスト: preload で公開するチャネルは `IpcChannels` に定義されたもののみ。任意のチャネル名を受け付ける汎用 API は提供しない

### 監視・ログ

- 本 Unit ではロガーは導入しない（Unit 2 と同様、将来の拡張ポイントとして認識）
- エラー発生時は `IpcResult` の `error` フィールドにエラー情報を格納し、レンダラー側でユーザーに表示可能にする
- `GitOperationError` の `stderr` はデバッグ情報として `IpcResult.error.message` に含める
