import type { IpcErrorCode } from './ipc-error-code.js';

/**
 * 全 IPC レスポンスの統一ラッパー型。
 *
 * Discriminated Union パターンにより、success フィールドで型の絞り込みが可能。
 * IPC 通信ではメインプロセスの例外がレンダラーに伝播しないため、
 * エラーを明示的にシリアライズして返す必要がある。
 *
 * メインプロセス（ipc-channels.ts）とレンダラー（electron-api.ts）の
 * 両方から参照される共通型として electron/types/ に配置している。
 *
 * @typeParam T - 成功時に返されるデータの型
 */
export type IpcResult<T> = { success: true; data: T } | IpcErrorResult;

/**
 * {@link IpcResult} の失敗ブランチのみを表す型。
 *
 * @remarks
 * `mapErrorToIpcResult` や `notFoundResult` など、常に失敗を返す関数の
 * 戻り値型として使用する。`IpcResult<never>` と異なり、成功ブランチ
 * （`data: never`）を含まないため、ESLint の `no-unsafe-assignment` に
 * 抵触しない。
 */
export interface IpcErrorResult {
  success: false;
  error: { code: IpcErrorCode; message: string };
}
