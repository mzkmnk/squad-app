---
inclusion: manual
---

# AI-DLC Inception: User Stories（条件付き）

## 実行条件（高優先度）

- 新しいユーザー向け機能
- ユーザーワークフローに影響する変更
- 複数のユーザータイプが関与
- 複雑なビジネス要件

## スキップ条件

- 純粋な内部リファクタリング
- 単純なバグ修正
- ユーザー影響のないインフラ変更
- ドキュメントのみの更新

## 手順（Planning → Generation の2パート）

### Part 1 - Planning

1. ストーリー計画を作成（チェックボックス付き）
2. コンテキストに応じた質問を `[Answer]:` タグで生成
3. ユーザー回答を収集
4. 回答の曖昧さを分析、フォローアップ質問
5. 計画の承認を得る

### Part 2 - Generation

1. 承認された計画に基づきストーリーを生成
2. ペルソナの定義（必要な場合）
3. 受入条件の定義（Given-When-Then 形式）

## 成果物

- `docs/aidlc/{feature_name}/inception/plans/story-generation-plan.md`
- `docs/aidlc/{feature_name}/inception/user-stories/stories.md`
- `docs/aidlc/{feature_name}/inception/user-stories/personas.md`（必要な場合）
