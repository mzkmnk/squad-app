# Implementation Plan: dashboard

## 概要

Dashboard 画面の Angular コンポーネントを実装する。作成済み Workspace の一覧表示・Open（VS Code 起動）・Delete（確認ダイアログ + 完全消去）操作を提供するアプリのメイン画面。

## 現状

- `dashboard.ts` — 設計書通りに実装済み（DatePipe import 含む）
- `dashboard.html` — 空ファイル（テンプレート未作成）
- `dashboard.spec.ts` — ユーザー指示により作成不要（コンポーネントテスト不要）
- `app.routes.ts` — `/dashboard` ルート未追加、デフォルトは `/repos`

## 実装タスク

### 1. テンプレート作成

- [x] 1.1 `src/app/dashboard/dashboard.html` を作成（ヘッダー・ローディング・空状態・Workspace カード一覧・AlertDialog）

### 2. ルーティング変更

- [x] 2.1 `src/app/app.routes.ts` に `/dashboard` ルートを追加し、デフォルトリダイレクトを `/dashboard` に変更する

### 3. テスト修正・確認

- [x] 3.1 `dashboard.spec.ts` の lint エラーを修正する（テンプレート作成後に型解決が可能になるため、残存エラーがあれば対応）→ ユーザー指示によりコンポーネントテスト不要のため対象なし
- [x] 3.2 テストを実行し全テストがパスすることを確認する

### 4. 最終確認

- [x] 4.1 全テスト実行・パス確認（`pnpm test:ng`）— 150 tests passed（Angular 9 + Electron 141）
- [x] 4.2 lint・format 確認（`pnpm lint` / `pnpm format:check`）— 全合格
- [x] 4.3 ビルド確認（`pnpm build`）— 成功（dashboard チャンク 6.91 kB で遅延読み込み生成）

## 更新履歴

| 日付       | 内容                                                     |
| ---------- | -------------------------------------------------------- |
| 2025-07-15 | 初版作成                                                 |
| 2025-07-15 | 現状分析に基づきプランを更新（既存実装を考慮した構成に） |
| 2025-07-15 | 全タスク完了                                             |
