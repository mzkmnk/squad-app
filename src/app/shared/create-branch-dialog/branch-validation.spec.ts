import { describe, expect, it } from 'vitest';

import { checkBranchDuplicate, validateBranchName } from './branch-validation';

describe('validateBranchName', () => {
  it.each(['main', 'feature/new-api', 'hotfix/v1.2.3', 'release/2024.01', 'a'])(
    '有効なブランチ名 "%s" で null を返す',
    (name) => {
      expect(validateBranchName(name)).toBeNull();
    },
  );

  it('空文字列でエラーメッセージを返す', () => {
    expect(validateBranchName('')).toBe('ブランチ名を入力してください');
  });

  it('先頭が "." でエラーメッセージを返す', () => {
    expect(validateBranchName('.hidden')).toBe('ブランチ名の先頭に "." は使用できません');
  });

  it('先頭が "-" でエラーメッセージを返す', () => {
    expect(validateBranchName('-invalid')).toBe('ブランチ名の先頭に "-" は使用できません');
  });

  it('末尾が "/" でエラーメッセージを返す', () => {
    expect(validateBranchName('feature/')).toBe('ブランチ名の末尾に "/" は使用できません');
  });

  it('末尾が ".lock" でエラーメッセージを返す', () => {
    expect(validateBranchName('branch.lock')).toBe('ブランチ名の末尾に ".lock" は使用できません');
  });

  it('".." を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature/..invalid')).toBe('ブランチ名に ".." は使用できません');
  });

  it('"//" を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature//branch')).toBe('ブランチ名に連続する "/" は使用できません');
  });

  it.each(['~', '^', ':', '?', '*', '[', '\\'])(
    '禁止文字 "%s" を含む場合にエラーメッセージを返す',
    (char) => {
      expect(validateBranchName(`feature${char}branch`)).toBe(
        'ブランチ名に使用できない文字が含まれています',
      );
    },
  );

  it('スペースを含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature branch')).toBe(
      'ブランチ名に使用できない文字が含まれています',
    );
  });

  it('制御文字を含む場合にエラーメッセージを返す', () => {
    expect(validateBranchName('feature\x01branch')).toBe(
      'ブランチ名に使用できない文字が含まれています',
    );
    expect(validateBranchName('feature\x7fbranch')).toBe(
      'ブランチ名に使用できない文字が含まれています',
    );
  });
});

describe('checkBranchDuplicate', () => {
  it('既存ブランチに同名が存在する場合にエラーメッセージを返す', () => {
    expect(checkBranchDuplicate('main', ['main', 'develop'])).toBe(
      '同名のブランチが既に存在します',
    );
  });

  it('既存ブランチに同名が存在しない場合に null を返す', () => {
    expect(checkBranchDuplicate('feature/new', ['main', 'develop'])).toBeNull();
  });

  it('空の既存ブランチ一覧で null を返す', () => {
    expect(checkBranchDuplicate('main', [])).toBeNull();
  });
});
