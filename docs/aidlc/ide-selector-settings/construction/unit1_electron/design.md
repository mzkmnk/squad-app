# Functional Design: Unit 1 — 設定基盤 & IDE 検出 & IPC（Electron）

## 概要

Electron メインプロセス側に設定永続化基盤、IDE 自動検出サービス、設定 IPC チャネルを追加し、
既存の Workspace ハンドラーを設定ベースの IDE 起動に変更する。

## Module 一覧

- [x] Module 1: Settings Store
- [x] Module 2: IDE Detector
- [x] Module 3: Settings IPC
- [x] Module 4: Workspace 変更
- [x] Module 5: Preload & 型定義

---

## Module 1: Settings Store

### データモデル（zod スキーマ）

`electron/types/models.ts` に追加:

```typescript
/** サポート対象 IDE の識別子 */
export const ideIdSchema = z.enum(['vscode', 'webstorm', 'kiro']);
export type IdeId = z.infer<typeof ideIdSchema>;

/** アプリケーション設定 */
export const settingsSchema = z.object({
  /** 選択された IDE の識別子 */
  selectedIde: ideIdSchema,
});
export type Settings = z.infer<typeof settingsSchema>;

/** `~/.squad/config/settings.json` のスキーマ */
export const settingsConfigSchema = z.object({
  /** スキーマバージョン。現在は `1` 固定 */
  version: z.number(),
  /** アプリケーション設定 */
  settings: settingsSchema,
});
export type SettingsConfig = z.infer<typeof settingsConfigSchema>;
```

デフォルト値（NFR-1）:

```typescript
const DEFAULT_SETTINGS: Settings = { selectedIde: 'vscode' };
```

### パス定義

`electron/store/squad-paths.ts` に追加:

```typescript
/** 設定ファイル（`~/.squad/config/settings.json`） */
readonly settingsConfig: string;
// 実装: path.join(root, 'config', 'settings.json')  ※ root = ~/.squad
```

### ストア CRUD

`electron/store/squad-store.ts` に追加:

| メソッド                                     | 説明                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| `getSettings(): Promise<Settings>`           | 設定を取得。パース失敗時はデフォルト値で再初期化（EC-2） |
| `updateSettings(s: Settings): Promise<void>` | 設定を上書き保存                                         |

`initialize()` を拡張し、`settings.json` が存在しない場合にデフォルト値で初期化する。

### 設定ファイル破損時の動作（EC-2）

`getSettings()` で `settings.json` のパースに失敗した場合:

1. デフォルト値で `settings.json` を再初期化
2. デフォルト値を返す
3. エラーは握りつぶす（ユーザーに通知しない）

---

## Module 2: IDE Detector

### ファイル

`electron/ide/ide-detector.ts`（新規作成）

### IDE 定義定数

```typescript
/** サポート対象 IDE の定義 */
export interface IdeDefinition {
  /** IDE 識別子（settings.json の selectedIde と対応） */
  id: IdeId;
  /** 表示名 */
  displayName: string;
  /** IDE 起動コマンド */
  command: string;
}

/** サポート対象 IDE の一覧（FR-1） */
export const IDE_DEFINITIONS: readonly IdeDefinition[] = [
  { id: 'vscode', displayName: 'VS Code', command: 'code' },
  { id: 'webstorm', displayName: 'WebStorm', command: 'webstorm' },
  { id: 'kiro', displayName: 'Kiro IDE', command: 'kiro' },
] as const;
```

### IDE 検出結果型

```typescript
/** 各 IDE の検出結果 */
export interface IdeDetectionResult {
  /** IDE 識別子 */
  id: IdeId;
  /** 表示名 */
  displayName: string;
  /** インストール済みかどうか */
  installed: boolean;
}
```

### 検出ロジック

```typescript
/**
 * 全サポート対象 IDE のインストール状態を検出する。
 *
 * `which <command>` を並列実行し（NFR-2）、終了コード 0 = installed と判定する。
 * `execFile` を使用しシェル経由でない（NFR-3）。
 *
 * @returns 各 IDE の検出結果の配列
 */
export async function detectInstalledIdes(): Promise<IdeDetectionResult[]>;
```

実装方針:

- `Promise.all` で全 IDE の `which` を並列実行
- `execFile('which', [command])` を使用（`shell: false` がデフォルト）
- `execFile` のエラー（終了コード非 0）は `installed: false` として処理
- IDE 定義の順序を維持して結果を返す

