import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideGitBranch, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { RepositoryService } from '../services/repository.service';
import { WorkspaceService } from '../services/workspace.service';
import type { Repository, Workspace } from '../../../electron/types/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [
    DatePipe,
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmIconImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideGitBranch, lucideTrash2 })],
})
export class DashboardComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly repoService = inject(RepositoryService);

  /** 作成済み Workspace 一覧 */
  protected readonly workspaces = signal<Workspace[]>([]);

  /** 登録済みリポジトリ一覧 */
  protected readonly repositories = signal<Repository[]>([]);

  /** ローディング状態 */
  protected readonly loading = signal(true);

  /** 削除処理中の Workspace ID セット */
  protected readonly deletingIds = signal<Set<string>>(new Set());

  /** Open 処理中の Workspace ID セット */
  protected readonly openingIds = signal<Set<string>>(new Set());

  /** repositoryId → Repository の Map */
  protected readonly repoMap = computed(() => {
    const map = new Map<string, Repository>();
    for (const repo of this.repositories()) {
      map.set(repo.id, repo);
    }
    return map;
  });

  constructor() {
    void this.initialize();
  }

  /** 初期化: Workspace 一覧 + リポジトリ一覧を並行取得 */
  private async initialize(): Promise<void> {
    this.loading.set(true);

    const [wsResult, repoResult] = await Promise.all([
      this.workspaceService.getWorkspaces(),
      this.repoService.getRepositories(),
    ]);

    if (wsResult.success) {
      this.workspaces.set(wsResult.data);
    } else {
      toast.error(wsResult.error.message);
    }

    if (repoResult.success) {
      this.repositories.set(repoResult.data);
    } else {
      toast.error(repoResult.error.message);
    }

    this.loading.set(false);
  }

  /** repositoryId からリポジトリ名を解決する */
  protected getRepoName(repositoryId: string): string {
    return this.repoMap().get(repositoryId)?.name ?? '不明なリポジトリ';
  }

  /** Workspace を VS Code で開く */
  protected async openWorkspace(id: string): Promise<void> {
    this.openingIds.update((ids) => new Set([...ids, id]));

    const result = await this.workspaceService.openWorkspace(id);
    if (result.success) {
      toast.success('VS Code を起動しました');
    } else {
      toast.error(result.error.message);
    }

    this.openingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  /** Workspace を削除する */
  protected async deleteWorkspace(id: string): Promise<void> {
    this.deletingIds.update((ids) => new Set([...ids, id]));

    const result = await this.workspaceService.deleteWorkspace(id);
    if (result.success) {
      this.workspaces.update((ws) => ws.filter((w) => w.id !== id));
      toast.success('Workspace を削除しました');
    } else {
      toast.error(result.error.message);
    }

    this.deletingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
