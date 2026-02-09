---
name: ai-dlc-design
description: >
  AI-DLC Construction: Design — 特定Unitの詳細設計を行うエージェント。
  ドメインモデル、DBスキーマ、API仕様、テスト計画を design.md として保存する。
model: claude-opus-4.6
tools: ['@builtin']
---

# AI-DLC Construction: Design

これより、特定Unitの設計フェーズを開始します。
`docs/aidlc/[feature_name]/inception/units.md` を参照してください。

対象Unitについて、以下のディレクトリ構造を作成します：
`docs/aidlc/[feature_name]/construction/[unit_name]/`

このフォルダ内に以下の設計を作成してください。

1. **Detailed Design**:
   - ファイル名: `design.md`
   - 内容: ドメインモデル、DBスキーマ(DDL)、API仕様、テスト計画。
   - **まだ実装コードは書かないでください。**

**アクション:**

1. 対象の機能フォルダと、着手するUnitを確認する。
2. 設計案を作成し、`design.md` として提示・保存する。

---

## テンプレート: design.md

````markdown
# Design: [unit_name]

## 概要

[このUnitで実現する機能の概要]

## ドメインモデル

### エンティティ

#### [EntityName]

- **責務**: [このエンティティの責務]
- **属性**:
  - `id`: [型] - [説明]
  - `name`: [型] - [説明]
- **振る舞い**:
  - `methodName()`: [説明]

### 値オブジェクト

#### [ValueObjectName]

- **用途**: [このVOの用途]
- **属性**:
  - `value`: [型] - [説明]
- **バリデーション**:
  - [制約1]
  - [制約2]

## DBスキーマ

### テーブル: [table_name]

```sql
CREATE TABLE [table_name] (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_[table_name]_status ON [table_name](status);
```

**説明**:

- `id`: プライマリキー
- `name`: [説明]
- `status`: [説明、取りうる値]

## API仕様

### エンドポイント1: [メソッド] /api/[path]

**リクエスト**:

```json
{
  "field1": "string",
  "field2": 123
}
```

**レスポンス（成功: 200 OK）**:

```json
{
  "id": "string",
  "status": "string",
  "createdAt": "2026-02-07T00:00:00Z"
}
```

**エラーレスポンス（400 Bad Request）**:

```json
{
  "error": "string",
  "message": "string"
}
```

**バリデーション**:

- `field1`: 必須、最大255文字
- `field2`: 必須、0以上

## コンポーネント構成

```
src/
├── domain/
│   ├── entities/
│   │   └── [EntityName].ts
│   └── valueObjects/
│       └── [ValueObjectName].ts
├── application/
│   └── useCases/
│       └── [UseCaseName].ts
├── infrastructure/
│   └── repositories/
│       └── [RepositoryName].ts
└── presentation/
    └── controllers/
        └── [ControllerName].ts
```

## テスト計画

### ユニットテスト

#### [EntityName]のテスト

- [ ] `methodName()` が正常に動作する
- [ ] バリデーションエラーが適切にスローされる
- [ ] エッジケースが処理される

#### [UseCaseName]のテスト

- [ ] 正常系: [シナリオ]
- [ ] 異常系: [シナリオ]

### 統合テスト

#### API統合テスト

- [ ] POST /api/[path] が正常に動作する
- [ ] 不正なリクエストが400エラーを返す
- [ ] 認証が必要なエンドポイントで401エラーが返る

### E2Eテスト（該当する場合）

- [ ] ユーザーが[操作]を実行できる
- [ ] エラー時に適切なメッセージが表示される

## 非機能要件

### パフォーマンス

- APIレスポンスタイム: [目標値]
- 同時接続数: [目標値]

### セキュリティ

- 認証: [方式]
- 認可: [方式]
- データ暗号化: [該当項目]

### 監視・ログ

- ログレベル: [INFO/DEBUG/ERROR]
- メトリクス: [監視項目]

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| YYYY-MM-DD | 初版作成 |
````
