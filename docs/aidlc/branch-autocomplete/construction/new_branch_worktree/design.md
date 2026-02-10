# Design: new_branch_worktree

## 概要

Workspace 作成時に、新規ブランチを起点ブランチから作成して worktree を追加する機能をバックエンドに実装する。フロントエンド（Unit 2: form_integration）から送信される新規ブランチ情報（起点ブランチ・新規ブランチ名）を受け取り、`git branch <new> <source>` で新規ブランチを作成した後、そのブランチで worktree を追加する。

**対応するストーリー:** AC15

### Unit 境界の明確化

| 責務                                            | 担当 Unit                                  |
| ----------------------------------------------- | ------------------------------------------ |
| ブランチ選択コンボボックスの UI・フィルタリング | Unit 1 (branch_combobox) ✅ 実装済み       |
| フォームへの統合・新規作成ボタン・状態管理      | Unit 2 (form_integration) ✅ 実装済み      |
| 新規ブランチ作成ダイアログの中身                | Unit 3 (create_branch_dialog) ✅ 実装済み  |
| **バックエンド IPC 型拡張・worktree 作成処理**  | **Unit 4 (new_branch_worktree) ← 本 Unit** |

## ドメインモデル

本 Unit はドメインエンティティや値オブジェクトの新規追加は不要。既存の `Workspace`、`WorkspaceEntry` モデルに変更はない。

### 新規ブランチ情報の伝搬モデル

新規ブランチ情報は IPC リクエストの `entries` 配列内で、エントリごとにオプショナルな `sourceBranch` フィールドとして伝搬する。

```
Angular (workspace-create-form.ts)
  ↓ buildEntries() で BranchSelection → entry に変換
WorkspaceService.createWorkspace()
  ↓ window.electronAPI.createWorkspace()
preload.ts (ipcRenderer.invoke)
  ↓ IPC チャネル: workspace:create
ipc-handlers.ts (ipcMain.handle)
  ↓ sourceBranch を addWorktree() に渡す
GitService.addWorktree(repoName, workspaceName, branch, sourceBranch?)
  ↓ 内部で createBranch() を使用
GitService.createBranch()  ← ブランチ作成の単一責務メソッド（新規）
```

## DBスキーマ

本 Unit は JSON ストア（`repos.json`, `workspaces.json`）のスキーマ変更は不要。

Workspace の `entries` に保存されるブランチ名は、新規ブランチの場合も作成後のブランチ名（suffix 付き）が格納される。起点ブランチ情報は Workspace 作成時のみ使用され、永続化しない。

> **設計判断**: `sourceBranch` を `WorkspaceEntry` に永続化しない理由:
>
> - 起点ブランチ情報は worktree 作成時の一時的なパラメータであり、作成後は不要
> - 既存の `WorkspaceEntry` スキーマ（`repositoryId` + `branch`）との後方互換性を維持
> - Workspace 削除時の worktree 削除処理に起点ブランチ情報は不要

## API仕様

### IPC チャネル: `workspace:create`（既存チャネルの拡張）

#### リクエスト型の変更

**変更前:**

```typescript
export interface WorkspaceCreateRequest {
  name: string;
  entries: {
    repositoryId: string;
    branch: string;
  }[];
}
```

**変更後:**

```typescript
export interface WorkspaceCreateRequest {
  name: string;
  entries: {
    repositoryId: string;
    branch: string;
    /** 新規ブランチの起点ブランチ名。指定時は branch を新規作成する */
    sourceBranch?: string;
  }[];
}
```

#### レスポンス

変更なし。`IpcResult<Workspace>` を返す。

#### エラーレスポンス

既存のエラーコードに加え、以下のケースが追加される:

| エラーコード           | 条件                                                     |
| ---------------------- | -------------------------------------------------------- |
| `VALIDATION_ERROR`     | `branch` または `sourceBranch` が Git 命名規則に違反     |
| `GIT_OPERATION_FAILED` | 新規ブランチ作成（`git branch`）または worktree 追加失敗 |
| `NOT_FOUND`            | `repositoryId` に対応するリポジトリが存在しない          |

#### 処理フロー

```
1. 各 entry の repositoryId を解決（既存処理）
2. Workspace をストアに登録（既存処理）
3. 各エントリに対して:
   → GitService.addWorktree(repoName, workspaceName, branch, sourceBranch?)
     sourceBranch 指定時: createBranch(repoName, actualBranch, sourceBranch) で新規ブランチ作成
     sourceBranch 未指定: createBranch(repoName, actualBranch, branch) で既存ブランチから分岐（従来と同じ動作）
4. .code-workspace ファイルを生成（既存処理）
5. VS Code を起動（既存処理）
```

