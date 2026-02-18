import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionService } from './version.service';
import type { IpcResult } from '../../../electron/types/ipc-result';
import type { VersionInfoResponse } from '../../../electron/ipc/ipc-channels';

describe('VersionService', () => {
  let service: VersionService;
  let mockElectronAPI: {
    getVersion: ReturnType<typeof vi.fn>;
    checkForUpdate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockElectronAPI = {
      getVersion: vi.fn(),
      checkForUpdate: vi.fn(),
    };

    // @ts-expect-error - testing mock
    window.electronAPI = mockElectronAPI;

    service = new VersionService();
  });

  describe('getVersionInfo', () => {
    it('should return version info observable', (done) => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.2.0',
        isUpdateAvailable: false,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.2.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      mockElectronAPI.getVersion.mockResolvedValue({
        success: true,
        data: mockVersionInfo,
      });

      service.getVersionInfo().subscribe((versionInfo) => {
        if (versionInfo !== null) {
          expect(versionInfo.current).toBe('0.2.0');
          done();
        }
      });
    });
  });

  describe('isLoading', () => {
    it('should return loading state observable', (done) => {
      mockElectronAPI.getVersion.mockResolvedValue({
        success: true,
        data: { current: '0.2.0' },
      });

      service.isLoading().subscribe((isLoading) => {
        // First emission should be false after initialization
        expect(typeof isLoading).toBe('boolean');
        done();
      });
    });
  });

  describe('checkForUpdate', () => {
    it('should call electronAPI.checkForUpdate', async () => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.3.0',
        isUpdateAvailable: true,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.3.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      mockElectronAPI.checkForUpdate.mockResolvedValue({
        success: true,
        data: mockVersionInfo,
      });

      const result = await service.checkForUpdate();

      expect(result).toBeDefined();
      expect(result?.isUpdateAvailable).toBe(true);
      expect(mockElectronAPI.checkForUpdate).toHaveBeenCalled();
    });

    it('should return null on error', async () => {
      mockElectronAPI.checkForUpdate.mockResolvedValue({
        success: false,
        error: { code: 'CHECK_UPDATE_FAILED', message: 'Network error' },
      });

      const result = await service.checkForUpdate();

      expect(result).toBeNull();
    });
  });

  describe('getVersionInfoSync', () => {
    it('should return null before initialization', () => {
      const result = service.getVersionInfoSync();
      expect(result).toBeNull();
    });
  });
});
