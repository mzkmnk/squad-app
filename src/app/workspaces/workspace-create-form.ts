import { Component, computed, inject, output, signal } from '@angular/core';
import { BrnDialogClose, BrnDialogRef } from '@spartan-ng/brain/dialog';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranchPlus, lucideLoader } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { BranchComboboxComponent } from '../shared/branch-combobox/branch-combobox';
import { CreateBranchDialogComponent } from '../shared/create-branch-dialog/create-branch-dialog';
import type { CreateBranchResult } from '../shared/create-branch-dialog/create-branch-dialog-types';
import { RepositoryService } from '../services/repository.service';
import { WorkspaceService } from '../services/workspace.service';
import type { Repository, Workspace } from '../../../electron/types/models';
import type { WorkspaceCreateEntry } from '../../../electron/ipc/ipc-channels';

/** 新規ブランチ作成ダイアログからの戻り値 */
export interface NewBranchInfo {
  /** 起点ブランチ名（例: develop） */
  readonly sourceBranch: string;
  /** 新規ブランチ名（例: feature/new-api） */
  readonly newBranchName: string;
}

/** リポジトリごとのブランチ選択状態 */
export type BranchSelection =
  | { readonly type: 'existing'; readonly branch: string }
  | { readonly type: 'new'; readonly newBranchInfo: Readonly<NewBranchInfo> };

@Component({
  selector: 'app-workspace-create-form',
  standalone: true,
  templateUrl: './workspace-create-form.html',
  imports: [
    BrnDialogClose,
    TranslocoDirective,
    BranchComboboxComponent,
    CreateBranchDialogComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmCheckboxImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmIconImports,
    HlmInputImports,
    HlmSeparatorImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideLoader, lucideGitBranchPlus })],
})
export class WorkspaceCreateFormComponent {
  private readonly repoService = inject(RepositoryService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly dialogRef = inject(BrnDialogRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly workspaceName = signal('');
  protected readonly repositories = signal<Repository[]>([]);
  protected readonly selectedRepoIds = signal<Set<string>>(new Set());
  protected readonly branchesMap = signal<Map<string, string[]>>(new Map());
  protected readonly branchSelections = signal<Map<string, BranchSelection>>(new Map());
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
      const selection = this.branchSelections().get(id);
      if (!selection) return false;
      if (selection.type === 'new' && selection.newBranchInfo.newBranchName.trim().length === 0) {
        return false;
      }
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
        this.branchSelections.update((map) => {
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

  protected selectBranch(repoId: string, branch: string | null): void {
    this.branchSelections.update((map) => {
      const next = new Map(map);
      if (branch === null) {
        next.delete(repoId);
      } else {
        next.set(repoId, { type: 'existing', branch });
      }
      return next;
    });
    this.selectionError.set(null);
  }

  protected setNewBranch(repoId: string, info: NewBranchInfo): void {
    this.branchSelections.update((map) => {
      const next = new Map(map);
      next.set(repoId, { type: 'new', newBranchInfo: info });
      return next;
    });
    this.selectionError.set(null);
  }

  protected onBranchCreated(repoId: string, result: CreateBranchResult): void {
    this.setNewBranch(repoId, {
      sourceBranch: result.baseBranch,
      newBranchName: result.newBranchName,
    });
  }

  protected getDefaultBranch(repoId: string): string {
    const branches = this.branchesMap().get(repoId) ?? [];
    return branches.includes('main') ? 'main' : (branches[0] ?? 'main');
  }

  protected getSelectedBranchName(repoId: string): string | null {
    const selection = this.branchSelections().get(repoId);
    if (!selection) return null;
    return selection.type === 'existing' ? selection.branch : selection.newBranchInfo.newBranchName;
  }

  protected validate(): boolean {
    let valid = true;
    const name = this.workspaceName().trim();
    if (name.length === 0) {
      this.nameError.set(this.transloco.translate('workspaces.validation.nameRequired'));
      valid = false;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      this.nameError.set(this.transloco.translate('workspaces.validation.nameInvalidChars'));
      valid = false;
    } else {
      this.nameError.set(null);
    }

    if (this.selectedRepoIds().size === 0) {
      this.selectionError.set(
        this.transloco.translate('workspaces.validation.selectAtLeastOneRepo'),
      );
      valid = false;
    } else {
      for (const id of this.selectedRepoIds()) {
        if (!this.branchSelections().has(id)) {
          this.selectionError.set(
            this.transloco.translate('workspaces.validation.selectBranchForAll'),
          );
          valid = false;
          break;
        }
      }
      if (valid) this.selectionError.set(null);
    }
    return valid;
  }

  private buildEntries(): WorkspaceCreateEntry[] {
    return [...this.selectedRepoIds()].map((repoId) => {
      const selection = this.branchSelections().get(repoId);
      if (!selection) {
        throw new Error(`Branch selection not found for repository: ${repoId}`);
      }
      if (selection.type === 'existing') {
        return { repositoryId: repoId, branch: selection.branch };
      }
      return {
        repositoryId: repoId,
        branch: selection.newBranchInfo.newBranchName,
        sourceBranch: selection.newBranchInfo.sourceBranch,
      };
    });
  }

  protected async onSubmit(): Promise<void> {
    if (!this.validate()) return;
    this.creating.set(true);

    const entries = this.buildEntries();
    const result = await this.workspaceService.createWorkspace(
      this.workspaceName().trim(),
      entries,
    );

    if (result.success) {
      toast.success(
        this.transloco.translate('workspaces.createSuccess', { name: result.data.name }),
      );
      this.created.emit(result.data);
      this.dialogRef.close();
    } else {
      toast.error(result.error.message);
    }
    this.creating.set(false);
  }
}
