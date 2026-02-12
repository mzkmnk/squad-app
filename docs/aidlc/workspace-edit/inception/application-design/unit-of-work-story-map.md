# Unit of Work ストーリーマップ — workspace-edit

## 要件 → Unit マッピング

| 要件 ID | 要件名                                | Unit 1: Electron IPC                                                                                         | Unit 2: Angular UI                                                                      |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| FR-1    | エントリの追加                        | `workspace:add-entry` ハンドラー（Worktree 作成 + ストア更新 + .code-workspace 再生成 + ロールバック）       | `WorkspaceService.addEntry()` + 編集ページの追加セクション UI                           |
| FR-2    | エントリの削除                        | `workspace:remove-entry` ハンドラー（Worktree 削除 + ストア更新 + .code-workspace 再生成、ベストエフォート） | `WorkspaceService.removeEntry()` + 編集ページの削除ボタン UI                            |
| FR-3    | 全エントリ削除時の Workspace 削除提案 | —                                                                                                            | 確認ダイアログ表示 + 既存 `workspace:delete` フロー呼び出し                             |
| FR-4    | 同一リポジトリの重複防止              | ハンドラー側のバリデーション（重複チェック）                                                                 | 追加 UI で既存リポジトリを disabled 表示                                                |
| FR-5    | Workspace 詳細の取得                  | —                                                                                                            | `WorkspaceService.getWorkspace(id)` 公開（既存 IPC を利用）                             |
| UI-1    | 編集ページへの遷移                    | —                                                                                                            | 一覧カードに編集アイコンボタン追加 + `Router` ナビゲーション                            |
| UI-2    | 編集ページの構成                      | —                                                                                                            | `WorkspaceEditComponent` 新規作成（エントリ一覧 + 追加セクション + 戻るナビゲーション） |
| UI-3    | 操作フィードバック                    | —                                                                                                            | toast 通知 + ローディング状態（ボタン無効化 + スピナー）                                |
| NFR-1   | 整合性                                | ロールバック処理（add-entry）、ベストエフォート（remove-entry）                                              | —                                                                                       |
| NFR-2   | IDE 連携                              | .code-workspace 再生成（上書き）                                                                             | —                                                                                       |

## Unit 別タスクサマリ

### Unit 1: Electron IPC

| タスク                                                                                                            | 対応要件                 | ファイル               |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------- |
| チャネル定数 + リクエスト型定義                                                                                   | FR-1, FR-2               | `ipc-channels.ts`      |
| add-entry ハンドラー（重複チェック + fetch + Worktree 作成 + ストア更新 + .code-workspace 再生成 + ロールバック） | FR-1, FR-4, NFR-1, NFR-2 | `ipc-handlers.ts`      |
| remove-entry ハンドラー（Worktree 削除 + ストア更新 + .code-workspace 再生成、ベストエフォート）                  | FR-2, NFR-1, NFR-2       | `ipc-handlers.ts`      |
| preload API 追加                                                                                                  | FR-1, FR-2               | `preload.ts`           |
| ElectronAPI 型更新                                                                                                | FR-1, FR-2               | `electron-api.ts`      |
| ハンドラー単体テスト                                                                                              | FR-1, FR-2, FR-4, NFR-1  | `ipc-handlers.spec.ts` |

### Unit 2: Angular UI

| タスク                                                                     | 対応要件         | ファイル                                   |
| -------------------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| `getWorkspace(id)` メソッド公開                                            | FR-5             | `workspace.service.ts`                     |
| `addEntry()` / `removeEntry()` メソッド追加                                | FR-1, FR-2       | `workspace.service.ts`                     |
| 編集ページコンポーネント新規作成                                           | UI-2, UI-3       | `workspace-edit.ts`, `workspace-edit.html` |
| エントリ追加セクション（リポジトリ選択 + ブランチ選択 + 新規ブランチ作成） | FR-1, FR-4, UI-2 | `workspace-edit.ts`, `workspace-edit.html` |
| エントリ削除 + 全削除時の Workspace 削除提案ダイアログ                     | FR-2, FR-3, UI-2 | `workspace-edit.ts`, `workspace-edit.html` |
| ルート追加（`workspaces/:id/edit`）                                        | UI-1             | `app.routes.ts`                            |
| 一覧画面に編集アイコンボタン追加                                           | UI-1             | `workspace-list.ts`, `workspace-list.html` |
| 翻訳キー追加                                                               | UI-2, UI-3       | `src/assets/i18n/*.json`                   |

## カバレッジ確認

全要件（FR-1〜FR-5、UI-1〜UI-3、NFR-1〜NFR-2）が少なくとも1つの Unit にマッピングされていることを確認済み。スコープ外の項目（ブランチ変更、displayName 変更、同一リポジトリ複数エントリ）はマッピング対象外。
