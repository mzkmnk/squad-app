/**
 * ブランチ名を Git 命名規則に基づいて検証する。
 * @returns エラーメッセージ。有効な場合は null
 */
export function validateBranchName(branch: string): string | null {
  if (branch.length === 0) {
    return 'ブランチ名を入力してください';
  }

  if (branch.startsWith('.')) {
    return 'ブランチ名の先頭に "." は使用できません';
  }

  if (branch.startsWith('-')) {
    return 'ブランチ名の先頭に "-" は使用できません';
  }

  if (branch.endsWith('/')) {
    return 'ブランチ名の末尾に "/" は使用できません';
  }

  if (branch.endsWith('.lock')) {
    return 'ブランチ名の末尾に ".lock" は使用できません';
  }

  if (branch.includes('..')) {
    return 'ブランチ名に ".." は使用できません';
  }

  if (branch.includes('//')) {
    return 'ブランチ名に連続する "/" は使用できません';
  }

  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(branch)) {
    return 'ブランチ名に使用できない文字が含まれています';
  }

  return null;
}

/**
 * 既存ブランチ一覧との重複を検証する。
 * @returns エラーメッセージ。重複がない場合は null
 */
export function checkBranchDuplicate(branch: string, existingBranches: string[]): string | null {
  if (existingBranches.includes(branch)) {
    return '同名のブランチが既に存在します';
  }
  return null;
}
