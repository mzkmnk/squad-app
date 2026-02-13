# 既存ブランチの直接 Checkout 対応

## 背景

Workspace 作成時、現状は常にリモートブランチの最新コミットから suffix 付きの新規ローカルブランチを作成して worktree を追加している。
しかし、リモートブランチをそのまま（suffix なしで）checkout して worktree に割り当てたいケースがある。

### 現状の動作

1. ユーザーが `feature/my-work` を選択
2. 内部: `git branch feature/my-work-xxxx refs/remotes/origin/feature/my-work` → `git worktree add ... feature/my-work-xxxx`
3. 結果: 常に suffix 付きの新規ブランチが作成される

### 問題点

- リモートブランチと同名のローカルブランチを作成して checkout する手段がない
- ユーザーが「このブランチ名をそのまま使いたい」という意図を表現できない

### 直接 checkout の実態

ユーザーが combobox で選択しているのはリモートブランチ一覧（`getRemoteBranches` の結果）。
`git worktree add <dir> <branch>` を実行すると、git が自動的に `refs/remotes/origin/<branch>` からローカルブランチを作成する。
つまり「リモートブランチ名と同名のローカルブランチを（suffix なしで）作成して worktree に割り当てる」という動作になる。

既にそのブランチ名のローカルブランチが存在する場合（以前の worktree 作成で残ったものなど）は、そのブランチがそのまま使用される。

### 別 worktree で使用中の場合

git は1つのブランチを1つの worktree にしか割り当てられない制約がある。
同じブランチを複数 worktree で使うと、同時編集によるデータ不整合のリスクがあるため、git のデフォルト動作（エラー）をそのまま尊重する。

## 方針

`WorkspaceCreateEntry` に `directCheckout` フラグを追加し、`GitService` にリモートブランチを suffix なしで直接 checkout する処理パスを実装する。
UI にはチェックボックスを追加し、ユーザーが明示的に直接 checkout を選択できるようにする。

別 worktree で使用中のブランチを指定した場合は、`ipc-error-mapper` で git エラーメッセージ（`stderr` に `already checked out` を含む）を検出し `BRANCH_IN_USE` エラーコードを返す。Angular 側では既存の共通エラーハンドリングで `errors.BRANCH_IN_USE` の i18n メッセージを表示する。

### directCheckout フラグの意味

`directCheckout: true` は suffix 付き新規ブランチ作成をスキップし、指定ブランチ名をそのまま使用することを意味する。

`directCheckout` は `BranchSelection.type === 'existing'`（既存ブランチ選択）の場合にのみ有効。
`BranchSelection.type === 'new'`（新規ブランチ作成）の場合は常に従来の動作（suffix 付き新規ブランチ作成）となる。
`directCheckout: true` の場合、`sourceBranch` は無視される。

### Workspace 削除時の動作

直接 checkout で割り当てたブランチは、Workspace 削除時に worktree のみ削除しブランチは残す（既存の `removeWorktree` の動作と同じ）。

## TODO

### 推奨実装順序

バックエンド（TODO 1-4）→ テスト（TODO 7）→ フロントエンド（TODO 5-6）→ 結合テスト（TODO 8）

### 1. IPC 型定義の拡張（`electron/ipc/ipc-channels.ts`）

- [ ] `WorkspaceCreateEntry` に `directCheckout?: boolean` フィールドを追加
- [ ] JSDoc: `directCheckout` が true の場合、suffix 付き新規ブランチ作成をスキップし、指定ブランチ名をそのまま worktree に checkout する旨を記載

### 2. GitService の拡張（`electron/git/git-service.ts`）

- [ ] `addWorktree` メソッドに `directCheckout?: boolean` パラメータを追加
- [ ] `directCheckout: true` の場合の処理パス:
  1. suffix 付き新規ブランチ作成（`createBranch` + リトライループ）をスキップ
  2. `sourceBranch` が指定されていても無視する（バリデーションエラーにはしない）
  3. `branch` をそのまま使用して `git worktree add <dir> <branch>` を実行
  4. 別 worktree で使用中の場合は git のエラーをそのまま伝搬
- [ ] `directCheckout: true` の場合、戻り値は suffix なしの `branch` をそのまま返す
- [ ] `directCheckout: false`（デフォルト）の場合: 既存の動作を維持（suffix 付き新規ブランチ作成）
- [ ] エラーハンドリング:
  - 別 worktree で使用中 → `GitOperationError` の `stderr` に `already checked out` を含むかを判定
  - `ipc-error-mapper.ts` の `GitOperationError` 分岐内で上記パターンマッチし、該当する場合は `BRANCH_IN_USE` を返す
  - worktree ディレクトリが既に存在する場合 → `GIT_OPERATION_FAILED`

### 3. IPC ハンドラーの修正（`electron/ipc/ipc-handlers.ts`）

- [ ] `ResolvedWorkspaceEntry` インターフェースに `directCheckout?: boolean` フィールドを追加
- [ ] resolvedEntries 構築時に `entry.directCheckout` を伝搬する
- [ ] `WORKSPACE_CREATE` ハンドラーで `resolved.directCheckout` を `gitService.addWorktree` に渡す
- [ ] `WORKSPACE_ADD_ENTRY` ハンドラーも同様に対応
- [ ] `store.addWorkspace` に渡す前に `entries` から `directCheckout` を除去する
  - `entries.map(({ directCheckout, ...rest }) => rest)` で destructuring
