/**
 * GitHub Releases を利用したバージョンチェッカー。
 *
 * @remarks
 * - 現在のアプリケーションバージョンを取得
 * - GitHub Releases API から最新バージョン情報を取得
 * - semver で比較してアップデート有無を判定
 * - 定期チェック機能を提供
 */

import https from 'node:https';
import { parse, compare } from 'semver';
import type { App } from 'electron';

/**
 * GitHub API レスポンスの型定義。
 *
 * @remarks 実際の API レスポンスにはより多くのフィールドがあるが、
 * ここでは必要な項目のみを定義している。
 */
interface GitHubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  body: string;
}

/**
 * バージョン情報を表すオブジェクト。
 */
export interface VersionInfo {
  current: string;
  latest: string;
  isUpdateAvailable: boolean;
  latestReleaseUrl: string;
  publishedAt: string;
}

/**
 * GitHub Releases API を利用したバージョンチェッカー。
 *
 * @remarks
 * `checkForUpdates()` を定期的に呼び出すことで、アップデート有無を監視できる。
 * 内部で最新バージョン情報をキャッシュし、複数回の呼び出しを効率化している。
 */
export class VersionCheckerService {
  private currentVersion: string;
  private latestVersion: string | null = null;
  private latestReleaseUrl: string | null = null;
  private publishedAt: string | null = null;
  private isUpdateAvailable = false;
  private periodicCheckInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number | null = null;
  private checkCooldownMs = 5 * 60 * 1000; // 5分のクールダウン

  /**
   * @param app - Electron App インスタンス（バージョン取得用）
   * @param repositoryOwner - GitHub リポジトリオーナー（例: `m4i`）
   * @param repositoryName - GitHub リポジトリ名（例: `squad-app`）
   * @param githubToken - GitHub API トークン（API レート制限を増加させるため）
   */
  constructor(
    private app: App,
    private repositoryOwner: string,
    private repositoryName: string,
    private githubToken?: string,
  ) {
    this.currentVersion = this.app.getVersion();
  }

  /**
   * 現在のアプリケーションバージョンを取得する。
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * 最新バージョン情報を取得する。
   *
   * @remarks
   * 実際には GitHub API を呼び出さずにキャッシュされた情報を返す。
   * 最初のチェック前は null が返される。
   */
  getLatestVersion(): string | null {
    return this.latestVersion;
  }

  /**
   * アップデートが利用可能かどうかを取得する。
   */
  isUpdateAvailableNow(): boolean {
    return this.isUpdateAvailable;
  }

  /**
   * 最新リリースの URL を取得する。
   */
  getLatestReleaseUrl(): string | null {
    return this.latestReleaseUrl;
  }

  /**
   * 公開日時を取得する。
   */
  getPublishedAt(): string | null {
    return this.publishedAt;
  }

  /**
   * 最新バージョン情報をチェックし、VersionInfo を返す。
   *
   * @remarks
   * クールダウン期間内の連続呼び出しはキャッシュから返す。
   * ネットワークエラーやパースエラーの場合はログしてスキップする。
   *
   * @returns 検査完了後のバージョン情報
   * @throws エラーは内部でキャッチしてログのみ。例外は発生しない。
   */
  async checkForUpdates(): Promise<VersionInfo> {
    // クールダウン期間内は前回の結果を返す
    const now = Date.now();
    if (this.lastCheckTime && now - this.lastCheckTime < this.checkCooldownMs) {
      return this.getCurrentVersionInfo();
    }

    try {
      const release = await this.fetchLatestRelease();
      if (release) {
        this.updateVersionInfo(release);
      }
    } catch (error) {
      console.error('[VersionChecker] Failed to fetch latest release:', error);
      // エラーは無視して現在のキャッシュを返す
    }

    this.lastCheckTime = now;
    return this.getCurrentVersionInfo();
  }

