# Code Generation Plan: Unit 2 — Angular UI

## 概要

Workspace 編集ページの Angular UI を実装する。WorkspaceService の拡張、WorkspaceEditComponent の新規作成、ルーティング追加、workspace-list への編集ボタン追加、翻訳キー追加を行う。

## 実装タスク

### 1. 翻訳キー追加

- [x] `public/i18n/en.json` に `workspaceEdit` セクションを追加
- [x] `public/i18n/ja.json` に `workspaceEdit` セクションを追加

### 2. WorkspaceService 拡張

- [x] `getWorkspace(id)` メソッドを追加
- [x] `addEntry(id, entries)` メソッドを追加
- [x] `removeEntry(id, repositoryIds)` メソッドを追加

### 3. WorkspaceEditComponent 新規作成

- [x] `src/app/workspaces/workspace-edit.ts` — コンポーネントクラス（シグナル設計、メソッド、バッチ確定ロジック）
- [x] `src/app/workspaces/workspace-edit.html` — テンプレート（ヘッダー、既存エントリ一覧、追加セクション、追加予定一覧、全削除時の Workspace 削除提案、保存ボタン）

### 4. ルーティング追加

- [x] `src/app/app.routes.ts` に `workspaces/:id/edit` ルートを追加（lazy load）

### 5. workspace-list への編集ボタン追加

- [x] `src/app/workspaces/workspace-list.ts` に `Router` inject、`lucidePencil` アイコン、`editWorkspace(id)` メソッドを追加
- [x] `src/app/workspaces/workspace-list.html` に編集アイコンボタンを追加（削除ボタンの左隣）

### 6. spartan-ng Select コンポーネントへの置き換え

- [x] `src/app/workspaces/workspace-edit.ts` に `BrnSelectImports` / `HlmSelectImports` を追加
- [x] `src/app/workspaces/workspace-edit.html` のリポジトリ選択を素の `<select>` から `brn-select` + `hlm-select-*` に置き換え
- [x] `onRepoSelected` メソッドの引数型を `brn-select` の `valueChange` に合わせて調整

### 7. コンポーネント分割リファクタリング

WorkspaceEditComponent を責務ごとの小さなサブコンポーネントに分割する。

#### 7-1. WorkspaceEntryListComponent 作成

- [x] `src/app/workspaces/workspace-entry-list.ts` — 既存エントリ一覧コンポーネント
  - input: `entries` (WorkspaceEntry[]), `pendingRemovals` (Set<string>), `repoMap` (Map<string, Repository>)
  - output: `markForRemoval` (string), `unmarkRemoval` (string)
- [x] `src/app/workspaces/workspace-entry-list.html` — テンプレート

#### 7-2. WorkspaceAddEntryFormComponent 作成

- [x] `src/app/workspaces/workspace-add-entry-form.ts` — 新規エントリ追加フォームコンポーネント
  - input: `availableRepos` (Repository[]), `branchesMap` (Map<string, string[]>), `disabled` (boolean)
  - output: `entryAdded` (PendingEntry)
  - 内部状態: selectedRepoId, branchSelection, fetchingIds
- [x] `src/app/workspaces/workspace-add-entry-form.html` — テンプレート（リポジトリ選択 + ブランチ選択 + 追加ボタン）

#### 7-3. WorkspacePendingListComponent 作成

- [x] `src/app/workspaces/workspace-pending-list.ts` — 追加予定エントリ一覧コンポーネント
  - input: `entries` (PendingEntry[]), `repoMap` (Map<string, Repository>)
  - output: `cancelAddition` (string)
- [x] `src/app/workspaces/workspace-pending-list.html` — テンプレート

#### 7-4. WorkspaceDeletePromptComponent 作成

- [x] `src/app/workspaces/workspace-delete-prompt.ts` — 全エントリ削除時の Workspace 削除提案コンポーネント
  - input: `workspaceName` (string)
  - output: `deleteConfirmed` (void)
- [x] `src/app/workspaces/workspace-delete-prompt.html` — テンプレート

#### 7-5. WorkspaceEditComponent リファクタリング

- [x] `workspace-edit.ts` からサブコンポーネントに移譲した状態・メソッドを削除し、サブコンポーネントを import
- [x] `workspace-edit.html` をサブコンポーネントの呼び出しに置き換え
- [x] 不要になった import を削除

#### 7-6. 最終確認

- [x] ビルド確認（`pnpm build`）
- [x] lint 確認（`pnpm lint:fix`）

## ストーリートレーサビリティ

| タスク                    | 要件                               | 対応内容                                           |
| ------------------------- | ---------------------------------- | -------------------------------------------------- |
| 翻訳キー追加              | UI-2, UI-3                         | 編集ページの全テキスト・フィードバックメッセージ   |
| WorkspaceService 拡張     | FR-1, FR-2, FR-5                   | getWorkspace / addEntry / removeEntry メソッド公開 |
| WorkspaceEditComponent    | UI-2, UI-3, FR-1, FR-2, FR-3, FR-4 | 編集ページ全体（エントリ管理 + バッチ確定）        |
| ルーティング追加          | UI-1                               | `/workspaces/:id/edit` ルート                      |
| workspace-list 編集ボタン | UI-1                               | 一覧カードに編集アイコンボタン追加                 |
| コンポーネント分割        | リファクタリング                   | 責務分離による保守性向上                           |
