# Reverse Engineering Analysis — workspace-edit

## 1. 既存アーキテクチャ概要

### 通信フロー

```
Angular Component
  → WorkspaceService (window.electronAPI.*)
    → preload.ts (ipcRenderer.invoke)
      → ipc-handlers.ts (ipcMain.handle)
        → SquadStore (JSON 永続化)
        → GitService (git コマンド実行)
        → CodeWorkspaceService (.code-workspace 生成)
```

### レスポンスパターン

全 IPC レスポンスは `IpcResult<T>` で統一（Discriminated Union）:

```typescript
type IpcResult<T> = { success: true; data: T } | IpcErrorResult;
```

エラーは `IpcErrorCode` で分類: `VALIDATION_ERROR`, `NOT_FOUND`, `GIT_OPERATION_FAILED`, `INTERNAL_ERROR` 等。

### ロールバックパターン

`workspace:create` では、途中失敗時に作成済み Worktree を逆順で削除するロールバック処理が実装されている。`workspace:delete` ではベストエフォート削除（一部失敗しても継続）。

---

## 2. 関連コンポーネント一覧と責務

### Electron 側

| ファイル                                 | 責務                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `electron/ipc/ipc-channels.ts`           | IPC チャネル名定数 + リクエスト型定義                                               |
| `electron/ipc/ipc-handlers.ts`           | `ipcMain.handle` 登録。ビジネスロジックのオーケストレーション                       |
| `electron/ipc/ipc-error-mapper.ts`       | 例外 → `IpcResult` 変換（`mapErrorToIpcResult`, `notFoundResult`, `successResult`） |
| `electron/git/git-service.ts`            | Git 操作: `addWorktree`, `removeWorktree`, `createBranch`, `fetch`                  |
| `electron/git/code-workspace-service.ts` | `.code-workspace` ファイルの生成・削除                                              |
| `electron/store/squad-store.ts`          | JSON ファイルベースの CRUD（`addWorkspace`, `updateWorkspace`, `removeWorkspace`）  |
| `electron/store/squad-paths.ts`          | `~/.squad/` 配下のパス解決                                                          |
| `electron/types/models.ts`               | zod スキーマ + 型定義（`Workspace`, `WorkspaceEntry`, `Repository`）                |
| `electron/types/electron-api.ts`         | `window.electronAPI` の型定義（Angular 側から参照）                                 |
| `electron/types/ipc-result.ts`           | `IpcResult<T>` 型定義                                                               |
| `electron/types/ipc-error-code.ts`       | `IpcErrorCode` 定数                                                                 |
| `electron/preload.ts`                    | `contextBridge.exposeInMainWorld` で API 公開                                       |

### Angular 側

| ファイル                                      | 責務                                               |
| --------------------------------------------- | -------------------------------------------------- |
| `src/app/services/workspace.service.ts`       | `window.electronAPI` のラッパー（Workspace 操作）  |
| `src/app/services/repository.service.ts`      | `window.electronAPI` のラッパー（Repository 操作） |
| `src/app/workspaces/workspace-list.ts`        | Workspace 一覧表示・削除・IDE で開く               |
| `src/app/workspaces/workspace-list.html`      | 一覧 UI テンプレート（カードグリッド）             |
| `src/app/workspaces/workspace-create-form.ts` | Workspace 新規作成ダイアログ                       |
| `src/app/shared/branch-combobox/`             | ブランチ選択コンボボックス（再利用可能）           |
| `src/app/shared/create-branch-dialog/`        | 新規ブランチ作成ダイアログ（再利用可能）           |

---

## 3. 既存の型定義・インターフェース

### データモデル

```typescript
// electron/types/models.ts
interface WorkspaceEntry {
  repositoryId: string; // Repository の UUID
  branch: string; // チェックアウト対象ブランチ名
}

interface Workspace {
  id: string; // UUID v4
  name: string; // suffix 付き内部名（ディレクトリ名）
  displayName: string; // UI 表示用の名前
  entries: WorkspaceEntry[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### IPC リクエスト型（workspace 関連）

```typescript
// electron/ipc/ipc-channels.ts
interface WorkspaceCreateEntry {
  repositoryId: string;
  branch: string;
  sourceBranch?: string; // 新規ブランチ作成時の起点
}

interface WorkspaceCreateRequest {
  name: string;
  entries: WorkspaceCreateEntry[];
}

