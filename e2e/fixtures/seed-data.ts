import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Repository, Workspace } from '../../electron/types/models.js';
import {
  REPOS_CURRENT_VERSION,
  WORKSPACES_CURRENT_VERSION,
} from '../../electron/store/migrations.js';

/**
 * SQUAD_HOME にシードデータを書き込む。
 * Electron 起動後、テスト内で呼び出し、`window.reload()` で反映する。
 */
export function seedData(
  squadHome: string,
  data: {
    repositories?: Repository[];
    workspaces?: Workspace[];
  },
): void {
  const configDir = path.join(squadHome, 'config');
  fs.mkdirSync(configDir, { recursive: true });

  if (data.repositories) {
    fs.writeFileSync(
      path.join(configDir, 'repos.json'),
      JSON.stringify({ version: REPOS_CURRENT_VERSION, repositories: data.repositories }, null, 2),
    );
  }

  if (data.workspaces) {
    fs.writeFileSync(
      path.join(configDir, 'workspaces.json'),
      JSON.stringify({ version: WORKSPACES_CURRENT_VERSION, workspaces: data.workspaces }, null, 2),
    );
  }
}
