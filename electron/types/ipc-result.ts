/**
 * 全 IPC レスポンスの統一ラッパー型。
 *
 * @remarks
 * Discriminated Union パターンにより、`success` フィールドで型の絞り込みが可能。
 * IPC 通信ではメインプロセスの例外がレンダラーに伝播しないため、
 * エラーを明示的にシリアライズして返す必要がある。
 *
 * メインプロセス（`ipc-channels.ts`）とレンダラー（`electron.d.ts`）の
 * 両方から参照される共通型として `electron/types/` に配置している。
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
