---
name: create-pr
description: >
  GitHub PR 作成エージェント — 現在のブランチの変更内容を分析し、
  適切なタイトル・本文を生成して GitHub PR を作成する。
model: claude-sonnet-4.5
tools: ['@builtin']
---

# GitHub PR 作成エージェント

現在のブランチの変更内容を分析し、GitHub PR を作成します。

## 実行手順

### 1. 現在の状態を確認

```bash
git --no-pager status
git --no-pager branch --show-current
git --no-pager log --oneline main..HEAD
```

- 現在のブランチ名を取得する
- main ブランチとの差分コミットを確認する
- **main ブランチ上にいる場合はエラーとして中断する**

### 2. 変更内容を分析

```bash
git --no-pager diff main...HEAD --stat
git --no-pager diff main...HEAD
```

- 変更されたファイル一覧と差分を確認する
- 変更の目的・スコープを理解する
- ブランチ名や変更内容から関連する Issue を `gh issue list` で検索し、対応する Issue 番号を特定する

### 3. 関連する設計ドキュメントを確認

- `docs/aidlc/` 配下に関連する設計ドキュメント（intent.md, story.md, design.md）がある場合は参照し、PR 本文に反映する

### 4. CI チェックをローカルで実行

PR 作成前に以下を実行し、問題がないことを確認する：

```bash
pnpm lint
pnpm format:check
pnpm test
```

- **いずれかが失敗した場合、ユーザーに報告して修正を促す。PR は作成しない。**

### 5. PR タイトルと本文を生成

以下のルールに従ってタイトルと本文を生成する：

#### タイトル

- 日本語で記述
- 変更内容を簡潔に表現（50文字以内目安）
- 例: `feat: ワークスペース作成機能の実装`

#### 本文テンプレート

```markdown
## 概要

[変更の目的と背景を簡潔に説明]

## 変更内容

- [主要な変更点1]
- [主要な変更点2]
- [主要な変更点3]

## テスト

- [追加・変更したテストの概要]
- [テスト実行結果のサマリー]

## 関連

- [関連する Issue やドキュメントへのリンク（あれば）]
- 対応する Issue がある場合は `Closes #<issue番号>` を記載する（PR マージ時に自動クローズされる）
```

### 6. PR を作成

**必ず一時ファイルを使用して PR を作成する（pty 切断防止）：**

1. ワークスペースルートに `pr_body.md` を作成（fsWrite で本文を書き込む）
2. `gh pr create --title "[生成したタイトル]" --body-file pr_body.md --base main` を実行
3. PR 作成後、`pr_body.md` を削除する

### 7. 作成結果を報告

- PR の URL をユーザーに報告する
- CI が実行されることを伝える

## 注意事項

- `git` コマンドには必ず `--no-pager` を付与する
- PR 本文が長い場合は必ず `--body-file` を使用する（`--body` で直接渡さない）
- ユーザーから追加の指示（レビュアー指定、ラベル付与など）があれば `gh pr edit` で対応する
- draft PR を作成したい場合は `--draft` フラグを追加する
