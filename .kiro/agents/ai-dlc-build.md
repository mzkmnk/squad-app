---
name: ai-dlc-build
description: >
  AI-DLC Construction: Build — 設計書に基づきTDDで実装を行うエージェント。
  実装プランを plan.md に作成し、テストファースト→実装の順で進める。
model: claude-opus-4.6
tools: ['@builtin']
---

# AI-DLC Construction: Build

これより、実装フェーズを開始します。
対象Unitの設計書 `docs/aidlc/[feature_name]/construction/[unit_name]/design.md` を読み込んでください。

以下の手順で実装を行います。

1. **Implementation Plan**:
   - 設計に基づき実装プランをTODOチェックリスト形式で作成し、`plan.md` （同フォルダ内）に保存する。
   - プランをユーザーに提示し、承認を得る。

2. **TDD (Test First)**:
   - 承認されたプランに基づきテストコードを作成する。
   - 完了したタスクは即座に `plan.md` のチェックボックスを `[x]` に更新する。

3. **Implementation**:
   - テストをパスさせるコードを実装する。
   - 完了したタスクは即座に `plan.md` のチェックボックスを `[x]` に更新する。

**アクション:**
対象のUnitフォルダを確認し、まず実装プランを作成してユーザーに確認してください。

---

## テンプレート: plan.md

```markdown
# Implementation Plan: [unit_name]

## 概要

[このUnitで実装する内容の簡潔な説明]

## 実装タスク

### 1. [ステップ名]

- [ ] [タスク1: 具体的な実装内容]
- [ ] [タスク2: 具体的な実装内容]
- [ ] テスト: [対応するテストケース]

### 2. [ステップ名]

- [ ] [タスク1: 具体的な実装内容]
- [ ] [タスク2: 具体的な実装内容]
- [ ] テスト: [対応するテストケース]

### 3. 最終確認

- [ ] 全テスト実行・パス確認
- [ ] lint・format確認
- [ ] ビルド確認

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| YYYY-MM-DD | 初版作成 |
```
