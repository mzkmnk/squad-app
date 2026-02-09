import { Component, computed, inject, output, signal } from '@angular/core';
import { BrnDialogClose, BrnDialogRef } from '@spartan-ng/brain/dialog';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { provideIcons } from '@ng-icons/core';
import { lucideLoader } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { RepositoryService } from '../services/repository.service';
import { WorkspaceService } from '../services/workspace.service';
import type { Repository, Workspace } from '../../../electron/types/models';

@Component({
  selector: 'app-workspace-create-form',
  standalone: true,
  templateUrl: './workspace-create-form.html',
  imports: [
    BrnDialogClose,
    BrnSelectImports,
    HlmButtonImports,
    HlmCardImports,
    HlmCheckboxImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmIconImports,
    HlmInputImports,
    HlmSelectImports,
    HlmSeparatorImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideLoader })],
})
export class WorkspaceCreateFormComponent {
  private readonly repoService = inject(RepositoryService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly dialogRef = inject(BrnDialogRef);

  protected readonly workspaceName = signal('');
  protected readonly repositories = signal<Repository[]>([]);
  protected readonly selectedRepoIds = signal<Set<string>>(new Set());
  protected readonly branchesMap = signal<Map<string, string[]>>(new Map());
  protected readonly selectedBranches = signal<Map<string, string>>(new Map());
  protected readonly fetchingIds = signal<Set<string>>(new Set());
  protected readonly loadingRepos = signal(true);
  protected readonly creating = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly selectionError = signal<string | null>(null);

  readonly created = output<Workspace>();

  protected readonly canSubmit = computed(() => {
    if (this.creating()) return false;
    if (this.workspaceName().trim().length === 0) return false;
    if (this.selectedRepoIds().size === 0) return false;
    for (const id of this.selectedRepoIds()) {
      if (!this.selectedBranches().has(id)) return false;
    }
    return true;
  });

  constructor() {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.loadingRepos.set(true);
    const result = await this.repoService.getRepositories();
    if (result.success) {
      this.repositories.set(result.data);
      for (const repo of result.data) {
        void this.fetchAndLoadBranches(repo.id);
      }
    } else {
      toast.error(result.error.message);
    }
    this.loadingRepos.set(false);
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

  protected toggleRepo(repoId: string): void {
    this.selectedRepoIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(repoId)) {
        next.delete(repoId);
        this.selectedBranches.update((map) => {
          const nextMap = new Map(map);
          nextMap.delete(repoId);
          return nextMap;
        });
      } else {
        next.add(repoId);
      }
      return next;
    });
    this.selectionError.set(null);
  }

  protected selectBranch(repoId: string, branch: string): void {
    this.selectedBranches.update((map) => {
      const next = new Map(map);
      next.set(repoId, branch);
      return next;
    });
    this.selectionError.set(null);
  }

  protected validate(): boolean {
    let valid = true;
    const name = this.workspaceName().trim();
    if (name.length === 0) {
      this.nameError.set('Workspace名を入力してください');
      valid = false;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      this.nameError.set('英数字、ハイフン、アンダースコアのみ使用できます');
      valid = false;
    } else {
      this.nameError.set(null);
    }

    if (this.selectedRepoIds().size === 0) {
      this.selectionError.set('1つ以上のリポジトリを選択してください');
      valid = false;
    } else {
      for (const id of this.selectedRepoIds()) {
        if (!this.selectedBranches().has(id)) {
          this.selectionError.set('全てのリポジトリでブランチを選択してください');
          valid = false;
          break;
        }
      }
      if (valid) this.selectionError.set(null);
    }
    return valid;
  }

  protected async onSubmit(): Promise<void> {
    if (!this.validate()) return;
    this.creating.set(true);

    const entries = [...this.selectedRepoIds()].map((repoId) => ({
      repositoryId: repoId,
      branch: this.selectedBranches().get(repoId) ?? '',
    }));

    const result = await this.workspaceService.createWorkspace(
      this.workspaceName().trim(),
      entries,
    );

    if (result.success) {
      toast.success(`Workspace「${result.data.name}」を作成しました`);
      this.created.emit(result.data);
      this.dialogRef.close();
    } else {
      toast.error(result.error.message);
    }
    this.creating.set(false);
  }
}
