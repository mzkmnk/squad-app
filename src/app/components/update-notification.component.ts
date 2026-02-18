import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VersionService } from '../services/version.service';
import type { VersionInfoResponse } from '../../../electron/ipc/ipc-channels';

/**
 * アップデート通知バナーコンポーネント。
 *
 * @remarks
 * - 新しいバージョンが利用可能な場合、画面上部にバナーを表示
 * - 「Download」ボタンで GitHub Releases ページに遷移
 * - 「Dismiss」ボタンでバナーを非表示（セッション中のみ）
 * - 自動チェック結果に基づいて自動更新
 */
@Component({
  selector: 'app-update-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './update-notification.component.html',
  styleUrls: ['./update-notification.component.css'],
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  /** バージョン情報 */
  versionInfo: VersionInfoResponse | null = null;

  /** ユーザーが手動で dismiss したかどうか */
  isDismissed = false;

  /** クリーンアップ用の Subject */
  private destroy$ = new Subject<void>();

  constructor(private versionService: VersionService) {}

  /**
   * コンポーネント初期化。
   * VersionService から バージョン情報の変更を監視する。
   */
  ngOnInit(): void {
    this.versionService
      .getVersionInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe((versionInfo) => {
        this.versionInfo = versionInfo;
        // 新しいバージョン情報が取得されたら、dismiss フラグをリセット
        if (versionInfo?.isUpdateAvailable) {
          this.isDismissed = false;
        }
      });
  }

  /**
   * 手動でバナーを非表示にする。
   */
  dismiss(): void {
    this.isDismissed = true;
  }

  /**
   * バナーが表示対象かどうかを判定する。
   */
  shouldShowBanner(): boolean {
    return Boolean(this.versionInfo?.isUpdateAvailable && !this.isDismissed);
  }

  /**
   * コンポーネント破棄時のクリーンアップ。
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
