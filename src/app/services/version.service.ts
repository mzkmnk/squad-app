import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { IpcResult } from '../../../electron/types/ipc-result';
import type { VersionInfoResponse } from '../../../electron/ipc/ipc-channels';

/**
 * アプリケーション バージョン情報を管理するサービス。
 *
 * @remarks
 * Electron メインプロセスと通信してバージョン情報を取得し、
 * Observable で UI コンポーネントに提供する。
 * バージョン情報の変更を監視して、アップデート通知の表示を制御する。
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private versionInfo$ = new BehaviorSubject<VersionInfoResponse | null>(null);
  private isLoading$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initializeVersionInfo();
  }

  /**
   * バージョン情報を Observable として取得する。
   * UI コンポーネントから購読して、リアルタイムで更新を監視できる。
   */
  getVersionInfo(): Observable<VersionInfoResponse | null> {
    return this.versionInfo$.asObservable();
  }

  /**
   * ローディング状態を Observable として取得する。
   */
  isLoading(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  /**
   * アプリ起動時にバージョン情報を読み込む。
   *
   * @remarks
   * Electron メインプロセスの定期チェック機能から取得した
   * キャッシュされたバージョン情報を使用する。
   */
  private async initializeVersionInfo(): Promise<void> {
    try {
      this.isLoading$.next(true);
      const result = await window.electronAPI.getVersion();

      if (result.success) {
        this.versionInfo$.next(result.data);
      } else {
        console.warn('[VersionService] Failed to get version info:', result.error);
      }
    } catch (error) {
      console.error('[VersionService] Error initializing version info:', error);
    } finally {
      this.isLoading$.next(false);
    }
  }

  /**
   * 最新バージョンをリアルタイムでチェックする。
   *
   * @remarks
   * ユーザーが「更新をチェック」ボタンを押したときなど、
   * 明示的にチェックを要求する場合に使用する。
   * GitHub API を呼び出して最新バージョン情報を取得し、
   * ローカルにキャッシュする。
   *
   * @returns 更新後のバージョン情報。エラー時は null
   */
  async checkForUpdate(): Promise<VersionInfoResponse | null> {
    try {
      this.isLoading$.next(true);
      const result = await window.electronAPI.checkForUpdate();

      if (result.success) {
        this.versionInfo$.next(result.data);
        return result.data;
      } else {
        console.warn('[VersionService] Check for update failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[VersionService] Error checking for update:', error);
      return null;
    } finally {
      this.isLoading$.next(false);
    }
  }

  /**
   * 現在キャッシュされているバージョン情報を取得する（同期）。
   *
   * @remarks
   * Observable ではなく同期的に値が必要な場合に使用する。
   * 値がまだ読み込まれていない場合は null を返す。
   */
  getVersionInfoSync(): VersionInfoResponse | null {
    return this.versionInfo$.value;
  }
}
