# Implementation Plan: workspace_create

## 概要

Workspace 作成フローの Angular コンポーネント（WorkspaceCreateComponent）と IPC サービス（WorkspaceService）を実装する。リポジトリ選択・ブランチ指定・auto-fetch・バリデーション・Workspace 生成までの一連の操作を提供する。

## 実装タスク

### 1. spartan-ng UI コンポーネントのインストール

- [x] `ng g @spartan-ng/cli:ui select` で Select コンポーネントをインストール
- [x] `ng g @spartan-ng/cli:ui checkbox` で Checkbox コンポーネントをインストール

### 2. WorkspaceService の実装

- [x] `src/app/services/workspace.service.ts` を作成（`window.electronAPI` の薄いラッパー）
- [x] テスト: `src/app/services/workspace.service.spec.ts` を作成
  - `getWorkspaces()` / `createWorkspace()` / `deleteWorkspace()` / `openWorkspace()` の各メソッドが対応する `window.electronAPI` メソッドを呼び出すことを検証

### 3. WorkspaceCreateComponent の実装

- [x] `src/app/workspaces/workspace-create.ts` を作成（シグナル・ロジック・auto-fetch）
- [x] `src/app/workspaces/workspace-create.html` を作成（テンプレート）
- [x] テスト: `src/app/workspaces/workspace-create.spec.ts` を作成
  - 初期化テスト（リポジトリ取得・auto-fetch）
  - リポジトリ選択/解除ロジック
  - ブランチ選択ロジック
  - バリデーション（名前・リポジトリ選択・ブランチ選択）
  - canSubmit computed
  - Workspace 作成（成功/失敗）
  - ナビゲーション

### 4. ルーティング・既存コンポーネント変更

- [x] `src/app/app.routes.ts` に `/workspaces/new` ルートを追加
- [x] `src/app/repos/repo-list.ts` に Workspace 作成画面への遷移ボタンを追加
- [x] `src/app/repos/repo-list.html` のヘッダーに「Workspace を作成」ボタンを追加

### 5. 最終確認

- [x] 全テスト実行・パス確認（`pnpm test:ng`）
- [x] lint・format 確認（`pnpm lint` / `pnpm format:check`）
- [x] ビルド確認（`pnpm build`）

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
