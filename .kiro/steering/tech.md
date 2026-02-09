# 技術スタック

## フロントエンド

- Angular 21（スタンドアロンコンポーネント、ゾーンレス変更検知、シグナル）
- TypeScript 5.9（strict モード全有効）
- Tailwind CSS 4（PostCSS 経由、oklch カラーテーマ）
- spartan-ng/brain + spartan-ng/helm（UI コンポーネントライブラリ）
- class-variance-authority + clsx + tailwind-merge（スタイルユーティリティ）
- zod 4（バリデーション・スキーマ定義）
- RxJS 7.8

## デスクトップ

- Electron 40（contextBridge IPC、nodeIntegration: false、contextIsolation: true）
- electron-builder（パッケージング）

## パッケージマネージャー

- pnpm 9（`packageManager` フィールドで固定）

## テスト

- Vitest 4（happy-dom 環境）
- Angular テスト: `@angular/build:unit-test` ビルダー経由
- テストファイルはソースと同ディレクトリに `*.spec.ts` として配置

## リンター・フォーマッター

- ESLint 9（typescript-eslint strict + stylistic、angular-eslint）
- Prettier 3（prettier-plugin-tailwindcss 統合）
- eslint-config-prettier で競合ルール無効化
- husky + lint-staged でコミット時に自動実行

## よく使うコマンド

```bash
pnpm install              # 依存関係インストール
pnpm test                 # 全テスト実行（Angular + Electron）
pnpm test:ng              # Angular テストのみ（ng test --no-watch）
pnpm test:electron        # Electron テストのみ（vitest run electron/）
pnpm build                # Angular プロダクションビルド
pnpm electron:build       # Electron TypeScript コンパイル
pnpm electron:serve       # Electron アプリ起動（ビルド込み）
pnpm package              # フルパッケージ（Angular + Electron + electron-builder）
pnpm lint                 # ESLint 実行
pnpm lint:fix             # ESLint 自動修正
pnpm format               # Prettier フォーマット
pnpm format:check         # Prettier チェック（CI 用）
```
