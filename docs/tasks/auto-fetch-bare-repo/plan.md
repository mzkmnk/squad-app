# Bare Repository 自動 fetch 改善計画

## 背景

現在、Bare Repository の fetch は以下の2パターンでのみ実行される：

1. `REPO_FETCH` IPC — ユーザーが明示的に fetch を呼んだとき
2. `WORKSPACE_ADD_ENTRY` — Workspace にエントリを追加する直前

そのため、以下の操作では古い状態のまま動作してしまう：

- `REPO_BRANCHES`（ブランチ一覧取得）— fetch せずにローカルの `refs/remotes/origin/*` を返す
- `WORKSPACE_CREATE`（Workspace 作成）— fetch なしで worktree を作成する

また、アプリ起動中にリモートが更新されても、ユーザーが手動で fetch しない限り反映されない。

### 問題点

- ブランチ一覧が古い（新しいリモートブランチが表示されない、削除済みブランチが残る）
- Workspace 作成時に古いコミットから worktree が作られる可能性がある
- `WORKSPACE_ADD_ENTRY` だけ fetch するのに `WORKSPACE_CREATE` はしないという非対称な設計

## 方針

3つの改善を実施する：

1. `REPO_BRANCHES` の前に fetch を追加
2. `WORKSPACE_CREATE` の各 worktree 作成前に fetch を追加（`WORKSPACE_ADD_ENTRY` と同じパターン）
3. バックグラウンド定期 fetch サービスを導入

## TODO

### 1. `REPO_BRANCHES` ハンドラに fetch を追加（`electron/ipc/ipc-handlers.ts`）

- [x] `getRemoteBranches()` 呼び出しの前に `gitService.fetch(repo.name)` を追加
- [x] fetch は独立した try/catch で囲み、失敗時（ネットワークエラー含む）もキャッシュ済みのブランチ一覧を返す（ベストエフォート）。ハンドラ全体の try/catch に巻き込まれないようにする

### 2. `WORKSPACE_CREATE` ハンドラに fetch を追加（`electron/ipc/ipc-handlers.ts`）

- [x] worktree 作成ループ（ステップ3「各エントリに対して Worktree を作成」）の各イテレーション冒頭で `gitService.fetch(resolved.repo.name)` を追加
- [x] 同一リポジトリの重複 fetch を避けるため、fetch 済みリポジトリ名を `Set<string>` で管理する
- [x] fetch 失敗時はエラーを返す（`WORKSPACE_ADD_ENTRY` と同じ動作: fetch 失敗 → ロールバック → エラー返却）

### 3. `BackgroundFetchService` の作成（`electron/git/background-fetch-service.ts`）

- [x] `BackgroundFetchService` クラスを新規作成
  - コンストラクタ: `GitService`, `SquadStore`, `intervalMs`（デフォルト 5 分）を受け取る
  - `start()`: 定期 fetch を開始（初回は即時実行）
  - `stop()`: 定期 fetch を停止
  - `fetchAll()`: 全登録リポジトリを `Promise.allSettled` で並列 fetch（個別の失敗は `console.error` でログ出力して継続）
- [x] テスト作成（`electron/git/background-fetch-service.spec.ts`）

### 4. メインプロセスへの組み込み（`electron/main.ts`）

- [x] `BackgroundFetchService` インスタンスをモジュールスコープの変数として保持する（`initializeServices()` のスコープ外からアクセスするため）
- [x] `initializeServices()` 内で `BackgroundFetchService` を生成・`start()` を呼び出す
- [x] `app.on('before-quit')` で `stop()` を呼び出す

### 5. テスト

- [x] 既存テストの修正: `REPO_BRANCHES` の既存テストに `gitService.fetch` のモック設定を追加（fetch 追加により既存テストが失敗するため）
- [x] 既存テストの修正: `WORKSPACE_CREATE` の既存テストに `gitService.fetch` のモック設定を追加
- [x] `REPO_BRANCHES` ハンドラのテスト: fetch が呼ばれた後にブランチ一覧が返ることを確認
- [x] `REPO_BRANCHES` ハンドラのテスト: fetch 失敗時もブランチ一覧が返ることを確認
- [x] `WORKSPACE_CREATE` ハンドラのテスト: 各リポジトリに対して fetch が呼ばれることを確認
- [x] `WORKSPACE_CREATE` ハンドラのテスト: 同一リポジトリが複数エントリにある場合、fetch は1回のみ
- [x] `BackgroundFetchService` のテスト: start/stop/fetchAll の動作確認

### 6. 動作確認

- [ ] リポジトリ登録後、リモートに新しいブランチを push し、ブランチ一覧に反映されることを確認
- [ ] Workspace 作成時にリモート最新のコミットから worktree が作られることを確認
- [ ] アプリ起動後、5 分経過でバックグラウンド fetch が実行されることを確認（ログ出力で検証）

## 対象ファイル

| ファイル                                        | 変更内容                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `electron/ipc/ipc-handlers.ts`                  | `REPO_BRANCHES` と `WORKSPACE_CREATE` に fetch 追加 |
| `electron/ipc/ipc-handlers.spec.ts`             | 既存テストの修正 + 新規テストケース追加             |
| `electron/git/background-fetch-service.ts`      | 新規: バックグラウンド定期 fetch サービス           |
| `electron/git/background-fetch-service.spec.ts` | 新規: テスト                                        |
| `electron/main.ts`                              | `BackgroundFetchService` の生成・ライフサイクル管理 |
