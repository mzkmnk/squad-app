# Design: git_operations

## 概要

Git CLI をラップしたサービスレイヤーを実装する。Bare Repository のクローン（`git clone --bare`）、Worktree の作成・削除（`git worktree add/remove`）、fetch（`git fetch`）、リモートブランチ一覧取得（`git branch -r`）、および `.code-workspace` ファイルの生成・削除を提供する。

全ての Git 操作は `child_process.execFile` を使用し、シェルを介さないことでコマンドインジェクションを防止する。入力値（URL、ブランチ名）にはホワイトリスト方式のバリデーションを適用する。

## ドメインモデル

### サービス

#### GitService

- **責務**: Git CLI コマンドの実行を抽象化し、Bare Repository・Worktree・fetch 操作を提供する
- **依存**: `SquadPaths`（パス解決）
- **振る舞い**:
  - `cloneBare(remoteUrl, repoName)`: Bare Repository をクローン
  - `removeBareRepository(repoName)`: Bare Repository をディスクから削除
  - `addWorktree(repoName, workspaceName, branch)`: Worktree を作成
  - `removeWorktree(repoName, workspaceName)`: Worktree を削除
  - `fetch(repoName)`: リモートから最新情報を取得
  - `getRemoteBranches(repoName)`: リモートブランチ一覧を取得

#### CodeWorkspaceService

- **責務**: VS Code の `.code-workspace` ファイルの生成・削除を管理する
- **依存**: `SquadPaths`（パス解決）
- **振る舞い**:
  - `generate(workspaceName, entries)`: `.code-workspace` ファイルを生成
  - `remove(workspaceName)`: `.code-workspace` ファイルを削除

### 値オブジェクト

#### GitValidation（ユーティリティモジュール）

- **用途**: Git 関連の入力値バリデーションを集約する
- **関数**:
  - `validateRemoteUrl(url)`: リモート URL の形式を検証
  - `validateBranchName(branch)`: ブランチ名の形式を検証
  - `validateRepoName(name)`: リポジトリ名の形式を検証
- **バリデーション**:
  - URL: `https://` または `git@` で始まる、`.git` で終わる（省略可）、禁止文字を含まない
  - ブランチ名: Git の命名規則に準拠（`..`、先頭/末尾の`.`、スペース、`~^:\?*[`、制御文字を禁止）
  - リポジトリ名: 英数字・ハイフン・アンダースコア・ドットのみ許可

#### CodeWorkspaceFile（型定義）

- **用途**: `.code-workspace` ファイルの JSON 構造を表現する
- **属性**:
  - `folders`: `{ path: string }[]` - Worktree フォルダのパス（相対パス）
  - `settings`: `Record<string, unknown>` - VS Code 設定（空オブジェクト）

## DBスキーマ

本Unitは JSON ファイルストア（Unit 1 の `SquadStore`）をそのまま使用する。追加のスキーマ変更はない。

ディスク上に作成されるのは以下のファイルシステム構造:

```
~/.squad/
├── repos/
│   └── <repoName>.git/          # git clone --bare で作成される Bare Repository
└── workspaces/
    └── <workspaceName>/
        ├── <repoName>/          # git worktree add で作成される Worktree
        └── <workspaceName>.code-workspace  # CodeWorkspaceService が生成
```

## API仕様

本Unitは Electron メインプロセス内のサービスレイヤーであり、HTTP API は提供しない。IPC チャネルは Unit 3（ipc_bridge）で定義する。

### GitService API

#### `cloneBare(remoteUrl: string, repoName: string): Promise<void>`

Bare Repository をクローンする。

**処理フロー**:

1. `validateRemoteUrl(remoteUrl)` で URL をバリデーション
2. `validateRepoName(repoName)` でリポジトリ名をバリデーション
3. 既に `SquadPaths.repoDir(repoName)` が存在する場合はエラー
4. `git clone --bare <remoteUrl> <repoDir>` を実行

**エラー**:

- `GitValidationError`: URL またはリポジトリ名が不正
- `GitOperationError`: `git clone` の実行失敗（ネットワークエラー、認証エラー等）
- `GitRepositoryExistsError`: 同名のリポジトリが既に存在する

#### `removeBareRepository(repoName: string): Promise<void>`

Bare Repository をディスクから削除する。

**処理フロー**:

1. `SquadPaths.repoDir(repoName)` のディレクトリを `fs.rm` で再帰削除
2. 存在しない場合は何もしない（冪等）

#### `addWorktree(repoName: string, workspaceName: string, branch: string): Promise<void>`

指定ブランチの Worktree を作成する。

**処理フロー**:

