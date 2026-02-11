import { describe, expect, it, vi } from 'vitest';
import type { TranslocoService } from '@jsverse/transloco';

import { checkBranchDuplicate, validateBranchName } from './branch-validation';

/** TranslocoService のモック: translate() はキーをそのまま返す */
const mockTransloco = {
  translate: vi.fn((key: string) => key),
} as unknown as TranslocoService;

describe('validateBranchName', () => {
  it.each(['main', 'feature/new-api', 'hotfix/v1.2.3', 'release/2024.01', 'a'])(
    '有効なブランチ名 "%s" で null を返す',
    (name) => {
      expect(validateBranchName(name, mockTransloco)).toBeNull();
    },
  );

  it('空文字列でエラーメッセージを返す', () => {
    expect(validateBranchName('', mockTransloco)).toBe('branches.validation.nameRequired');
  });

  it('先頭が "." でエラーメッセージを返す', () => {
    expect(validateBranchName('.hidden', mockTransloco)).toBe('branches.validation.noLeadingDot');
  });

  it('先頭が "-" でエラーメッセージを返す', () => {
    expect(validateBranchName('-invalid', mockTransloco)).toBe('branches.validation.noLeadingDash');
  });

  it('末尾が "/" でエラーメッセージを返す', () => {
    expect(validateBranchName('feature/', mockTransloco)).toBe(
      'branches.validation.noTrailingSlash',
    );
  });

  it('末尾が ".lock" でエラーメッセージを返す', () => {
    expect(validateBranchName('branch.lock', mockTransloco)).toBe(
      'branches.validation.noTrailingLock',
    );
  });

  it('".." を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature/..invalid', mockTransloco)).toBe(
      'branches.validation.noDoubleDot',
    );
  });

  it('"//" を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature//branch', mockTransloco)).toBe(
      'branches.validation.noDoubleSlash',
    );
  });

  it.each(['~', '^', ':', '?', '*', '[', '\\'])(
    '禁止文字 "%s" を含む場合にエラーメッセージを返す',
    (char) => {
      expect(validateBranchName(`feature${char}branch`, mockTransloco)).toBe(
        'branches.validation.invalidChars',
      );
    },
  );

  it('スペースを含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature branch', mockTransloco)).toBe(
      'branches.validation.invalidChars',
    );
  });

  it('制御文字を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature\x01branch', mockTransloco)).toBe(
      'branches.validation.invalidChars',
    );
    expect(validateBranchName('feature\x7fbranch', mockTransloco)).toBe(
      'branches.validation.invalidChars',
    );
  });
});

describe('checkBranchDuplicate', () => {
  it('既存ブランチに同名が存在する場合にエラーメッセージを返す', () => {
    expect(checkBranchDuplicate('main', ['main', 'develop'], mockTransloco)).toBe(
      'branches.validation.duplicate',
    );
  });

  it('既存ブランチに同名が存在しない場合に null を返す', () => {
    expect(checkBranchDuplicate('feature/new', ['main', 'develop'], mockTransloco)).toBeNull();
  });

  it('空の既存ブランチ一覧で null を返す', () => {
    expect(checkBranchDuplicate('main', [], mockTransloco)).toBeNull();
  });
});
