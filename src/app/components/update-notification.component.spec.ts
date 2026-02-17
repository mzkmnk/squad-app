import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UpdateNotificationComponent } from './update-notification.component';
import { VersionService } from '../services/version.service';
import type { VersionInfoResponse } from '../../../electron/ipc/ipc-channels';

describe('UpdateNotificationComponent', () => {
  let component: UpdateNotificationComponent;
  let fixture: ComponentFixture<UpdateNotificationComponent>;
  let versionService: VersionService;

  beforeEach(async () => {
    const versionServiceMock = {
      getVersionInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UpdateNotificationComponent],
      providers: [{ provide: VersionService, useValue: versionServiceMock }],
    }).compileComponents();

    versionService = TestBed.inject(VersionService);
    fixture = TestBed.createComponent(UpdateNotificationComponent);
    component = fixture.componentInstance;
  });

  describe('shouldShowBanner', () => {
    it('should show banner when update is available and not dismissed', () => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.3.0',
        isUpdateAvailable: true,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.3.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      component.versionInfo = mockVersionInfo;
      component.isDismissed = false;

      expect(component.shouldShowBanner()).toBe(true);
    });

    it('should not show banner when update is not available', () => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.2.0',
        isUpdateAvailable: false,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.2.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      component.versionInfo = mockVersionInfo;
      component.isDismissed = false;

      expect(component.shouldShowBanner()).toBe(false);
    });

    it('should not show banner when user dismissed it', () => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.3.0',
        isUpdateAvailable: true,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.3.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      component.versionInfo = mockVersionInfo;
      component.isDismissed = true;

      expect(component.shouldShowBanner()).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should set isDismissed to true', () => {
      component.isDismissed = false;
      component.dismiss();
      expect(component.isDismissed).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should subscribe to version info changes', (done) => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.3.0',
        isUpdateAvailable: true,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.3.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      vi.spyOn(versionService, 'getVersionInfo').mockReturnValue(of(mockVersionInfo));

      component.ngOnInit();

      setTimeout(() => {
        expect(component.versionInfo).toEqual(mockVersionInfo);
        expect(component.isDismissed).toBe(false);
        done();
      }, 100);
    });

    it('should reset isDismissed when new update is available', (done) => {
      const mockVersionInfo: VersionInfoResponse = {
        current: '0.2.0',
        latest: '0.3.0',
        isUpdateAvailable: true,
        latestReleaseUrl: 'https://github.com/m4i/squad-app/releases/tag/v0.3.0',
        publishedAt: '2026-02-17T00:00:00Z',
      };

      vi.spyOn(versionService, 'getVersionInfo').mockReturnValue(of(mockVersionInfo));

      component.isDismissed = true;
      component.ngOnInit();

      setTimeout(() => {
        expect(component.isDismissed).toBe(false);
        done();
      }, 100);
    });
  });
});
