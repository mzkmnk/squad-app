# Code Generation Plan: Unit 2 — 設定 UI（Angular）

## 概要

Angular フロントエンド側に設定画面を追加する。`@spartan-ng/helm/select` を使った IDE 選択 UI、
IDE 検出状態のリアルタイム表示、選択時の即時自動保存、サイドバーナビゲーション、ルーティング、i18n を実装する。

設計書: `docs/aidlc/ide-selector-settings/construction/unit2_angular/design.md`

## 実装タスク

### 1. i18n 翻訳キーの追加（Module 4）

- [x] 1-1: `public/i18n/ja.json` に `nav.settings`, `settings.*` 翻訳キーを追加
- [x] 1-2: `public/i18n/en.json` に `nav.settings`, `settings.*` 翻訳キーを追加

### 2. ルーティングの追加（Module 2）

- [x] 2-1: `src/app/app.routes.ts` に `/settings` ルートを lazy loading で追加

### 3. サイドバーナビゲーションの追加（Module 3）

- [x] 3-1: `src/app/app.ts` に `lucideSettings` アイコンの import と `provideIcons` への追加
- [x] 3-2: `src/app/app.html` のサイドバーメニューに設定ナビゲーション項目を追加

### 4. 設定画面コンポーネントの実装（Module 1）

- [x] 4-1: `src/app/settings/settings.html` テンプレートを作成
- [x] 4-2: `src/app/settings/settings.ts` コンポーネントを作成

### 5. 最終確認

- [x] 5-1: 全テスト実行・パス確認（`pnpm test:ng`）
- [x] 5-2: lint 確認（`pnpm lint`）
- [x] 5-3: ビルド確認（`pnpm build`）

## ストーリートレーサビリティ

| タスク                         | 要件        | 受入条件                                                     |
| ------------------------------ | ----------- | ------------------------------------------------------------ |
| i18n 翻訳キー追加              | FR-4        | 日英の翻訳キーが定義されている                               |
| ルーティング追加               | FR-4        | `/settings` で設定画面が表示される                           |
| サイドバーナビゲーション追加   | FR-4        | サイドバーに設定リンクが表示される                           |
| 設定画面コンポーネント（検出） | FR-3, NFR-2 | IDE 検出中に spinner が表示され、検出結果が反映される        |
| 設定画面コンポーネント（選択） | FR-2, FR-4  | IDE を選択でき、未インストール IDE は選択不可                |
| 設定画面コンポーネント（保存） | FR-4        | 選択変更時に即時自動保存され、成功/失敗が toast で通知される |
| 設定画面コンポーネント（復旧） | EC-1        | 保存失敗時に選択値がロールバックされる                       |
