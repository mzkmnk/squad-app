// --- エンティティ ---

/** 登録された Git リポジトリの情報を保持する */
export interface Repository {
  /** UUID v4。リポジトリの一意識別子 */
  readonly id: string;
  /** リポジトリ名（URL から抽出、例: `backend`） */
  readonly name: string;
  /** リモートリポジトリ URL（例: `https://github.com/org/backend.git`） */
  readonly remoteUrl: string;
  /** ISO 8601 形式の登録日時 */
  readonly registeredAt: string;
}

/** 複数リポジトリ × ブランチの組み合わせを1つの開発環境として管理する */
export interface Workspace {
  /** UUID v4。Workspace の一意識別子 */
  readonly id: string;
  /** Workspace 名（ユーザー入力、例: `feature-payment`） */
  readonly name: string;
  /** Workspace に含まれるリポジトリ × ブランチの構成 */
  readonly entries: readonly WorkspaceEntry[];
  /** ISO 8601 形式の作成日時 */
  readonly createdAt: string;
  /** ISO 8601 形式の最終更新日時 */
  readonly updatedAt: string;
}

// --- 値オブジェクト ---

/** Workspace 内の1つのリポジトリ × ブランチの組み合わせを表現する */
export interface WorkspaceEntry {
  /** 対応する {@link Repository} の ID */
  readonly repositoryId: string;
  /** チェックアウト対象のブランチ名（例: `feature/payment`） */
  readonly branch: string;
}

// --- JSON ファイルスキーマ ---

/** `~/.squad/config/repos.json` のスキーマ */
export interface ReposConfig {
  /** スキーマバージョン。現在は `1` 固定 */
  readonly version: number;
  /** 登録済みリポジトリの配列 */
  readonly repositories: Repository[];
}

/** `~/.squad/config/workspaces.json` のスキーマ */
export interface WorkspacesConfig {
  /** スキーマバージョン。現在は `1` 固定 */
  readonly version: number;
  /** 作成済み Workspace の配列 */
  readonly workspaces: Workspace[];
}
