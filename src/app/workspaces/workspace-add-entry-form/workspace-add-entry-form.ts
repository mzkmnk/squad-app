import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranchPlus, lucidePlus } from '@ng-icons/lucide';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { BranchComboboxComponent } from '../../shared/branch-combobox/branch-combobox';
import { CreateBranchDialogComponent } from '../../shared/create-branch-dialog/create-branch-dialog';
import type { CreateBranchResult } from '../../shared/create-branch-dialog/create-branch-dialog-types';
import type { PendingEntry } from '../workspace-edit/workspace-edit-types';
import type { Repository } from '../../../../electron/types/models';

type BranchSelection =
  | { readonly type: 'existing'; readonly branch: string }
  | {
      readonly type: 'new';
      readonly newBranchInfo: { readonly sourceBranch: string; readonly newBranchName: string };
    };

@Component({
  selector: 'app-workspace-add-entry-form',
  standalone: true,
  templateUrl: './workspace-add-entry-form.html',
  imports: [
    TranslocoDirective,
    BranchComboboxComponent,
    CreateBranchDialogComponent,
    ...BrnSelectImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmIconImports,
    ...HlmSelectImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideGitBranchPlus, lucidePlus })],
})
export class WorkspaceAddEntryFormComponent {
  readonly availableRepos = input.required<Repository[]>();
  readonly branchesMap = input.required<Map<string, string[]>>();
  readonly fetchingIds = input.required<Set<string>>();
  readonly disabled = input<boolean>(false);

  readonly entryAdded = output<PendingEntry>();
  readonly repoSelected = output<string>();

  protected readonly selectedRepoId = signal<string | null>(null);
  protected readonly branchSelection = signal<BranchSelection | null>(null);

  protected readonly canAddEntry = computed(() => {
    return !!this.selectedRepoId() && !!this.branchSelection();
  });

  protected readonly selectedRepoBranches = computed(() => {
    const id = this.selectedRepoId();
    if (!id) return [];
    return this.branchesMap().get(id) ?? [];
  });

  protected readonly isSelectedRepoReady = computed(() => {
    const id = this.selectedRepoId();
    if (!id) return false;
    return this.branchesMap().has(id) && !this.fetchingIds().has(id);
  });

  protected onRepoSelected(value: string | string[] | undefined): void {
    if (typeof value !== 'string') return;
    this.selectedRepoId.set(value);
    this.branchSelection.set(null);
    this.repoSelected.emit(value);
  }

  protected selectBranch(branch: string | null): void {
    if (branch === null) {
      this.branchSelection.set(null);
    } else {
      this.branchSelection.set({ type: 'existing', branch });
    }
  }

  protected onBranchCreated(result: CreateBranchResult): void {
    this.branchSelection.set({
      type: 'new',
      newBranchInfo: {
        sourceBranch: result.baseBranch,
        newBranchName: result.newBranchName,
      },
    });
  }

  protected confirmAddition(): void {
    const repoId = this.selectedRepoId();
    const selection = this.branchSelection();
    if (!repoId || !selection) return;

    const entry: PendingEntry =
      selection.type === 'existing'
        ? { type: 'existing', repositoryId: repoId, branch: selection.branch }
        : { type: 'new', repositoryId: repoId, newBranchInfo: selection.newBranchInfo };

    this.entryAdded.emit(entry);
    this.selectedRepoId.set(null);
    this.branchSelection.set(null);
  }

  protected getSelectedBranchName(): string | null {
    const selection = this.branchSelection();
    if (!selection) return null;
    return selection.type === 'existing' ? selection.branch : selection.newBranchInfo.newBranchName;
  }

  protected getDefaultBranch(): string {
    const branches = this.selectedRepoBranches();
    return branches.includes('main') ? 'main' : (branches[0] ?? 'main');
  }
}