## コンポーネント構成

```
electron/
├── git/
│   └── git-service.ts              # 変更: createBranch() 追加、addWorktree() に sourceBranch? 引数追加
├── ipc/
│   ├── ipc-channels.ts             # 変更: WorkspaceCreateRequest の entries 型拡張
│   └── ipc-handlers.ts             # 変更: workspace:create ハンドラーで sourceBranch を渡す
├── types/
│   ├── electron-api.ts               # 変更: createWorkspace の entries 型拡張
│   └── models.ts                   # 変更なし
├── preload.ts                      # 変更: createWorkspace の entries 型拡張
src/app/
├── services/
│   └── workspace.service.ts        # 変更: createWorkspace の entries 型拡張
└── workspaces/
    └── workspace-create-form.ts    # 変更: buildEntries() で sourceBranch を含める
```

### 変更対象ファイル一覧

| ファイル                                      | 変更種別 | 内容                                                               |
| --------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `electron/git/git-service.ts`                 | 修正     | `createBranch()` 追加、`addWorktree()` に `sourceBranch?` 引数追加 |
| `electron/ipc/ipc-channels.ts`                | 修正     | `WorkspaceCreateRequest` の entries に `sourceBranch?` 追加        |
| `electron/ipc/ipc-handlers.ts`                | 修正     | `workspace:create` ハンドラーで `sourceBranch` を渡す              |
| `electron/types/electron-api.ts`              | 修正     | `createWorkspace` の entries 型に `sourceBranch?` 追加             |
| `electron/preload.ts`                         | 修正     | `createWorkspace` の引数型に `sourceBranch?` 追加                  |
| `src/app/services/workspace.service.ts`       | 修正     | `createWorkspace` の entries 型に `sourceBranch?` 追加             |
| `src/app/workspaces/workspace-create-form.ts` | 修正     | `buildEntries()` で `sourceBranch` を含める                        |

## 詳細設計

### 1. GitService — `createBranch()` 追加 + `addWorktree()` 拡張

ブランチ作成を独立したサービスメソッド `createBranch()` として切り出し、既存の `addWorktree()` にオプショナルな `sourceBranch` 引数を追加して一本化する。

#### 1.1 `createBranch()` — ブランチ作成の単一責務メソッド

```typescript
/**
 * 起点ブランチから新規ブランチを作成する。
 *
 * @remarks
 * Bare Repository 上で `git branch <newBranch> <sourceBranch>` を実行する。
 * sourceBranch は `refs/remotes/origin/<sourceBranch>` として自動解決される
 * （`remote.origin.fetch` の refspec が設定済みのため）。
 *
 * @param repoName - Bare Repository 名（suffix 付き）
 * @param newBranch - 作成するブランチ名
 * @param sourceBranch - 起点ブランチ名（例: develop）
 * @throws {GitValidationError} ブランチ名が Git 命名規則に違反する場合
 * @throws {GitOperationError} git branch コマンドが失敗した場合（起点ブランチが存在しない等）
 */
async createBranch(repoName: string, newBranch: string, sourceBranch: string): Promise<void> {
  validateBranchName(newBranch);
  validateBranchName(sourceBranch);

  const repoDir = this.paths.repoDir(repoName);
  await this.execGit(['branch', newBranch, sourceBranch], repoDir);
}
```

> **設計判断 — `createBranch()` を独立メソッドにする理由:**
>
> - 「ブランチ作成」は worktree 追加とは独立した責務であり、将来的に worktree 以外の文脈（例: ブランチ管理 UI）でも再利用可能
> - 単体テストが書きやすい（Git コマンドの引数検証のみに集中できる）
> - `addWorktree()` 内のブランチ作成ロジックを `createBranch()` に委譲することで責務が明確になる

#### 1.2 `addWorktree()` — `sourceBranch` オプショナル引数の追加

```typescript
/**
 * 指定ブランチの Worktree を作成する。suffix 付きブランチ名を返す。
 *
 * @param repoName - Bare Repository 名（suffix 付き）
 * @param workspaceName - Workspace 名（suffix 付き）
 * @param branch - ブランチ名（既存ブランチ or 新規ブランチ名）
 * @param sourceBranch - 起点ブランチ名（省略時は branch 自身が起点）
 * @returns 作成された suffix 付きブランチ名
 */
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
```

