# Code Generation Plan: Unit 1 — Electron IPC

## 概要

Workspace のエントリ追加・削除に必要な IPC 通信基盤を実装する。
`workspace:add-entry`（ロールバック付き）と `workspace:remove-entry`（ベストエフォート）の 2 チャネルを追加し、
関連する型定義・preload・ElectronAPI を更新する。

## 実装タスク

### 1. エラーコード追加

- [x] `electron/types/ipc-error-code.ts` に `DUPLICATE_ENTRY` エラーコードを追加

### 2. IPC チャネル定数・リクエスト型追加

- [x] `electron/ipc/ipc-channels.ts` に `WORKSPACE_ADD_ENTRY` / `WORKSPACE_REMOVE_ENTRY` チャネル定数を追加
- [x] `WorkspaceAddEntryRequest` / `WorkspaceRemoveEntryRequest` インターフェースを追加

### 3. テスト作成（workspace:add-entry）

- [x] テスト: 正常系 — 単一エントリ追加（fetch → addWorktree → updateWorkspace → generate）
- [x] テスト: 正常系 — 複数エントリ一括追加
- [x] テスト: 異常系 — Workspace が見つからない（NOT_FOUND）
- [x] テスト: 異常系 — Repository が見つからない（NOT_FOUND）
- [x] テスト: 異常系 — 同一リポジトリの重複エントリ（DUPLICATE_ENTRY）
- [x] テスト: 異常系 — Worktree 作成失敗時のロールバック
- [x] テスト: 異常系 — fetch 失敗（GIT_OPERATION_FAILED）

### 4. テスト作成（workspace:remove-entry）

- [x] テスト: 正常系 — 単一エントリ削除
- [x] テスト: 正常系 — 複数エントリ一括削除
- [x] テスト: 異常系 — Workspace が見つからない（NOT_FOUND）
- [x] テスト: 異常系 — 指定 repositoryId がエントリに存在しない（VALIDATION_ERROR）
- [x] テスト: 正常系 — Worktree 削除失敗でもストア更新は続行（ベストエフォート）
- [x] テスト: 正常系 — Repository が見つからなくても削除続行

### 5. ハンドラー実装（workspace:add-entry）

- [x] `electron/ipc/ipc-handlers.ts` に `workspace:add-entry` ハンドラーを実装
  - Workspace 存在確認 → Repository 存在確認 → 重複チェック → fetch → addWorktree → updateWorkspace → generate
  - ロールバック: 作成済み Worktree の逆順削除 + ストア復元

### 6. ハンドラー実装（workspace:remove-entry）

- [x] `electron/ipc/ipc-handlers.ts` に `workspace:remove-entry` ハンドラーを実装
  - Workspace 存在確認 → repositoryId 検証 → Worktree 削除（ベストエフォート）→ updateWorkspace → generate

### 7. preload / ElectronAPI 更新

- [x] `electron/preload.ts` に `addWorkspaceEntry` / `removeWorkspaceEntry` メソッドを追加
- [x] `electron/types/electron-api.ts` の `ElectronAPI` インターフェースに型定義を追加

### 8. 最終確認

- [x] 全テスト実行・パス確認（`pnpm test:electron`）
- [x] lint 確認（`pnpm lint`）
- [x] ビルド確認（`pnpm electron:build`）

## ストーリートレーサビリティ

| タスク                        | ストーリー         | 受入条件                                    |
| ----------------------------- | ------------------ | ------------------------------------------- |
| DUPLICATE_ENTRY エラーコード  | エントリ追加       | 重複時に適切なエラーコードが返る            |
| チャネル定数・リクエスト型    | エントリ追加・削除 | 型安全な IPC 通信が可能                     |
| add-entry ハンドラー          | エントリ追加       | fetch → Worktree → ストア → .code-workspace |
| add-entry ロールバック        | エントリ追加       | エラー時に作成済み Worktree が削除される    |
| remove-entry ハンドラー       | エントリ削除       | Worktree 削除 → ストア → .code-workspace    |
| remove-entry ベストエフォート | エントリ削除       | Worktree 削除失敗でもストア更新が実行される |
| preload / ElectronAPI         | エントリ追加・削除 | Angular から型安全に呼び出し可能            |
