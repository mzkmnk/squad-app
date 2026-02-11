---
inclusion: manual
---

# AI-DLC Construction: NFR Requirements & Design（条件付き、Unit 単位）

非機能要件の評価と設計パターンの組み込み。
NFR Requirements → NFR Design の順で実行する。

---

## NFR Requirements

### 実行条件

- パフォーマンス要件がある
- セキュリティ考慮が必要
- スケーラビリティの懸念がある

### スキップ条件

- NFR 要件がない
- 技術スタックが既に決定済み

### 本プロジェクトでの適用

SquadApp で特に関連する NFR:

- IPC 通信のレスポンスタイム
- Git 操作のタイムアウト処理
- contextIsolation / nodeIntegration のセキュリティ
- ファイルシステム操作のエラーハンドリング

---

## NFR Design

### 実行条件

- NFR Requirements が実行された
- NFR パターンの組み込みが必要

### スキップ条件

- NFR Requirements がスキップされた

---

## 成果物

- `docs/aidlc/{feature_name}/construction/{unit_name}/nfr.md`

---

## Infrastructure Design（条件付き、Unit 単位）

### 本プロジェクトでの適用

SquadApp はローカルデスクトップアプリのため、クラウドインフラ設計は通常不要。
以下の場合のみ実行:

- `~/.squad/` ディレクトリ構造の設計変更
- Electron のビルド・パッケージング設定の変更