> **設計判断 — `addWorktreeNewBranch()` を廃止し `addWorktree()` を拡張する理由:**
>
> - 既存の `addWorktree()` と `addWorktreeNewBranch()` の処理フローはほぼ同一で、違いは `git branch` の第2引数（起点）だけ
> - `sourceBranch` をオプショナル引数にすることで、既存の呼び出し元は変更不要（省略時は `branch` 自身が起点 = 従来と同じ動作）
> - メソッドが1つに統合されることで、テスト・メンテナンスの対象が減る

### 2. IPC チャネル型の拡張（ipc-channels.ts）

```typescript
// 変更前
export interface WorkspaceCreateRequest {
  name: string;
  entries: {
    repositoryId: string;
    branch: string;
  }[];
}

// 変更後
export interface WorkspaceCreateRequest {
  name: string;
  entries: {
    repositoryId: string;
    branch: string;
    /** 新規ブランチの起点ブランチ名。指定時は branch を sourceBranch から新規作成する */
    sourceBranch?: string;
  }[];
}
```

### 3. IPC ハンドラーの変更（ipc-handlers.ts）

#### 3.1 `ResolvedWorkspaceEntry` インターフェースの拡張

```typescript
// 変更前
interface ResolvedWorkspaceEntry {
  repo: Repository;
  branch: string;
}

// 変更後
interface ResolvedWorkspaceEntry {
  repo: Repository;
  branch: string;
  /** 新規ブランチの起点ブランチ名 */
  sourceBranch?: string;
}
```

#### 3.2 `workspace:create` ハンドラーの変更

entries の解決部分:

```typescript
// 変更前
resolvedEntries.push({ repo, branch: entry.branch });

// 変更後
resolvedEntries.push({
  repo,
  branch: entry.branch,
  sourceBranch: entry.sourceBranch,
});
```

worktree 作成部分:

```typescript
// 変更前
await gitService.addWorktree(resolved.repo.name, workspace.name, resolved.branch);

// 変更後
await gitService.addWorktree(
  resolved.repo.name,
  workspace.name,
  resolved.branch,
  resolved.sourceBranch,
);
```

> **ロールバック処理**: 既存のロールバック処理（`removeWorktree` の逆順呼び出し）はそのまま動作する。新規ブランチで作成された worktree も `removeWorktree` で削除可能（worktree のパスは `repoName` + `workspaceName` で決定されるため、ブランチの作成方法に依存しない）。

### 4. ElectronAPI 型定義の変更（electron-api.ts）

```typescript
// 変更前
createWorkspace: (name: string, entries: { repositoryId: string; branch: string }[]) =>
  Promise<IpcResult<Workspace>>;

// 変更後
createWorkspace: (
  name: string,
  entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
) => Promise<IpcResult<Workspace>>;
```

### 5. preload.ts の変更

```typescript
// 変更前
createWorkspace: (name: string, entries: { repositoryId: string; branch: string }[]) =>
  ipcRenderer.invoke('workspace:create', { name, entries }),

// 変更後
createWorkspace: (
  name: string,
  entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
) => ipcRenderer.invoke('workspace:create', { name, entries }),
```

### 6. WorkspaceService の変更（workspace.service.ts）

```typescript
// 変更前
createWorkspace(
  name: string,
  entries: { repositoryId: string; branch: string }[],
): Promise<IpcResult<Workspace>> {
  return window.electronAPI.createWorkspace(name, entries);
}

// 変更後
createWorkspace(
  name: string,
  entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
): Promise<IpcResult<Workspace>> {
  return window.electronAPI.createWorkspace(name, entries);
}
```

### 7. workspace-create-form.ts — `buildEntries()` の変更

```typescript
// 変更前
private buildEntries(): { repositoryId: string; branch: string }[] {
  return [...this.selectedRepoIds()].map((repoId) => {
    const selection = this.branchSelections().get(repoId);
    if (!selection) {
      throw new Error(`Branch selection not found for repository: ${repoId}`);
    }
    const branch =
      selection.type === 'existing' ? selection.branch : selection.newBranchInfo.newBranchName;
    return { repositoryId: repoId, branch };
  });
}

// 変更後
private buildEntries(): { repositoryId: string; branch: string; sourceBranch?: string }[] {
  return [...this.selectedRepoIds()].map((repoId) => {
    const selection = this.branchSelections().get(repoId);
    if (!selection) {
      throw new Error(`Branch selection not found for repository: ${repoId}`);
    }
    if (selection.type === 'existing') {
      return { repositoryId: repoId, branch: selection.branch };
    }
    return {
      repositoryId: repoId,
      branch: selection.newBranchInfo.newBranchName,
      sourceBranch: selection.newBranchInfo.sourceBranch,
    };
  });
}
```

