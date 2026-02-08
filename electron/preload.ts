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
 * @remarks チャネル名について
 * preload スクリプトはサンドボックス環境で実行されるため、
 * `electron/ipc/ipc-channels.ts` の `IpcChannels` 定数を直接 import しない。
 * チャネル名は文字列リテラルとして記述し、型安全性は `electron.d.ts` の
 * `ElectronAPI` インターフェースで担保する。
 * チャネル名の一致は `ipc-handlers.spec.ts` のテストで検証される。
 *
 * @see {@link ElectronAPI} レンダラー側から参照される型定義（`electron/electron.d.ts`）
 * @see {@link IpcChannels} メインプロセス側のチャネル名定数（`electron/ipc/ipc-channels.ts`）
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 疎通確認用の ping メソッド。
   *
   * @remarks 開発・デバッグ用途。メインプロセスとの IPC 通信が正常に動作するか確認する。
   * @returns メインプロセスからの応答文字列
   */
  ping: () => ipcRenderer.invoke('ping'),

  // ---------------------------------------------------------------------------
  // リポジトリ操作
  // ---------------------------------------------------------------------------

  /**
   * 登録済みリポジトリの一覧を取得する。
   *
   * @remarks
   * メインプロセスの `SquadStore.getRepositories()` を呼び出し、
   * 全登録済みリポジトリを {@link IpcResult}<{@link Repository}[]> 形式で返す。
   *
   * @returns 登録済みリポジトリの配列を含む IpcResult
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.getRepositories();
   * if (result.success) {
   *   result.data.forEach(repo => console.log(repo.name));
   * }
   * ```
   */
  getRepositories: () => ipcRenderer.invoke('repo:list'),

  /**
   * 指定された ID のリポジトリを取得する。
   *
   * @remarks
   * メインプロセスの `SquadStore.getRepository(id)` を呼び出す。
   * 該当するリポジトリが存在しない場合は `NOT_FOUND` エラーを返す。
   *
   * @param id - 取得対象のリポジトリ UUID
   * @returns リポジトリ情報を含む IpcResult。見つからない場合は NOT_FOUND エラー
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.getRepository('550e8400-...');
   * if (result.success) {
   *   console.log(result.data.name, result.data.remoteUrl);
   * } else {
   *   console.error(result.error.code); // 'NOT_FOUND'
   * }
   * ```
   */
  getRepository: (id: string) => ipcRenderer.invoke('repo:get', { id }),

  /**
   * リモート URL を指定してリポジトリを登録する。
   *
   * @remarks
   * 以下の処理をメインプロセスで順次実行する:
   * 1. URL からリポジトリ名を自動抽出（末尾パスセグメント、`.git` 除去）
   * 2. `GitService.cloneBare()` で Bare Repository をクローン
   * 3. `SquadStore.addRepository()` でストアに登録
   *
   * @param remoteUrl - クローン元のリモートリポジトリ URL（HTTPS または SSH 形式）
   * @returns 登録されたリポジトリ情報を含む IpcResult
   *
   * @throws VALIDATION_ERROR - URL 形式が不正な場合
   * @throws REPOSITORY_EXISTS - 同名リポジトリが既に存在する場合
   * @throws GIT_OPERATION_FAILED - git clone --bare が失敗した場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.addRepository('https://github.com/org/backend.git');
   * if (result.success) {
   *   console.log('登録完了:', result.data.id);
   * }
   * ```
   */
  addRepository: (remoteUrl: string) => ipcRenderer.invoke('repo:add', { remoteUrl }),

  /**
   * 指定された ID のリポジトリを削除する。
   *
   * @remarks
   * Bare Repository のディスク削除とストアからの登録解除を行う。
   * 該当リポジトリに紐づく Workspace がある場合、先に Workspace を削除する必要がある。
   *
   * @param id - 削除対象のリポジトリ UUID
   * @returns 成功時は `data: null` の IpcResult
   *
   * @throws NOT_FOUND - 指定 ID のリポジトリが存在しない場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.removeRepository('550e8400-...');
   * if (result.success) {
   *   console.log('削除完了');
   * }
   * ```
   */
  removeRepository: (id: string) => ipcRenderer.invoke('repo:remove', { id }),

  /**
   * 指定リポジトリのリモートブランチ一覧を取得する。
   *
   * @remarks
   * メインプロセスで `GitService.getRemoteBranches(repo.name)` を呼び出し、
   * `origin/` プレフィックスを除去したブランチ名の配列を返す。
   *
   * @param repositoryId - ブランチ一覧を取得するリポジトリの UUID
   * @returns ブランチ名の文字列配列を含む IpcResult
   *
   * @throws NOT_FOUND - 指定 ID のリポジトリが存在しない場合
   * @throws GIT_OPERATION_FAILED - git branch -r の実行に失敗した場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.getRemoteBranches('550e8400-...');
   * if (result.success) {
   *   console.log(result.data); // ['main', 'develop', 'feature/payment']
   * }
   * ```
   */
  getRemoteBranches: (repositoryId: string) =>
    ipcRenderer.invoke('repo:branches', { id: repositoryId }),

  /**
   * 指定リポジトリのリモート情報を最新に更新する。
   *
   * @remarks
   * メインプロセスで `GitService.fetch(repo.name)` を呼び出し、
   * `git fetch --all --prune` を実行する。
   * UI をブロックしないよう、呼び出し側（Angular サービス）で非同期制御を行うことを推奨。
   *
   * @param repositoryId - fetch 対象のリポジトリ UUID
   * @returns 成功時は `data: null` の IpcResult
   *
   * @throws NOT_FOUND - 指定 ID のリポジトリが存在しない場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.fetchRepository('550e8400-...');
   * if (result.success) {
   *   console.log('fetch 完了');
   * }
   * ```
   */
  fetchRepository: (repositoryId: string) => ipcRenderer.invoke('repo:fetch', { id: repositoryId }),

  // ---------------------------------------------------------------------------
  // Workspace 操作
  // ---------------------------------------------------------------------------

  /**
   * 作成済み Workspace の一覧を取得する。
   *
   * @remarks
   * メインプロセスの `SquadStore.getWorkspaces()` を呼び出し、
   * 全 Workspace を {@link IpcResult}<{@link Workspace}[]> 形式で返す。
   *
   * @returns Workspace の配列を含む IpcResult
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.getWorkspaces();
   * if (result.success) {
   *   result.data.forEach(ws => console.log(ws.name, ws.entries.length));
   * }
   * ```
   */
  getWorkspaces: () => ipcRenderer.invoke('workspace:list'),

  /**
   * 指定された ID の Workspace を取得する。
   *
   * @remarks
   * メインプロセスの `SquadStore.getWorkspace(id)` を呼び出す。
   * 該当する Workspace が存在しない場合は `NOT_FOUND` エラーを返す。
   *
   * @param id - 取得対象の Workspace UUID
   * @returns Workspace 情報を含む IpcResult。見つからない場合は NOT_FOUND エラー
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.getWorkspace('660e8400-...');
   * if (result.success) {
   *   console.log(result.data.name, result.data.entries);
   * }
   * ```
   */
  getWorkspace: (id: string) => ipcRenderer.invoke('workspace:get', { id }),

  /**
   * 新しい Workspace を作成する。
   *
   * @remarks
   * 以下の処理をメインプロセスで順次実行する:
   * 1. 各 `entry.repositoryId` に対応するリポジトリ情報を解決
   * 2. 各エントリに対して `GitService.addWorktree()` で Worktree を作成
   * 3. `CodeWorkspaceService.generate()` で `.code-workspace` ファイルを生成
   * 4. `SquadStore.addWorkspace()` でストアに登録
   * 5. VS Code で `.code-workspace` を自動的に開く
   *
   * エラー発生時は作成済み Worktree のロールバック削除を行う（ベストエフォート）。
   * Workspace 名の重複時は UUID suffix が自動付与され、最大3回リトライする。
   *
   * @param name - Workspace 名（UUID suffix が自動付与される場合がある）
   * @param entries - Workspace に含めるリポジトリ × ブランチの構成配列
   * @returns 作成された Workspace 情報を含む IpcResult
   *
   * @throws NOT_FOUND - entries 内の repositoryId が存在しない場合
   * @throws VALIDATION_ERROR - ブランチ名が不正な場合
   * @throws DUPLICATE_WORKSPACE_ERROR - 3回リトライ後も重複が解決しない場合
   * @throws GIT_OPERATION_FAILED - Worktree 作成に失敗した場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.createWorkspace('feature-payment', [
   *   { repositoryId: '550e8400-...', branch: 'feature/payment' },
   *   { repositoryId: '660e8400-...', branch: 'main' },
   * ]);
   * if (result.success) {
   *   console.log('Workspace 作成完了:', result.data.id);
   * }
   * ```
   */
  createWorkspace: (name: string, entries: { repositoryId: string; branch: string }[]) =>
    ipcRenderer.invoke('workspace:create', { name, entries }),

  /**
   * 指定された ID の Workspace を削除する。
   *
   * @remarks
   * 以下の処理をメインプロセスで順次実行する:
   * 1. 各エントリの Worktree を削除
   * 2. `.code-workspace` ファイルを削除
   * 3. Workspace ディレクトリを再帰的に削除
   * 4. ストアから登録を解除
   *
   * 一部の削除が失敗しても処理は継続する（ベストエフォート削除）。
   *
   * @param id - 削除対象の Workspace UUID
   * @returns 成功時は `data: null` の IpcResult
   *
   * @throws NOT_FOUND - 指定 ID の Workspace が存在しない場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.deleteWorkspace('660e8400-...');
   * if (result.success) {
   *   console.log('Workspace 削除完了');
   * }
   * ```
   */
  deleteWorkspace: (id: string) => ipcRenderer.invoke('workspace:delete', { id }),

  /**
   * 指定された ID の Workspace を VS Code で開く。
   *
   * @remarks
   * `.code-workspace` ファイルのパスを `SquadPaths.codeWorkspaceFile()` で解決し、
   * `child_process.execFile('code', [...])` で VS Code を起動する。
   *
   * @param id - 開く対象の Workspace UUID
   * @returns 成功時は `data: null` の IpcResult
   *
   * @throws NOT_FOUND - 指定 ID の Workspace が存在しない場合
   * @throws GIT_OPERATION_FAILED - `code` コマンドの実行に失敗した場合
   *
   * @example
   * ```typescript
   * const result = await window.electronAPI.openWorkspace('660e8400-...');
   * if (result.success) {
   *   console.log('VS Code で開きました');
   * }
   * ```
   */
  openWorkspace: (id: string) => ipcRenderer.invoke('workspace:open', { id }),
});
