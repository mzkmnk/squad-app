# Implementation Plan: data_model

## 概要

リポジトリ・Workspaceのデータモデル（TypeScript 型定義）と、`~/.squad` 配下のディレクトリ構造初期化・JSON ベースの永続化ストア（`SquadStore`）を実装する。

## 実装対象

### 作成するファイル

- `electron/types/models.ts` - 共有型定義（Repository, Workspace, WorkspaceEntry, ReposConfig, WorkspacesConfig）
- `electron/store/squad-paths.ts` - パス解決ユーティリティ（`SquadPaths`）
- `electron/store/squad-store.ts` - JSON ストア CRUD 操作（`SquadStore`クラス）
- `electron/store/squad-store.spec.ts` - SquadStore + SquadPaths のユニットテスト

### 変更するファイル

- `tsconfig.app.json` - `include` に `electron/types/**/*.ts` を追加（Angular側から型参照可能にする）

## 実装順序

### ステップ1: 共有型定義の作成

**内容**:

- `electron/types/models.ts` に `Repository`, `Workspace`, `WorkspaceEntry`, `ReposConfig`, `WorkspacesConfig` インターフェースを定義
- 全プロパティを `readonly` にし、イミュータブルを保証

**テスト**:

- 型定義のみのため、直接のテストはなし。後続ステップのテストで間接的に検証。

---

### ステップ2: パス解決ユーティリティの作成

**内容**:

- `electron/store/squad-paths.ts` に `createSquadPaths(rootPath)` ファクトリ関数を実装
- デフォルトルートは `~/.squad`、テスト時にDI可能
- 静的パス（`root`, `configDir`, `reposDir`, `workspacesDir`, `reposConfig`, `workspacesConfig`）
- 動的パス関数（`repoDir()`, `workspaceDir()`, `worktreeDir()`, `codeWorkspaceFile()`）

**テスト**:

- `SquadPaths.root` が指定ルートを指す
- `repoDir('backend')` → `<root>/repos/backend.git`
- `workspaceDir('feature-payment')` → `<root>/workspaces/feature-payment`
- `worktreeDir('feature-payment', 'backend')` → `<root>/workspaces/feature-payment/backend`
- `codeWorkspaceFile('feature-payment')` → `<root>/workspaces/feature-payment/feature-payment.code-workspace`
- 全パスが `root` 配下に収まる

---

### ステップ3: SquadStore クラスの作成

**内容**:

- `electron/store/squad-store.ts` に `SquadStore` クラスを実装
- コンストラクタで `rootPath?` を受け取り、`createSquadPaths()` でパスを生成
- `initialize()`: ディレクトリ構造の作成、設定ファイルの初期化（冪等）
- リポジトリ CRUD: `getRepositories()`, `getRepository()`, `addRepository()`, `removeRepository()`
- Workspace CRUD: `getWorkspaces()`, `getWorkspace()`, `addWorkspace()`, `updateWorkspace()`, `removeWorkspace()`
- アトミック書き込み: 一時ファイル → `fs.rename()`
- バージョンチェック: 未知の `version` でエラースロー

**テスト**:

- 初期化テスト（ディレクトリ作成、ファイル初期化、冪等性）
- リポジトリ CRUD（追加・取得・削除・存在しないID）
- Workspace CRUD（追加・取得・更新・削除・存在しないID）
- データ復元テスト（既存データの保持）
- エッジケース（空一覧操作、不正JSON、未知バージョン）

---

### ステップ4: tsconfig.app.json の更新

**内容**:

- `include` 配列に `"electron/types/**/*.ts"` を追加

**テスト**:

- `pnpm build` でAngularビルドが成功することを確認

---

## テスト戦略

### ユニットテスト

- **対象**: `SquadPaths`（パス解決）、`SquadStore`（CRUD操作）
- **実行方法**: `npx vitest run electron/store/squad-store.spec.ts`（Node.js環境で直接実行）
- **テスト環境**: 各テストケースで `os.tmpdir()` 配下に一時ディレクトリを作成し、テスト後にクリーンアップ
- **カバー範囲**:
  - 正常系: 初期化、CRUD全操作、データ永続化
  - 異常系: 存在しないID、不正JSON、未知バージョン
  - エッジケース: 空一覧操作、冪等性、データ復元

### 統合テスト

- 本Unitでは統合テストは不要（ファイルシステム操作をユニットテストで直接検証するため）

## 技術的な考慮事項

### パフォーマンス

- JSON ファイルは小規模（数十〜数百エントリ）を想定。全件読み込み→書き込みのシンプルな方式で十分。

### セキュリティ

- ファイルシステム操作は `~/.squad` 配下に限定
- `nodeIntegration: false`, `contextIsolation: true` の既存セキュリティ設定を維持

### エラーハンドリング

- 不正な JSON ファイル: パースエラーをそのままスロー（呼び出し側で処理）
- 未知のバージョン: 明示的なエラーメッセージ付きでスロー
- ファイル未存在: `initialize()` で自動作成されるため、通常は発生しない

## リスクと対策

### リスク1: Electron テスト環境の設定

**内容**: `ng test` はAngular用のため、Electron側のテストは `npx vitest` で直接実行する必要がある
**対策**: `npx vitest run electron/store/squad-store.spec.ts` で実行。`electron/tsconfig.json` は `commonjs` モジュールだが、Vitest は ESM/CJS 両方に対応しているため問題なし。

### リスク2: アトミック書き込みの信頼性

**内容**: `fs.rename()` は同一ファイルシステム内でないとアトミックにならない
**対策**: 一時ファイルは対象ファイルと同じディレクトリに作成する

## 依存関係

- **外部ライブラリ**: なし（Node.js 組み込みモジュールのみ: `fs/promises`, `path`, `os`, `crypto`）
- **devDependencies**: `vitest`（既存）
- **他のUnitとの依存**: なし（本Unitが基盤レイヤー）

## チェックリスト

- [ ] 設計書との整合性確認
- [ ] テストケースの網羅性確認
- [ ] エラーハンドリングの実装
- [ ] パフォーマンス要件の確認
- [ ] セキュリティ要件の確認
