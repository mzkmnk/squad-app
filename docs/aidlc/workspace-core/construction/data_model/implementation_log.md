# Implementation Log: data_model

## 実装サマリー

- **実装日**: 2026-02-08
- **実装者**: AI-DLC
- **所要時間**: -

## 実装内容

### 作成したファイル

- `electron/types/models.ts` - 共有型定義（Repository, Workspace, WorkspaceEntry, ReposConfig, WorkspacesConfig）
- `electron/store/squad-paths.ts` - パス解決ユーティリティ（`createSquadPaths()` ファクトリ関数 + `SquadPaths` インターフェース）
- `electron/store/squad-store.ts` - JSON ストア CRUD 操作（`SquadStore` クラス）
- `electron/store/squad-store.spec.ts` - ユニットテスト（36テストケース）
- `electron/tsconfig.spec.json` - Electron テスト用 TypeScript 設定

### 変更したファイル

- `tsconfig.app.json` - `include` に `electron/types/**/*.ts` を追加（Angular 側から型参照可能に）
- `tsconfig.json` - `references` に `electron/tsconfig.json` と `electron/tsconfig.spec.json` を追加
- `electron/tsconfig.json` - `exclude` に `**/*.spec.ts` を追加（テストファイルをビルドから除外）
- `eslint.config.mjs` - spec ファイルのルール緩和対象に `electron/**/*.spec.ts` を追加

## 設計からの変更点

### 変更1: `SquadPaths` をインターフェース + ファクトリ関数に変更

**理由**: 設計書では `const SquadPaths = { ... } as const` のオブジェクトリテラルだったが、テスト時の DI（ルートパスの差し替え）を実現するため、`createSquadPaths(rootPath?)` ファクトリ関数 + `SquadPaths` インターフェースの構成に変更した。
**影響範囲**: `squad-paths.ts`, `squad-store.ts`
**対応内容**: `SquadStore` のコンストラクタで `createSquadPaths(rootPath)` を呼び出し、インスタンスごとにパスを生成する。

### 変更2: `electron/tsconfig.spec.json` の追加

**理由**: `electron/tsconfig.json` は `module: "commonjs"` で設定されており、spec ファイルが vitest の型を含むため Electron ビルドが失敗した。また、ESLint の `projectService` がspec ファイルを解決できるよう、spec ファイルを含む tsconfig が必要だった。
**影響範囲**: `electron/tsconfig.json`, `tsconfig.json`（references追加）
**対応内容**: `electron/tsconfig.spec.json` を新規作成し、`types: ["node"]` を指定。`electron/tsconfig.json` からは `**/*.spec.ts` を除外。ルート `tsconfig.json` の `references` に両方を追加。

### 変更3: ESLint 対応のコード修正

**理由**: `strictTypeChecked` + `stylisticTypeChecked` ルールセットにより、`JSON.parse()` の戻り値（`any`）の代入、`restrict-template-expressions` でのテンプレートリテラル内の `number` 型使用などがエラーとなった。
**影響範囲**: `squad-store.ts`, `squad-store.spec.ts`
**対応内容**: `JSON.parse()` の結果に `as ReposConfig` 等の型アサーションを使用。テンプレートリテラル内の `number` は `String()` でラップ。テストコード内の non-null assertion (`!`) をオプショナルチェーン (`?.`) に変更。

## 発生した問題と解決策

### 問題1: Electron ビルドが vitest 型で失敗

**現象**: `pnpm electron:build` で vitest の型依存（`@vitest/utils/display`, `vite` の `#types/`）の解決に失敗
**原因**: `electron/tsconfig.json` の `include: ["**/*.ts"]` が spec ファイルも含み、vitest のインポートが `module: "commonjs"` の moduleResolution と非互換
**解決策**: `electron/tsconfig.json` に `"exclude": ["**/*.spec.ts"]` を追加し、テスト用に `electron/tsconfig.spec.json` を別途作成

### 問題2: ESLint が spec ファイルを解決できない

**現象**: `Parsing error: ...squad-store.spec.ts was not found by the project service`
**原因**: spec ファイルがどの tsconfig にも含まれておらず、ESLint の `projectService` が型情報を取得できない
**解決策**: `electron/tsconfig.spec.json` を作成し、ルート `tsconfig.json` の `references` に追加

## テスト結果

### ユニットテスト

- **実行コマンド**: `npx vitest run electron/store/squad-store.spec.ts`
- **結果**: Pass
- **テストケース数**: 36/36

```
 ✓ electron/store/squad-store.spec.ts (36 tests) 85ms

 Test Files  1 passed (1)
      Tests  36 passed (36)
   Start at  01:21:38
   Duration  222ms (transform 42ms, setup 0ms, import 52ms, tests 85ms, environment 0ms)
```

### ビルド検証

- `pnpm build` (Angular): Pass
- `pnpm electron:build` (Electron): Pass
- `pnpm lint` (ESLint): Pass
- `pnpm format:check` (Prettier): Pass

## 技術的負債・TODO

- なし

## 学び・気づき

- Electron プロジェクトでテストファイルを含む tsconfig を分離する場合、ESLint の `projectService` が解決できるよう、ルート `tsconfig.json` の `references` に追加する必要がある
- `strictTypeChecked` ルールセット下では `JSON.parse()` の戻り値は `as` で型アサーションする必要がある

## 次のステップ

- [ ] Unit 2 (git_operations) の実装に進む
