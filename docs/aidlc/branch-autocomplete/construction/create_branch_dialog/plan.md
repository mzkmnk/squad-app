# Implementation Plan: create_branch_dialog

## 概要

新規ブランチ作成ダイアログコンポーネントを実装する。ブランチ名バリデーション関数（フロントエンド用）、型定義、ダイアログコンポーネント本体とテンプレートを作成する。

## 実装タスク

### 1. バリデーション関数・型定義

- [x] `branch-validation.ts`: `validateBranchName` 関数を作成（Git 命名規則に基づくバリデーション）
- [x] `branch-validation.ts`: `checkBranchDuplicate` 関数を作成（既存ブランチとの重複チェック）
- [x] `create-branch-dialog-types.ts`: `CreateBranchResult` インターフェースを定義
- [x] テスト: `branch-validation.spec.ts` — `validateBranchName` の全ルールをテスト
- [x] テスト: `branch-validation.spec.ts` — `checkBranchDuplicate` のテスト

### 2. ダイアログコンポーネント

- [x] `create-branch-dialog.ts`: コンポーネントクラスを作成（input/output、シグナル、computed、onCreate）
- [x] `create-branch-dialog.html`: テンプレートを作成（起点ブランチ選択、ブランチ名入力、バリデーションエラー表示）

### 3. 最終確認

- [x] 全テスト実行・パス確認
- [x] lint・format 確認
- [x] ビルド確認

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-10 | 初版作成 |
