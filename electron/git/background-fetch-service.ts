import type { GitService } from './git-service.js';
import type { SquadStore } from '../store/squad-store.js';

/**
 * 登録済み全リポジトリを定期的に fetch するバックグラウンドサービス。
 *
 * 個別リポジトリの fetch 失敗は他のリポジトリに影響しない（ベストエフォート）。
 */
export class BackgroundFetchService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly gitService: GitService,
    private readonly store: SquadStore,
    private readonly intervalMs: number = 5 * 60 * 1000,
  ) {}

  /** 定期 fetch を開始する（初回は即時実行） */
  start(): void {
    if (this.timer) {
      return;
    }
    void this.fetchAll();
    this.timer = setInterval(() => {
      void this.fetchAll();
    }, this.intervalMs);
  }

  /** 定期 fetch を停止する */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 全登録リポジトリを並列 fetch する */
  async fetchAll(): Promise<void> {
    let repos;
    try {
      repos = await this.store.getRepositories();
    } catch (error: unknown) {
      console.error('Background fetch: failed to get repositories:', error);
      return;
    }
    const results = await Promise.allSettled(repos.map((repo) => this.gitService.fetch(repo.name)));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Background fetch failed:', result.reason);
      }
    }
  }
}
