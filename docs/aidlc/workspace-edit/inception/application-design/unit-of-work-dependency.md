# Unit of Work 依存関係マトリクス — workspace-edit

## 依存関係マトリクス

|                          | Unit 1: Electron IPC | Unit 2: Angular UI |
| ------------------------ | -------------------- | ------------------ |
| **Unit 1: Electron IPC** | —                    | —                  |
| **Unit 2: Angular UI**   | ✅ 依存              | —                  |

## 依存関係の詳細

### Unit 2 → Unit 1

| 依存元 (Unit 2)                  | 依存先 (Unit 1)                             | 依存内容                         |
| -------------------------------- | ------------------------------------------- | -------------------------------- |
| `WorkspaceService.addEntry()`    | `preload.ts: addWorkspaceEntry()`           | IPC 経由でエントリ追加を呼び出す |
| `WorkspaceService.removeEntry()` | `preload.ts: removeWorkspaceEntry()`        | IPC 経由でエントリ削除を呼び出す |
| `WorkspaceService` 型参照        | `electron-api.ts: ElectronAPI`              | メソッドシグネチャの型安全性     |
| `WorkspaceService` 型参照        | `ipc-channels.ts: WorkspaceAddEntryRequest` | リクエスト型の参照               |

## 実装順序の制約

```
Unit 1: Electron IPC  ──→  Unit 2: Angular UI  ──→  Build and Test
       (先行)                    (後続)                  (統合確認)
```

- Unit 1 は外部依存なし。単独で実装・テスト可能
- Unit 2 は Unit 1 の IPC チャネル・preload・型定義が必要
- Build and Test は両 Unit 完了後に実施

## 既存コードへの依存（両 Unit 共通）

| 既存資産                          | 利用する Unit | 用途                                   |
| --------------------------------- | ------------- | -------------------------------------- |
| `GitService.addWorktree()`        | Unit 1        | Worktree 作成                          |
| `GitService.removeWorktree()`     | Unit 1        | Worktree 削除                          |
| `GitService.fetch()`              | Unit 1        | エントリ追加前のリモート更新           |
| `SquadStore.updateWorkspace()`    | Unit 1        | entries 更新                           |
| `SquadStore.getWorkspace()`       | Unit 1        | Workspace 存在確認                     |
| `SquadStore.getRepository()`      | Unit 1        | Repository 存在確認                    |
| `CodeWorkspaceService.generate()` | Unit 1        | .code-workspace 再生成                 |
| `BranchComboboxComponent`         | Unit 2        | ブランチ選択 UI                        |
| `CreateBranchDialogComponent`     | Unit 2        | 新規ブランチ作成 UI                    |
| `workspace:get` (既存 IPC)        | Unit 2        | Service 公開のみ（ハンドラー追加不要） |
| `workspace:delete` (既存 IPC)     | Unit 2        | 全エントリ削除時の Workspace 削除      |