1. `validateBranchName(branch)` でブランチ名をバリデーション
2. Worktree のパスを `SquadPaths.worktreeDir(workspaceName, repoName)` で解決
3. Workspace ディレクトリが存在しない場合は作成（`mkdir -p` 相当）
4. `git worktree add <worktreeDir> <branch>` を Bare Repository 内で実行

**エラー**:

- `GitValidationError`: ブランチ名が不正
- `GitOperationError`: `git worktree add` の実行失敗（ブランチが存在しない等）

#### `removeWorktree(repoName: string, workspaceName: string): Promise<void>`

Worktree を削除する。

**処理フロー**:

1. Worktree のパスを `SquadPaths.worktreeDir(workspaceName, repoName)` で解決
2. `git worktree remove <worktreeDir> --force` を Bare Repository 内で実行
3. Worktree が存在しない場合は何もしない（冪等）

#### `fetch(repoName: string): Promise<void>`

リモートから最新情報を取得する。

**処理フロー**:

1. `git fetch --all --prune` を Bare Repository 内で実行

**エラー**:

- `GitOperationError`: ネットワークエラー等

#### `getRemoteBranches(repoName: string): Promise<string[]>`

リモートブランチ一覧を取得する。

**処理フロー**:

1. `git branch -r --format='%(refname:short)'` を Bare Repository 内で実行
2. `origin/HEAD` を除外
3. `origin/` プレフィックスを除去してブランチ名の配列を返す

**レスポンス例**: `['main', 'develop', 'feature/payment']`

### CodeWorkspaceService API

#### `generate(workspaceName: string, entries: { repoName: string }[]): Promise<void>`

`.code-workspace` ファイルを生成する。

**処理フロー**:

1. Workspace ディレクトリが存在しない場合は作成
2. entries から各 Worktree の相対パス（`"./<repoName>"`）を `folders` に設定
3. `SquadPaths.codeWorkspaceFile(workspaceName)` に JSON 書き込み（アトミック）

**生成されるファイル例**:

```json
{
  "folders": [{ "path": "./backend" }, { "path": "./frontend" }],
  "settings": {}
}
```

#### `remove(workspaceName: string): Promise<void>`

`.code-workspace` ファイルを削除する。

**処理フロー**:

1. `SquadPaths.codeWorkspaceFile(workspaceName)` のファイルを削除
2. 存在しない場合は何もしない（冪等）

## コンポーネント構成

```
electron/
├── git/
│   ├── git-service.ts           # Git CLI ラッパーサービス
│   ├── git-service.spec.ts      # GitService ユニットテスト
│   ├── git-validation.ts        # 入力値バリデーション
│   ├── git-validation.spec.ts   # バリデーション ユニットテスト
│   ├── git-errors.ts            # カスタムエラー定義
│   ├── code-workspace-service.ts      # .code-workspace ファイル管理
│   └── code-workspace-service.spec.ts # CodeWorkspaceService テスト
├── store/
│   ├── squad-paths.ts           # 既存（変更なし）
│   └── squad-store.ts           # 既存（変更なし）
└── types/
    └── models.ts                # 既存（変更なし）
```

### ファイル詳細

#### `electron/git/git-errors.ts` — カスタムエラー

```typescript
/** Git 入力値バリデーションエラー */
export class GitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitValidationError';
  }
}

/** Git コマンド実行エラー */
export class GitOperationError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}

/** リポジトリ重複エラー */
export class GitRepositoryExistsError extends Error {
  constructor(repoName: string) {
    super(`Repository '${repoName}' already exists`);
    this.name = 'GitRepositoryExistsError';
  }
}
```

#### `electron/git/git-validation.ts` — バリデーション

```typescript
import { GitValidationError } from './git-errors.js';

/**
 * リモート URL の形式を検証する。
 *
 * 許可形式:
 * - HTTPS: `https://host/path(.git)?`
 * - SSH: `git@host:path(.git)?`
 */
export function validateRemoteUrl(url: string): void;

/**
 * ブランチ名の形式を検証する。
 *
 * Git の命名規則に準拠:
 * - `..` 禁止
 * - 先頭/末尾の `.` 禁止
 * - スペース・制御文字禁止
 * - `~`, `^`, `:`, `?`, `*`, `[`, `\` 禁止
 * - 末尾の `.lock` 禁止
 * - 先頭の `-` 禁止
 */
export function validateBranchName(branch: string): void;

/**
 * リポジトリ名の形式を検証する。
 *
 * 許可: 英数字、ハイフン、アンダースコア、ドット
 * 1〜100文字
 */
