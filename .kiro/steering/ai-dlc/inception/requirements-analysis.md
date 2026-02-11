---
inclusion: manual
---

# AI-DLC Inception: Requirements Analysis（常に実行 — 深度は適応的）

プロダクトオーナーの役割を担い、要件を収集・検証する。

## 手順

1. **リクエスト分析**:
   - 明確さ: Clear / Vague / Incomplete
   - 種別: New Feature / Bug Fix / Refactoring / Enhancement
   - スコープ: Single File / Single Component / Multiple Components / System-wide
   - 複雑さ: Trivial / Simple / Moderate / Complex

2. **深度の決定**:
   - **Minimal**: 単純で明確なリクエスト。意図の文書化のみ
   - **Standard**: 通常の複雑さ。機能・非機能要件の収集
   - **Comprehensive**: 複雑・高リスク。詳細な要件とトレーサビリティ

3. **既存要件の評価**: ユーザーが提供した情報を分析

4. **網羅性分析（必須）**: 以下の全領域を評価し、不明点があれば質問:
   - 機能要件: コア機能、ユーザーインタラクション、システム動作
   - 非機能要件: パフォーマンス、セキュリティ、ユーザビリティ
   - ユーザーシナリオ: ユースケース、エッジケース、エラーシナリオ
   - ビジネスコンテキスト: 目標、制約、成功基準
   - 技術コンテキスト: 統合ポイント、データ要件、システム境界

5. **明確化質問の生成**:
   - `requirement-verification-questions.md` を作成
   - `[Answer]:` タグ形式で質問を埋め込む
   - ユーザーの回答を待つ

6. **⛔ ゲート: 回答の検証**:
   - 全回答の曖昧さを分析
   - 曖昧な回答にはフォローアップ質問を追加
   - 全ての曖昧さが解消されるまで次に進まない

7. **要件ドキュメント生成**: `requirements.md` を作成

8. **承認を待つ**

## 成果物

- `docs/aidlc/{feature_name}/inception/requirements/requirement-verification-questions.md`（必要な場合）
- `docs/aidlc/{feature_name}/inception/requirements/requirements.md`