### ヘルパー関数

```typescript
/**
 * 指定 IDE ID の起動コマンドを取得する。
 *
 * @param ideId - IDE 識別子
 * @returns 起動コマンド文字列。未知の ID の場合は undefined
 */
export function getIdeCommand(ideId: IdeId): string | undefined;
```

---

## Module 3: Settings IPC

### IPC チャネル定義

`electron/ipc/ipc-channels.ts` に追加:

```typescript
// 設定操作
/** 現在の設定を取得する */
SETTINGS_GET: 'settings:get',
/** 設定を更新する */
SETTINGS_UPDATE: 'settings:update',
/** インストール済み IDE の検出結果を取得する */
SETTINGS_DETECT_IDES: 'settings:detect-ides',
```

### リクエスト型

`electron/ipc/ipc-channels.ts` に追加:

```typescript
/**
 * `settings:update` チャネルのリクエスト。
 * 設定オブジェクト全体を上書きする。
 */
export interface SettingsUpdateRequest {
  /** 更新する設定 */
  settings: Settings;
}
```

`settings:get` と `settings:detect-ides` はリクエストパラメータなし。

### IPC ハンドラー

`electron/ipc/ipc-handlers.ts` に追加:

| チャネル               | レスポンス型                      | 処理                                          |
| ---------------------- | --------------------------------- | --------------------------------------------- |
| `settings:get`         | `IpcResult<Settings>`             | `store.getSettings()` を呼び出し              |
| `settings:update`      | `IpcResult<Settings>`             | `store.updateSettings()` → 更新後の設定を返す |
| `settings:detect-ides` | `IpcResult<IdeDetectionResult[]>` | `detectInstalledIdes()` を呼び出し            |

### IpcHandlerDeps の拡張

```typescript
export interface IpcHandlerDeps {
  store: SquadStore;
  gitService: GitService;
  codeWorkspaceService: CodeWorkspaceService;
  paths: SquadPaths;
  ideDetector: { detectInstalledIdes: () => Promise<IdeDetectionResult[]> }; // 追加
}
```

---

## Module 4: Workspace 変更

### WORKSPACE_CREATE からの IDE 起動削除（FR-5）

現在の `WORKSPACE_CREATE` ハンドラーから以下のブロックを削除:

```typescript
// 削除対象
try {
  await execFileAsync('code', [codeWorkspaceFilePath]);
} catch {
  // VS Code 起動失敗は Workspace 作成自体の失敗とはしない
}
```

Workspace 作成後の IDE 起動は `WORKSPACE_OPEN` からのみ行う。

### WORKSPACE_OPEN の設定ベース変更（FR-6）

現在:

```typescript
await execFileAsync('code', [codeWorkspaceFilePath]);
```

変更後:

```typescript
// 1. 設定から選択された IDE を取得
const settings = await store.getSettings();
const command = getIdeCommand(settings.selectedIde);

// 2. IDE コマンドの存在チェック
if (!command) {
  return { success: false, error: { code: IpcErrorCode.IDE_NOT_FOUND, message: '...' } };
}

// 3. which で IDE のインストール確認
try {
  await execFileAsync('which', [command]);
} catch {
  return {
    success: false,
    error: { code: IpcErrorCode.IDE_NOT_FOUND, message: `${displayName} is not installed` },
  };
}

// 4. IDE 起動
try {
  await execFileAsync(command, [codeWorkspaceFilePath]);
} catch (error) {
  return {
    success: false,
    error: { code: IpcErrorCode.IDE_LAUNCH_FAILED, message: `Failed to launch ${displayName}` },
  };
}
```

### エラーコード

| コード              | 意味                                                      | 使用箇所         |
| ------------------- | --------------------------------------------------------- | ---------------- |
| `IDE_NOT_FOUND`     | 設定された IDE がインストールされていない（`which` 失敗） | `WORKSPACE_OPEN` |
| `IDE_LAUNCH_FAILED` | IDE はインストール済みだが起動に失敗（`execFile` 失敗）   | `WORKSPACE_OPEN` |

---

## Module 5: Preload & 型定義

### エラーコード追加

`electron/types/ipc-error-code.ts` に追加:

