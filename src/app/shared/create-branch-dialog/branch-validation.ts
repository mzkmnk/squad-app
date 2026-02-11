import type { TranslocoService } from '@jsverse/transloco';

/**
 * ブランチ名を Git 命名規則に基づいて検証する。
 * @returns エラーメッセージ。有効な場合は null
 */
export function validateBranchName(branch: string, transloco: TranslocoService): string | null {
  if (branch.length === 0) {
    return transloco.translate('branches.validation.nameRequired');
  }

  if (branch.startsWith('.')) {
    return transloco.translate('branches.validation.noLeadingDot');
  }

  if (branch.startsWith('-')) {
    return transloco.translate('branches.validation.noLeadingDash');
  }

  if (branch.endsWith('/')) {
    return transloco.translate('branches.validation.noTrailingSlash');
  }

  if (branch.endsWith('.lock')) {
    return transloco.translate('branches.validation.noTrailingLock');
  }

  if (branch.includes('..')) {
    return transloco.translate('branches.validation.noDoubleDot');
  }

  if (branch.includes('//')) {
    return transloco.translate('branches.validation.noDoubleSlash');
  }

  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(branch)) {
    return transloco.translate('branches.validation.invalidChars');
  }

  return null;
}

/**
 * 既存ブランチ一覧との重複を検証する。
 * @returns エラーメッセージ。重複がない場合は null
 */
export function checkBranchDuplicate(
  branch: string,
  existingBranches: string[],
  transloco: TranslocoService,
): string | null {
  if (existingBranches.includes(branch)) {
    return transloco.translate('branches.validation.duplicate');
  }
  return null;
}
