import { test, expect } from '../fixtures/electron-app.js';
import { RepoListPage } from '../pages/repo-list.page.js';
import { seedData } from '../fixtures/seed-data.js';
import { REPOS, ALL_REPOS } from '../fixtures/test-data.js';

test.describe('リポジトリ一覧画面', () => {
  test('空状態', async ({ window }) => {
    const repoList = new RepoListPage(window);
    await repoList.navigateAndWait();
    await expect(window).toHaveScreenshot('repo-list-empty.png');
  });

  test('リポジトリ1件', async ({ squadHome, window }) => {
    seedData(squadHome, { repositories: [REPOS.backend] });
    await window.reload();
    const repoList = new RepoListPage(window);
    await repoList.navigateAndWait();
    await expect(window).toHaveScreenshot('repo-list-single.png');
  });

  test('リポジトリ複数件', async ({ squadHome, window }) => {
    seedData(squadHome, { repositories: ALL_REPOS });
    await window.reload();
    const repoList = new RepoListPage(window);
    await repoList.navigateAndWait();
    await expect(window).toHaveScreenshot('repo-list-multiple.png');
  });
});