```typescript
/** 設定された IDE がインストールされていない */
IDE_NOT_FOUND: 'IDE_NOT_FOUND',
/** IDE の起動に失敗した */
IDE_LAUNCH_FAILED: 'IDE_LAUNCH_FAILED',
```

### ElectronAPI 型定義追加

`electron/types/electron-api.ts` に追加:

```typescript
import type { Settings } from './models';
import type { IdeDetectionResult } from '../ide/ide-detector';

// ElectronAPI インターフェースに追加:

// --- 設定操作 ---

/** 現在の設定を取得する */
getSettings: () => Promise<IpcResult<Settings>>;

/** 設定を更新する */
updateSettings: (settings: Settings) => Promise<IpcResult<Settings>>;

/** インストール済み IDE の検出結果を取得する */
detectIdes: () => Promise<IpcResult<IdeDetectionResult[]>>;
```

### Preload 追加

`electron/preload.ts` に追加:

```typescript
// --- 設定操作 ---

/** 現在の設定を取得する */
getSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),

/** 設定を更新する */
updateSettings: (settings: Settings) =>
  ipcRenderer.invoke(IpcChannels.SETTINGS_UPDATE, { settings }),

/** インストール済み IDE の検出結果を取得する */
detectIdes: () => ipcRenderer.invoke(IpcChannels.SETTINGS_DETECT_IDES),
```

---

## コンポーネント構成（ファイル配置と責務）

### 変更対象ファイル

| ファイル                           | 変更内容                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| `electron/types/models.ts`         | `ideIdSchema`, `settingsSchema`, `settingsConfigSchema` 追加        |
| `electron/types/ipc-error-code.ts` | `IDE_NOT_FOUND`, `IDE_LAUNCH_FAILED` 追加                           |
| `electron/types/electron-api.ts`   | 設定 API 3 メソッドの型定義追加                                     |
| `electron/store/squad-paths.ts`    | `settingsConfig` パス追加                                           |
| `electron/store/squad-store.ts`    | `getSettings()`, `updateSettings()`, `initialize()` 拡張            |
| `electron/ipc/ipc-channels.ts`     | 設定チャネル 3 つ + `SettingsUpdateRequest` 型追加                  |
| `electron/ipc/ipc-handlers.ts`     | 設定ハンドラー 3 つ追加、`WORKSPACE_CREATE` / `WORKSPACE_OPEN` 変更 |
| `electron/preload.ts`              | 設定 API 3 メソッド公開                                             |

### 新規作成ファイル

| ファイル                       | 責務                                             |
| ------------------------------ | ------------------------------------------------ |
| `electron/ide/ide-detector.ts` | IDE 定義定数、検出ロジック、コマンド取得ヘルパー |

---

## テスト計画

### ユニットテスト

| テストファイル                       | テスト対象              | シナリオ                                                                            |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| `electron/ide/ide-detector.spec.ts`  | `detectInstalledIdes`   | 全 IDE インストール済み / 一部のみ / 全て未インストール / `which` タイムアウト      |
| `electron/ide/ide-detector.spec.ts`  | `getIdeCommand`         | 各 IDE ID に対する正しいコマンド返却 / 未知の ID で `undefined`                     |
| `electron/store/squad-store.spec.ts` | `getSettings`           | 正常取得 / ファイル未存在時のデフォルト初期化 / パース失敗時の再初期化（EC-2）      |
| `electron/store/squad-store.spec.ts` | `updateSettings`        | 正常更新 / 更新後の値が永続化されていること                                         |
| `electron/ipc/ipc-handlers.spec.ts`  | `settings:get`          | 正常取得 / ストアエラー時の `INTERNAL_ERROR`                                        |
| `electron/ipc/ipc-handlers.spec.ts`  | `settings:update`       | 正常更新 / 不正な設定値時の `VALIDATION_ERROR`                                      |
| `electron/ipc/ipc-handlers.spec.ts`  | `settings:detect-ides`  | 検出結果の正常返却                                                                  |
| `electron/ipc/ipc-handlers.spec.ts`  | `WORKSPACE_CREATE` 変更 | IDE 起動コードが削除されていること（`execFileAsync('code', ...)` が呼ばれないこと） |
| `electron/ipc/ipc-handlers.spec.ts`  | `WORKSPACE_OPEN` 変更   | 設定 IDE で起動 / `IDE_NOT_FOUND` / `IDE_LAUNCH_FAILED` の各パス                    |
