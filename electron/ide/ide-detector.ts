import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IdeId, IdeDetectionResult } from '../types/models.js';

const execFileAsync = promisify(execFile);

/** サポート対象 IDE の定義 */
export interface IdeDefinition {
  /** IDE 識別子（settings.json の selectedIde と対応） */
  id: IdeId;
  /** 表示名 */
  displayName: string;
  /** IDE 起動コマンド */
  command: string;
}

export type { IdeDetectionResult } from '../types/models.js';

/** サポート対象 IDE の一覧（FR-1） */
export const IDE_DEFINITIONS: readonly IdeDefinition[] = [
  { id: 'vscode', displayName: 'VS Code', command: 'code' },
  { id: 'webstorm', displayName: 'WebStorm', command: 'webstorm' },
  { id: 'kiro', displayName: 'Kiro IDE', command: 'kiro' },
] as const;

/**
 * 全サポート対象 IDE のインストール状態を検出する。
 *
 * `which <command>` を並列実行し（NFR-2）、終了コード 0 = installed と判定する。
 * `execFile` を使用しシェル経由でない（NFR-3）。
 *
 * @returns 各 IDE の検出結果の配列
 */
export async function detectInstalledIdes(): Promise<IdeDetectionResult[]> {
  const results = await Promise.all(
    IDE_DEFINITIONS.map(async (def) => {
      try {
        await execFileAsync('which', [def.command]);
        return { id: def.id, displayName: def.displayName, installed: true };
      } catch {
        return { id: def.id, displayName: def.displayName, installed: false };
      }
    }),
  );
  return results;
}

/**
 * 指定 IDE ID の起動コマンドを取得する。
 *
 * @param ideId - IDE 識別子
 * @returns 起動コマンド文字列。未知の ID の場合は undefined
 */
export function getIdeCommand(ideId: IdeId): string | undefined {
  return IDE_DEFINITIONS.find((def) => def.id === ideId)?.command;
}
