import { describe, it, expect, vi, beforeEach } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

import { detectInstalledIdes, getIdeCommand, IDE_DEFINITIONS } from './ide-detector.js';

beforeEach(() => {
  execFileMock.mockReset();
});

// --- IDE_DEFINITIONS ---

describe('IDE_DEFINITIONS', () => {
  it('3 つの IDE 定義が含まれる', () => {
    expect(IDE_DEFINITIONS).toHaveLength(3);
  });

  it('vscode, webstorm, kiro の順で定義されている', () => {
    expect(IDE_DEFINITIONS.map((d) => d.id)).toEqual(['vscode', 'webstorm', 'kiro']);
  });
});

// --- detectInstalledIdes ---

describe('detectInstalledIdes', () => {
  it('全 IDE がインストール済みの場合、全て installed: true を返す', async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(null, { stdout: '/usr/local/bin/code', stderr: '' });
      },
    );

    const results = await detectInstalledIdes();

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.installed)).toBe(true);
  });

  it('一部の IDE のみインストール済みの場合、正しく判定される', async () => {
    execFileMock.mockImplementation(
      (cmd: string, args: string[], cb: (err: unknown, result: unknown) => void) => {
        const command = args[0];
        if (command === 'code') {
          cb(null, { stdout: '/usr/local/bin/code', stderr: '' });
        } else {
          cb(new Error('not found'), null);
        }
      },
    );

    const results = await detectInstalledIdes();

    expect(results.find((r) => r.id === 'vscode')?.installed).toBe(true);
    expect(results.find((r) => r.id === 'webstorm')?.installed).toBe(false);
    expect(results.find((r) => r.id === 'kiro')?.installed).toBe(false);
  });

  it('全て未インストールの場合、全て installed: false を返す', async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(new Error('not found'), null);
      },
    );

    const results = await detectInstalledIdes();

    expect(results).toHaveLength(3);
    expect(results.every((r) => !r.installed)).toBe(true);
  });

  it('IDE 定義の順序が維持される', async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(null, { stdout: '', stderr: '' });
      },
    );

    const results = await detectInstalledIdes();

    expect(results.map((r) => r.id)).toEqual(['vscode', 'webstorm', 'kiro']);
  });

  it('各結果に displayName が含まれる', async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(null, { stdout: '', stderr: '' });
      },
    );

    const results = await detectInstalledIdes();

    expect(results.map((r) => r.displayName)).toEqual(['VS Code', 'WebStorm', 'Kiro IDE']);
  });

  it('which コマンドが execFile で呼ばれる（shell 経由でない）', async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: unknown, result: unknown) => void) => {
        cb(null, { stdout: '', stderr: '' });
      },
    );

    await detectInstalledIdes();

    // 各 IDE に対して which が呼ばれる
    expect(execFileMock).toHaveBeenCalledTimes(3);
    expect(execFileMock).toHaveBeenCalledWith('which', ['code'], expect.any(Function));
    expect(execFileMock).toHaveBeenCalledWith('which', ['webstorm'], expect.any(Function));
    expect(execFileMock).toHaveBeenCalledWith('which', ['kiro'], expect.any(Function));
  });
});

// --- getIdeCommand ---

describe('getIdeCommand', () => {
  it('vscode に対して code を返す', () => {
    expect(getIdeCommand('vscode')).toBe('code');
  });

  it('webstorm に対して webstorm を返す', () => {
    expect(getIdeCommand('webstorm')).toBe('webstorm');
  });

  it('kiro に対して kiro を返す', () => {
    expect(getIdeCommand('kiro')).toBe('kiro');
  });

  it('未知の ID に対して undefined を返す', () => {
    expect(getIdeCommand('unknown' as never)).toBeUndefined();
  });
});
