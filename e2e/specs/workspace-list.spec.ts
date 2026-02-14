import { test, expect } from '../fixtures/electron-app.js';
import { WorkspaceListPage } from '../pages/workspace-list.page.js';

test.describe('ワークスペース一覧画面', () => {
  let workspaceList: WorkspaceListPage;

  test.beforeEach(async ({ window }) => {
    workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
  });

  test('ページタイトルが表示される', async () => {
    await expect(workspaceList.heading).toBeVisible();
  });

  test('「Create」ボタンが表示される', async () => {
    await expect(workspaceList.createButton).toBeVisible();
  });

  test('空状態のメッセージが表示される', async () => {
    await expect(workspaceList.emptyTitle).toBeVisible();
    await expect(workspaceList.emptyDescription).toBeVisible();
  });

  test('ワークスペースカードが存在しない', async () => {
    await expect(workspaceList.workspaceCards).toHaveCount(0);
  });

  test('空状態の VRT スナップショット', async ({ window }) => {
    await expect(window).toHaveScreenshot('workspace-list-empty.png');
  });
});