## テスト計画

テスト環境: Vitest 4（`vitest run electron/`）

### ユニットテスト

#### GitService.createBranch() のテスト

テストファイル: `electron/git/git-service.spec.ts`（既存ファイルにテストケース追加）

- [ ] 正常系: `git branch <newBranch> <sourceBranch>` が正しい引数で呼ばれる
- [ ] 正常系: 正しい repoDir が cwd として渡される
- [ ] 異常系: `newBranch` が空文字の場合に `GitValidationError` がスローされる
- [ ] 異常系: `sourceBranch` が空文字の場合に `GitValidationError` がスローされる
- [ ] 異常系: `newBranch` が Git 命名規則に違反する場合に `GitValidationError` がスローされる
- [ ] 異常系: `git branch` コマンド失敗時（起点ブランチが存在しない等）に `GitOperationError` がスローされる

#### GitService.addWorktree() の sourceBranch 引数テスト

テストファイル: `electron/git/git-service.spec.ts`（既存ファイルにテストケース追加）

- [ ] 正常系: `sourceBranch` 省略時は `createBranch(repoName, actualBranch, branch)` が呼ばれる（従来と同じ動作）
- [ ] 正常系: `sourceBranch` 指定時は `createBranch(repoName, actualBranch, sourceBranch)` が呼ばれる
- [ ] 正常系: suffix 付きブランチ名が返される
- [ ] 正常系: Workspace ディレクトリが自動作成される
- [ ] 異常系: `sourceBranch` が Git 命名規則に違反する場合に `GitValidationError` がスローされる

#### IPC ハンドラー workspace:create のテスト

テストファイル: `electron/ipc/ipc-handlers.spec.ts`（既存ファイルにテストケース追加）

- [ ] 正常系: `sourceBranch` 未指定のエントリは `addWorktree(repo, ws, branch)` が呼ばれる
- [ ] 正常系: `sourceBranch` 指定のエントリは `addWorktree(repo, ws, branch, sourceBranch)` が呼ばれる
- [ ] 正常系: 混在エントリ（既存ブランチ + 新規ブランチ）が正しく処理される
- [ ] 異常系: 新規ブランチ作成失敗時にロールバックが実行される

#### workspace-create-form.ts buildEntries() のテスト

テストファイル: `src/app/workspaces/workspace-create-form.spec.ts`（既存ファイルにテストケース追加、または新規作成）

- [ ] 既存ブランチ選択時: `sourceBranch` が含まれない entry が生成される
- [ ] 新規ブランチ選択時: `sourceBranch` が含まれる entry が生成される
- [ ] 混在選択時: 各エントリが正しい形式で生成される

### AC カバレッジ

| AC   | カバレッジ方法                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| AC15 | IPC ハンドラーテスト（`sourceBranch` 指定時に `addWorktree` が `sourceBranch` 付きで呼ばれ、Workspace が正常に作成される） |

## 非機能要件

### パフォーマンス

- 新規ブランチ作成（`git branch`）は Bare Repository 上のローカル操作であり、ネットワーク通信は発生しない。既存の `addWorktree` と同等のパフォーマンス特性
- suffix 衝突時のリトライは最大3回（`MAX_SUFFIX_RETRY`）で、実用上衝突が発生する確率は極めて低い

### セキュリティ

- `branch` と `sourceBranch` の両方に対して `validateBranchName()` を実行し、Git コマンドインジェクションを防止
- フロントエンド側のバリデーション（Unit 3: `branch-validation.ts`）とバックエンド側のバリデーション（`git-validation.ts`）の二重チェックにより、不正な入力が Git コマンドに到達しない

### エラーハンドリング

- 新規ブランチ作成失敗時は既存のロールバック機構（作成済み worktree の逆順削除）がそのまま動作する
- 起点ブランチが存在しない場合は `git branch` コマンドが失敗し、`GitOperationError` → `GIT_OPERATION_FAILED` としてフロントエンドに伝搬される
- ロールバック処理はベストエフォート（一部失敗しても継続）で、既存の設計方針を踏襲する

## 更新履歴

| 日付       | 内容                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| 2026-02-10 | 初版作成                                                                                     |
| 2026-02-11 | createBranch() を独立メソッドとして切り出し、addWorktree() に sourceBranch? 引数追加で一本化 |