export function validateRepoName(name: string): void;
```

#### `electron/git/git-service.ts` — Git サービス

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import type { SquadPaths } from '../store/squad-paths.js';
import { validateRemoteUrl, validateBranchName, validateRepoName } from './git-validation.js';
import { GitOperationError, GitRepositoryExistsError } from './git-errors.js';

const execFileAsync = promisify(execFile);

export class GitService {
  constructor(private readonly paths: SquadPaths) {}

  /** Bare Repository をクローンする */
  async cloneBare(remoteUrl: string, repoName: string): Promise<void>;

  /** Bare Repository をディスクから削除する */
  async removeBareRepository(repoName: string): Promise<void>;

  /** 指定ブランチの Worktree を作成する */
  async addWorktree(repoName: string, workspaceName: string, branch: string): Promise<void>;

  /** Worktree を削除する */
  async removeWorktree(repoName: string, workspaceName: string): Promise<void>;

  /** リモートから最新情報を取得する */
  async fetch(repoName: string): Promise<void>;

  /** リモートブランチ一覧を取得する */
  async getRemoteBranches(repoName: string): Promise<string[]>;
}
```

**実装方針**:

- **`child_process.execFile`**: シェルを介さない `execFile` を使用し、引数が直接プロセスに渡されるためコマンドインジェクションを構造的に防止する。`exec` や `spawn({ shell: true })` は使用しない。
- **エラーハンドリング**: `execFile` の失敗（非ゼロ終了コード）は `GitOperationError` にラップし、`exitCode` と `stderr` を保持する。
- **冪等性**: `removeBareRepository` と `removeWorktree` は対象が存在しない場合でもエラーにしない。
- **cwd 指定**: `addWorktree`, `removeWorktree`, `fetch`, `getRemoteBranches` は Bare Repository のディレクトリ（`SquadPaths.repoDir(repoName)`）を `cwd` に設定して実行する。

#### `electron/git/code-workspace-service.ts` — .code-workspace 管理

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { SquadPaths } from '../store/squad-paths.js';

export interface CodeWorkspaceFile {
  folders: { path: string }[];
  settings: Record<string, unknown>;
}

export class CodeWorkspaceService {
  constructor(private readonly paths: SquadPaths) {}

  /** .code-workspace ファイルを生成する */
  async generate(workspaceName: string, entries: { repoName: string }[]): Promise<void>;

  /** .code-workspace ファイルを削除する */
  async remove(workspaceName: string): Promise<void>;
}
```

**実装方針**:

- **相対パス**: `folders[].path` には Workspace ディレクトリからの相対パス（`"./<repoName>"`）を使用。これにより `~/.squad` のルートパスに依存しないポータブルな `.code-workspace` ファイルを生成する。
- **アトミック書き込み**: Unit 1 と同様に、一時ファイル + rename のアトミック書き込みを使用する。
- **JSON フォーマット**: `JSON.stringify(data, null, 2)` で人間が読める形式で保存。

## テスト計画

### テスト環境の方針

- **GitService テスト**: 実際の Git コマンドを使用する統合テスト。テスト用の一時ディレクトリにローカル Bare Repository を作成し、リモートリポジトリの代替として使用する。ネットワーク接続不要。
- **CodeWorkspaceService テスト**: ファイルシステム操作のみ。一時ディレクトリを使用。
- **git-validation テスト**: 純粋な関数テスト。外部依存なし。
- テスト実行: `npx vitest run electron/git/`（直接 Vitest 使用）
- 各テストで `os.tmpdir()` 配下に一時ディレクトリを作成し、テスト後にクリーンアップ

### ユニットテスト

#### git-validation のテスト（`git-validation.spec.ts`）

##### validateRemoteUrl

- [ ] HTTPS URL（`https://github.com/org/repo.git`）を受け入れる
- [ ] HTTPS URL（`.git` 省略: `https://github.com/org/repo`）を受け入れる
- [ ] SSH URL（`git@github.com:org/repo.git`）を受け入れる
- [ ] 空文字列を拒否する
- [ ] `http://`（非HTTPS）を拒否する
- [ ] スキームなしの文字列を拒否する
- [ ] シェルメタ文字（`; rm -rf /`）を含む URL を拒否する
- [ ] スペースを含む URL を拒否する
- [ ] 改行を含む URL を拒否する

##### validateBranchName

