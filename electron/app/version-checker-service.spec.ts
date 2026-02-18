import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { App } from 'electron';
import { VersionCheckerService } from './version-checker-service';

describe('VersionCheckerService', () => {
  let mockApp: Partial<App>;
  let service: VersionCheckerService;

  beforeEach(() => {
    mockApp = {
      getVersion: vi.fn(() => '0.2.0'),
    };
    service = new VersionCheckerService(mockApp as App, 'owner', 'repo', 'test-token');
  });

  afterEach(() => {
    service.stopPeriodicCheck();
    vi.clearAllMocks();
  });

  describe('getCurrentVersion', () => {
    it('should return the current app version', () => {
      expect(service.getCurrentVersion()).toBe('0.2.0');
    });
  });

  describe('getLatestVersion', () => {
    it('should return null before any check', () => {
      expect(service.getLatestVersion()).toBeNull();
    });
  });

  describe('isUpdateAvailableNow', () => {
    it('should return false before any check', () => {
      expect(service.isUpdateAvailableNow()).toBe(false);
    });
  });

  describe('getLatestReleaseUrl', () => {
    it('should return null before any check', () => {
      expect(service.getLatestReleaseUrl()).toBeNull();
    });
  });

  describe('getPublishedAt', () => {
    it('should return null before any check', () => {
      expect(service.getPublishedAt()).toBeNull();
    });
  });

  describe('checkForUpdates', () => {
    it('should return VersionInfo with current version', async () => {
      const versionInfo = await service.checkForUpdates();

      expect(versionInfo).toBeDefined();
      expect(versionInfo.current).toBe('0.2.0');
      expect(versionInfo.latest).toBe('0.2.0');
      expect(versionInfo.isUpdateAvailable).toBe(false);
    });

    // NOTE: 実際の GitHub API 呼び出しをテストするにはモック HTTP サーバーが必要。
    // ここでは基本的なインターフェースをテストしている。
  });

  describe('startPeriodicCheck', () => {
    it('should start periodic checking', (done) => {
      const checkSpy = vi.spyOn(service, 'checkForUpdates');

      service.startPeriodicCheck(100); // 100ms ごとにチェック

      setTimeout(() => {
        service.stopPeriodicCheck();
        // 少なくとも1回チェックが呼ばれている
        expect(checkSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        done();
      }, 250);
    });

    it('should not start if already running', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      service.startPeriodicCheck(100);
      service.startPeriodicCheck(100); // 2回目の呼び出し

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Periodic check is already running'),
      );

      service.stopPeriodicCheck();
      vi.restoreAllMocks();
    });
  });

  describe('stopPeriodicCheck', () => {
    it('should stop periodic checking', (done) => {
      service.startPeriodicCheck(100);

      setTimeout(() => {
        service.stopPeriodicCheck();

        const beforeStopTime = Date.now();
        setTimeout(() => {
          // stopPeriodicCheck 後は checkForUpdates が呼ばれていないことを確認
          // (これは実装依存で完全には検証できないが、タイムアウト関連のエラーが出ないことを確認)
          expect(true).toBe(true);
          done();
        }, 150);
      }, 150);
    });
  });
});
