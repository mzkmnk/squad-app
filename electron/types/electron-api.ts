/**
 * レンダラープロセス（Angular）向けの Electron API 型定義。
 *
 * electron/preload.ts の contextBridge.exposeInMainWorld で公開された API の型を定義する。
 * Angular コンポーネントやサービスから window.electronAPI を型安全に利用するために使用する。
 *
 * tsconfig.app.json の include に electron/types/ が含まれているため、
 * Angular 側で自動的に型補完が有効になる。
 */

import type { Repository, Workspace, Settings, IdeDetectionResult } from './models';
import type { IpcResult } from './ipc-result';
import type { WorkspaceCreateEntry } from '../ipc/ipc-channels';

/**
 * contextBridge.exposeInMainWorld で window.electronAPI に公開される API の型定義。
 *
 * 各メソッドは ipcRenderer.invoke を通じてメインプロセスの対応する IPC ハンドラーを呼び出す。
 * 全てのメソッドは非同期（Promise）で、レスポンスは IpcResult でラップされる。
 *
 * メソッド名 → IPC チャネル名:
 *   getRepositories   → repo:list
 *   getRepository     → repo:get
 *   addRepository     → repo:add
 *   removeRepository  → repo:remove
 *   getRemoteBranches → repo:branches
 *   fetchRepository   → repo:fetch
 *   getWorkspaces     → workspace:list
 *   getWorkspace      → workspace:get
 *   createWorkspace   → workspace:create
 *   deleteWorkspace   → workspace:delete
 *   openWorkspace     → workspace:open
 */
export interface ElectronAPI {
  /**
   * 疎通確認用の ping メソッド。開発・デバッグ用途。
   * @returns メインプロセスからの応答文字列（通常 'pong'）
   */
  ping: () => Promise<string>;

  // --- リポジトリ操作 ---

  /**
   * 登録済みリポジトリの一覧を取得する。
   * @returns 登録済みリポジトリの配列を含む IpcResult
   */
  getRepositories: () => Promise<IpcResult<Repository[]>>;

  /**
   * 指定 ID のリポジトリを取得する。
   * @param id - 取得対象のリポジトリ UUID
   * @returns リポジトリ情報を含む IpcResult。見つからない場合は NOT_FOUND エラー
   */
  getRepository: (id: string) => Promise<IpcResult<Repository>>;

  /**
   * リモート URL を指定してリポジトリを登録する。
   * URL からリポジトリ名を自動抽出し、Bare Repository のクローンとストア登録を行う。
   * @param remoteUrl - クローン元のリモートリポジトリ URL（HTTPS または SSH 形式）
   * @returns 登録されたリポジトリ情報を含む IpcResult
   */
  addRepository: (remoteUrl: string) => Promise<IpcResult<Repository>>;

  /**
   * 指定 ID のリポジトリを削除する。
   * Bare Repository のディスク削除とストアからの登録解除を行う。
   * @param id - 削除対象のリポジトリ UUID
   * @returns 成功時は data: null の IpcResult
   */
  removeRepository: (id: string) => Promise<IpcResult<null>>;

  /**
   * 指定リポジトリのリモートブランチ一覧を取得する。
   * origin/ プレフィックスを除去したブランチ名の配列を返す。
   * @param repositoryId - ブランチ一覧を取得するリポジトリの UUID
   * @returns ブランチ名の文字列配列を含む IpcResult
   */
  getRemoteBranches: (repositoryId: string) => Promise<IpcResult<string[]>>;

  /**
   * 指定リポジトリのリモート情報を最新に更新する。
   * git fetch --all --prune を実行する。
   * @param repositoryId - fetch 対象のリポジトリ UUID
   * @returns 成功時は data: null の IpcResult
   */
  fetchRepository: (repositoryId: string) => Promise<IpcResult<null>>;

  // --- Workspace 操作 ---

  /**
   * 作成済み Workspace の一覧を取得する。
   * @returns Workspace の配列を含む IpcResult
   */
  getWorkspaces: () => Promise<IpcResult<Workspace[]>>;

  /**
   * 指定 ID の Workspace を取得する。
   * @param id - 取得対象の Workspace UUID
   * @returns Workspace 情報を含む IpcResult。見つからない場合は NOT_FOUND エラー
   */
  getWorkspace: (id: string) => Promise<IpcResult<Workspace>>;

  /**
   * 新しい Workspace を作成する。
   * Worktree 作成 → .code-workspace 生成 → ストア登録 → VS Code 起動の順で処理する。
   * エラー発生時は作成済み Worktree のロールバック削除を行う（ベストエフォート）。
   * @param name - Workspace 名（UUID suffix が自動付与される場合がある）
   * @param entries - Workspace に含めるリポジトリ × ブランチの構成配列
   * @returns 作成された Workspace 情報を含む IpcResult
   */
  createWorkspace: (name: string, entries: WorkspaceCreateEntry[]) => Promise<IpcResult<Workspace>>;

  /**
   * 指定 ID の Workspace を削除する。
   * Worktree 削除 → .code-workspace 削除 → ディレクトリ削除 → ストア削除の順で処理する。
   * 一部の削除が失敗しても処理は継続する（ベストエフォート削除）。
   * @param id - 削除対象の Workspace UUID
   * @returns 成功時は data: null の IpcResult
   */
  deleteWorkspace: (id: string) => Promise<IpcResult<null>>;

  /**
   * 指定 ID の Workspace を VS Code で開く。
   * .code-workspace ファイルのパスを解決し、code コマンドで VS Code を起動する。
   * @param id - 開く対象の Workspace UUID
   * @returns 成功時は data: null の IpcResult
   */
  openWorkspace: (id: string) => Promise<IpcResult<null>>;

  // --- 設定操作 ---

  /**
   * 現在のアプリケーション設定を取得する。
   * @returns 設定オブジェクトを含む IpcResult
   */
  getSettings: () => Promise<IpcResult<Settings>>;

  /**
   * アプリケーション設定を更新する。
   * @param settings - 新しい設定オブジェクト
   * @returns 更新後の設定オブジェクトを含む IpcResult
   */
  updateSettings: (settings: Settings) => Promise<IpcResult<Settings>>;

  /**
   * インストール済み IDE を検出する。
   * @returns 各 IDE の検出結果の配列を含む IpcResult
   */
  detectIdes: () => Promise<IpcResult<IdeDetectionResult[]>>;
}

declare global {
  /** window.electronAPI のグローバル型拡張。 */
  interface Window {
    electronAPI: ElectronAPI;
  }
}
