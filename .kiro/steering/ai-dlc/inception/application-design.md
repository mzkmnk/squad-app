---
inclusion: manual
---

# AI-DLC Inception: Application Design（条件付き）

高レベルのコンポーネント識別とサービス層設計。
詳細なビジネスロジック設計は Construction フェーズの Functional Design で行う。

## 実行条件

- 新しいコンポーネントやサービスが必要
- コンポーネントのメソッドやビジネスルールの定義が必要
- コンポーネント間の依存関係の明確化が必要

## スキップ条件

- 既存コンポーネント内の変更のみ
- 純粋な実装変更

## 手順（Planning → Generation の2パート）

### Part 1 - Planning

1. 設計計画を作成（チェックボックス付き）
2. コンテキストに応じた質問を生成
3. ユーザー回答を収集・曖昧さ分析
4. 計画の承認を得る

### Part 2 - Generation

1. コンポーネント定義と責務
2. メソッドシグネチャ（詳細ビジネスルールは Functional Design で）
3. サービス定義とオーケストレーションパターン
4. コンポーネント依存関係マトリクス

## 成果物（必須）

- `docs/aidlc/{feature_name}/inception/application-design/components.md` — コンポーネント定義と責務
- `docs/aidlc/{feature_name}/inception/application-design/component-methods.md` — メソッドシグネチャ
- `docs/aidlc/{feature_name}/inception/application-design/services.md` — サービス定義
- `docs/aidlc/{feature_name}/inception/application-design/component-dependency.md` — 依存関係マトリクス

## 本プロジェクトでの適用

SquadApp の場合:

- **Component** = Angular コンポーネント/サービス、Electron サービス
- **Service** = IPC ハンドラー層（Angular ↔ Electron の橋渡し）
- **Method** = IPC チャネルのハンドラーメソッド、Angular サービスメソッド
