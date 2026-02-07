# Design: data_model

## 概要

リポジトリ・Workspaceのデータモデル（TypeScript 型定義）と、`~/.squad` 配下のディレクトリ構造初期化・JSON ベースの永続化ストアを実装する。アプリ全体の基盤となるレイヤーであり、後続の全Unitがこの型定義とストアに依存する。

## ドメインモデル

### エンティティ

#### Repository

- **責務**: 登録されたGitリポジトリの情報を保持する
- **属性**:
  - `id`: `string` - UUID v4。リポジトリの一意識別子
  - `name`: `string` - リポジトリ名（URLから抽出、例: `backend`）
  - `remoteUrl`: `string` - リモートリポジトリURL（例: `https://github.com/org/backend.git`）
  - `registeredAt`: `string` - ISO 8601 形式の登録日時

#### Workspace

- **責務**: 複数リポジトリ×ブランチの組み合わせを1つの開発環境として管理する
- **属性**:
  - `id`: `string` - UUID v4。Workspaceの一意識別子
  - `name`: `string` - Workspace名（ユーザー入力、例: `feature-payment`）
  - `entries`: `WorkspaceEntry[]` - Workspaceに含まれるリポジトリ×ブランチの構成
  - `createdAt`: `string` - ISO 8601 形式の作成日時
  - `updatedAt`: `string` - ISO 8601 形式の最終更新日時

### 値オブジェクト

#### WorkspaceEntry

- **用途**: Workspace内の1つのリポジトリ×ブランチの組み合わせを表現する
- **属性**:
  - `repositoryId`: `string` - 対応するRepositoryのID
  - `branch`: `string` - チェックアウト対象のブランチ名（例: `feature/payment`）

## ディレクトリ構造（`~/.squad`）

```
~/.squad/
├── config/
│   ├── repos.json                # リポジトリ登録情報
│   └── workspaces.json           # Workspace設定情報
├── repos/
│   ├── backend.git/              # Bare Repository（Unit 2で作成）
│   └── frontend.git/             # Bare Repository（Unit 2で作成）
└── workspaces/
    └── feature-payment/          # Workspace ディレクトリ（Unit 2で作成）
        ├── backend/              # Worktree
        ├── frontend/             # Worktree
        └── feature-payment.code-workspace
```

- `config/`: JSON設定ファイル格納ディレクトリ。本Unitで管理。
- `repos/`: Bare Repositoryの格納ディレクトリ。Unit 2 (git_operations) が内容を管理。
- `workspaces/`: Worktree・`.code-workspace` ファイルの格納ディレクトリ。Unit 2 が内容を管理。

## JSON ファイルスキーマ

### `~/.squad/config/repos.json`

```json
{
  "version": 1,
  "repositories": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "backend",
      "remoteUrl": "https://github.com/org/backend.git",
      "registeredAt": "2026-02-08T12:00:00.000Z"
    }
  ]
}
```

**説明**:

- `version`: スキーマバージョン。将来のマイグレーション用。現在は `1` 固定。
- `repositories`: 登録済みリポジトリの配列。

### `~/.squad/config/workspaces.json`

```json
{
  "version": 1,
  "workspaces": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "feature-payment",
      "entries": [
        {
          "repositoryId": "550e8400-e29b-41d4-a716-446655440000",
          "branch": "feature/payment"
        },
        {
          "repositoryId": "550e8400-e29b-41d4-a716-446655440002",
          "branch": "main"
        }
      ],
      "createdAt": "2026-02-08T12:30:00.000Z",
      "updatedAt": "2026-02-08T12:30:00.000Z"
    }
  ]
}
```

**説明**:

- `version`: スキーマバージョン。現在は `1` 固定。
- `workspaces`: 作成済みWorkspaceの配列。
- `entries`: 各Workspaceに含まれるリポジトリ×ブランチの構成。パス情報はストアが `SquadPaths` から動的に解決するため、JSON には保持しない。

## コンポーネント構成

```
electron/
├── types/
│   └── models.ts                 # 共有型定義（Repository, Workspace, WorkspaceEntry）
├── store/
│   ├── squad-paths.ts            # パス解決ユーティリティ
│   ├── squad-store.ts            # JSON ストア CRUD 操作
│   └── squad-store.spec.ts       # ユニットテスト
├── main.ts                       # 既存（変更なし）
├── preload.ts                    # 既存（変更なし）
├── electron.d.ts                 # 既存（変更なし）
└── tsconfig.json                 # include パス追加
```

### ファイル詳細

#### `electron/types/models.ts` — 共有型定義

Angular（レンダラー）と Electron（メインプロセス）の両方から参照される型定義。

