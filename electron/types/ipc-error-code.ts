/**
 * IPC レスポンスで使用するエラーコードの定数オブジェクト。
 *
 * 各エラーコードは {@link IpcResult} の error.code フィールドに設定される。
 * レンダラー側でエラー種別に応じた分岐処理を行う際に使用する。
 */
export const IpcErrorCode = {
  /** 入力値バリデーション失敗 */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 同名リポジトリが既に存在する */
  REPOSITORY_EXISTS: 'REPOSITORY_EXISTS',
  /** Git コマンド実行失敗 */
  GIT_OPERATION_FAILED: 'GIT_OPERATION_FAILED',
  /** 指定された ID のリソースが見つからない */
  NOT_FOUND: 'NOT_FOUND',
  /** 設定された IDE がインストールされていない */
  IDE_NOT_FOUND: 'IDE_NOT_FOUND',
  /** IDE の起動に失敗した */
  IDE_LAUNCH_FAILED: 'IDE_LAUNCH_FAILED',
  /** 予期しないエラー。上記に該当しない全ての例外がマッピングされる */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** {@link IpcErrorCode} の値から導出されるエラーコードのユニオン型。 */
export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];
