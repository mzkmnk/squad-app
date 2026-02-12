# Unit of Work Plan — workspace-edit

## 1. 分解方針

SquadApp はモノリス（Electron デスクトップアプリ）のため、1つの Unit of Work = アプリ全体ではなく、レイヤー境界（Electron メインプロセス / Angular レンダラー）で分割する。

### 決定事項

| 質問                  | 回答                                                           | 根拠                                                                  |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| グルーピング粒度      | 2 Unit（Electron IPC / Angular UI）                            | レイヤー境界で明確に分離可能。Angular 側のさらなる分割は不要          |
| `getWorkspace` の配置 | Unit 2（Angular UI）                                           | 既存 IPC チャネルの Service 公開のみなので Angular 側でまとめる       |
| テスト戦略            | Unit 1: ハンドラー単体テスト、Unit 2: コンポーネントテストなし | Unit 2 のコンポーネントテストは不要。統合確認は Build and Test で実施 |

## 2. Unit 構成

### Unit 1: Electron IPC

IPC チャネル定義・ハンドラー実装・preload/型更新。Angular 側に依存しない。

**スコープ:**

- `ipc-channels.ts`: `WORKSPACE_ADD_ENTRY` / `WORKSPACE_REMOVE_ENTRY` チャネル定数 + リクエスト型
- `ipc-handlers.ts`: `workspace:add-entry` / `workspace:remove-entry` ハンドラー実装
- `preload.ts`: `addWorkspaceEntry` / `removeWorkspaceEntry` メソッド追加
- `electron-api.ts`: `ElectronAPI` インターフェースに型追加

**テスト:** `ipc-handlers.spec.ts` にハンドラーの単体テストを追加

### Unit 2: Angular UI

Service 拡張・編集ページ・ルーティング・一覧画面更新。Unit 1 に依存。

**スコープ:**

- `workspace.service.ts`: `getWorkspace` / `addEntry` / `removeEntry` メソッド追加
- `workspace-edit.ts` (新規): 編集ページコンポーネント
- `app.routes.ts`: `workspaces/:id/edit` ルート追加
- `workspace-list.html` / `workspace-list.ts`: 編集アイコンボタン追加
- 翻訳ファイル: 編集関連キー追加

**テスト:** コンポーネントテストなし。Build and Test フェーズで統合確認

## 3. 実装順序

```
Unit 1: Electron IPC（依存なし）
  ↓
Unit 2: Angular UI（Unit 1 に依存）
  ↓
Build and Test（統合確認）
```