```typescript
// --- エンティティ ---

export interface Repository {
  readonly id: string;
  readonly name: string;
  readonly remoteUrl: string;
  readonly registeredAt: string; // ISO 8601
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly WorkspaceEntry[];
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
}

// --- 値オブジェクト ---

export interface WorkspaceEntry {
  readonly repositoryId: string;
  readonly branch: string;
}

// --- JSON ファイルスキーマ ---

export interface ReposConfig {
  readonly version: number;
  readonly repositories: Repository[];
}

export interface WorkspacesConfig {
  readonly version: number;
  readonly workspaces: Workspace[];
}
```

**型共有の仕組み**:

- `tsconfig.app.json` の `include` に `electron/types/**/*.ts` を追加し、Angular 側からも型を参照可能にする。
- Electron の `electron/tsconfig.json` は `electron/` 配下を全てコンパイルするため、追加設定不要。

#### `electron/store/squad-paths.ts` — パス解決

```typescript
import * as os from 'os';
import * as path from 'path';

const SQUAD_ROOT = path.join(os.homedir(), '.squad');

export const SquadPaths = {
  /** ~/.squad */
  root: SQUAD_ROOT,
  /** ~/.squad/config */
  configDir: path.join(SQUAD_ROOT, 'config'),
  /** ~/.squad/repos */
  reposDir: path.join(SQUAD_ROOT, 'repos'),
  /** ~/.squad/workspaces */
  workspacesDir: path.join(SQUAD_ROOT, 'workspaces'),

  /** ~/.squad/config/repos.json */
  reposConfig: path.join(SQUAD_ROOT, 'config', 'repos.json'),
  /** ~/.squad/config/workspaces.json */
  workspacesConfig: path.join(SQUAD_ROOT, 'config', 'workspaces.json'),

  /** ~/.squad/repos/<name>.git */
  repoDir(name: string): string {
    return path.join(SQUAD_ROOT, 'repos', `${name}.git`);
  },

  /** ~/.squad/workspaces/<workspaceName> */
  workspaceDir(workspaceName: string): string {
    return path.join(SQUAD_ROOT, 'workspaces', workspaceName);
  },

  /** ~/.squad/workspaces/<workspaceName>/<repoName> (Worktree) */
  worktreeDir(workspaceName: string, repoName: string): string {
    return path.join(SQUAD_ROOT, 'workspaces', workspaceName, repoName);
  },

  /** ~/.squad/workspaces/<workspaceName>/<workspaceName>.code-workspace */
  codeWorkspaceFile(workspaceName: string): string {
    return path.join(SQUAD_ROOT, 'workspaces', workspaceName, `${workspaceName}.code-workspace`);
  },
} as const;
```

#### `electron/store/squad-store.ts` — ストア実装

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Repository, Workspace, ReposConfig, WorkspacesConfig } from '../types/models';
import { SquadPaths } from './squad-paths';

const CURRENT_VERSION = 1;

export class SquadStore {
  // --- 初期化 ---

  /** ~/.squad ディレクトリ構造を初期化し、設定ファイルが存在しない場合は空の状態で作成する */
  async initialize(): Promise<void>;

  // --- リポジトリ操作 ---

  /** 登録済み全リポジトリを取得する */
  async getRepositories(): Promise<Repository[]>;

  /** IDでリポジトリを取得する。見つからない場合は undefined */
  async getRepository(id: string): Promise<Repository | undefined>;

  /** 新しいリポジトリを登録する。id と registeredAt は自動付与。 */
  async addRepository(repo: Pick<Repository, 'name' | 'remoteUrl'>): Promise<Repository>;

  /** IDでリポジトリを削除する。存在しない場合は何もしない。 */
  async removeRepository(id: string): Promise<void>;

  // --- Workspace 操作 ---

  /** 作成済み全Workspaceを取得する */
  async getWorkspaces(): Promise<Workspace[]>;

  /** IDでWorkspaceを取得する。見つからない場合は undefined */
  async getWorkspace(id: string): Promise<Workspace | undefined>;

  /** 新しいWorkspaceを追加する。id, createdAt, updatedAt は自動付与。 */
  async addWorkspace(workspace: Pick<Workspace, 'name' | 'entries'>): Promise<Workspace>;

  /** Workspaceの entries を更新する。updatedAt を自動更新。 */
  async updateWorkspace(
    id: string,
    updates: Pick<Workspace, 'entries'>,
  ): Promise<Workspace | undefined>;

