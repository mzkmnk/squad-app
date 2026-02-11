import { z } from 'zod';

// --- エンティティ ---

/** 登録された Git リポジトリの情報を保持する */
export const repositorySchema = z.object({
  /** UUID v4。リポジトリの一意識別子 */
  id: z.string(),
  /** リポジトリ名（suffix 付き内部名、ディレクトリ名に使用。例: `backend-a1b2c3d4`） */
  name: z.string(),
  /** UI 表示用の名前（ユーザーが認識しやすい元の名前。例: `backend`） */
  displayName: z.string(),
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
  /** Workspace 名（suffix 付き内部名、ディレクトリ名に使用。例: `feature-payment-a1b2c3d4`） */
  name: z.string(),
  /** UI 表示用の名前（ユーザーが入力した元の名前。例: `feature-payment`） */
  displayName: z.string(),
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
  /** スキーマバージョン（マイグレーションにより変動） */
  version: z.number(),
  /** 登録済みリポジトリの配列 */
  repositories: z.array(repositorySchema),
});

export type ReposConfig = z.infer<typeof reposConfigSchema>;

/** `~/.squad/config/workspaces.json` のスキーマ */
export const workspacesConfigSchema = z.object({
  /** スキーマバージョン（マイグレーションにより変動） */
  version: z.number(),
  /** 作成済み Workspace の配列 */
  workspaces: z.array(workspaceSchema),
});

export type WorkspacesConfig = z.infer<typeof workspacesConfigSchema>;

// --- 設定 ---

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

/** 各 IDE の検出結果 */
export interface IdeDetectionResult {
  /** IDE 識別子 */
  id: IdeId;
  /** 表示名 */
  displayName: string;
  /** インストール済みかどうか */
  installed: boolean;
}
