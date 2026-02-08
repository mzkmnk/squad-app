import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSquadPaths } from './squad-paths.js';

describe('createSquadPaths', () => {
  it('root が指定したルートパスを指す', () => {
    const paths = createSquadPaths('/test/root');
    expect(paths.root).toBe('/test/root');
  });

  it('デフォルトで ~/.squad を指す', () => {
    const paths = createSquadPaths();
    expect(paths.root).toBe(path.join(os.homedir(), '.squad'));
  });

  it('repoDir("backend") が <root>/repos/backend.git を返す', () => {
    const paths = createSquadPaths('/test/root');
    expect(paths.repoDir('backend')).toBe('/test/root/repos/backend.git');
  });

  it('workspaceDir("feature-payment") が正しいパスを返す', () => {
    const paths = createSquadPaths('/test/root');
    expect(paths.workspaceDir('feature-payment')).toBe('/test/root/workspaces/feature-payment');
  });

  it('worktreeDir("feature-payment", "backend") が正しいパスを返す', () => {
    const paths = createSquadPaths('/test/root');
    expect(paths.worktreeDir('feature-payment', 'backend')).toBe(
      '/test/root/workspaces/feature-payment/backend',
    );
  });

  it('codeWorkspaceFile("feature-payment") が正しいパスを返す', () => {
    const paths = createSquadPaths('/test/root');
    expect(paths.codeWorkspaceFile('feature-payment')).toBe(
      '/test/root/workspaces/feature-payment/feature-payment.code-workspace',
    );
  });

  it('全パスが root 配下に収まる', () => {
    const paths = createSquadPaths('/test/root');
    const allPaths = [
      paths.configDir,
      paths.reposDir,
      paths.workspacesDir,
      paths.reposConfig,
      paths.workspacesConfig,
      paths.repoDir('test'),
      paths.workspaceDir('test'),
      paths.worktreeDir('test', 'repo'),
      paths.codeWorkspaceFile('test'),
    ];
    for (const p of allPaths) {
      expect(p.startsWith(paths.root)).toBe(true);
    }
  });
});