- [ ] `WORKSPACE_ADD_ENTRY` ハンドラーでも同様に、ストア更新時の `newEntries` 構築で `directCheckout` を除去する

### 4. Preload / ElectronAPI 型の修正（`electron/preload.ts`, `electron/types/electron-api.ts`）

- [ ] `preload.ts`: `createWorkspace` の `entries` インライン型に `directCheckout?: boolean` を手動追加（`WorkspaceCreateEntry` を import していないため自動伝搬しない）
- [ ] `preload.ts`: `addWorkspaceEntry` の `entries` インライン型にも同様に `directCheckout?: boolean` を追加
- [ ] `electron-api.ts`: `createWorkspace` / `addWorkspaceEntry` は `WorkspaceCreateEntry` を import 参照しているため、TODO 1 の変更で自動的に伝搬する（変更不要）
- [ ] `preload.ts` のインライン型と `electron-api.ts` の `WorkspaceCreateEntry` 参照が同じフィールドを持つことを確認する

### 5. Angular UI の修正（`src/app/workspaces/workspace-create-form.ts`, `.html`）

- [ ] `BranchSelection` の `existing` 型に `directCheckout: boolean` フィールドを追加（デフォルト: `false`）
- [ ] `selectBranch()` で `BranchSelection` を作成する際、`directCheckout` を `false` で初期化する
- [ ] リポジトリごとのブランチ選択エリアに「ブランチ名をそのまま使用する」チェックボックスを追加
- [ ] チェックボックスは `BranchSelection.type === 'existing'` の場合のみ表示（`type === 'new'` では非表示）
- [ ] `buildEntries()` で `directCheckout` フラグを `WorkspaceCreateEntry` に含める
- [ ] チェックボックスの注意書き（suffix なしでブランチを checkout する旨のヘルプテキスト）を表示
- [ ] `BRANCH_IN_USE` エラーコードに対応する i18n メッセージは `errors.BRANCH_IN_USE` に配置し、既存の共通エラーハンドリング（`toast.error`）で処理する

### 6. i18n キーの追加（`public/i18n/ja.json`）

- [ ] `workspaces.directCheckout`: 「ブランチ名をそのまま使用する」
- [ ] `workspaces.directCheckoutHint`: 「新規ブランチを作成せず、選択したブランチ名で直接チェックアウトします。」
- [ ] `errors.BRANCH_IN_USE`: 「このブランチは別の Workspace で使用中です。」（`errors` 配下に配置し、既存のエラーコード別メッセージパターンに合わせる）

※ transloco のネスト形式に合わせて配置する。

### 7. テスト

- [ ] `GitService.addWorktree` の directCheckout パスの単体テスト:
  - `directCheckout: true` で `createBranch` がスキップされ、`git worktree add <dir> <branch>` が呼ばれることを検証
  - `directCheckout: true` で別 worktree 使用中のブランチに対してエラーが返ることを検証
  - `directCheckout: true` の戻り値が suffix なしの `branch` であることを検証
  - `directCheckout: true` + `sourceBranch` 指定時に `sourceBranch` が無視されることを検証
  - `directCheckout: false`（デフォルト）の場合に既存動作が維持されることを検証
- [ ] Angular 側のテスト:
  - `buildEntries()` が `directCheckout` フラグを正しく含めることを検証
  - `BranchSelection.type === 'new'` の場合に直接 checkout チェックボックスが非表示であることを検証

### 8. 動作確認

- [ ] Workspace 作成ダイアログで既存ブランチ選択時にチェックボックスが表示されることを確認
- [ ] 新規ブランチ作成時にチェックボックスが非表示であることを確認
- [ ] チェックあり: ブランチ名がそのまま使われることを確認（suffix なし）
- [ ] チェックなし: 従来通り suffix 付き新規ブランチが作成されることを確認
- [ ] 別 worktree で使用中のブランチに対して `errors.BRANCH_IN_USE` の i18n エラーメッセージが表示されることを確認

## 対象ファイル

| ファイル                                        | 変更内容                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `electron/ipc/ipc-channels.ts`                  | `WorkspaceCreateEntry` に `directCheckout?: boolean` 追加    |
| `electron/git/git-service.ts`                   | `addWorktree` に直接 checkout パス追加                       |
| `electron/ipc/ipc-handlers.ts`                  | `directCheckout` フラグの伝搬、ストア保存時の除去            |
| `electron/ipc/ipc-error-mapper.ts`              | `BRANCH_IN_USE` エラーコードの追加・マッピング               |
| `electron/types/ipc-error-code.ts`              | `BRANCH_IN_USE` エラーコード定義追加                         |
| `electron/preload.ts`                           | `entries` インライン型に `directCheckout?: boolean` 手動追加 |
| `electron/types/electron-api.ts`                | 変更不要（`WorkspaceCreateEntry` import で自動伝搬）         |
| `src/app/workspaces/workspace-create-form.ts`   | `BranchSelection` 拡張、`buildEntries` 修正                  |
| `src/app/workspaces/workspace-create-form.html` | 直接 checkout チェックボックス追加                           |
| `public/i18n/ja.json`                           | i18n キー追加                                                |
