# Functional Design: Unit 1 — Electron IPC

## 概要

Workspace のエントリ追加・削除に必要な IPC 通信基盤を提供する。
複数エントリの一括操作をサポートし、add-entry ではロールバック、remove-entry ではベストエフォートで整合性を保つ。

## データモデル（リクエスト型）

### WorkspaceAddEntryRequest

```typescript
// electron/ipc/ipc-channels.ts に追加

/**
 * `workspace:add-entry` チャネルのリクエスト。
 *
 * 1つの Workspace に対して複数エントリを一括追加する。
 * 各エントリは WorkspaceCreateEntry と同じフィールド構造を持つ。
 */
export interface WorkspaceAddEntryRequest {
  /** 対象 Workspace の UUID */
  id: string;
  /** 追加するエントリの配列（複数一括対応） */
  entries: WorkspaceCreateEntry[];
}
```

### WorkspaceRemoveEntryRequest

```typescript
// electron/ipc/ipc-channels.ts に追加

/**
 * `workspace:remove-entry` チャネルのリクエスト。
 *
 * 1つの Workspace から複数エントリを一括削除する。
 * repositoryId の配列で削除対象を指定する。
 */
export interface WorkspaceRemoveEntryRequest {
  /** 対象 Workspace の UUID */
  id: string;
  /** 削除対象のリポジトリ UUID の配列（複数一括対応） */
  repositoryIds: string[];
}
```

### 既存型の再利用

- `WorkspaceCreateEntry`（`repositoryId`, `branch`, `sourceBranch?`）を add-entry のエントリ型として再利用
- `Workspace` 型はレスポンスとしてそのまま使用（更新後の Workspace を返す）

## IPC チャネル仕様

### workspace:add-entry

| 項目         | 値                                                          |
| ------------ | ----------------------------------------------------------- |
| チャネル名   | `workspace:add-entry`                                       |
| 定数名       | `WORKSPACE_ADD_ENTRY`                                       |
| リクエスト型 | `WorkspaceAddEntryRequest`                                  |
| レスポンス型 | `IpcResult<Workspace>`（更新後の Workspace）                |
| 正常系エラー | `NOT_FOUND`（Workspace / Repository が見つからない）        |
|              | `DUPLICATE_ENTRY`（同一リポジトリのエントリが既に存在する） |
|              | `VALIDATION_ERROR`（ブランチ名バリデーション失敗）          |
| 異常系エラー | `GIT_OPERATION_FAILED`（fetch / Worktree 作成失敗）         |
|              | `INTERNAL_ERROR`（予期しないエラー）                        |

### workspace:remove-entry

| 項目         | 値                                                                   |
| ------------ | -------------------------------------------------------------------- |
| チャネル名   | `workspace:remove-entry`                                             |
| 定数名       | `WORKSPACE_REMOVE_ENTRY`                                             |
| リクエスト型 | `WorkspaceRemoveEntryRequest`                                        |
| レスポンス型 | `IpcResult<Workspace>`（更新後の Workspace）                         |
| 正常系エラー | `NOT_FOUND`（Workspace が見つからない）                              |
|              | `VALIDATION_ERROR`（指定された repositoryId がエントリに存在しない） |
| 異常系エラー | `INTERNAL_ERROR`（予期しないエラー）                                 |

### 新規エラーコード

```typescript
// electron/types/ipc-error-code.ts に追加

/** 同一リポジトリのエントリが既に Workspace に存在する */
DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
```

## ビジネスルール

### add-entry フロー

```
1. Workspace 存在確認（store.getWorkspace）
   → 見つからない場合: NOT_FOUND エラー

2. 各エントリの Repository 存在確認（store.getRepository）
   → 見つからない場合: NOT_FOUND エラー

3. 重複チェック: 追加対象の repositoryId が既存 entries に含まれていないか確認
   → 重複あり: DUPLICATE_ENTRY エラー（最初に見つかった重複の repositoryId をメッセージに含める）

4. 各エントリに対して順次処理:
   a. git fetch（対象リポジトリのリモート情報を更新）
   b. git worktree add（Worktree 作成）
   c. 作成済み Worktree を追跡リストに追加（ロールバック用）

5. ストア更新: 既存 entries に新規 entries を追加
   → store.updateWorkspace(id, { entries: [...existing, ...new] })

6. .code-workspace 再生成
   → codeWorkspaceService.generate(workspace.name, allEntries)

7. 更新後の Workspace を返す
```

### add-entry ロールバック

```
ステップ 4〜6 のいずれかで例外が発生した場合:
  - 作成済み Worktree を逆順で削除（gitService.removeWorktree）
  - 各削除の失敗は無視（ベストエフォート）
  - mapErrorToIpcResult で元のエラーを返す

※ ストア更新前に失敗した場合: Worktree のみロールバック
※ ストア更新後に失敗した場合（.code-workspace 再生成失敗）:
   ストアを元の entries に戻す + Worktree ロールバック
```

### remove-entry フロー

```
1. Workspace 存在確認（store.getWorkspace）
   → 見つからない場合: NOT_FOUND エラー

2. 削除対象の検証: 指定された repositoryIds が全て既存 entries に含まれているか確認
   → 存在しない repositoryId がある場合: VALIDATION_ERROR エラー

3. 各削除対象エントリに対して:
   a. Repository 情報を取得（store.getRepository）
   b. Worktree 削除（gitService.removeWorktree）— ベストエフォート（失敗しても継続）

4. ストア更新: 削除対象を除外した entries で更新
   → store.updateWorkspace(id, { entries: remaining })

5. .code-workspace 再生成
   → codeWorkspaceService.generate(workspace.name, remainingEntries)

6. 更新後の Workspace を返す
```

