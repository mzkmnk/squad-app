# Unit of Work 定義 — IDE Selector & Settings

## Unit 1: 設定基盤 & IDE 検出 & IPC（Electron）

### 責務

Electron メインプロセス側の全変更を担当する。設定の永続化基盤、IDE 自動検出、IPC チャネル追加、既存ハンドラーの変更を含む。

### Module 構成

| Module           | 責務                                                                  | 対象ファイル                                                                                       |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Settings Store   | `settings.json` のパス定義、zod スキーマ、CRUD、`initialize()` 拡張   | `electron/store/squad-paths.ts`, `electron/store/squad-store.ts`, `electron/types/models.ts`       |
| IDE Detector     | `which` コマンドによる IDE インストール検出（並列実行）               | `electron/ide/ide-detector.ts`（新規）                                                             |
| Settings IPC     | `settings:get`, `settings:update`, `settings:detect-ides` チャネル    | `electron/ipc/ipc-channels.ts`, `electron/ipc/ipc-handlers.ts`, `electron/ipc/ipc-error-mapper.ts` |
| Workspace 変更   | `WORKSPACE_CREATE` から IDE 起動削除、`WORKSPACE_OPEN` を設定ベースに | `electron/ipc/ipc-handlers.ts`                                                                     |
| Preload & 型定義 | 設定 API の公開、型定義追加、エラーコード追加                         | `electron/preload.ts`, `electron/types/electron-api.ts`, `electron/types/ipc-error-code.ts`        |

### 入力

- 要件定義書（FR-1〜FR-8, NFR-1〜NFR-3, EC-1〜EC-2）

### 出力

- 設定 IPC API（Angular 側から呼び出し可能な状態）
- IDE 検出サービス
- 設定永続化基盤

---

## Unit 2: 設定 UI（Angular）

### 責務

Angular フロントエンド側の全変更を担当する。設定画面の UI コンポーネント、サイドバーナビゲーション、ルーティングを含む。

### Module 構成

| Module        | 責務                                                | 対象ファイル                                                             |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Settings Page | 設定画面コンポーネント（IDE 選択 UI、検出状態表示） | `src/app/settings/settings.ts`, `src/app/settings/settings.html`（新規） |
| Navigation    | サイドバーに「設定」ナビゲーション項目を追加        | `src/app/app.ts`, `src/app/app.html`                                     |
| Routing       | `/settings` ルート追加                              | `src/app/app.routes.ts`                                                  |

### 入力

- Unit 1 の IPC API（`settings:get`, `settings:update`, `settings:detect-ides`）
- Unit 1 の型定義（`ElectronAPI` の設定メソッド）

### 出力

- 動作する設定画面（IDE 選択・検出状態表示・永続化）
