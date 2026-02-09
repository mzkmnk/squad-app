import { describe, it, expect } from 'vitest';
import {
  GitValidationError,
  GitOperationError,
  GitRepositoryExistsError,
} from '../git/git-errors.js';
import { IpcErrorCode } from './ipc-channels.js';
import { mapErrorToIpcResult, notFoundResult, successResult } from './ipc-error-mapper.js';

describe('mapErrorToIpcResult', () => {
  it('GitValidationError が VALIDATION_ERROR コードにマッピングされる', () => {
    const error = new GitValidationError('Invalid remote URL');
    const result = mapErrorToIpcResult(error);

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.VALIDATION_ERROR, message: 'Invalid remote URL' },
    });
  });

  it('GitRepositoryExistsError が REPOSITORY_EXISTS コードにマッピングされる', () => {
    const error = new GitRepositoryExistsError('backend');
    const result = mapErrorToIpcResult(error);

    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.REPOSITORY_EXISTS,
        message: "Repository 'backend' already exists",
      },
    });
  });

  it('GitOperationError が GIT_OPERATION_FAILED コードにマッピングされ、stderr が優先される', () => {
    const error = new GitOperationError('git clone failed', 128, 'fatal: repository not found');
    const result = mapErrorToIpcResult(error);

    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.GIT_OPERATION_FAILED,
        message: 'fatal: repository not found',
      },
    });
  });

  it('GitOperationError で stderr が空の場合は message にフォールバックする', () => {
    const error = new GitOperationError('git clone failed', 1, '');
    const result = mapErrorToIpcResult(error);

    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.GIT_OPERATION_FAILED,
        message: 'git clone failed',
      },
    });
  });

  it('未知の Error が INTERNAL_ERROR コードにマッピングされる', () => {
    const error = new Error('Something went wrong');
    const result = mapErrorToIpcResult(error);

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.INTERNAL_ERROR, message: 'Something went wrong' },
    });
  });

  it('Error でないオブジェクトが INTERNAL_ERROR + "Unknown error" にマッピングされる', () => {
    const result = mapErrorToIpcResult('string error');

    expect(result).toEqual({
      success: false,
      error: { code: IpcErrorCode.INTERNAL_ERROR, message: 'Unknown error' },
    });
  });
});

describe('notFoundResult', () => {
  it('指定されたリソース種別と ID で NOT_FOUND エラーを生成する', () => {
    const result = notFoundResult('Repository', 'abc-123');

    expect(result).toEqual({
      success: false,
      error: {
        code: IpcErrorCode.NOT_FOUND,
        message: 'Repository not found: abc-123',
      },
    });
  });
});

describe('successResult', () => {
  it('データを success: true でラップする', () => {
    const data = [{ id: '1', name: 'backend' }];
    const result = successResult(data);

    expect(result).toEqual({
      success: true,
      data: [{ id: '1', name: 'backend' }],
    });
  });

  it('null データも正しくラップする', () => {
    const result = successResult(null);

    expect(result).toEqual({ success: true, data: null });
  });
});
