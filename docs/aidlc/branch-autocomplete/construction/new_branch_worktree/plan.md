# Implementation Plan: new_branch_worktree

## 概要

Workspace 作成時に、新規ブランチを起点ブランチから作成して worktree を追加する機能をバックエンド〜フロントエンドの全レイヤーに実装する。`sourceBranch` オプショナルフィールドを IPC 型に追加し、`GitService.createBranch()` を独立メソッドとして切り出し、`addWorktree()` を拡張する。

## 実装タスク

### 1. GitService — createBranch() 追加 + addWorktree() 拡張

- [ ] `createBranch(repoName, newBranch, sourceBranch)` メソッドを追加
- [ ] `addWorktree()` に `sourceBranch?` オプショナル引数を追加し、内部で `createBranch()` に委譲
- [ ] テスト: `createBranch()` の正常系・異常系テスト（git-service.spec.ts に追加）
- [ ] テスト: `addWorktree()` の `sourceBranch` 引数テスト（git-service.spec.ts に追加）

### 2. IPC 型拡張（ipc-channels.ts）

- [ ] `WorkspaceCreateRequest.entries` に `sourceBranch?: string` を追加

### 3. IPC ハンドラー変更（ipc-handlers.ts）

- [ ] `ResolvedWorkspaceEntry` に `sourceBranch?: string` を追加
- [ ] `workspace:create` ハンドラーで `sourceBranch` を解決・伝搬
- [ ] テスト: `sourceBranch` 未指定時の既存動作確認（ipc-handlers.spec.ts に追加）
- [ ] テスト: `sourceBranch` 指定時の `addWorktree` 呼び出し確認
- [ ] テスト: 混在エントリ（既存 + 新規ブランチ）の処理確認
- [ ] テスト: 新規ブランチ作成失敗時のロールバック確認

### 4. ElectronAPI 型定義変更（electron.d.ts）

- [ ] `createWorkspace` の entries 型に `sourceBranch?: string` を追加

### 5. preload.ts 変更

- [ ] `createWorkspace` の引数型に `sourceBranch?: string` を追加

### 6. WorkspaceService 変更（workspace.service.ts）

- [ ] `createWorkspace` の entries 型に `sourceBranch?: string` を追加

### 7. workspace-create-form.ts — buildEntries() 変更

- [ ] `buildEntries()` で新規ブランチ選択時に `sourceBranch` を含める

### 8. 最終確認

- [ ] 全テスト実行・パス確認
- [ ] lint・format 確認
- [ ] ビルド確認

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-11 | 初版作成 |