  /** IDでWorkspaceを削除する。存在しない場合は何もしない。 */
  async removeWorkspace(id: string): Promise<void>;
}
```

**実装方針**:

- **ID生成**: `crypto.randomUUID()`（Node.js 組み込み、外部依存なし）
- **アトミック書き込み**: 同一ディレクトリ内の一時ファイルに書き込み後、`fs.rename()` で上書き。ファイル破損を防止する。
- **JSON フォーマット**: `JSON.stringify(data, null, 2)` で人間が読める形式で保存。
- **バージョンチェック**: JSON 読み込み時に `version` フィールドを検証。未知のバージョンの場合はエラーをスロー。
- **排他制御**: デスクトップアプリのため単一プロセスからのアクセスを前提とし、ファイルロックは実装しない。

## tsconfig 変更

### `tsconfig.app.json`

Angular 側から `electron/types/` の型定義を参照できるよう、`include` に追加:

```jsonc
{
  "include": [
    "src/**/*.ts",
    "electron/electron.d.ts",
    "electron/types/**/*.ts", // 追加
  ],
}
```

## テスト計画

### ユニットテスト

テストファイル: `electron/store/squad-store.spec.ts`

テスト実行には Node.js のファイルシステム操作が必要なため、Vitest を直接使用（`npx vitest run electron/store/squad-store.spec.ts`）。テスト用の一時ディレクトリを使用し、`~/.squad` の実データには影響しない。

#### SquadStore 初期化テスト

- [ ] `initialize()` で `~/.squad/config/`, `~/.squad/repos/`, `~/.squad/workspaces/` が作成される
- [ ] `initialize()` で `repos.json` と `workspaces.json` が空の初期状態で作成される
- [ ] `initialize()` を複数回呼び出しても既存データが上書きされない（冪等性）
- [ ] 既に設定ファイルが存在する場合、内容が保持される

#### リポジトリ CRUD テスト

- [ ] `addRepository()` でリポジトリが追加され、`id` と `registeredAt` が自動付与される
- [ ] `addRepository()` の結果が `repos.json` に永続化される
- [ ] `getRepositories()` で全リポジトリが取得できる
- [ ] `getRepository(id)` で特定のリポジトリが取得できる
- [ ] `getRepository()` に存在しないIDを渡すと `undefined` が返る
- [ ] `removeRepository(id)` でリポジトリが削除され、`repos.json` から消える
- [ ] `removeRepository()` に存在しないIDを渡してもエラーにならない

#### Workspace CRUD テスト

- [ ] `addWorkspace()` でWorkspaceが追加され、`id`, `createdAt`, `updatedAt` が自動付与される
- [ ] `addWorkspace()` で `createdAt` と `updatedAt` が同じ値になる
- [ ] `addWorkspace()` の結果が `workspaces.json` に永続化される
- [ ] `getWorkspaces()` で全Workspaceが取得できる
- [ ] `getWorkspace(id)` で特定のWorkspaceが取得できる
- [ ] `getWorkspace()` に存在しないIDを渡すと `undefined` が返る
- [ ] `updateWorkspace()` で `entries` が更新され、`updatedAt` が更新される
- [ ] `updateWorkspace()` で `createdAt` は変更されない
- [ ] `updateWorkspace()` に存在しないIDを渡すと `undefined` が返る
- [ ] `removeWorkspace(id)` でWorkspaceが削除され、`workspaces.json` から消える
- [ ] `removeWorkspace()` に存在しないIDを渡してもエラーにならない

#### SquadPaths テスト

- [ ] `SquadPaths.root` が `~/.squad` を指す
- [ ] `SquadPaths.repoDir('backend')` が `~/.squad/repos/backend.git` を返す
- [ ] `SquadPaths.workspaceDir('feature-payment')` が正しいパスを返す
- [ ] `SquadPaths.worktreeDir('feature-payment', 'backend')` が正しいパスを返す
- [ ] `SquadPaths.codeWorkspaceFile('feature-payment')` が正しいパスを返す

#### データ復元テスト（AC10 対応）

- [ ] `repos.json` に事前データがある状態で `initialize()` → `getRepositories()` でデータが復元される
- [ ] `workspaces.json` に事前データがある状態で `initialize()` → `getWorkspaces()` でデータが復元される

#### データ隔離テスト（AC11 対応）

- [ ] 全てのファイル操作が `~/.squad`（テスト時は一時ディレクトリ）配下で完結する
- [ ] `SquadPaths` の全パスが `SquadPaths.root` 配下に収まる

#### エッジケース

- [ ] 空のリポジトリ一覧・Workspace一覧に対する操作が正常に動作する
- [ ] JSON ファイルが不正（パースエラー）の場合、適切なエラーがスローされる
- [ ] `version` が未知の値の場合、適切なエラーがスローされる

### テスト環境の方針

- 各テストケースで一時ディレクトリ（`os.tmpdir()` 配下）を作成し、`SquadPaths.root` を差し替え可能にする
- テスト後に一時ディレクトリをクリーンアップする
- `SquadStore` のコンストラクタでルートパスを受け取れるようにし、テスト時にDI可能にする

```typescript
// テスト時のDI対応
export class SquadStore {
  constructor(rootPath?: string); // デフォルトは ~/.squad
}
```