### remove-entry ベストエフォート

- Worktree 削除（ステップ 3b）の失敗は無視して継続（既存の `workspace:delete` と同じパターン）
- Repository が見つからない場合（削除済み等）も Worktree 削除をスキップして継続
- ストア更新と .code-workspace 再生成は必ず実行

## コンポーネント構成

| ファイル                           | 変更種別 | 変更内容                                                                                                                               |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `electron/types/ipc-error-code.ts` | 修正     | `DUPLICATE_ENTRY` エラーコード追加                                                                                                     |
| `electron/ipc/ipc-channels.ts`     | 修正     | `WORKSPACE_ADD_ENTRY` / `WORKSPACE_REMOVE_ENTRY` チャネル定数、`WorkspaceAddEntryRequest` / `WorkspaceRemoveEntryRequest` リクエスト型 |
| `electron/ipc/ipc-handlers.ts`     | 修正     | `workspace:add-entry` ハンドラー（ロールバック付き）、`workspace:remove-entry` ハンドラー（ベストエフォート）                          |
| `electron/preload.ts`              | 修正     | `addWorkspaceEntry(id, entries)` / `removeWorkspaceEntry(id, repositoryIds)` メソッド追加                                              |
| `electron/types/electron-api.ts`   | 修正     | `ElectronAPI` に上記メソッドの型定義を追加                                                                                             |

## テスト計画

`electron/ipc/ipc-handlers.spec.ts` に以下のテストケースを追加する。

### workspace:add-entry

| #   | テストケース                              | 検証内容                                                                                 |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | 正常系: 単一エントリ追加                  | fetch → addWorktree → updateWorkspace → generate が順に呼ばれ、更新後の Workspace が返る |
| 2   | 正常系: 複数エントリ一括追加              | 各エントリに対して fetch → addWorktree が順次実行され、entries が全て追加される          |
| 3   | 異常系: Workspace が見つからない          | NOT_FOUND エラーが返る                                                                   |
| 4   | 異常系: Repository が見つからない         | NOT_FOUND エラーが返る（Repository ID をメッセージに含む）                               |
| 5   | 異常系: 同一リポジトリの重複エントリ      | DUPLICATE_ENTRY エラーが返る                                                             |
| 6   | 異常系: Worktree 作成失敗時のロールバック | 2つ目のエントリで失敗 → 1つ目の Worktree が removeWorktree で削除される                  |
| 7   | 異常系: fetch 失敗                        | GIT_OPERATION_FAILED エラーが返る。Worktree 未作成のためロールバック不要                 |

### workspace:remove-entry

| #   | テストケース                                                      | 検証内容                                                                                |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | 正常系: 単一エントリ削除                                          | removeWorktree → updateWorkspace → generate が呼ばれ、更新後の Workspace が返る         |
| 2   | 正常系: 複数エントリ一括削除                                      | 各エントリの Worktree が削除され、entries から除外される                                |
| 3   | 異常系: Workspace が見つからない                                  | NOT_FOUND エラーが返る                                                                  |
| 4   | 異常系: 指定 repositoryId がエントリに存在しない                  | VALIDATION_ERROR エラーが返る                                                           |
| 5   | 正常系: Worktree 削除失敗でもストア更新は続行（ベストエフォート） | removeWorktree が例外を投げても updateWorkspace と generate が呼ばれる                  |
| 6   | 正常系: Repository が見つからなくても削除続行                     | getRepository が undefined を返しても Worktree 削除をスキップしてストア更新が実行される |

## preload / ElectronAPI 追加メソッド

### preload.ts

```typescript
/** Workspace にエントリを一括追加する */
addWorkspaceEntry: (
  id: string,
  entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
) => ipcRenderer.invoke(IpcChannels.WORKSPACE_ADD_ENTRY, { id, entries }),

/** Workspace からエントリを一括削除する */
removeWorkspaceEntry: (id: string, repositoryIds: string[]) =>
  ipcRenderer.invoke(IpcChannels.WORKSPACE_REMOVE_ENTRY, { id, repositoryIds }),
```

### ElectronAPI

```typescript
/**
 * 既存の Workspace にエントリを一括追加する。
 * fetch → Worktree 作成 → ストア更新 → .code-workspace 再生成の順で処理する。
 * エラー発生時は作成済み Worktree のロールバック削除を行う。
 * @param id - 対象 Workspace の UUID
 * @param entries - 追加するエントリの配列
 * @returns 更新後の Workspace を含む IpcResult
 */
addWorkspaceEntry: (id: string, entries: WorkspaceCreateEntry[]) => Promise<IpcResult<Workspace>>;

/**
 * 既存の Workspace からエントリを一括削除する。
 * Worktree 削除 → ストア更新 → .code-workspace 再生成の順で処理する。
 * Worktree 削除はベストエフォート（失敗しても継続）。
 * @param id - 対象 Workspace の UUID
 * @param repositoryIds - 削除対象のリポジトリ UUID の配列
 * @returns 更新後の Workspace を含む IpcResult
 */
removeWorkspaceEntry: (id: string, repositoryIds: string[]) => Promise<IpcResult<Workspace>>;
```
