/**
 * @fileoverview Electron preload スクリプト。
 *
 * @remarks
 * `contextBridge.exposeInMainWorld` を使用して、レンダラープロセス（Angular）に
 * 型安全な IPC 通信 API を公開する。
 *
 * セキュリティ要件として `contextIsolation: true` / `nodeIntegration: false` を維持し、
 * `ipcRenderer` を直接レンダラーに公開しない。全ての Node.js 操作は
 * ここで定義されたメソッド経由の IPC 通信を通じてのみ実行可能。
 *
 * @remarks ビルドについて
 * sandbox 環境の preload は ESM import が使えないため、
 * esbuild でバンドルして単一 CJS ファイルとして出力する（`electron/build-preload.mjs`）。
 * これにより `IpcChannels` 定数を直接 import でき、チャネル名の二重定義を排除している。
 *
 * @see {@link ElectronAPI} レンダラー側から参照される型定義（`electron/types/electron-api.ts`）
 * @see {@link IpcChannels} チャネル名定数（`electron/ipc/ipc-channels.ts`）
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './ipc/ipc-channels.js';

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 疎通確認用の ping メソッド。
   *
   * @remarks 開発・デバッグ用途。メインプロセスとの IPC 通信が正常に動作するか確認する。
   * @returns メインプロセスからの応答文字列
   */
  ping: () => ipcRenderer.invoke(IpcChannels.PING),

  // ---------------------------------------------------------------------------
  // リポジトリ操作
  // ---------------------------------------------------------------------------

  /** 登録済みリポジトリの一覧を取得する。 */
  getRepositories: () => ipcRenderer.invoke(IpcChannels.REPO_LIST),

  /** 指定された ID のリポジトリを取得する。 */
  getRepository: (id: string) => ipcRenderer.invoke(IpcChannels.REPO_GET, { id }),

  /** リモート URL を指定してリポジトリを登録する。 */
  addRepository: (remoteUrl: string) => ipcRenderer.invoke(IpcChannels.REPO_ADD, { remoteUrl }),

  /** 指定された ID のリポジトリを削除する。 */
  removeRepository: (id: string) => ipcRenderer.invoke(IpcChannels.REPO_REMOVE, { id }),

  /** 指定リポジトリのリモートブランチ一覧を取得する。 */
  getRemoteBranches: (repositoryId: string) =>
    ipcRenderer.invoke(IpcChannels.REPO_BRANCHES, { id: repositoryId }),

  /** 指定リポジトリのリモート情報を最新に更新する。 */
  fetchRepository: (repositoryId: string) =>
    ipcRenderer.invoke(IpcChannels.REPO_FETCH, { id: repositoryId }),

  // ---------------------------------------------------------------------------
  // Workspace 操作
  // ---------------------------------------------------------------------------

  /** 作成済み Workspace の一覧を取得する。 */
  getWorkspaces: () => ipcRenderer.invoke(IpcChannels.WORKSPACE_LIST),

  /** 指定された ID の Workspace を取得する。 */
  getWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_GET, { id }),

  /** 新しい Workspace を作成する。 */
  createWorkspace: (
    name: string,
    entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
  ) => ipcRenderer.invoke(IpcChannels.WORKSPACE_CREATE, { name, entries }),

  /** 指定された ID の Workspace を削除する。 */
  deleteWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_DELETE, { id }),

  /** 指定された ID の Workspace を VS Code で開く。 */
  openWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.WORKSPACE_OPEN, { id }),

  /** Workspace にエントリを一括追加する。 */
  addWorkspaceEntry: (
    id: string,
    entries: { repositoryId: string; branch: string; sourceBranch?: string }[],
  ) => ipcRenderer.invoke(IpcChannels.WORKSPACE_ADD_ENTRY, { id, entries }),

  /** Workspace からエントリを一括削除する。 */
  removeWorkspaceEntry: (id: string, repositoryIds: string[]) =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_REMOVE_ENTRY, { id, repositoryIds }),

  // ---------------------------------------------------------------------------
  // 設定操作
  // ---------------------------------------------------------------------------

  /** 現在のアプリケーション設定を取得する。 */
  getSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),

  /** アプリケーション設定を更新する。 */
  updateSettings: (settings: { selectedIde: string }) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_UPDATE, { settings }),

  /** インストール済み IDE を検出する。 */
  detectIdes: () => ipcRenderer.invoke(IpcChannels.SETTINGS_DETECT_IDES),
});
