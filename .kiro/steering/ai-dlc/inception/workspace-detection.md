---
inclusion: manual
---

# AI-DLC Inception: Workspace Detection（常に実行）

既存コードベースを分析し、プロジェクトの状態を判定する。
Inception フェーズの最初のステージとして常に実行される。

## 手順

1. ワークスペースをスキャンし、既存コードの有無を確認
2. **greenfield**（新規）か **brownfield**（既存コードあり）かを判定
3. 既存の AI-DLC 成果物（`docs/aidlc/` 配下）があれば、セッション再開と判断
4. 判定結果を `docs/aidlc/{feature_name}/audit.md` に記録
5. 次のステージを決定:
   - brownfield かつ分析成果物なし → Reverse Engineering
   - それ以外 → Requirements Analysis

## 本プロジェクトでの適用

SquadApp は brownfield プロジェクト。既存の Electron + Angular コードベースがある。
新機能追加時は既存コードの影響範囲を分析してから要件定義に進む。

## 成果物

- `docs/aidlc/{feature_name}/audit.md`