- [ ] 通常のブランチ名（`main`, `develop`）を受け入れる
- [ ] スラッシュ区切り（`feature/payment`）を受け入れる
- [ ] 空文字列を拒否する
- [ ] `..` を含む名前を拒否する
- [ ] 先頭が `.` の名前を拒否する
- [ ] 末尾が `.lock` の名前を拒否する
- [ ] スペースを含む名前を拒否する
- [ ] `~`, `^`, `:`, `?`, `*`, `[`, `\` を含む名前を拒否する
- [ ] 制御文字を含む名前を拒否する
- [ ] 先頭が `-` の名前を拒否する
- [ ] 末尾が `/` の名前を拒否する
- [ ] 連続する `/` を含む名前を拒否する

##### validateRepoName

- [ ] 英数字のみの名前を受け入れる
- [ ] ハイフン・アンダースコア・ドットを含む名前を受け入れる
- [ ] 空文字列を拒否する
- [ ] 101文字以上の名前を拒否する
- [ ] スラッシュを含む名前を拒否する
- [ ] スペースを含む名前を拒否する
- [ ] 日本語を含む名前を拒否する

#### GitService のテスト（`git-service.spec.ts`）

テスト前準備: 一時ディレクトリにローカル Git リポジトリを作成し、それを「リモート」として使用。

##### cloneBare

- [ ] 有効な URL から Bare Repository をクローンできる
- [ ] クローン先に `.git` サフィックスのディレクトリが作成される
- [ ] `HEAD` ファイルが存在する（Bare Repository の証跡）
- [ ] 同名リポジトリが既に存在する場合に `GitRepositoryExistsError` がスローされる
- [ ] 不正な URL の場合に `GitValidationError` がスローされる
- [ ] 存在しないリモートの場合に `GitOperationError` がスローされる

##### removeBareRepository

- [ ] 既存の Bare Repository を削除できる
- [ ] 削除後にディレクトリが存在しない
- [ ] 存在しないリポジトリを指定してもエラーにならない（冪等）

##### addWorktree

- [ ] 指定ブランチの Worktree を作成できる
- [ ] Worktree ディレクトリ内にファイルが展開される
- [ ] Workspace ディレクトリが自動作成される
- [ ] 不正なブランチ名の場合に `GitValidationError` がスローされる
- [ ] 存在しないブランチの場合に `GitOperationError` がスローされる

##### removeWorktree

- [ ] 既存の Worktree を削除できる
- [ ] 削除後に Worktree ディレクトリが存在しない
- [ ] 存在しない Worktree を指定してもエラーにならない（冪等）

##### fetch

- [ ] リモートから最新情報を取得できる（リモートに新ブランチ追加後に反映される）
- [ ] Bare Repository が存在しない場合にエラー

##### getRemoteBranches

- [ ] リモートブランチ一覧を取得できる
- [ ] `origin/HEAD` が結果に含まれない
- [ ] `origin/` プレフィックスが除去される
- [ ] ブランチが存在しない場合（空リポジトリ）は空配列を返す

#### CodeWorkspaceService のテスト（`code-workspace-service.spec.ts`）

##### generate

- [ ] `.code-workspace` ファイルが正しいパスに生成される
- [ ] `folders` に各リポジトリの相対パス（`"./<repoName>"`）が含まれる
- [ ] `settings` が空オブジェクトである
- [ ] JSON が整形（2スペースインデント）されている
- [ ] 複数エントリの場合に全リポジトリが含まれる
- [ ] Workspace ディレクトリが存在しない場合に自動作成される

##### remove

- [ ] `.code-workspace` ファイルが削除される
- [ ] ファイルが存在しない場合でもエラーにならない（冪等）

### テスト間の独立性保証

- 全テストで一時ディレクトリを使用（`SquadPaths` に一時パスを注入）
- `beforeEach` で一時ディレクトリを作成、`afterEach` で再帰削除
- テスト間で状態を共有しない

## 同名 Workspace・同一ブランチ Worktree の重複対応

### 背景

`git worktree add` は同じブランチを複数の Worktree にチェックアウトできない制約がある（`fatal: '<branch>' is already checked out`）。Workspace のコピー機能や、同じ構成の Workspace を複数作りたいユースケース（例: AI コーディングで同一環境を複製して並行実験）に対応する。

### 設計方針: UUID 先頭8文字 suffix + リトライ

Workspace 名、Worktree ディレクトリ名、ブランチ名の全てに対して、作成時に常に UUID v4 の先頭8文字を suffix として付与する。suffix は各メソッド（`SquadStore.addWorkspace`、`GitService.addWorktree`）が独立して生成する。suffix 付与後に重複が発生した場合は新しい UUID で最大3回までリトライし、それでも解決しない場合は重複エラーを返す。

```
# Workspace 名（SquadStore.addWorkspace が生成）
feature-payment-a3f2b1c9

