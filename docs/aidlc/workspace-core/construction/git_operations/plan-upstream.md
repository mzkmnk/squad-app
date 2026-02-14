# Implementation Plan: addWorktree upstream 自動設定 (Issue #64)

## 概要

`addWorktree()` で Worktree を作成した後、作成されたブランチの upstream が起点ブランチを引き継いでしまう問題を修正する。Worktree 作成後に `git config` で `branch.<actualBranch>.remote` と `branch.<actualBranch>.merge` を明示的に設定し、`git push` が正しいリモートブランチに向くようにする。

## 実装タスク

### 1. テスト追加（TDD: Test First）

- [x] `git-service.spec.ts` の `addWorktree (sourceBranch)` describe ブロック内に、Worktree 作成後にブランチの upstream remote が `origin` に設定されていることを検証するテストを追加
- [x] 同 describe ブロック内に、Worktree 作成後にブランチの upstream merge が `refs/heads/<actualBranch>` に設定されていることを検証するテストを追加
- [x] テスト実行・失敗確認（Red）

### 2. 実装

- [x] `git-service.ts` の `addWorktree()` メソッド内、`git worktree add` の後・`return actualBranch` の前に `git config branch.<actualBranch>.remote origin` を追加
- [x] 同箇所に `git config branch.<actualBranch>.merge refs/heads/<actualBranch>` を追加
- [x] テスト実行・パス確認（Green）

### 3. 最終確認

- [x] 全テスト実行・パス確認（`pnpm test:electron`）
- [x] lint 確認（`pnpm lint`）
- [x] ビルド確認（`pnpm electron:build`）

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2025-07-15 | 初版作成 |
