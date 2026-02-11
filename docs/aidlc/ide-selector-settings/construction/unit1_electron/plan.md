# Code Generation Plan: Unit 1 — 設定基盤 & IDE 検出 & IPC（Electron）

## 概要

Electron メインプロセス側に設定永続化基盤、IDE 自動検出サービス、設定 IPC チャネルを追加し、
既存の Workspace ハンドラーを設定ベースの IDE 起動に変更する。

設計書: `docs/aidlc/ide-selector-settings/construction/unit1_electron/design.md`

## 実装タスク

### 1. データモデル・型定義の追加

- [ ] `electron/types/models.ts` に `ideIdSchema`, `settingsSchema`, `settingsConfigSchema` を追加
- [ ] `electron/types/ipc-error-code.ts` に `IDE_NOT_FOUND`, `IDE_LAUNCH_FAILED` を追加
- [ ] テスト: 既存テストが壊れていないことを確認（`pnpm test:electron`）

### 2. パス定義の拡張

- [ ] `electron/store/squad-paths.ts` の `SquadPaths` インターフェースに `settingsConfig` を追加
- [ ] `createSquadPaths()` の実装に `settingsConfig` パスを追加
- [ ] テスト: 既存の `squad-paths.spec.ts` が壊れていないことを確認

### 3. ストア CRUD の拡張

- [ ] テスト: `electron/store/squad-store.spec.ts` に `getSettings` / `updateSettings` / `initialize` 拡張のテストを追加
  - 正常取得
  - ファイル未存在時のデフォルト初期化
  - パース失敗時の再初期化（EC-2）
  - 正常更新
  - 更新後の値が永続化されていること
- [ ] `electron/store/squad-store.ts` に `getSettings()`, `updateSettings()` を実装
- [ ] `initialize()` を拡張し、`settings.json` が存在しない場合にデフォルト値で初期化
- [ ] テスト実行・パス確認

### 4. IDE Detector の実装

- [ ] テスト: `electron/ide/ide-detector.spec.ts` を作成
  - `detectInstalledIdes`: 全 IDE インストール済み / 一部のみ / 全て未インストール
  - `getIdeCommand`: 各 IDE ID に対する正しいコマンド返却 / 未知の ID で `undefined`
- [ ] `electron/ide/ide-detector.ts` を新規作成（`IDE_DEFINITIONS`, `detectInstalledIdes`, `getIdeCommand`）
- [ ] テスト実行・パス確認

### 5. IPC チャネル・リクエスト型の追加

- [ ] `electron/ipc/ipc-channels.ts` に `SETTINGS_GET`, `SETTINGS_UPDATE`, `SETTINGS_DETECT_IDES` チャネルと `SettingsUpdateRequest` 型を追加

### 6. IPC ハンドラーの追加・変更

- [ ] テスト: `electron/ipc/ipc-handlers.spec.ts` に以下を追加
  - `settings:get` — 正常取得 / ストアエラー時の `INTERNAL_ERROR`
  - `settings:update` — 正常更新 / 不正な設定値時の `VALIDATION_ERROR`
  - `settings:detect-ides` — 検出結果の正常返却
  - `WORKSPACE_CREATE` 変更 — IDE 起動コードが削除されていること
  - `WORKSPACE_OPEN` 変更 — 設定 IDE で起動 / `IDE_NOT_FOUND` / `IDE_LAUNCH_FAILED`
- [ ] `IpcHandlerDeps` に `ideDetector` を追加
- [ ] `ipc-handlers.ts` に設定ハンドラー 3 つを実装
- [ ] `WORKSPACE_CREATE` から IDE 起動コードを削除
- [ ] `WORKSPACE_OPEN` を設定ベースの IDE 起動に変更
- [ ] テスト実行・パス確認

### 7. Preload & 型定義の追加

- [ ] `electron/types/electron-api.ts` に `getSettings`, `updateSettings`, `detectIdes` の型定義を追加
- [ ] `electron/preload.ts` に設定 API 3 メソッドを追加

### 8. main.ts の更新

- [ ] `electron/main.ts` の `initializeServices()` で `ideDetector` を `registerIpcHandlers` に渡す

### 9. 最終確認

- [ ] 全テスト実行・パス確認（`pnpm test:electron`）
- [ ] lint 確認（`pnpm lint`）
- [ ] ビルド確認（`pnpm electron:build`）

## ストーリートレーサビリティ

| タスク                       | 要件   | 受入条件                                              |
| ---------------------------- | ------ | ----------------------------------------------------- |
| データモデル追加             | FR-7   | zod スキーマで設定モデルが定義されている              |
| パス定義拡張                 | FR-7   | `settingsConfig` パスが解決できる                     |
| ストア CRUD 拡張             | FR-7   | 設定の読み書きが永続化される                          |
| IDE Detector 実装            | FR-1,3 | 3 IDE の検出が並列実行される                          |
| IPC チャネル追加             | FR-8   | 3 チャネルが定義されている                            |
| IPC ハンドラー追加           | FR-8   | 設定 API が IPC 経由で利用可能                        |
| WORKSPACE_CREATE 変更        | FR-5   | 作成時に IDE が自動起動しない                         |
| WORKSPACE_OPEN 変更          | FR-6   | 設定された IDE で Workspace が開かれる                |
| エラーコード追加             | EC-1   | `IDE_NOT_FOUND`, `IDE_LAUNCH_FAILED` が定義されている |
| 設定ファイル破損時の再初期化 | EC-2   | パース失敗時にデフォルト値で復旧する                  |
| Preload & 型定義追加         | FR-8   | Angular 側から設定 API が型安全に利用可能             |
