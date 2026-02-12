# Unit of Work 定義 — workspace-edit

## Unit 1: Electron IPC

### 責務

Workspace のエントリ追加・削除に必要な IPC 通信基盤を提供する。

### 変更対象ファイル

| ファイル                         | 変更内容                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `electron/ipc/ipc-channels.ts`   | `WORKSPACE_ADD_ENTRY` / `WORKSPACE_REMOVE_ENTRY` チャネル定数、`WorkspaceAddEntryRequest` / `WorkspaceRemoveEntryRequest` リクエスト型                                                                                  |
| `electron/ipc/ipc-handlers.ts`   | `workspace:add-entry` ハンドラー（Worktree 作成 → ストア更新 → .code-workspace 再生成、ロールバック付き）、`workspace:remove-entry` ハンドラー（Worktree 削除 → ストア更新 → .code-workspace 再生成、ベストエフォート） |
| `electron/preload.ts`            | `addWorkspaceEntry(id, entry)` / `removeWorkspaceEntry(id, repositoryId)` メソッド                                                                                                                                      |
| `electron/types/electron-api.ts` | `ElectronAPI` に上記メソッドの型定義を追加                                                                                                                                                                              |

### ビジネスルール

- エントリ追加: 同一リポジトリの重複チェック → fetch → Worktree 作成 → ストア更新 → .code-workspace 再生成。失敗時は作成済み Worktree を削除（ロールバック）
- エントリ削除: Worktree 削除 → ストア更新 → .code-workspace 再生成。ベストエフォート（一部失敗しても継続）

### テスト

- `ipc-handlers.spec.ts` に add-entry / remove-entry のテストケースを追加

---

## Unit 2: Angular UI

### 責務

Workspace 編集ページの UI と、既存一覧画面への編集導線を提供する。

### 変更対象ファイル

| ファイル                                        | 変更内容                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/services/workspace.service.ts`         | `getWorkspace(id)` / `addEntry(id, entry)` / `removeEntry(id, repositoryId)` メソッド追加 |
| `src/app/workspaces/workspace-edit.ts` (新規)   | 編集ページコンポーネント（エントリ一覧表示、追加セクション、削除操作）                    |
| `src/app/workspaces/workspace-edit.html` (新規) | 編集ページテンプレート                                                                    |
| `src/app/app.routes.ts`                         | `workspaces/:id/edit` ルート追加（lazy load）                                             |
| `src/app/workspaces/workspace-list.ts`          | 編集アイコンの import、`Router` inject、`editWorkspace(id)` メソッド追加                  |
| `src/app/workspaces/workspace-list.html`        | 削除ボタンの左隣に編集アイコンボタン追加                                                  |
| 翻訳ファイル (`src/assets/i18n/`)               | 編集関連の翻訳キー追加                                                                    |

### UI 構成

- 既存エントリ一覧: リポジトリ名 + ブランチ名 + 削除ボタン
- 新規エントリ追加: 未追加リポジトリ選択（既存は disabled）+ `BranchComboboxComponent` + `CreateBranchDialogComponent`
- 全エントリ削除時: Workspace 削除提案の確認ダイアログ
- 操作フィードバック: toast 通知 + ローディング状態

### テスト

- コンポーネントテストなし
- Build and Test フェーズで統合確認
