# ブランチ選択 UI 改善計画

## 背景

Workspace 作成時に「既存ブランチを選択」しても、内部的には `refs/remotes/origin/<branch>` の最新コミットから新規ローカルブランチ（suffix 付き）が作成される。
UIの表現と実際の動作にギャップがあり、ユーザーが「既存ブランチをそのままチェックアウトする」と誤解しやすい。

### 現状の動作

1. ユーザーが `develop` を選択
2. 内部: `git branch develop-xxxx refs/remotes/origin/develop` → `git worktree add ... develop-xxxx`
3. 結果: リモートの最新 `develop` から `develop-xxxx` という新規ブランチが作成される

### 問題点

- 「既存ブランチを選択」というUIラベルが、実際の動作（リモート最新から新規ブランチ作成）と一致しない
- suffix 付きブランチが作られることが事前に伝わらない

## 方針

案1（ラベル変更）+ 案2（ヘルプテキスト追加）を組み合わせて改善する。

## TODO

### 1. i18n キーの追加・変更（`public/i18n/ja.json`）

- [x] `workspaces.reposAndBranches` のラベルを「リポジトリと起点ブランチ」に変更
- [x] `workspaces.branchHint` を追加: 「選択したブランチのリモート最新から作業用ブランチが作成されます」
- [x] `branches.searchPlaceholder` を「起点ブランチを検索...」に変更

### 2. Workspace 作成フォームのテンプレート修正（`src/app/workspaces/workspace-create-form.html`）

- [x] セクション見出し `reposAndBranches` の下にヘルプテキスト（`branchHint`）を表示する `<p>` を追加
- [x] スタイル: `text-muted-foreground text-xs` で控えめに表示

### 3. ブランチコンボボックスの placeholder 更新（`src/app/shared/branch-combobox/branch-combobox.ts`）

- [x] デフォルト placeholder を i18n キー `branches.searchPlaceholder` の値に合わせる（呼び出し元から渡す）

### 4. 動作確認

- [x] Workspace 作成ダイアログを開き、ラベルとヘルプテキストが正しく表示されることを確認
- [x] 新規ブランチ作成ダイアログ側のラベルとの整合性を確認（こちらは元々「起点ブランチ」表記なので問題なし）

## 対象ファイル

| ファイル                                            | 変更内容                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| `public/i18n/ja.json`                               | キー追加・ラベル変更                           |
| `src/app/workspaces/workspace-create-form.html`     | ヘルプテキスト追加                             |
| `src/app/shared/branch-combobox/branch-combobox.ts` | placeholder デフォルト値の調整（必要に応じて） |
