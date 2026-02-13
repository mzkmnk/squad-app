import { Component, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { WorkspaceEntryListComponent } from '../workspace-entry-list/workspace-entry-list';
import { WorkspaceAddEntryFormComponent } from '../workspace-add-entry-form/workspace-add-entry-form';
import { WorkspacePendingListComponent } from '../workspace-pending-list/workspace-pending-list';
import { WorkspaceDeletePromptComponent } from '../workspace-delete-prompt/workspace-delete-prompt';
import { RepositoryService } from '../../services/repository.service';
import { WorkspaceService } from '../../services/workspace.service';
import type { Repository, Workspace } from '../../../../electron/types/models';
import { toWorkspaceCreateEntry } from './workspace-edit-types';
import type { PendingEntry } from './workspace-edit-types';

@Component({
  selector: 'app-workspace-edit',
  standalone: true,
  templateUrl: './workspace-edit.html',
  imports: [
    TranslocoDirective,
    WorkspaceEntryListComponent,
    WorkspaceAddEntryFormComponent,
    WorkspacePendingListComponent,
    WorkspaceDeletePromptComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmIconImports,
    HlmSeparatorImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideArrowLeft })],
})
export class WorkspaceEditComponent {
  readonly id = input.required<string>();

  private readonly router = inject(Router);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly repoService = inject(RepositoryService);
  private readonly transloco = inject(TranslocoService);

  // --- データ ---
  protected readonly workspace = signal<Workspace | null>(null);
  protected readonly repositories = signal<Repository[]>([]);
  protected readonly repoMap = computed(() => {
    const map = new Map<string, Repository>();
    for (const repo of this.repositories()) {
      map.set(repo.id, repo);
    }
    return map;
  });

  // --- 編集状態 ---
  protected readonly pendingRemovals = signal<Set<string>>(new Set());
  protected readonly pendingAdditions = signal<PendingEntry[]>([]);

  // --- ブランチデータ ---
  protected readonly branchesMap = signal<Map<string, string[]>>(new Map());
  protected readonly fetchingIds = signal<Set<string>>(new Set());

  // --- UI 状態 ---
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly notFound = signal(false);

  // --- 算出プロパティ ---
  protected readonly effectiveEntries = computed(() => {
    const ws = this.workspace();
    if (!ws) return [];
    const removals = this.pendingRemovals();
    const existing = ws.entries.filter((e) => !removals.has(e.repositoryId));
    const additions = this.pendingAdditions().map((p) => ({
      repositoryId: p.repositoryId,
      branch: p.type === 'existing' ? p.branch : p.newBranchInfo.newBranchName,
    }));
    return [...existing, ...additions];
  });

  protected readonly hasChanges = computed(() => {
    return this.pendingRemovals().size > 0 || this.pendingAdditions().length > 0;
  });

  protected readonly willBeEmpty = computed(() => {
    return this.effectiveEntries().length === 0;
  });

  protected readonly availableRepos = computed(() => {
    const ws = this.workspace();
    if (!ws) return [];
    const removals = this.pendingRemovals();
    const existingIds = new Set(
      ws.entries.filter((e) => !removals.has(e.repositoryId)).map((e) => e.repositoryId),
    );
    const pendingIds = new Set(this.pendingAdditions().map((p) => p.repositoryId));
    return this.repositories().filter((r) => !existingIds.has(r.id) && !pendingIds.has(r.id));
  });

  protected readonly canSave = computed(() => {
    if (this.saving()) return false;
    if (!this.hasChanges()) return false;
    if (this.willBeEmpty()) return false;
    return true;
  });

  constructor() {
    afterNextRender(() => {
      void this.initialize(this.id());
    });
  }

  private async initialize(id: string): Promise<void> {
    const [wsResult, repoResult] = await Promise.all([
      this.workspaceService.getWorkspace(id),
      this.repoService.getRepositories(),
    ]);

    if (!wsResult.success) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.workspace.set(wsResult.data);

    if (repoResult.success) {
      this.repositories.set(repoResult.data);
    }

    const repos = repoResult.success ? repoResult.data : [];
    await Promise.all(repos.map((repo) => this.fetchAndLoadBranches(repo.id)));

    this.loading.set(false);
  }

  private async fetchAndLoadBranches(repoId: string): Promise<void> {
    this.fetchingIds.update((ids) => new Set([...ids, repoId]));
    await this.repoService.fetchRepository(repoId);
    const branchResult = await this.repoService.getRemoteBranches(repoId);
    if (branchResult.success) {
      this.branchesMap.update((map) => {
        const next = new Map(map);
        next.set(repoId, branchResult.data);
        return next;
      });
    }
    this.fetchingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(repoId);
      return next;
    });
  }

  // --- サブコンポーネントイベントハンドラ ---
  protected markForRemoval(repositoryId: string): void {
    this.pendingRemovals.update((ids) => new Set([...ids, repositoryId]));
  }

  protected unmarkRemoval(repositoryId: string): void {
    this.pendingRemovals.update((ids) => {
      const next = new Set(ids);
      next.delete(repositoryId);
      return next;
    });
  }

  protected async onRepoSelected(repoId: string): Promise<void> {
    if (!this.branchesMap().has(repoId)) {
      await this.fetchAndLoadBranches(repoId);
    }
  }

  protected onEntryAdded(entry: PendingEntry): void {
    this.pendingAdditions.update((list) => [...list, entry]);
  }

  protected cancelAddition(repositoryId: string): void {
    this.pendingAdditions.update((list) => list.filter((e) => e.repositoryId !== repositoryId));
  }

  // --- 保存 ---
  protected async save(): Promise<void> {
    const ws = this.workspace();
    if (!ws) return;

    this.saving.set(true);

    if (this.pendingRemovals().size > 0) {
      const result = await this.workspaceService.removeEntry(ws.id, [...this.pendingRemovals()]);
      if (!result.success) {
        toast.error(
          this.transloco.translate('workspaceEdit.removeFailed', { message: result.error.message }),
        );
        this.saving.set(false);
        return;
      }
      this.workspace.set(result.data);
    }

    if (this.pendingAdditions().length > 0) {
      const entries = this.pendingAdditions().map(toWorkspaceCreateEntry);
      const result = await this.workspaceService.addEntry(ws.id, entries);
      if (!result.success) {
        toast.error(
          this.transloco.translate('workspaceEdit.addFailed', { message: result.error.message }),
        );
        this.pendingRemovals.set(new Set());
        this.saving.set(false);
        return;
      }
      this.workspace.set(result.data);
    }

    this.pendingRemovals.set(new Set());
    this.pendingAdditions.set([]);
    toast.success(
      this.transloco.translate('workspaceEdit.saveSuccess', {
        name: this.workspace()?.displayName ?? '',
      }),
    );
    this.saving.set(false);
  }

  // --- Workspace 削除 ---
  protected async deleteWorkspace(): Promise<void> {
    const ws = this.workspace();
    if (!ws) return;

    const result = await this.workspaceService.deleteWorkspace(ws.id);
    if (result.success) {
      toast.success(this.transloco.translate('workspaces.deleteSuccess', { name: ws.displayName }));
      void this.router.navigate(['/workspaces']);
    } else {
      toast.error(result.error.message);
    }
  }

  // --- ナビゲーション ---
  protected goBack(): void {
    void this.router.navigate(['/workspaces']);
  }
}
