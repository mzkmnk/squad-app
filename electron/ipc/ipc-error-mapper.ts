import {
  GitValidationError,
  GitOperationError,
  GitRepositoryExistsError,
} from '../git/git-errors.js';
import { IpcErrorCode, type IpcResult } from './ipc-channels.js';

/**
 * メインプロセスで発生した例外を {@link IpcResult} の失敗形式に変換する。
 *
 * @remarks
 * エラー種別に応じて適切な {@link IpcErrorCode} をマッピングする。
 * 未知のエラーは `INTERNAL_ERROR` として処理する。
 *
 * - {@link GitValidationError} → `VALIDATION_ERROR`
 * - {@link GitRepositoryExistsError} → `REPOSITORY_EXISTS`
 * - {@link GitOperationError} → `GIT_OPERATION_FAILED`（`stderr` を優先、空なら `message` にフォールバック）
 * - その他の `Error` → `INTERNAL_ERROR`（`message` を使用）
 * - `Error` でないオブジェクト → `INTERNAL_ERROR` + `'Unknown error'`
 *
 * @param error - 捕捉された例外オブジェクト
 * @returns 失敗形式の {@link IpcResult}
 *
 * @example
 * ```typescript
 * try {
 *   await gitService.cloneBare(url, name);
 * } catch (error) {
 *   return mapErrorToIpcResult(error);
 * }
 * ```
 */
export function mapErrorToIpcResult(error: unknown): IpcResult<never> {
  if (error instanceof GitValidationError) {
    return {
      success: false,
      error: { code: IpcErrorCode.VALIDATION_ERROR, message: error.message },
    };
  }

  if (error instanceof GitRepositoryExistsError) {
    return {
      success: false,
      error: { code: IpcErrorCode.REPOSITORY_EXISTS, message: error.message },
    };
  }

  if (error instanceof GitOperationError) {
    return {
      success: false,
      error: {
        code: IpcErrorCode.GIT_OPERATION_FAILED,
        message: error.stderr.length > 0 ? error.stderr : error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    success: false,
    error: { code: IpcErrorCode.INTERNAL_ERROR, message },
  };
}

/**
 * `NOT_FOUND` エラーの {@link IpcResult} を生成する。
 *
 * @remarks
 * リソースの種別と ID を組み合わせて、統一的なエラーメッセージを生成する。
 *
 * @param resourceType - リソースの種別名（例: `'Repository'`, `'Workspace'`）
 * @param id - 見つからなかったリソースの UUID
 * @returns `NOT_FOUND` コードを持つ失敗形式の {@link IpcResult}
 *
 * @example
 * ```typescript
 * const repo = await store.getRepository(id);
 * if (!repo) {
 *   return notFoundResult('Repository', id);
 * }
 * ```
 */
export function notFoundResult(resourceType: string, id: string): IpcResult<never> {
  return {
    success: false,
    error: {
      code: IpcErrorCode.NOT_FOUND,
      message: `${resourceType} not found: ${id}`,
    },
  };
}

/**
 * 成功形式の {@link IpcResult} を生成する。
 *
 * @typeParam T - レスポンスデータの型
 * @param data - 成功時に返すデータ
 * @returns 成功形式の {@link IpcResult}
 *
 * @example
 * ```typescript
 * const repos = await store.getRepositories();
 * return successResult(repos);
 * ```
 */
export function successResult<T>(data: T): IpcResult<T> {
  return { success: true, data };
}
