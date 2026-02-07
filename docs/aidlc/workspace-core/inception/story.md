# User Story: Workspace Core

## ユーザーストーリー（EARS形式）

### US1: リポジトリ登録

**WHEN** ユーザーがリポジトリ管理画面で「リポジトリ追加」を実行した時
**THEN** システムはリモートリポジトリURLを受け取り、`~/.squad/repos` 配下に Bare Repository としてクローンし、登録済みリポジトリ一覧に追加する

### US2: Workspace 作成

**WHEN** ユーザーが「Create Workspace」を実行した時
**THEN** システムはWorkspace名の入力、登録済みリポジトリの選択、各リポジトリのブランチ指定を受け付け、Worktreeを自動生成し、`.code-workspace` ファイルを作成する

### US3: Workspace オープン

**WHEN** ユーザーがDashboardからWorkspaceを選択して「Open」を実行した時
**THEN** システムは該当Workspaceの `.code-workspace` ファイルを使用してVS Codeを起動し、全リポジトリのフォルダがエクスプローラーに表示される

### US4: Workspace 削除

**WHEN** ユーザーがDashboardからWorkspaceを選択して「Delete」を実行した時
**THEN** システムは確認ダイアログを表示し、承認後に関連するWorktree実体・`.code-workspace` ファイル・設定データをディスクから完全消去する

### US5: 複数Workspaceの並行運用

**WHEN** ユーザーが既存Workspaceが稼働中の状態で新しいWorkspaceを作成した時
**THEN** システムは既存Workspaceに一切影響を与えず、独立した新しいWorkspaceを生成する

### US6: リポジトリごとの非対称ブランチ指定

**WHEN** ユーザーがWorkspace作成時にリポジトリごとのブランチを指定する時
**IF** リポジトリによって異なるブランチ（例: Backend: `feature/payment`, Infra: `main`）が指定された場合
**THEN** システムは各リポジトリに対してそれぞれ指定されたブランチのWorktreeを生成し、単一のWorkspaceとして統合する

---

## 受入条件（Given-When-Then形式）

### AC1: リポジトリをBare Repositoryとして登録できる

- **Given** ユーザーがリポジトリ管理画面を開いている
- **When** 有効なリモートリポジトリURL（例: `https://github.com/org/backend.git`）を入力し、登録を実行する
- **Then** `~/.squad/repos/<リポジトリ名>.git` に Bare Repository が作成され、リポジトリ一覧に表示される

### AC2: 登録済みリポジトリの一覧を表示できる

- **Given** 1つ以上のリポジトリが登録済みである
- **When** ユーザーがリポジトリ管理画面を開く
- **Then** 登録済みリポジトリの名前・URLが一覧表示される

### AC3: Workspaceを作成しVS Codeで開ける

- **Given** 1つ以上のリポジトリが登録済みである
- **When** ユーザーがWorkspace名（例: `feature-payment`）を入力し、リポジトリを選択し、各ブランチを指定して「作成」を実行する
- **Then** 以下が数秒以内に完了する:
  - 各リポジトリに対し `~/.squad/workspaces/<workspace名>/<リポジトリ名>` にWorktreeが作成される
  - `.code-workspace` ファイルが生成される
  - VS Codeが起動し、全リポジトリのフォルダがエクスプローラーに表示される

### AC4: リポジトリごとに異なるブランチを指定できる

- **Given** Backend と Infra の2つのリポジトリが登録済みである
- **When** ユーザーがWorkspace作成時に Backend: `feature/payment`, Infra: `main` を指定する
- **Then** Backend は `feature/payment` ブランチ、Infra は `main` ブランチのWorktreeがそれぞれ作成され、1つのWorkspaceとして統合される

### AC5: Workspace作成時にauto-fetchが実行される

- **Given** リポジトリが登録済みで、リモートに新しいブランチが追加されている
- **When** ユーザーがWorkspace作成画面を開く
- **Then** `git fetch` が自動実行され、最新のリモートブランチ一覧が選択肢に反映される

### AC6: Dashboard でWorkspace一覧を確認できる

- **Given** 1つ以上のWorkspaceが作成済みである
- **When** ユーザーがDashboard画面を開く
- **Then** 各Workspaceの名前・含まれるリポジトリ・ブランチ構成が一覧表示される

### AC7: 既存Workspaceを再度開ける

- **Given** 以前作成したWorkspaceが存在する
- **When** ユーザーがDashboardから該当Workspaceの「Open」を実行する
- **Then** 保存されたリポジトリ×ブランチ構成でVS Codeが起動する

### AC8: Workspaceを削除しディスクからも消去できる

- **Given** 不要になったWorkspaceが存在する
- **When** ユーザーがDashboardから該当Workspaceの「Delete」を実行し、確認ダイアログで承認する
- **Then** 以下が完了する:
  - 関連するWorktreeが `git worktree remove` で削除される
  - `.code-workspace` ファイルが削除される
  - Workspace設定データが永続化ストアから削除される
  - Dashboard一覧から該当Workspaceが消える

### AC9: 複数Workspaceが互いに干渉しない

- **Given** Workspace-A（Backend: `feature/a`）が稼働中である
- **When** ユーザーがWorkspace-B（Backend: `feature/b`）を新規作成する
- **Then** Workspace-Aのファイル・ブランチ状態に一切影響がなく、両方のWorkspaceが独立して動作する

### AC10: アプリ再起動後もWorkspace設定が保持される

- **Given** Workspaceが作成済みの状態でアプリを終了する
- **When** アプリを再起動する
- **Then** 以前作成したWorkspaceが全てDashboardに表示され、Open・Delete操作が可能である

### AC11: 全データが `~/.squad` 配下に隔離される

- **Given** ユーザーがリポジトリ登録やWorkspace作成を行う
- **When** ファイルシステムを確認する
- **Then** 全ての関連データ（Bare Repository, Worktree, 設定ファイル）が `~/.squad` 配下に格納されており、ユーザーのホームディレクトリ直下やDocuments等を汚染していない

---

## 非機能要件

### パフォーマンス

- Workspace作成（Worktree生成 + `.code-workspace` 作成）は、リポジトリのローカルキャッシュが存在する場合、5秒以内に完了すること
- Dashboard画面の初期表示は1秒以内にレンダリングされること
- `git fetch` はバックグラウンドで非同期実行し、UIをブロックしないこと

### セキュリティ

- Electron の `contextIsolation: true` / `nodeIntegration: false` を維持し、レンダラープロセスから直接Node.js APIにアクセスさせない
- Git操作は全て Electron メインプロセス側で `contextBridge` 経由のIPC通信を通じて実行する
- ユーザーが入力するリポジトリURLやブランチ名はバリデーションを行い、コマンドインジェクションを防止する
