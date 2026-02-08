import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { SquadPaths } from '../store/squad-paths.js';

export interface CodeWorkspaceFile {
  folders: { path: string }[];
  settings: Record<string, unknown>;
}

export class CodeWorkspaceService {
  constructor(private readonly paths: SquadPaths) {}

  /** .code-workspace ファイルを生成する */
  async generate(workspaceName: string, entries: { repoName: string }[]): Promise<void> {
    const wsDir = this.paths.workspaceDir(workspaceName);
    await fs.mkdir(wsDir, { recursive: true });

    const data: CodeWorkspaceFile = {
      folders: entries.map((e) => ({ path: `./${e.repoName}` })),
      settings: {},
    };

    const filePath = this.paths.codeWorkspaceFile(workspaceName);
    const content = JSON.stringify(data, null, 2) + '\n';

    // アトミック書き込み: 一時ファイル + rename
    const tmpPath = path.join(path.dirname(filePath), `.tmp-${crypto.randomUUID()}`);
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  /** .code-workspace ファイルを削除する */
  async remove(workspaceName: string): Promise<void> {
    const filePath = this.paths.codeWorkspaceFile(workspaceName);
    await fs.rm(filePath, { force: true });
  }
}
