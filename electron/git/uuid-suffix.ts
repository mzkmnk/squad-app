import * as crypto from 'node:crypto';

/** suffix 生成時の最大リトライ回数 */
export const MAX_SUFFIX_RETRY = 3;

/** UUID v4 の先頭8文字を suffix として生成する */
export function generateSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/** suffix 付き名前を生成する（`name-<suffix>`） */
export function appendSuffix(name: string, suffix: string): string {
  return `${name}-${suffix}`;
}
