import { test, expect } from '../fixtures/electron-app.js';
import { WorkspaceListPage } from '../pages/workspace-list.page.js';
import { seedData } from '../fixtures/seed-data.js';
import { REPOS, ALL_REPOS, WORKSPACES, ALL_WORKSPACES } from '../fixtures/test-data.js';

test.describe('ワークスペース一覧画面', () => {
  test('空状態', async ({ window }) => {
    const workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
    await expect(window).toHaveScreenshot('workspace-list-empty.png');
  });

  test('ワークスペース1件', async ({ squadHome, window }) => {
    seedData(squadHome, {
      repositories: [REPOS.backend, REPOS.frontend],
      workspaces: [WORKSPACES.single],
    });
    await window.reload();
    const workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
    await expect(window).toHaveScreenshot('workspace-list-single.png');
  });

  test('ワークスペース複数件', async ({ squadHome, window }) => {
    seedData(squadHome, {
      repositories: ALL_REPOS,
      workspaces: ALL_WORKSPACES,
    });
    await window.reload();
    const workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
    await expect(window).toHaveScreenshot('workspace-list-multiple.png');
  });
});
