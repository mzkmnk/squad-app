import { test, expect } from '../fixtures/electron-app.js';
import { WorkspaceListPage } from '../pages/workspace-list.page.js';

test.describe('ワークスペース一覧画面', () => {
  let workspaceList: WorkspaceListPage;

  test.beforeEach(async ({ window }) => {
    workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
  });

  test('空状態', async ({ window }) => {
    await expect(window).toHaveScreenshot('workspace-list-empty.png');
  });
});
