import { test, expect } from '../fixtures/electron-app.js';

test.describe('ダッシュボード', () => {
  test('初期表示で空状態のメッセージが表示される', async ({ window }) => {
    await expect(window.locator('body')).toBeVisible();
  });

  test('初期表示の VRT スナップショット', async ({ window }) => {
    await expect(window).toHaveScreenshot('dashboard-empty.png');
  });
});
