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

// --- レスポンスラッパー ---

/**
 * 全 IPC レスポンスの統一ラッパー型。
 *
 * @remarks
 * Discriminated Union パターンにより、`success` フィールドで型の絞り込みが可能。
 * IPC 通信ではメインプロセスの例外がレンダラーに伝播しないため、
 * エラーを明示的にシリアライズして返す必要がある。
 *
 * @typeParam T - 成功時に返されるデータの型
 *
 * @example
 * ```typescript
 * const result: IpcResult<Repository[]> = await window.electronAPI.getRepositories();
 * if (result.success) {
 *   console.log(result.data); // Repository[]
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// --- エラーコード ---

/**
 * IPC レスポンスで使用するエラーコードの定数オブジェクト。
 *
 * @remarks
 * 各エラーコードは {@link IpcResult} の `error.code` フィールドに設定される。
 * レンダラー側でエラー種別に応じた分岐処理を行う際に使用する。
 */
export const IpcErrorCode = {
  /** 入力値バリデーション失敗。{@link GitValidationError} から変換される */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 同名リポジトリが既に存在する。{@link GitRepositoryExistsError} から変換される */
  REPOSITORY_EXISTS: 'REPOSITORY_EXISTS',
  /** Git コマンド実行失敗。{@link GitOperationError} から変換される */
  GIT_OPERATION_FAILED: 'GIT_OPERATION_FAILED',
  /** 指定された ID のリソースが見つからない */
  NOT_FOUND: 'NOT_FOUND',
  /** 同名 Workspace の重複が最大リトライ回数後も解決しない */
  DUPLICATE_WORKSPACE_ERROR: 'DUPLICATE_WORKSPACE_ERROR',
  /** 予期しないエラー。上記に該当しない全ての例外がマッピングされる */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * {@link IpcErrorCode} の値から導出されるエラーコードのユニオン型。
 */
export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

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
  entries: {
    /** 対象リポジトリの UUID */
    repositoryId: string;
    /** チェックアウト対象のブランチ名 */
    branch: string;
  }[];
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
