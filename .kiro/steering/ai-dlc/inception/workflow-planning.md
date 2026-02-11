---
inclusion: manual
---

# AI-DLC Inception: Workflow Planning（常に実行）

どのステージを実行するかを決定する。

## 手順

1. 全ての先行成果物をロード
2. 各ステージの実行/スキップを判定
3. 各ステージの深度レベルを決定
4. 実行計画を可視化（Mermaid ダイアグラム）
5. `workflow-plan.md` として保存
6. ユーザー承認を待つ（ユーザーはステージの追加/除外を指示可能）

## 判定対象ステージ

### Inception フェーズ

| ステージ              | デフォルト               |
| --------------------- | ------------------------ |
| Workspace Detection   | 常に実行                 |
| Reverse Engineering   | brownfield のみ          |
| Requirements Analysis | 常に実行（深度は適応的） |
| User Stories          | 条件付き                 |
| Workflow Planning     | 常に実行                 |
| Application Design    | 条件付き                 |
| Units Generation      | 条件付き                 |

### Construction フェーズ（Unit 単位）

| ステージ              | デフォルト                                 |
| --------------------- | ------------------------------------------ |
| Functional Design     | 条件付き                                   |
| NFR Requirements      | 条件付き                                   |
| NFR Design            | 条件付き                                   |
| Infrastructure Design | 条件付き（本プロジェクトでは通常スキップ） |
| Code Generation       | 常に実行                                   |
| Build and Test        | 常に実行（全 Unit 完了後）                 |

## 成果物

- `docs/aidlc/{feature_name}/inception/plans/workflow-plan.md`
