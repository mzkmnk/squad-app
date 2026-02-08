# Implementation Plan: git_operations

## 概要

Git CLI をラップした `GitService`、入力バリデーションの `git-validation`、カスタムエラーの `git-errors`、および `.code-workspace` ファイル管理の `CodeWorkspaceService` を実装する。TDD アプローチで、テストを先に書き、その後実装を行う。

## 実装タスク

### 1. カスタムエラー定義（`electron/git/git-errors.ts`）

- [x] `GitValidationError`, `GitOperationError`, `GitRepositoryExistsError` を定義

### 2. バリデーション（`electron/git/git-validation.ts` + テスト）

- [x] テスト: `validateRemoteUrl` — HTTPS/SSH URL の受け入れ、空文字列・http・スキームなし・シェルメタ文字・スペース・改行の拒否（9ケース）
- [x] テスト: `validateBranchName` — 通常名・スラッシュ区切りの受け入れ、`..`・先頭`.`・末尾`.lock`・スペース・禁止文字・制御文字・先頭`-`・末尾`/`・連続`/` の拒否（12ケース）
- [x] テスト: `validateRepoName` — 英数字・ハイフン等の受け入れ、空文字列・101文字超・スラッシュ・スペース・日本語の拒否（7ケース）
- [x] 実装: `validateRemoteUrl`
- [x] 実装: `validateBranchName`
- [x] 実装: `validateRepoName`
- [x] テスト全パス確認（28テスト全パス）

### 3. GitService（`electron/git/git-service.ts` + テスト）

- [x] テスト: `cloneBare` — 正常クローン、`.git` ディレクトリ作成、`HEAD` ファイル存在、重複エラー、バリデーションエラー、存在しないリモートエラー（6ケース）
- [x] テスト: `removeBareRepository` — 正常削除、ディレクトリ不在確認、冪等性（3ケース）
- [x] テスト: `addWorktree` — 正常作成、ファイル展開、ディレクトリ自動作成、バリデーションエラー、存在しないブランチエラー（5ケース）
- [x] テスト: `removeWorktree` — 正常削除、ディレクトリ不在確認、冪等性（3ケース）
- [x] テスト: `fetch` — 正常取得（新ブランチ反映）、Bare Repository 不在エラー（2ケース）
- [x] テスト: `getRemoteBranches` — 一覧取得、`origin/HEAD` 除外、`origin/` プレフィックス除去、空リポジトリで空配列（4ケース）
- [x] 実装: `cloneBare`（+ bare clone 後の fetch refspec 設定）
- [x] 実装: `removeBareRepository`
- [x] 実装: `addWorktree`
- [x] 実装: `removeWorktree`
- [x] 実装: `fetch`
- [x] 実装: `getRemoteBranches`
- [x] テスト全パス確認（23テスト全パス）

### 4. CodeWorkspaceService（`electron/git/code-workspace-service.ts` + テスト）

- [x] テスト: `generate` — 正しいパス生成、相対パス、空settings、JSON整形、複数エントリ、ディレクトリ自動作成（6ケース）
- [x] テスト: `remove` — 正常削除、冪等性（2ケース）
- [x] 実装: `generate`
- [x] 実装: `remove`
- [x] テスト全パス確認（8テスト全パス）

### 5. 最終確認

- [x] 全テスト実行・パス確認（`npx vitest run electron/git/`）
- [x] lint 確認（`pnpm lint`）
- [x] format 確認（`pnpm format:check`）
- [x] Electron ビルド確認（`pnpm electron:build`）

### 6. 同名リソースの重複対応（UUID 先頭8文字 suffix）

各メソッドが独立して UUID v4 先頭8文字の suffix を生成し、リポジトリ名・Workspace 名・ブランチ名に付与する。重複時は新しい UUID で最大3回リトライし、解決しなければエラーを返す。

- [ ] 実装: `GitService.cloneBare` の変更 — suffix 付きリポジトリ名（`repoName-<suffix>`）+ 3回リトライ
- [ ] 実装: `GitService.addWorktree` の変更 — suffix 付きローカルブランチ作成（`git branch <branch>-<suffix> <branch>` → `git worktree add`）+ 3回リトライ
- [ ] 実装: `SquadStore.addWorkspace` の変更 — suffix 付き Workspace 名（`name-<suffix>`）+ 3回リトライ
- [ ] テスト: `cloneBare` — suffix 付き名前で Bare Repository が作成される、3回リトライ後にエラー
- [ ] テスト: `addWorktree` — suffix 付きブランチで worktree が作成される、3回リトライ後にエラー
- [ ] テスト: `addWorkspace` — suffix 付き名前で保存される、3回リトライ後にエラー
- [ ] テスト全パス確認
- [ ] lint / format 確認
