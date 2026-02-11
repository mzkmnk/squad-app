---
inclusion: manual
---

# AI-DLC Inception: Units Generation（条件付き）

システムを管理可能な Unit of Work に分解する。

## 実行条件

- 複数の Unit of Work への分解が必要
- 複数のサービスまたはモジュールが必要
- 構造化された分解が必要な複雑なシステム

## スキップ条件

- 単一の単純な Unit
- 分解不要
- 単一コンポーネントの実装

## Unit of Work の定義

> Unit of Work はストーリーの論理的グルーピングである。
> マイクロサービスでは各 Unit が独立デプロイ可能なサービスになる。
> モノリスでは単一の Unit がアプリ全体を表し、内部に論理モジュールを持つ。

## 本プロジェクトでの適用

SquadApp はモノリス（Electron デスクトップアプリ）のため:

- 通常は **1つの Unit of Work = アプリ全体**
- 内部の分割は **Module**（論理モジュール）として扱う
- ただし、機能の独立性が高い場合は複数 Unit に分割可能

## 手順（Planning → Generation の2パート）

### Part 1 - Planning

1. 分解計画を作成（チェックボックス付き）
2. コンテキストに応じた質問を生成:
   - ストーリーのグルーピング戦略
   - 依存関係と統合アプローチ
   - コード構成（greenfield の場合）
3. ユーザー回答を収集・曖昧さ分析
4. 計画の承認を得る

### Part 2 - Generation

1. Unit 定義と責務
2. 依存関係マトリクス
3. ストーリーマッピング

## 成果物（必須）

- `docs/aidlc/{feature_name}/inception/plans/unit-of-work-plan.md`
- `docs/aidlc/{feature_name}/inception/application-design/unit-of-work.md` — Unit 定義と責務
- `docs/aidlc/{feature_name}/inception/application-design/unit-of-work-dependency.md` — 依存関係マトリクス
- `docs/aidlc/{feature_name}/inception/application-design/unit-of-work-story-map.md` — ストーリーと Unit のマッピング
