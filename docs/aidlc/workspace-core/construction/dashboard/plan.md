# Implementation Plan: dashboard

## 概要

Dashboard 画面の Angular コンポーネントを実装する。作成済み Workspace の一覧表示・Open（VS Code 起動）・Delete（確認ダイアログ + 完全消去）操作を提供するアプリのメイン画面。

## 実装タスク

### 1. テスト作成（Test First）

- [ ] 1.1 `src/app/dashboard/dashboard.spec.ts` を作成し、テストデータ・モック・TestBed 設定を記述する
- [ ] 1.2 テスト: 初期化時に `getWorkspaces()` と `getRepositories()` が並行で呼ばれる
- [ ] 1.3 テスト: Workspace 取得成功時に `workspaces` シグナルが更新される
- [ ] 1.4 テスト: リポジトリ取得成功時に `repositories` シグナルが更新される
- [ ] 1.5 テスト: Workspace 取得失敗時に `toast.error()` が呼ばれる
- [ ] 1.6 テスト: リポジトリ取得失敗時に `toast.error()` が呼ばれる
- [ ] 1.7 テスト: 初期化完了後に `loading` が `false` になる
- [ ] 1.8 テスト: `getRepoName()` が正しいリポジトリ名を返す / 存在しない ID に `'不明なリポジトリ'` を返す
- [ ] 1.9 テスト: `openWorkspace()` が正しい ID で呼ばれ、成功時に `toast.success()`、失敗時に `toast.error()` が呼ばれる
- [ ] 1.10 テスト: Open 処理中に `openingIds` に ID が追加され、完了後に削除される
- [ ] 1.11 テスト: `deleteWorkspace()` が正しい ID で呼ばれ、成功時に `workspaces` から削除 + `toast.success()`、失敗時に `toast.error()` + `workspaces` 変更なし
- [ ] 1.12 テスト: 削除処理中に `deletingIds` に ID が追加され、完了後に削除される
- [ ] 1.13 テスト: `navigateToCreate()` が `/workspaces/new` に遷移する
- [ ] 1.14 テスト: `navigateToRepos()` が `/repos` に遷移する
- [ ] 1.15 テスト: Workspace が 0 件の場合に空状態メッセージが表示される
- [ ] 1.16 テスト: `repoMap` computed が正しい Map を生成する / 空の場合に空 Map を返す

### 2. DashboardComponent 実装

- [ ] 2.1 `src/app/dashboard/dashboard.ts` を作成（コンポーネントクラス・シグナル・メソッド）
- [ ] 2.2 `src/app/dashboard/dashboard.html` を作成（テンプレート: ヘッダー・ローディング・空状態・Workspace カード一覧・AlertDialog）
- [ ] 2.3 テストを実行し全テストがパスすることを確認する

### 3. ルーティング変更

- [ ] 3.1 `src/app/app.routes.ts` に `/dashboard` ルートを追加し、デフォルトリダイレクトを `/dashboard` に変更する

### 4. 最終確認

- [ ] 4.1 全テスト実行・パス確認（`pnpm test:ng`）
- [ ] 4.2 lint・format 確認（`pnpm lint` / `pnpm format:check`）
- [ ] 4.3 ビルド確認（`pnpm build`）

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2025-07-15 | 初版作成 |
