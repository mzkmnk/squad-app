---
inclusion: manual
---

# AI-DLC カスタムステアリング ガイド

本プロジェクト（SquadApp）では、AWS が提唱する AI-DLC（AI-Driven Development Life Cycle）に基づいた
カスタムステアリングファイル群を `.kiro/steering/ai-dlc/` に配置している。

各ファイルは `inclusion: manual` のため、プロンプトで `/` を使い必要なものだけを読み込む。
このガイドを参照すれば、どのファイルをいつ読み込むべきかがわかる。

---

## ファイル一覧と用途

### 共通（フェーズ横断）

| ファイル               | 用途                                                                                                       | いつ使うか                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/overview`            | 基本原則、3フェーズ構成、用語定義、適応的深度、質問フォーマット、チェックポイント承認                      | AI-DLC を初めて使うとき、原則やルールを確認したいとき |
| `/artifacts`           | 全成果物のテンプレート集（requirements.md, stories.md, functional-design.md, audit.md, aidlc-state.md 等） | 成果物を作成するとき                                  |
| `/guide`（本ファイル） | ステアリングファイルの一覧と使い分け                                                                       | どのファイルを読み込むか迷ったとき                    |

### Inception フェーズ — WHAT と WHY を決める

| ファイル                 | ステージ              | 実行条件        | 用途                                                     |
| ------------------------ | --------------------- | --------------- | -------------------------------------------------------- |
| `/workspace-detection`   | Workspace Detection   | 常に実行        | greenfield/brownfield 判定、セッション再開判定           |
| `/reverse-engineering`   | Reverse Engineering   | brownfield のみ | 既存コードの分析、影響範囲の文書化                       |
| `/requirements-analysis` | Requirements Analysis | 常に実行        | 要件収集、明確化質問、`[Answer:]` タグ、曖昧さゲート     |
| `/user-stories`          | User Stories          | 条件付き        | ペルソナ定義、ストーリー・受入条件（Given-When-Then）    |
| `/workflow-planning`     | Workflow Planning     | 常に実行        | 各ステージの実行/スキップ判定、深度決定                  |
| `/application-design`    | Application Design    | 条件付き        | コンポーネント・サービス層の概念設計、依存関係マトリクス |
| `/units-generation`      | Units Generation      | 条件付き        | Unit of Work 分解、ストーリーマッピング                  |

### Construction フェーズ — HOW を決めて実装する

| ファイル             | ステージ                                   | 実行条件                   | 用途                                                 |
| -------------------- | ------------------------------------------ | -------------------------- | ---------------------------------------------------- |
| `/functional-design` | Functional Design                          | 条件付き（Unit 単位）      | zod スキーマ、IPC 仕様、ビジネスルール、テスト計画   |
| `/nfr`               | NFR Requirements / Design / Infrastructure | 条件付き（Unit 単位）      | 非機能要件評価、NFR パターン設計、インフラ設計       |
| `/code-generation`   | Code Generation                            | 常に実行（Unit 単位）      | Planning → Generation の2パート、TDD、Critical Rules |
| `/build-and-test`    | Build and Test                             | 常に実行（全 Unit 完了後） | ビルド・テスト手順の文書化                           |

---

## 典型的な使い方

### 新機能を AI-DLC で開発する場合

1. `/overview` と `/workspace-detection` を読み込んで開始
2. Workflow Planning で決まったステージに応じて、該当ファイルを順次読み込む
3. 成果物作成時は `/artifacts` を読み込んでテンプレートを参照

### 特定ステージだけ実行する場合

該当ステージのファイルだけを読み込めばよい。
例: Functional Design だけ → `/functional-design` + `/artifacts`

### ルールや原則を確認したい場合

`/overview` を読み込む。基本原則、用語定義、質問フォーマット、承認フローが記載されている。
