import { GitValidationError } from './git-errors.js';

const HTTPS_URL_PATTERN = /^https:\/\/[^\s;|&`'"\\]+$/;
const SSH_URL_PATTERN = /^git@[^\s;|&`'"\\]+:[^\s;|&`'"\\]+$/;

/**
 * リモート URL の形式を検証する。
 *
 * 許可形式:
 * - HTTPS: `https://host/path(.git)?`
 * - SSH: `git@host:path(.git)?`
 */
export function validateRemoteUrl(url: string): void {
  if (url.length === 0) {
    throw new GitValidationError('Remote URL must not be empty');
  }

  if (HTTPS_URL_PATTERN.test(url) || SSH_URL_PATTERN.test(url)) {
    return;
  }

  throw new GitValidationError(`Invalid remote URL: ${url}`);
}

/**
 * ブランチ名の形式を検証する。
 *
 * Git の命名規則に準拠:
 * - `..` 禁止
 * - 先頭/末尾の `.` 禁止
 * - スペース・制御文字禁止
 * - `~`, `^`, `:`, `?`, `*`, `[`, `\` 禁止
 * - 末尾の `.lock` 禁止
 * - 先頭の `-` 禁止
 */
export function validateBranchName(branch: string): void {
  if (branch.length === 0) {
    throw new GitValidationError('Branch name must not be empty');
  }

  if (branch.startsWith('.')) {
    throw new GitValidationError('Branch name must not start with "."');
  }

  if (branch.startsWith('-')) {
    throw new GitValidationError('Branch name must not start with "-"');
  }

  if (branch.endsWith('/')) {
    throw new GitValidationError('Branch name must not end with "/"');
  }

  if (branch.endsWith('.lock')) {
    throw new GitValidationError('Branch name must not end with ".lock"');
  }

  if (branch.includes('..')) {
    throw new GitValidationError('Branch name must not contain ".."');
  }

  if (branch.includes('//')) {
    throw new GitValidationError('Branch name must not contain consecutive slashes');
  }

  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(branch)) {
    throw new GitValidationError('Branch name contains invalid characters');
  }
}

const REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * リポジトリ名の形式を検証する。
 *
 * 許可: 英数字、ハイフン、アンダースコア、ドット
 * 1〜100文字
 */
export function validateRepoName(name: string): void {
  if (name.length === 0) {
    throw new GitValidationError('Repository name must not be empty');
  }

  if (name.length > 100) {
    throw new GitValidationError('Repository name must not exceed 100 characters');
  }

  if (!REPO_NAME_PATTERN.test(name)) {
    throw new GitValidationError(`Invalid repository name: ${name}`);
  }
}
