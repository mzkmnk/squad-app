# Requirements — workspace-edit

## 1. 概要

既存の Workspace に対して、エントリ（リポジトリ × ブランチの組み合わせ）の追加・削除を行う機能を提供する。

## 2. 機能要件

### FR-1: エントリの追加

- ユーザーは既存の Workspace に新しいリポジトリ × ブランチのエントリを追加できる
- 追加時、既存ブランチの選択と新規ブランチの作成（sourceBranch 指定）の両方をサポートする
- 追加処理:
  1. `git worktree add` で Worktree を作成
  2. ストア（`workspaces.json`）の `entries` を更新
  3. `.code-workspace` ファイルを再生成
- 追加が途中で失敗した場合、作成済み Worktree を削除するロールバックを行う

### FR-2: エントリの削除

- ユーザーは Workspace から既存のエントリを削除できる
- 削除処理:
  1. `git worktree remove` で Worktree を削除
  2. ストアの `entries` を更新
  3. `.code-workspace` ファイルを再生成
- 削除はベストエフォート（一部失敗しても継続）

### FR-3: 全エントリ削除時の Workspace 削除提案

- 最後のエントリを削除しようとした場合、Workspace 自体の削除を提案する確認ダイアログを表示する
- ユーザーが承認した場合、既存の `workspace:delete` フローで Workspace を削除する
- ユーザーがキャンセルした場合、エントリ削除は行わない

### FR-4: 同一リポジトリの重複防止

- 1つの Workspace 内で同一リポジトリのエントリは1つのみ許可する
- エントリ追加 UI では、既に Workspace に含まれているリポジトリを選択不可（disabled）にする

### FR-5: Workspace 詳細の取得

- `workspace:get` チャネルは既に Electron 側に実装済みだが、Angular の `WorkspaceService` に未公開
- 編集ページで Workspace の最新状態を取得するために `WorkspaceService.getWorkspace(id)` を公開する

## 3. ユーザーインタラクション

### UI-1: 編集ページへの遷移

- Workspace 一覧画面のカードに編集アイコンボタンを追加する（削除ボタンの左隣）
- 編集アイコンをクリックすると、専用の編集ページ（`/workspaces/:id/edit`）に遷移する

### UI-2: 編集ページの構成

- 既存エントリの一覧表示（リポジトリ名 + ブランチ名 + 削除ボタン）
- 新規エントリ追加セクション:
  - 未追加のリポジトリから選択（既に含まれているリポジトリは選択不可）
  - ブランチ選択（`BranchComboboxComponent` を再利用）
  - 新規ブランチ作成（`CreateBranchDialogComponent` を再利用）
- 「戻る」ナビゲーション（Workspace 一覧に戻る）

### UI-3: 操作フィードバック

- エントリ追加・削除の成功/失敗時に toast 通知を表示する
- 処理中はローディング状態を表示する（ボタン無効化 + スピナー）

## 4. 非機能要件

### NFR-1: 整合性

- エントリ追加のロールバック: Worktree 作成後にストア更新が失敗した場合、作成した Worktree を削除する
- エントリ削除のベストエフォート: Worktree 削除が失敗してもストア更新は続行する
- `.code-workspace` ファイルは操作完了後に毎回再生成して整合性を保つ

### NFR-2: IDE 連携

- `.code-workspace` ファイルの再生成について、IDE 側の自動リロードに委ねる（特別な制御は行わない）

## 5. IPC チャネル設計

### 新規チャネル

| チャネル名               | 用途                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `workspace:add-entry`    | Workspace にエントリを追加（Worktree 作成 + ストア更新 + .code-workspace 再生成）   |
| `workspace:remove-entry` | Workspace からエントリを削除（Worktree 削除 + ストア更新 + .code-workspace 再生成） |

### 既存チャネルの活用

| チャネル名         | 用途                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `workspace:get`    | 編集ページで Workspace の最新状態を取得（Angular Service への公開が必要） |
| `workspace:delete` | 全エントリ削除時の Workspace 削除（既存フローをそのまま使用）             |

## 6. スコープ外

- エントリのブランチ変更（同一リポジトリで別ブランチへの切り替え）
- Workspace の表示名（displayName）の変更
- 同一リポジトリの複数エントリ対応（ディレクトリ構造の変更）

## 7. ルーティング

- 新規ルート: `workspaces/:id/edit` → `WorkspaceEditComponent`（lazy load）
- 既存ルート `workspaces` は変更なし
