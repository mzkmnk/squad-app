import type { Settings } from '../types/models.js';

/**
 * IPC チャネル名を一元管理する定数オブジェクト。
 *
 * @remarks
 * メインプロセス（`ipcMain.handle`）と preload（`ipcRenderer.invoke`）で
 * 同じ定数を参照することで、チャネル名のタイポを防止する。
 * 命名規則は「ドメイン:操作」で統一する。
 *
 * @example
 * ```typescript
 * ipcMain.handle(IpcChannels.REPO_LIST, async () => { ... });
 * ipcRenderer.invoke(IpcChannels.REPO_ADD, { remoteUrl });
 * ```
 */
export const IpcChannels = {
  // 共通

  /** 疎通確認用 ping */
  PING: 'ping',

  // リポジトリ操作

  /** 登録済みリポジトリ一覧を取得する */
  REPO_LIST: 'repo:list',
  /** ID を指定してリポジトリを取得する */
  REPO_GET: 'repo:get',
  /** リモート URL を指定してリポジトリを登録する（clone --bare + ストア保存） */
  REPO_ADD: 'repo:add',
  /** ID を指定してリポジトリを削除する（Bare Repository + ストア削除） */
  REPO_REMOVE: 'repo:remove',
  /** ID を指定してリモートブランチ一覧を取得する */
  REPO_BRANCHES: 'repo:branches',
  /** ID を指定してリモートから最新情報を取得する */
  REPO_FETCH: 'repo:fetch',

  // Workspace 操作

  /** Workspace 一覧を取得する */
  WORKSPACE_LIST: 'workspace:list',
  /** ID を指定して Workspace を取得する */
  WORKSPACE_GET: 'workspace:get',
  /** Workspace を作成する（Worktree + .code-workspace 生成 + VS Code 起動） */
  WORKSPACE_CREATE: 'workspace:create',
  /** ID を指定して Workspace を削除する（Worktree + .code-workspace + ストア削除） */
  WORKSPACE_DELETE: 'workspace:delete',
  /** ID を指定して Workspace を VS Code で開く */
  WORKSPACE_OPEN: 'workspace:open',
  /** 既存の Workspace にエントリを一括追加する */
  WORKSPACE_ADD_ENTRY: 'workspace:add-entry',
  /** 既存の Workspace からエントリを一括削除する */
  WORKSPACE_REMOVE_ENTRY: 'workspace:remove-entry',

  // 設定操作

  /** 現在の設定を取得する */
  SETTINGS_GET: 'settings:get',
  /** 設定を更新する */
  SETTINGS_UPDATE: 'settings:update',
  /** インストール済み IDE の検出結果を取得する */
  SETTINGS_DETECT_IDES: 'settings:detect-ides',
} as const;

/**
 * {@link IpcChannels} の値から導出されるチャネル名のユニオン型。
 *
 * @remarks
 * ハンドラー登録やチャネル名を引数に取る関数の型制約に使用する。
 *
 * @example
 * ```typescript
 * function handle(channel: IpcChannel, handler: () => void): void { ... }
 * ```
 */
export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// --- リクエスト型 ---

/**
 * `repo:get` チャネルのリクエスト。
 *
 * @remarks ID を指定して単一のリポジトリを取得する。
 */
export interface RepoGetRequest {
  /** 取得対象のリポジトリ UUID */
  id: string;
}

/**
 * `repo:add` チャネルのリクエスト。
 *
 * @remarks
 * リモート URL からリポジトリ名を自動抽出し、Bare Repository のクローンとストア登録を行う。
 */
export interface RepoAddRequest {
  /** クローン元のリモートリポジトリ URL（HTTPS または SSH 形式） */
  remoteUrl: string;
}

/**
 * `repo:remove` チャネルのリクエスト。
 *
 * @remarks Bare Repository のディスク削除とストアからの登録解除を行う。
 */
export interface RepoRemoveRequest {
  /** 削除対象のリポジトリ UUID */
  id: string;
}

/**
 * `repo:branches` チャネルのリクエスト。
 *
 * @remarks 指定リポジトリのリモートブランチ一覧を取得する。
 */
export interface RepoBranchesRequest {
  /** ブランチ一覧を取得するリポジトリの UUID */
  id: string;
}

/**
 * `repo:fetch` チャネルのリクエスト。
 *
 * @remarks 指定リポジトリに対して `git fetch --all --prune` を実行する。
 */
export interface RepoFetchRequest {
  /** fetch 対象のリポジトリ UUID */
  id: string;
}

/**
 * `workspace:get` チャネルのリクエスト。
 *
 * @remarks ID を指定して単一の Workspace を取得する。
 */
export interface WorkspaceGetRequest {
  /** 取得対象の Workspace UUID */
  id: string;
}

/**
 * {@link WorkspaceCreateRequest} の各エントリ。
 *
 * @remarks
 * リポジトリ × ブランチの組み合わせを1つ表す。
 * `sourceBranch` を指定すると、既存ブランチからの新規ブランチ作成になる。
 */
export interface WorkspaceCreateEntry {
  /** 対象リポジトリの UUID */
  repositoryId: string;
  /** チェックアウト対象のブランチ名 */
  branch: string;
  /** 新規ブランチの起点ブランチ名。指定時は branch を sourceBranch から新規作成する */
  sourceBranch?: string;
}

/**
 * `workspace:create` チャネルのリクエスト。
 *
 * @remarks
 * 各エントリに対して Worktree を作成し、`.code-workspace` ファイルを生成した後、
 * VS Code で自動的に開く。エラー発生時は作成済み Worktree のロールバック削除を行う。
 */
export interface WorkspaceCreateRequest {
  /** Workspace 名（UUID suffix が自動付与される） */
  name: string;
  /** Workspace に含めるリポジトリ × ブランチの構成 */
  entries: WorkspaceCreateEntry[];
}

/**
 * `workspace:delete` チャネルのリクエスト。
 *
 * @remarks
 * Worktree 削除 → `.code-workspace` ファイル削除 → ディレクトリ削除 → ストア削除の順で処理する。
 * 一部の削除が失敗しても処理は継続する（ベストエフォート）。
 */
export interface WorkspaceDeleteRequest {
  /** 削除対象の Workspace UUID */
  id: string;
}

/**
 * `workspace:open` チャネルのリクエスト。
 *
 * @remarks `.code-workspace` ファイルのパスを解決し、`code` コマンドで VS Code を起動する。
 */
export interface WorkspaceOpenRequest {
  /** 開く対象の Workspace UUID */
  id: string;
}

// --- 設定リクエスト型 ---

/**
 * `settings:update` チャネルのリクエスト。
 * 設定オブジェクト全体を上書きする。
 */
export interface SettingsUpdateRequest {
  /** 更新する設定 */
  settings: Settings;
}

/**
 * `workspace:add-entry` チャネルのリクエスト。
 *
 * 1つの Workspace に対して複数エントリを一括追加する。
 * 各エントリは WorkspaceCreateEntry と同じフィールド構造を持つ。
 */
export interface WorkspaceAddEntryRequest {
  /** 対象 Workspace の UUID */
  id: string;
  /** 追加するエントリの配列（複数一括対応） */
  entries: WorkspaceCreateEntry[];
}

/**
 * `workspace:remove-entry` チャネルのリクエスト。
 *
 * 1つの Workspace から複数エントリを一括削除する。
 * repositoryId の配列で削除対象を指定する。
 */
export interface WorkspaceRemoveEntryRequest {
  /** 対象 Workspace の UUID */
  id: string;
  /** 削除対象のリポジトリ UUID の配列（複数一括対応） */
  repositoryIds: string[];
}
