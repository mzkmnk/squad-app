import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { RepositoryService } from '../services/repository.service';
import { RepoAddFormComponent } from './repo-add-form';
import type { Repository } from '../../../electron/types/models';

@Component({
  selector: 'app-repo-list',
  standalone: true,
  templateUrl: './repo-list.html',
  imports: [
    DatePipe,
    TranslocoDirective,
    RepoAddFormComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmAlertDialogImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmIconImports,
  ],
  providers: [provideIcons({ lucideTrash2, lucidePlus, lucideRefreshCw })],
})
export class RepoListComponent {
  private readonly repoService = inject(RepositoryService);
  private readonly transloco = inject(TranslocoService);

  protected readonly repositories = signal<Repository[]>([]);
  protected readonly loading = signal(true);
  protected readonly deletingIds = signal<Set<string>>(new Set());
  protected readonly fetching = signal(false);

  constructor() {
    void this.loadRepositories();
  }

  protected async loadRepositories(): Promise<void> {
    this.loading.set(true);

    const result = await this.repoService.getRepositories();
    if (result.success) {
      this.repositories.set(
        [...result.data].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)),
      );
    } else {
      toast.error(result.error.message);
    }
    this.loading.set(false);
  }

  protected async fetchAll(): Promise<void> {
    this.fetching.set(true);

    const repos = this.repositories();
    let hasError = false;
    for (const repo of repos) {
      const result = await this.repoService.fetchRepository(repo.id);
      if (!result.success) {
        toast.error(result.error.message);
        hasError = true;
      }
    }

    this.fetching.set(false);
    if (!hasError) {
      toast.success(this.transloco.translate('repos.fetchAllSuccess'));
    }
  }

  protected onRepoAdded(repo: Repository): void {
    this.repositories.update((repos) => [repo, ...repos]);
  }

  protected async removeRepository(id: string): Promise<void> {
    this.deletingIds.update((ids) => new Set([...ids, id]));

    const result = await this.repoService.removeRepository(id);
    if (result.success) {
      this.repositories.update((repos) => repos.filter((r) => r.id !== id));
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