  /**
   * 定期的にアップデートをチェックする。
   *
   * @remarks
   * 既に定期チェックが実行中の場合は何もしない。
   * 外部から明示的に `stopPeriodicCheck()` を呼び出してクリーンアップすること。
   *
   * @param intervalMs - チェック間隔（ミリ秒）。デフォルト: 30分
   */
  startPeriodicCheck(intervalMs = 30 * 60 * 1000): void {
    if (this.periodicCheckInterval !== null) {
      console.warn('[VersionChecker] Periodic check is already running.');
      return;
    }

    console.log(
      `[VersionChecker] Starting periodic check every ${intervalMs / 1000 / 60} minutes.`,
    );

    // 起動時にすぐチェック
    this.checkForUpdates().catch((err) => {
      console.error('[VersionChecker] Initial check failed:', err);
    });

    // その後は定期的にチェック
    this.periodicCheckInterval = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        console.error('[VersionChecker] Periodic check failed:', err);
      });
    }, intervalMs);
  }

  /**
   * 定期チェックを停止する。
   */
  stopPeriodicCheck(): void {
    if (this.periodicCheckInterval !== null) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
      console.log('[VersionChecker] Periodic check stopped.');
    }
  }

  /**
   * 現在のバージョン情報を返す。
   */
  private getCurrentVersionInfo(): VersionInfo {
    return {
      current: this.currentVersion,
      latest: this.latestVersion || this.currentVersion,
      isUpdateAvailable: this.isUpdateAvailable,
      latestReleaseUrl: this.latestReleaseUrl || '',
      publishedAt: this.publishedAt || '',
    };
  }

  /**
   * GitHub Releases API から最新リリース情報を取得する。
   *
   * @remarks
   * `Authorization` ヘッダーにトークンが設定されている場合のみ認証付きで呼び出す。
   * HTTPS リクエストのタイムアウト: 10秒
   *
   * @returns リリース情報、エラーの場合は null
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    return new Promise((resolve) => {
      const url = `https://api.github.com/repos/${this.repositoryOwner}/${this.repositoryName}/releases/latest`;
      const options = {
        headers: {
          'User-Agent': 'squad-app-version-checker',
          Accept: 'application/vnd.github+json',
          ...(this.githubToken && { Authorization: `Bearer ${this.githubToken}` }),
        },
        timeout: 10000,
      };

      https
        .get(url, options, (res: any) => {
          let data = '';

          res.on('data', (chunk: any) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const release = JSON.parse(data) as GitHubRelease;
                resolve(release);
              } else if (res.statusCode === 404) {
                console.warn('[VersionChecker] No releases found for this repository.');
                resolve(null);
              } else {
                console.warn(
                  `[VersionChecker] Unexpected status code: ${res.statusCode}. Response: ${data}`,
                );
                resolve(null);
              }
            } catch (err) {
              console.error('[VersionChecker] Failed to parse GitHub API response:', err);
              resolve(null);
            }
          });
        })
        .on('error', (err: any) => {
          console.error('[VersionChecker] HTTPS request failed:', err);
          resolve(null);
        })
        .on('timeout', () => {
          console.warn('[VersionChecker] HTTPS request timed out.');
          resolve(null);
        });
    });
  }

  /**
   * GitHub Releases レスポンスからバージョン情報を更新する。
   *
   * @remarks
   * tag_name から 'v' プレフィックスを除去し、semver で比較する。
   * `isUpdateAvailable` は比較結果に基づいて更新される。
   * タグが有効な semver ではない場合は無視する。
   *
   * @param release - GitHub Release オブジェクト
   */
  private updateVersionInfo(release: GitHubRelease): void {
    try {
      // tag_name から 'v' プレフィックスを除去
      const versionString = release.tag_name.replace(/^v/, '');

      // semver でパース
      const latestVersion = parse(versionString);
      if (!latestVersion) {
        console.warn(
          `[VersionChecker] Invalid semver tag: ${release.tag_name}. Ignoring.`,
        );
        return;
      }

      // 現在のバージョンと比較
      const currentVersionParsed = parse(this.currentVersion);
      if (!currentVersionParsed) {
        console.warn('[VersionChecker] Current version is not valid semver.');
        this.isUpdateAvailable = false;
        return;
      }

      const isNewer = compare(latestVersion, currentVersionParsed) > 0;

      this.latestVersion = latestVersion.version;
      this.isUpdateAvailable = isNewer;
      this.latestReleaseUrl = release.html_url;
      this.publishedAt = release.published_at;

      if (isNewer) {
        console.log(
          `[VersionChecker] Update available: ${this.currentVersion} → ${this.latestVersion}`,
        );
      } else {
        console.log(`[VersionChecker] Already up to date: ${this.currentVersion}`);
      }
    } catch (err) {
      console.error('[VersionChecker] Failed to update version info:', err);
    }
  }
}
