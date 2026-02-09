# Implementation Plan: ipc_bridge

## 概要

Electron IPC 通信基盤を構築する。チャネル定義・エラーマッパー・メインプロセスハンドラー・preload API・型定義を実装し、Unit 1（data_model）と Unit 2（git_operations）の機能をレンダラープロセスに公開する。

## 実装タスク

### 1. IPC チャネル定義 (`electron/ipc/ipc-channels.ts`)

- [x] チャネル名定数 `IpcChannels` を定義
- [x] `IpcResult<T>` Discriminated Union 型を定義
- [x] `IpcErrorCode` 定数を定義
- [x] リクエスト型（`RepoGetRequest`, `RepoAddRequest`, etc.）を定義

### 2. エラーマッパー (`electron/ipc/ipc-error-mapper.ts`)

- [x] `mapErrorToIpcResult` — 例外を `IpcResult` 失敗形式に変換
- [x] `notFoundResult` — NOT_FOUND エラー生成ヘルパー
- [x] `successResult` — 成功レスポンス生成ヘルパー
- [x] テスト: `GitValidationError` → `VALIDATION_ERROR`
- [x] テスト: `GitRepositoryExistsError` → `REPOSITORY_EXISTS`
- [x] テスト: `GitOperationError` → `GIT_OPERATION_FAILED`（stderr 優先 / message フォールバック）
- [x] テスト: 未知の Error → `INTERNAL_ERROR`
- [x] テスト: Error でないオブジェクト → `INTERNAL_ERROR` + `'Unknown error'`
- [x] テスト: `notFoundResult` / `successResult` の形式検証

### 3. IPC ハンドラー (`electron/ipc/ipc-handlers.ts`)

- [x] `extractRepoName` ユーティリティ関数
- [x] `IpcHandlerDeps` インターフェース定義
- [x] `registerIpcHandlers` 関数の骨格
- [x] テスト: `extractRepoName` — HTTPS URL, SSH URL, `.git` なし, 深いパス

#### 3a. リポジトリ操作ハンドラー

- [x] `repo:list` ハンドラー実装
- [x] テスト: 正常系 / ストアエラー時 `INTERNAL_ERROR`
- [x] `repo:get` ハンドラー実装
- [x] テスト: 存在する ID / 存在しない ID → `NOT_FOUND`
- [x] `repo:add` ハンドラー実装（URL 抽出 → cloneBare → addRepository）
- [x] テスト: 正常系 / `VALIDATION_ERROR` / `REPOSITORY_EXISTS` / `GIT_OPERATION_FAILED` / cloneBare 成功後 addRepository 失敗時のクリーンアップ
- [x] `repo:remove` ハンドラー実装
- [x] テスト: 正常系 / `NOT_FOUND`
- [x] `repo:branches` ハンドラー実装
- [x] テスト: 正常系 / `NOT_FOUND` / `GIT_OPERATION_FAILED`
- [x] `repo:fetch` ハンドラー実装
- [x] テスト: 正常系 / `NOT_FOUND`

#### 3b. Workspace 操作ハンドラー

- [x] `workspace:list` ハンドラー実装
- [x] テスト: 正常系
- [x] `workspace:get` ハンドラー実装
- [x] テスト: 存在する ID / `NOT_FOUND`
- [x] `workspace:create` ハンドラー実装（リポジトリ解決 → Worktree 作成 → .code-workspace 生成 → ストア登録 → VS Code 起動 + ロールバック処理）
- [x] テスト: 正常系フロー / 存在しない repositoryId → `NOT_FOUND` / Worktree 作成途中エラー時のロールバック / ロールバック中エラーは無視
- [x] `workspace:delete` ハンドラー実装
- [x] テスト: 正常系 / `NOT_FOUND` / 一部 Worktree 削除失敗でも継続
- [x] `workspace:open` ハンドラー実装
- [x] テスト: 正常系 / `NOT_FOUND` / `code` コマンド失敗

### 4. preload API 拡張 (`electron/preload.ts`)

- [x] リポジトリ操作メソッド追加（getRepositories, getRepository, addRepository, removeRepository, getRemoteBranches, fetchRepository）
- [x] Workspace 操作メソッド追加（getWorkspaces, getWorkspace, createWorkspace, deleteWorkspace, openWorkspace）

### 5. 型定義拡張 (`electron/electron.d.ts`)

- [x] `IpcResult<T>` 型定義追加
- [x] `ElectronAPI` インターフェースに全 IPC メソッドの型を追加

### 6. main.ts 統合

- [x] サービス初期化（SquadPaths, SquadStore, GitService, CodeWorkspaceService）
- [x] `registerIpcHandlers` 呼び出し追加
- [x] `createWindow` を async 化

### 7. 最終確認

- [x] 全テスト実行・パス確認
- [x] lint・format 確認
- [x] ビルド確認

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
