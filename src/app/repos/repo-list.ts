import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
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
    TranslocoDirective,
    RepoAddFormComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmAlertDialogImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmIconImports,
  ],
  providers: [provideIcons({ lucideTrash2, lucidePlus })],
})
export class RepoListComponent {
  private readonly repoService = inject(RepositoryService);

  protected readonly repositories = signal<Repository[]>([]);
  protected readonly loading = signal(true);
  protected readonly deletingIds = signal<Set<string>>(new Set());

  constructor() {
    void this.loadRepositories();
  }

  protected async loadRepositories(): Promise<void> {
    this.loading.set(true);

    const result = await this.repoService.getRepositories();
    if (result.success) {
      this.repositories.set(result.data);
    } else {
      toast.error(result.error.message);
    }
    this.loading.set(false);
  }

  protected onRepoAdded(repo: Repository): void {
    this.repositories.update((repos) => [...repos, repo]);
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
