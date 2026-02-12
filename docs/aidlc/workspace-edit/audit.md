# Audit Log — workspace-edit

## Workspace Detection

| 項目               | 結果                     |
| ------------------ | ------------------------ |
| 日時               | 2026-02-12               |
| 判定               | **brownfield**           |
| 既存 AI-DLC 成果物 | なし（新規フィーチャー） |
| 次ステージ         | Reverse Engineering      |

### 既存コードベース分析

#### 現在の Workspace 機能（実装済み）

| 操作                    | Electron IPC       | Angular UI                     | 状態        |
| ----------------------- | ------------------ | ------------------------------ | ----------- |
| Workspace 一覧表示      | `workspace:list`   | `WorkspaceListComponent`       | ✅ 実装済み |
| Workspace 作成          | `workspace:create` | `WorkspaceCreateFormComponent` | ✅ 実装済み |
| Workspace 削除          | `workspace:delete` | `WorkspaceListComponent` 内    | ✅ 実装済み |
| Workspace を IDE で開く | `workspace:open`   | `WorkspaceListComponent` 内    | ✅ 実装済み |
| **Workspace 編集**      | **なし**           | **なし**                       | ❌ 未実装   |

#### 現在のリポジトリ管理機能（実装済み）

| 操作               | Electron IPC    | Angular UI                 | 状態        |
| ------------------ | --------------- | -------------------------- | ----------- |
| リポジトリ一覧表示 | `repo:list`     | `RepoListComponent`        | ✅ 実装済み |
| リポジトリ追加     | `repo:add`      | `RepoAddFormComponent`     | ✅ 実装済み |
| リポジトリ削除     | `repo:remove`   | `RepoListComponent` 内     | ✅ 実装済み |
| ブランチ一覧取得   | `repo:branches` | `BranchComboboxComponent`  | ✅ 実装済み |
| リモート fetch     | `repo:fetch`    | Workspace 作成時に自動実行 | ✅ 実装済み |

#### ユーザーリクエストの分析

ユーザーは「ワークスペースの編集機能」として以下を要望:

1. **リポジトリの削除** — Workspace 内の特定リポジトリ（エントリ）を削除
2. **リポジトリの追加** — Workspace に新しいリポジトリ × ブランチのエントリを追加

これは既存 Workspace の `entries` 配列を変更する機能であり、現在は未実装。
作成後の Workspace は読み取り専用で、変更するには削除→再作成が必要な状態。

#### 影響範囲

- **Electron 側**: IPC チャネル追加（`workspace:update` or `workspace:add-entry` / `workspace:remove-entry`）、Worktree の追加・削除ロジック、`.code-workspace` ファイルの再生成
- **Angular 側**: Workspace 詳細/編集 UI、エントリの追加・削除操作
- **データモデル**: `Workspace.updatedAt` の更新（既にフィールドは存在）
- **既存コード**: `WorkspaceListComponent` の拡張 or 新規編集コンポーネント

### 技術的考慮事項

- Worktree の追加は `git worktree add` で対応可能（`git-service.ts` に既存メソッドあり）
- Worktree の削除は `git worktree remove` で対応可能（`git-service.ts` に既存メソッドあり）
- `.code-workspace` ファイルの再生成が必要（`code-workspace-service.ts` に既存ロジックあり）
- エントリ削除時、対応する Worktree ディレクトリも削除する必要がある
- エントリ追加時、新規ブランチ作成のフローも考慮が必要（既存の `CreateBranchDialog` を再利用可能）
