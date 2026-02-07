# CLAUDE.md

## プロジェクト概要

SquadApp — Angular 21 + Electron 40 による型安全な IPC 通信を備えたデスクトップアプリケーション。

## 技術スタック

- **フロントエンド**: Angular 21（スタンドアロンコンポーネント、ゾーンレス変更検知、シグナル）
- **デスクトップ**: Electron 40（contextBridge IPC）
- **言語**: TypeScript 5.9（strict モード）
- **パッケージマネージャー**: pnpm

## プロジェクト構成

```
src/           # Angular アプリケーションソース
electron/      # Electron メインプロセス、プリロードスクリプト、型定義
public/        # 静的アセット
```

## コマンド

```bash
pnpm install              # 依存関係のインストール
ng serve                  # Angular 開発サーバー起動（localhost:4200）
ng test                   # Vitest ユニットテスト実行
pnpm build                # プロダクションビルド（Angular）
pnpm electron:build       # Electron TypeScript のコンパイル
pnpm electron:serve       # ビルドして Electron アプリを起動
pnpm package              # フルプロダクションパッケージ（Angular + Electron + electron-builder）
pnpm lint                 # ESLint 実行
pnpm lint:fix             # ESLint 自動修正
pnpm format               # Prettier フォーマット実行
pnpm format:check         # Prettier フォーマットチェック（CI 用）
```

## コードスタイル

- インデントはスペース 2 つ
- TypeScript ではシングルクォートを使用
- UTF-8 エンコーディング、LF 改行
- Prettier を設定済み（`.prettierrc` 参照）
- EditorConfig を適用（`.editorconfig`）
- ESLint を設定済み（`eslint.config.mjs` 参照、strict + stylistic ルールセット）
- ESLint と Prettier の統合: `eslint-config-prettier` で競合ルールを無効化

## TypeScript 設定

strict モードを完全に有効化:

- `strict`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- Angular strict テンプレート: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `typeCheckHostBindings`

## テスト

- **フレームワーク**: Vitest（happy-dom 使用）
- **ビルダー**: `@angular/build:unit-test`
- **実行**: `ng test`
- **テストファイル**: ソースファイルと同じディレクトリに `*.spec.ts` として配置

## Electron アーキテクチャ

- メインプロセス: `electron/main.ts` — ウィンドウ作成、IPC ハンドラー
- プリロード: `electron/preload.ts` — `contextBridge` 経由で安全な `window.electronAPI` ブリッジを提供
- 型定義: `electron/electron.d.ts` — 共有 IPC 型定義
- セキュリティ: `nodeIntegration: false`, `contextIsolation: true`
