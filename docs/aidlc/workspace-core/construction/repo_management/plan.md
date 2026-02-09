# Implementation Plan: repo_management

## 概要

リポジトリ管理画面の Angular コンポーネント（RepoListComponent, RepoAddFormComponent）と RepositoryService を実装する。spartan-ng/helm UI コンポーネントのインストール、ルーティング設定、テストを含む。

## 実装タスク

### 1. spartan-ng/helm UI コンポーネントのインストール

- [x] `card`, `sonner`, `alert-dialog`, `field`, `input`, `spinner`, `icon` を `ng g @spartan-ng/cli:ui` でインストール

### 2. RepositoryService の実装

- [x] `src/app/services/repository.service.ts` を作成（window.electronAPI のラッパー）
- [x] テスト: `src/app/services/repository.service.spec.ts` — 全5メソッドの委譲テスト

### 3. RepoAddFormComponent の実装

- [x] `src/app/repos/repo-add-form.ts` + `repo-add-form.html` を作成
- [x] テスト: `src/app/repos/repo-add-form.spec.ts` — バリデーション、送信、キャンセルのテスト

### 4. RepoListComponent の実装

- [x] `src/app/repos/repo-list.ts` + `repo-list.html` を作成
- [x] テスト: `src/app/repos/repo-list.spec.ts` — 一覧表示、追加、削除、ローディング、エラーのテスト

### 5. ルーティング・ルートコンポーネント変更

- [x] `src/app/app.routes.ts` に `/repos` ルート追加 + デフォルトリダイレクト
- [x] `src/app/app.ts` を変更（RouterOutlet + HlmToasterComponent の import、テストコード削除）
- [x] `src/app/app.html` を変更（`<router-outlet />` + `<hlm-toaster />`）

### 6. 最終確認

- [x] 全テスト実行・パス確認（`pnpm test:ng`）
- [x] lint・format 確認（`pnpm lint` + `pnpm format:check`）
- [x] ビルド確認（`pnpm build`）

## 更新履歴

| 日付       | 内容         |
| ---------- | ------------ |
| 2026-02-09 | 初版作成     |
| 2026-02-09 | 全タスク完了 |
