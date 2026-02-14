import type { Repository, Workspace } from '../../electron/types/models.js';

/**
 * E2E / VRT テスト共通のテストデータ。
 * repos はリポジトリ画面・ワークスペース画面の両方で使用する。
 */

export const REPOS = {
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
    registeredAt: '2025-02-20T14:30:00.000Z',
  },
  shared: {
    id: 'repo-shared-003',
    name: 'shared-lib-i9j0k1l2',
    displayName: 'shared-lib',
    remoteUrl: 'https://github.com/example/shared-lib.git',
    registeredAt: '2025-03-10T08:00:00.000Z',
  },
} as const satisfies Record<string, Repository>;

export const ALL_REPOS = Object.values(REPOS);

export const WORKSPACES = {
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
} as const satisfies Record<string, Workspace>;

export const ALL_WORKSPACES = Object.values(WORKSPACES);
