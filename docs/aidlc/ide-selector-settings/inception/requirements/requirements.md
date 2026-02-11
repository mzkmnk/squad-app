# 要件定義書 — IDE Selector & Settings

## 1. 概要

SquadApp の Workspace オープン時に使用する IDE を、ユーザーが設定画面から選択できるようにする。
現在ハードコードされている VS Code 起動を、設定に基づく動的な IDE 起動に置き換える。

## 2. ビジネスコンテキスト

### 目標

- 開発チームが使用する IDE は多様化しており（VS Code, WebStorm, Kiro IDE 等）、チームメンバーが自分の好みの IDE で Workspace を開けるようにする

### 成功基準

- ユーザーが設定画面から IDE を選択し、Workspace オープン時にその IDE が起動すること
- 未インストールの IDE がグレーアウト表示されること
- 設定が `~/.squad/config/settings.json` に永続化されること

## 3. 機能要件

### FR-1: サポート対象 IDE

以下の 3 つの IDE をサポートする:

| IDE      | 起動コマンド | 検出コマンド     |
| -------- | ------------ | ---------------- |
| VS Code  | `code`       | `which code`     |
| WebStorm | `webstorm`   | `which webstorm` |
| Kiro IDE | `kiro`（仮） | `which kiro`     |

- IDE 定義はコード内で定数として管理する（ユーザーによるカスタム IDE 登録は対象外）
- Kiro IDE のコマンドは仮定値。確定後に定数を変更するだけで対応可能な設計とする

### FR-2: IDE 選択の粒度

- アプリ全体で 1 つの IDE を設定する（グローバル設定のみ）
- Workspace ごと・リポジトリごとのオーバーライドは対象外

### FR-3: IDE 自動検出

- アプリ起動時および設定画面表示時に、各 IDE のインストール状態を検出する
- 検出方法: `which <command>` の終了コードで判定（0 = インストール済み、非 0 = 未インストール）
- 未インストールの IDE は設定画面でグレーアウト表示し、選択不可とする
- 検出結果はキャッシュせず、設定画面を開くたびに再検出する

### FR-4: 設定画面

- サイドバーに「設定」ナビゲーション項目を追加し、専用ページとして表示する
- ルート: `/settings`
- 画面構成: 「大項目 — 設定値」のフラットなレイアウト
  - 大項目「IDE」配下に IDE 選択 UI を配置
- 今回の設定項目は IDE 選択のみ。ただし将来の設定追加に備え、大項目を追加しやすい構造とする

### FR-5: Workspace 作成時の動作変更

- Workspace 作成時（`WORKSPACE_CREATE` ハンドラー）の IDE 自動起動を削除する
- Workspace を開くのは一覧画面の「開く」ボタン（`WORKSPACE_OPEN`）からのみとする

### FR-6: Workspace オープン時の IDE 起動

- `WORKSPACE_OPEN` ハンドラーで、設定された IDE の起動コマンドを使用する
- 現在の `execFileAsync('code', [...])` を、設定値に基づく動的なコマンドに置き換える

### FR-7: 設定の永続化

- 設定ファイル: `~/.squad/config/settings.json`
- `SquadStore.initialize()` で `settings.json` も初期化する（既存パターンに合わせる）
- データモデルは zod スキーマで定義する

### FR-8: 設定 IPC API

以下の IPC チャネルを新規追加する:

| チャネル               | 操作                                  |
| ---------------------- | ------------------------------------- |
| `settings:get`         | 現在の設定を取得                      |
| `settings:update`      | 設定を更新                            |
| `settings:detect-ides` | インストール済み IDE の検出結果を取得 |

## 4. 非機能要件

### NFR-1: デフォルト値

- 初回起動時のデフォルト IDE は VS Code とする（現在の動作を維持）

### NFR-2: パフォーマンス

- IDE 検出（`which` コマンド × 3）は並列実行し、設定画面の表示をブロックしない

### NFR-3: セキュリティ

- 起動コマンドはアプリ内定数のみ使用し、ユーザー入力をシェルに渡さない
- `execFile`（シェル経由でない）を引き続き使用する

## 5. エッジケース

### EC-1: 設定された IDE が見つからない場合

- Workspace オープン時に設定された IDE の起動コマンドが見つからない場合:
  - エラーメッセージを表示し、設定画面からの変更を促す
  - `IpcErrorCode` に `IDE_NOT_FOUND` を追加する

### EC-2: 設定ファイルの破損

- `settings.json` のパースに失敗した場合、デフォルト値で再初期化する

## 6. 影響範囲

### 変更対象ファイル（既存）

| ファイル                           | 変更内容                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `electron/ipc/ipc-handlers.ts`     | `WORKSPACE_CREATE` から IDE 起動を削除、`WORKSPACE_OPEN` を設定ベースに変更、設定 IPC ハンドラー追加 |
| `electron/ipc/ipc-channels.ts`     | 設定チャネル定数・リクエスト型追加                                                                   |
| `electron/preload.ts`              | 設定 API の公開                                                                                      |
| `electron/types/electron-api.ts`   | 設定 API の型定義追加                                                                                |
| `electron/types/models.ts`         | 設定スキーマ追加                                                                                     |
| `electron/store/squad-store.ts`    | `settings.json` の CRUD、`initialize()` に設定初期化追加                                             |
| `electron/store/squad-paths.ts`    | `settingsConfig` パス追加                                                                            |
| `electron/types/ipc-error-code.ts` | `IDE_NOT_FOUND` 追加                                                                                 |
| `src/app/app.ts`                   | サイドバーに設定ナビ追加                                                                             |
| `src/app/app.html`                 | 設定ナビリンク追加                                                                                   |
| `src/app/app.routes.ts`            | `/settings` ルート追加                                                                               |

### 新規作成ファイル

| ファイル                         | 内容                   |
| -------------------------------- | ---------------------- |
| `electron/ide/ide-detector.ts`   | IDE 検出サービス       |
| `src/app/settings/settings.ts`   | 設定画面コンポーネント |
| `src/app/settings/settings.html` | 設定画面テンプレート   |

## 7. 対象外（スコープ外）

- ユーザーによるカスタム IDE 登録
- Workspace ごと・リポジトリごとの IDE オーバーライド
- `.code-workspace` ファイル形式の IDE 別対応（WebStorm/Kiro は `.code-workspace` をそのまま開く前提）
- i18n 対応（翻訳キーの追加は実装時に対応）
