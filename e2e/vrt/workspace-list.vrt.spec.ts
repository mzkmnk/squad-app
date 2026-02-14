import { test, expect } from '../fixtures/electron-app.js';
import { WorkspaceListPage } from '../pages/workspace-list.page.js';
import { seedData } from '../fixtures/seed-data.js';

// --- テストデータ定義 ---

const REPOS = {
  backend: {
    id: 'repo-backend-001',
    name: 'backend-a1b2c3d4',
    displayName: 'backend',
    remoteUrl: 'https://github.com/example/backend.git',
    registeredAt: '2025-01-15T10:00:00.000Z',
  },
  frontend: {
    id: 'repo-frontend-002',
    name: 'frontend-e5f6g7h8',
    displayName: 'frontend',
    remoteUrl: 'https://github.com/example/frontend.git',
    registeredAt: '2025-01-15T10:00:00.000Z',
  },
  shared: {
    id: 'repo-shared-003',
    name: 'shared-lib-i9j0k1l2',
    displayName: 'shared-lib',
    remoteUrl: 'https://github.com/example/shared-lib.git',
    registeredAt: '2025-01-15T10:00:00.000Z',
  },
};

const WORKSPACES = {
  single: {
    id: 'ws-single-001',
    name: 'feature-auth-x1y2z3w4',
    displayName: 'feature-auth',
    entries: [
      { repositoryId: REPOS.backend.id, branch: 'feature/auth' },
      { repositoryId: REPOS.frontend.id, branch: 'feature/auth' },
    ],
    createdAt: '2025-06-01T09:00:00.000Z',
    updatedAt: '2025-06-01T09:00:00.000Z',
  },
  payment: {
    id: 'ws-payment-002',
    name: 'feature-payment-a2b3c4d5',
    displayName: 'feature-payment',
    entries: [
      { repositoryId: REPOS.backend.id, branch: 'feature/payment' },
      { repositoryId: REPOS.frontend.id, branch: 'feature/payment' },
      { repositoryId: REPOS.shared.id, branch: 'feature/payment' },
    ],
    createdAt: '2025-05-20T14:30:00.000Z',
    updatedAt: '2025-06-10T08:00:00.000Z',
  },
  hotfix: {
    id: 'ws-hotfix-003',
    name: 'hotfix-login-e5f6g7h8',
    displayName: 'hotfix-login',
    entries: [{ repositoryId: REPOS.backend.id, branch: 'hotfix/login-fix' }],
    createdAt: '2025-06-12T16:00:00.000Z',
    updatedAt: '2025-06-12T16:00:00.000Z',
  },
  refactor: {
    id: 'ws-refactor-004',
    name: 'refactor-api-i9j0k1l2',
    displayName: 'refactor-api',
    entries: [
      { repositoryId: REPOS.backend.id, branch: 'refactor/api-v2' },
      { repositoryId: REPOS.shared.id, branch: 'refactor/api-v2' },
    ],
    createdAt: '2025-04-10T11:00:00.000Z',
    updatedAt: '2025-05-15T09:30:00.000Z',
  },
};

// --- テスト ---

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
      repositories: [REPOS.backend, REPOS.frontend, REPOS.shared],
      workspaces: [WORKSPACES.single, WORKSPACES.payment, WORKSPACES.hotfix, WORKSPACES.refactor],
    });
    await window.reload();
    const workspaceList = new WorkspaceListPage(window);
    await workspaceList.waitForLoaded();
    await expect(window).toHaveScreenshot('workspace-list-multiple.png');
  });
});
