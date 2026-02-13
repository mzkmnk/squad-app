import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranch, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { PendingEntry } from '../workspace-edit/workspace-edit-types';

@Component({
  selector: 'app-workspace-pending-list',
  standalone: true,
  templateUrl: './workspace-pending-list.html',
  imports: [TranslocoDirective, HlmButtonImports, HlmIconImports],
  providers: [provideIcons({ lucideGitBranch, lucideTrash2 })],
})
export class WorkspacePendingListComponent {
  readonly entries = input.required<PendingEntry[]>();
  readonly repoMap = input.required<Map<string, { displayName: string }>>();

  readonly cancelAddition = output<string>();

  protected getRepoName(repositoryId: string): string {
    return this.repoMap().get(repositoryId)?.displayName ?? repositoryId;
  }

  protected getEntryBranchName(entry: PendingEntry): string {
    return entry.type === 'existing' ? entry.branch : entry.newBranchInfo.newBranchName;
  }
}
