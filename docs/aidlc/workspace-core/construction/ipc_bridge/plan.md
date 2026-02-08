# Implementation Plan: ipc_bridge

## 概要

Electron IPC 通信基盤を構築する。チャネル定義・エラーマッパー・メインプロセスハンドラー・preload API・型定義を実装し、Unit 1（data_model）と Unit 2（git_operations）の機能をレンダラープロセスに公開する。

## 実装タスク

### 1. IPC チャネル定義 (`electron/ipc/ipc-channels.ts`)

- [ ] チャネル名定数 `IpcChannels` を定義
- [ ] `IpcResult<T>` Discriminated Union 型を定義
- [ ] `IpcErrorCode` 定数を定義
- [ ] リクエスト型（`RepoGetRequest`, `RepoAddRequest`, etc.）を定義

### 2. エラーマッパー (`electron/ipc/ipc-error-mapper.ts`)

- [ ] `mapErrorToIpcResult` — 例外を `IpcResult` 失敗形式に変換
- [ ] `notFoundResult` — NOT_FOUND エラー生成ヘルパー
- [ ] `successResult` — 成功レスポンス生成ヘルパー
- [ ] テスト: `GitValidationError` → `VALIDATION_ERROR`
- [ ] テスト: `GitRepositoryExistsError` → `REPOSITORY_EXISTS`
- [ ] テスト: `GitOperationError` → `GIT_OPERATION_FAILED`（stderr 優先 / message フォールバック）
- [ ] テスト: 未知の Error → `INTERNAL_ERROR`
- [ ] テスト: Error でないオブジェクト → `INTERNAL_ERROR` + `'Unknown error'`
- [ ] テスト: `notFoundResult` / `successResult` の形式検証

### 3. IPC ハンドラー (`electron/ipc/ipc-handlers.ts`)

- [ ] `extractRepoName` ユーティリティ関数
- [ ] `IpcHandlerDeps` インターフェース定義
- [ ] `registerIpcHandlers` 関数の骨格
- [ ] テスト: `extractRepoName` — HTTPS URL, SSH URL, `.git` なし, 深いパス

#### 3a. リポジトリ操作ハンドラー

- [ ] `repo:list` ハンドラー実装
- [ ] テスト: 正常系 / ストアエラー時 `INTERNAL_ERROR`
- [ ] `repo:get` ハンドラー実装
- [ ] テスト: 存在する ID / 存在しない ID → `NOT_FOUND`
- [ ] `repo:add` ハンドラー実装（URL 抽出 → cloneBare → addRepository）
- [ ] テスト: 正常系 / `VALIDATION_ERROR` / `REPOSITORY_EXISTS` / `GIT_OPERATION_FAILED` / cloneBare 成功後 addRepository 失敗時のクリーンアップ
- [ ] `repo:remove` ハンドラー実装
- [ ] テスト: 正常系 / `NOT_FOUND`
- [ ] `repo:branches` ハンドラー実装
- [ ] テスト: 正常系 / `NOT_FOUND` / `GIT_OPERATION_FAILED`
- [ ] `repo:fetch` ハンドラー実装
- [ ] テスト: 正常系 / `NOT_FOUND`

#### 3b. Workspace 操作ハンドラー

- [ ] `workspace:list` ハンドラー実装
- [ ] テスト: 正常系
- [ ] `workspace:get` ハンドラー実装
- [ ] テスト: 存在する ID / `NOT_FOUND`
- [ ] `workspace:create` ハンドラー実装（リポジトリ解決 → Worktree 作成 → .code-workspace 生成 → ストア登録 → VS Code 起動 + ロールバック処理）
- [ ] テスト: 正常系フロー / 存在しない repositoryId → `NOT_FOUND` / Worktree 作成途中エラー時のロールバック / ロールバック中エラーは無視
- [ ] `workspace:delete` ハンドラー実装
- [ ] テスト: 正常系 / `NOT_FOUND` / 一部 Worktree 削除失敗でも継続
- [ ] `workspace:open` ハンドラー実装
- [ ] テスト: 正常系 / `NOT_FOUND` / `code` コマンド失敗

### 4. preload API 拡張 (`electron/preload.ts`)

- [ ] リポジトリ操作メソッド追加（getRepositories, getRepository, addRepository, removeRepository, getRemoteBranches, fetchRepository）
- [ ] Workspace 操作メソッド追加（getWorkspaces, getWorkspace, createWorkspace, deleteWorkspace, openWorkspace）

### 5. 型定義拡張 (`electron/electron.d.ts`)

- [ ] `IpcResult<T>` 型定義追加
- [ ] `ElectronAPI` インターフェースに全 IPC メソッドの型を追加

### 6. main.ts 統合

- [ ] サービス初期化（SquadPaths, SquadStore, GitService, CodeWorkspaceService）
- [ ] `registerIpcHandlers` 呼び出し追加
- [ ] `createWindow` を async 化

### 7. 最終確認

- [ ] 全テスト実行・パス確認
- [ ] lint・format 確認
- [ ] ビルド確認

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
