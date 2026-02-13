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

### 7. 最終確認

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

## 承認

以下のいずれかを選択してください:

- 🔧 **変更を依頼**
- ✅ **承認して次のステージへ**
