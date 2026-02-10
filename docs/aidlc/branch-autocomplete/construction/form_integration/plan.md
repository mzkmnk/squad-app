# Implementation Plan: form_integration

## 概要

Workspace 作成フォーム（`WorkspaceCreateFormComponent`）の既存ブランチ選択ドロップダウン（`brn-select`）を Unit 1 で作成済みの `BranchComboboxComponent` に置き換え、各リポジトリのブランチ入力欄の横に「新規作成」ボタンを追加する。新規ブランチ情報（起点ブランチ・新規ブランチ名）をフォーム状態として保持し、送信時にその情報を含めて Workspace 作成を実行できるようにする。

> **テスト戦略**: 本 Unit は純粋な UI 変更のため、ユニットテストは作成しない（設計書でもテスト計画セクションは削除済み）。

## 実装タスク

### 1. 型定義の追加（workspace-create-form.ts）

- [x] 1-1: `NewBranchInfo` インターフェースを定義（sourceBranch, newBranchName）
- [x] 1-2: `BranchSelection` Discriminated Union 型を定義（existing / new）

### 2. 状態管理の変更（workspace-create-form.ts）

- [x] 2-1: `selectedBranches` シグナルを `branchSelections: Signal<Map<string, BranchSelection>>` に変更
- [x] 2-2: `selectBranch` メソッドを変更（引数 `branch: string | null`、null 時は削除、非 null 時は `{ type: 'existing' }` で設定）
- [x] 2-3: `setNewBranch` メソッドを新規追加（`{ type: 'new', newBranchInfo }` で設定）
- [x] 2-4: `openCreateBranchDialog` スタブメソッドを新規追加（Unit 3 統合用）
- [x] 2-5: `toggleRepo` メソッドを変更（`selectedBranches` → `branchSelections` に参照変更）
- [x] 2-6: `canSubmit` computed を変更（`branchSelections` ベースに変更、新規ブランチ名の空チェック追加）
- [x] 2-7: `validate` メソッドを変更（`branchSelections` ベースに変更）
- [x] 2-8: `buildEntries` private メソッドを新規追加（branchSelections → entries 変換ロジック）
- [x] 2-9: `onSubmit` メソッドを変更（`buildEntries()` を使用）
- [x] 2-10: `getSelectedBranchName` テンプレートヘルパーメソッドを新規追加

### 3. import の変更（workspace-create-form.ts）

- [x] 3-1: `BrnSelectImports` / `HlmSelectImports` の import を削除
- [x] 3-2: `BranchComboboxComponent` の import を追加
- [x] 3-3: `lucideGitBranchPlus` アイコンの import と `provideIcons` への追加
- [x] 3-4: `@Component.imports` 配列を更新（BrnSelectImports/HlmSelectImports 削除、BranchComboboxComponent 追加）

### 4. テンプレートの変更（workspace-create-form.html）

- [x] 4-1: `brn-select` ブロックを `app-branch-combobox` + 新規作成ボタンに差し替え
- [x] 4-2: コンボボックスに `[branches]`, `[value]`, `[disabled]`, `(valueChange)` バインディングを設定
- [x] 4-3: 新規作成ボタンに `lucideGitBranchPlus` アイコン、`aria-label`、`(click)` ハンドラを設定
- [x] 4-4: `flex items-start gap-2` レイアウトでコンボボックスとボタンを横並び配置

### 5. 最終確認

- [x] 5-1: lint・format 確認（`pnpm lint` / `pnpm format:check`）
- [x] 5-2: ビルド確認（`pnpm build`）

## 更新履歴

| 日付       | 内容                                                   |
| ---------- | ------------------------------------------------------ |
| 2025-07-25 | 初版作成                                               |
| 2025-07-25 | テスト関連タスクを削除（純粋 UI 変更のためテスト不要） |
| 2025-07-25 | ステップ 1〜4 実装完了                                 |
| 2025-07-25 | ステップ 5 最終確認完了（lint / format / build パス）  |
