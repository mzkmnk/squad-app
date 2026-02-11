import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranch, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { RepositoryService } from '../services/repository.service';
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceCreateFormComponent } from './workspace-create-form';
import type { Repository, Workspace } from '../../../electron/types/models';

@Component({
  selector: 'app-workspace-list',
  standalone: true,
  templateUrl: './workspace-list.html',
  imports: [
    DatePipe,
    TranslocoDirective,
    WorkspaceCreateFormComponent,
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmIconImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideGitBranch, lucidePlus, lucideTrash2 })],
})
export class WorkspaceListComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly repoService = inject(RepositoryService);
  private readonly transloco = inject(TranslocoService);

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly repositories = signal<Repository[]>([]);
  protected readonly loading = signal(true);
  protected readonly deletingIds = signal<Set<string>>(new Set());
  protected readonly openingIds = signal<Set<string>>(new Set());

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

  protected getRepoName(repositoryId: string): string {
    return (
      this.repoMap().get(repositoryId)?.name ?? this.transloco.translate('workspaces.unknownRepo')
    );
  }

  protected onWorkspaceCreated(ws: Workspace): void {
    this.workspaces.update((list) => [...list, ws]);
  }

  protected async openWorkspace(id: string): Promise<void> {
    this.openingIds.update((ids) => new Set([...ids, id]));

    const result = await this.workspaceService.openWorkspace(id);
    if (result.success) {
      toast.success(this.transloco.translate('workspaces.openSuccess'));
    } else {
      toast.error(result.error.message);
    }

    this.openingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  protected async deleteWorkspace(id: string): Promise<void> {
    this.deletingIds.update((ids) => new Set([...ids, id]));
    const ws = this.workspaces().find((w) => w.id === id);

    const result = await this.workspaceService.deleteWorkspace(id);
    if (result.success) {
      this.workspaces.update((list) => list.filter((w) => w.id !== id));
      toast.success(this.transloco.translate('workspaces.deleteSuccess', { name: ws?.name ?? '' }));
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
