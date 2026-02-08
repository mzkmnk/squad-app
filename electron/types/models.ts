import { z } from 'zod';

// --- エンティティ ---

/** 登録された Git リポジトリの情報を保持する */
export const repositorySchema = z.object({
  /** UUID v4。リポジトリの一意識別子 */
  id: z.string(),
  /** リポジトリ名（URL から抽出、例: `backend`） */
  name: z.string(),
  /** リモートリポジトリ URL（例: `https://github.com/org/backend.git`） */
  remoteUrl: z.string(),
  /** ISO 8601 形式の登録日時 */
  registeredAt: z.string(),
});

export type Repository = z.infer<typeof repositorySchema>;

/** 複数リポジトリ × ブランチの組み合わせを1つの開発環境として管理する */
export const workspaceEntrySchema = z.object({
  /** 対応する {@link Repository} の ID */
  repositoryId: z.string(),
  /** チェックアウト対象のブランチ名（例: `feature/payment`） */
  branch: z.string(),
});

export type WorkspaceEntry = z.infer<typeof workspaceEntrySchema>;

export const workspaceSchema = z.object({
  /** UUID v4。Workspace の一意識別子 */
  id: z.string(),
  /** Workspace 名（ユーザー入力、例: `feature-payment`） */
  name: z.string(),
  /** Workspace に含まれるリポジトリ × ブランチの構成 */
  entries: z.array(workspaceEntrySchema),
  /** ISO 8601 形式の作成日時 */
  createdAt: z.string(),
  /** ISO 8601 形式の最終更新日時 */
  updatedAt: z.string(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

// --- JSON ファイルスキーマ ---

/** `~/.squad/config/repos.json` のスキーマ */
export const reposConfigSchema = z.object({
  /** スキーマバージョン。現在は `1` 固定 */
  version: z.number(),
  /** 登録済みリポジトリの配列 */
  repositories: z.array(repositorySchema),
});

export type ReposConfig = z.infer<typeof reposConfigSchema>;

/** `~/.squad/config/workspaces.json` のスキーマ */
export const workspacesConfigSchema = z.object({
  /** スキーマバージョン。現在は `1` 固定 */
  version: z.number(),
  /** 作成済み Workspace の配列 */
  workspaces: z.array(workspaceSchema),
});

export type WorkspacesConfig = z.infer<typeof workspacesConfigSchema>;
