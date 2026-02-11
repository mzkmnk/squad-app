---
inclusion: manual
---

# AI-DLC Construction: Build and Test（常に実行 — 全 Unit 完了後）

全 Unit のコード生成が完了した後に実行する。

## 手順

1. 全 Unit のビルド手順を文書化
2. テスト戦略を文書化:
   - ユニットテスト実行手順
   - 統合テスト手順（Unit 間のインタラクション）
   - パフォーマンステスト手順（該当する場合）
3. ビルド・テストのサマリーを作成

## 本プロジェクトでのコマンド

```bash
pnpm test:ng              # Angular テスト
pnpm test:electron        # Electron テスト
pnpm build                # Angular ビルド
pnpm electron:build       # Electron ビルド
pnpm lint                 # ESLint
pnpm format:check         # Prettier チェック
```

## 成果物

- `docs/aidlc/{feature_name}/construction/build-and-test/build-instructions.md`
- `docs/aidlc/{feature_name}/construction/build-and-test/unit-test-instructions.md`
- `docs/aidlc/{feature_name}/construction/build-and-test/integration-test-instructions.md`
- `docs/aidlc/{feature_name}/construction/build-and-test/build-and-test-summary.md`
