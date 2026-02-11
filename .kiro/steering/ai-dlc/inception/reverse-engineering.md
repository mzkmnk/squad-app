---
inclusion: manual
---

# AI-DLC Inception: Reverse Engineering（条件付き — brownfield のみ）

## 実行条件

- 既存コードベースが検出された
- 対象機能に関連する既存コードの分析成果物がない

## スキップ条件

- greenfield プロジェクト
- 既に分析成果物が存在する

## 手順

1. 対象機能に関連する既存コンポーネントを分析
2. 以下を文書化:
   - 既存アーキテクチャの概要
   - 関連コンポーネントの一覧と責務
   - 既存の型定義・インターフェース
   - 影響を受ける IPC チャネル・ハンドラー
3. 成果物を `docs/aidlc/{feature_name}/inception/reverse-engineering/` に保存
4. ユーザー承認を待つ

## 成果物

- `docs/aidlc/{feature_name}/inception/reverse-engineering/analysis.md`
