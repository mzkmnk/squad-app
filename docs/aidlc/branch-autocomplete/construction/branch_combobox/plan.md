# Implementation Plan: branch_combobox

## 概要

Workspace 作成フォームおよび新規ブランチ作成ダイアログで再利用可能な、ブランチ選択用オートコンプリートコンポーネントを新規作成する。`@spartan-ng/brain/autocomplete` + `@spartan-ng/helm/autocomplete` を基盤とし、テキスト入力による部分一致フィルタリング（大文字小文字を区別しない）を提供する。

## 実装タスク

### 1. セットアップ: spartan-ng helm ラッパー生成

- [x] 1.1 `ng g @spartan-ng/cli:ui popover` で popover helm ラッパーを生成
- [x] 1.2 `ng g @spartan-ng/cli:ui autocomplete` で autocomplete helm ラッパーを生成
- [x] 1.3 `tsconfig.json` の `paths` に `@spartan-ng/helm/popover` と `@spartan-ng/helm/autocomplete` を追加
- [x] 1.4 生成されたファイルの確認・ビルド確認

### 2. コンポーネント実装

- [x] 2.1 `src/app/shared/branch-combobox/branch-combobox.ts` を作成（コンポーネント本体）
- [x] 2.2 `src/app/shared/branch-combobox/branch-combobox.html` を作成（テンプレート）

### 3. 最終確認

- [x] 3.1 lint・format 確認（`pnpm lint` / `pnpm format:check`）
- [x] 3.2 ビルド確認（`pnpm build`）

## 更新履歴

| 日付       | 内容                                     |
| ---------- | ---------------------------------------- |
| 2025-07-25 | 初版作成                                 |
| 2025-07-25 | テスト作成ステップを削除（ユーザー指示） |