# Worktree ブランチ名（GitService.addWorktree が生成）
backend → feature/payment-7d4e9f01
frontend → main-e2c8a4b6
```

各 suffix は独立した UUID から生成されるため、揃っている必要はない。紐づけは `SquadStore` の `entries` が保持する。

### リトライフロー

各メソッドが独立してリトライする:

```
SquadStore.addWorkspace:
  1回目: feature-payment-<uuid1の先頭8文字> → 重複 → リトライ
  2回目: feature-payment-<uuid2の先頭8文字> → 重複 → リトライ
  3回目: feature-payment-<uuid3の先頭8文字> → 重複 → DUPLICATE_WORKSPACE_ERROR

GitService.addWorktree:
  1回目: git branch feature/payment-<uuid1の先頭8文字> → 重複 → リトライ
  2回目: git branch feature/payment-<uuid2の先頭8文字> → 重複 → リトライ
  3回目: git branch feature/payment-<uuid3の先頭8文字> → 重複 → GitOperationError
```

### 選定理由

- 1つ目から常に suffix を付与するため、重複チェックのロジックが不要でシンプル
- 連番方式（`-2`, `-3`）と比較して、既存一覧のスキャンが不要
- 並行作成時の衝突リスクがない（UUID 先頭8文字 = 32bit、約43億通り）
- 8文字なら人間が読める長さで、`git log` や `git branch` でも元との関連がわかる
- CloudFormation のスタック名等、エンジニアに馴染みのある命名パターン
- 3回リトライで十分な安全マージン（衝突確率は天文学的に低い）

### 既存メソッドの変更

#### `GitService.cloneBare(remoteUrl, repoName)`

内部ロジックを変更:

1. UUID v4 の先頭8文字を suffix として生成
2. `repoName-<suffix>` を実際のリポジトリ名として使用（`~/.squad/repos/backend-a3f2b1c9.git`）
3. ディレクトリが既に存在する場合、新しい UUID で最大3回リトライ
4. 3回失敗したら `GitRepositoryExistsError` をスロー

#### `GitService.addWorktree(repoName, workspaceName, branch)`

内部ロジックを変更:

1. UUID v4 の先頭8文字を suffix として生成
2. `branch-<suffix>` で新しいローカルブランチを作成（`git branch <branch>-<suffix> <branch>`）
3. 作成したブランチで `git worktree add` を実行
4. ブランチ作成が重複エラーの場合、新しい UUID で最大3回リトライ
5. 3回失敗したら `GitOperationError` をスロー

#### `SquadStore.addWorkspace({ name, entries })`

内部ロジックを変更:

1. UUID v4 の先頭8文字を suffix として生成
2. `name-<suffix>` を実際の Workspace 名として使用
3. 同名が既に存在する場合、新しい UUID で最大3回リトライ
4. 3回失敗したらエラーをスロー

### 影響範囲

- `GitService.cloneBare()`: suffix 付きリポジトリ名 + リトライロジックを内部に追加
- `GitService.addWorktree()`: suffix 付きブランチ作成 + リトライロジックを内部に追加
- `SquadStore.addWorkspace()`: suffix 付き Workspace 名 + リトライロジックを内部に追加
- `SquadStore.addRepository()`: `cloneBare` が返す suffix 付き名前を保存する
- `CodeWorkspaceService.generate()`: 変更なし（suffix 付き Workspace 名がそのまま渡される）
- IPC ハンドラー（Unit 3: ipc_bridge）: ユーザー入力の生の名前をそのまま渡すだけ。suffix ロジックは関知しない

## 非機能要件

### パフォーマンス

- `cloneBare`: ネットワーク依存のため目標値なし（ユーザーにプログレス表示で対応。UI 側は Unit 4 で実装）
- `addWorktree`: ローカル操作のため 1 秒以内（ローカルキャッシュ済み前提）
- `fetch`: バックグラウンド非同期実行。UI をブロックしない（呼び出し側の責務。Unit 3/5 で制御）

### セキュリティ

- **コマンドインジェクション防止**: `execFile` を使用し、シェルを介さない。ユーザー入力は直接コマンド引数として渡される前にバリデーション済み。
- **パストラバーサル防止**: リポジトリ名・Workspace 名のバリデーションでスラッシュ・`..` 等を禁止。全パスは `SquadPaths` 経由で `~/.squad` 配下に限定。
- **入力値バリデーション**: ホワイトリスト方式。許可された文字パターンのみ受け入れ。

### 監視・ログ

- Git コマンドの実行失敗時に `stderr` をエラーオブジェクトに保持（デバッグ用）
- 本Unitではロガーは導入しない（将来の拡張ポイントとして認識）