interface WorkspaceDeleteRequest {
  id: string;
}
interface WorkspaceGetRequest {
  id: string;
}
interface WorkspaceOpenRequest {
  id: string;
}
```

### ストアメソッド（既存）

```typescript
// electron/store/squad-store.ts — 既に実装済み
async updateWorkspace(
  id: string,
  updates: Pick<Workspace, 'entries'>,
): Promise<Workspace | undefined>
// → entries を更新し、updatedAt を自動更新。存在しない ID は undefined を返す。
```

---

## 4. 影響を受ける IPC チャネル・ハンドラー

### 現在の Workspace 関連チャネル

| チャネル名         | 定数               | ハンドラー | preload | ElectronAPI | Angular Service      |
| ------------------ | ------------------ | ---------- | ------- | ----------- | -------------------- |
| `workspace:list`   | `WORKSPACE_LIST`   | ✅         | ✅      | ✅          | ✅                   |
| `workspace:get`    | `WORKSPACE_GET`    | ✅         | ✅      | ✅          | ❌（Service 未公開） |
| `workspace:create` | `WORKSPACE_CREATE` | ✅         | ✅      | ✅          | ✅                   |
| `workspace:delete` | `WORKSPACE_DELETE` | ✅         | ✅      | ✅          | ✅                   |
| `workspace:open`   | `WORKSPACE_OPEN`   | ✅         | ✅      | ✅          | ✅                   |

### 新規追加が必要なチャネル

| チャネル名               | 用途                                              |
| ------------------------ | ------------------------------------------------- |
| `workspace:add-entry`    | Workspace にリポジトリ × ブランチのエントリを追加 |
| `workspace:remove-entry` | Workspace からエントリを削除                      |

---

## 5. 再利用可能な既存資産

### Git 操作

- `GitService.addWorktree(repoName, workspaceName, branch, sourceBranch?)` — Worktree 作成（suffix 付きブランチ名を返す）
- `GitService.removeWorktree(repoName, workspaceName)` — Worktree 削除（存在しない場合は no-op）
- `GitService.fetch(repoName)` — リモート情報の更新

### ストア操作

- `SquadStore.updateWorkspace(id, { entries })` — entries 更新 + updatedAt 自動更新（**既に実装済み**）
- `SquadStore.getWorkspace(id)` — Workspace 取得
- `SquadStore.getRepository(id)` — Repository 取得

### .code-workspace 再生成

- `CodeWorkspaceService.generate(workspaceName, entries)` — 既存ファイルを上書き可能（アトミック書き込み）

### Angular 共有コンポーネント

- `BranchComboboxComponent` — ブランチ選択 UI（`workspace-create-form` で使用中）
- `CreateBranchDialogComponent` — 新規ブランチ作成ダイアログ

---

## 6. 技術的制約・注意事項

### Worktree のディレクトリ構造

```
~/.squad/workspaces/<workspaceName>/
  ├── <repoName>/          ← Worktree ディレクトリ（git worktree add で作成）
  ├── <repoName>/          ← 複数リポジトリの場合
  └── <workspaceName>.code-workspace  ← VS Code Workspace ファイル
```

- エントリ追加時: `git worktree add` で新しいディレクトリを作成し、`.code-workspace` の `folders` 配列に追加
- エントリ削除時: `git worktree remove` でディレクトリを削除し、`.code-workspace` の `folders` 配列から除去

### ロールバック戦略

- エントリ追加: Worktree 作成後にストア更新が失敗した場合、作成した Worktree を削除する（`workspace:create` と同じパターン）
- エントリ削除: Worktree 削除 → ストア更新 → `.code-workspace` 再生成の順。ベストエフォート

### 同一リポジトリの重複エントリ

- 現在の `WorkspaceEntry` は `repositoryId` + `branch` の組み合わせ
- 同一リポジトリで異なるブランチのエントリは許可されるべきか要検討
- Worktree ディレクトリは `<workspaceName>/<repoName>` で一意のため、同一リポジトリの複数エントリは現在のパス構造では不可能

### `.code-workspace` ファイルの再生成

- `CodeWorkspaceService.generate()` は既存ファイルを上書きする（アトミック書き込み）
- エントリ追加・削除後に毎回再生成すれば整合性を保てる

### `workspace:get` の活用

- `workspace:get` チャネルは既に実装済みだが、Angular Service (`WorkspaceService`) には未公開
- 編集画面で Workspace の最新状態を取得するために公開が必要
