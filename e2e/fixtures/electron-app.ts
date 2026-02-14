import {
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

/**
 * E2E テスト用のカスタムフィクスチャ。
 *
 * テストごとに一時ディレクトリを作成し、`SQUAD_HOME` 環境変数で
 * 実データ（`~/.squad/`）と分離する。
 */
export const test = base.extend<{
  electronApp: ElectronApplication;
  window: Page;
}>({
  electronApp: async ({}, use) => {
    const squadHome = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-e2e-'));

    const app = await electron.launch({
      args: [path.join(import.meta.dirname, '../../dist-electron/main.js')],
      env: {
        ...process.env,
        SQUAD_HOME: squadHome,
        NODE_ENV: 'test',
      },
    });

    await use(app);

    await app.close();
    fs.rmSync(squadHome, { recursive: true, force: true });
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
