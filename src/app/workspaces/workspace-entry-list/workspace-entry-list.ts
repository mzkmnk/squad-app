import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranch, lucideTrash2, lucideUndo2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';

@Component({
  selector: 'app-workspace-entry-list',
  standalone: true,
  templateUrl: './workspace-entry-list.html',
  imports: [TranslocoDirective, HlmButtonImports, HlmIconImports],
  providers: [provideIcons({ lucideGitBranch, lucideTrash2, lucideUndo2 })],
})
export class WorkspaceEntryListComponent {
  readonly entries = input.required<{ repositoryId: string; branch: string }[]>();
  readonly pendingRemovals = input.required<Set<string>>();
  readonly repoMap = input.required<Map<string, { displayName: string }>>();

  readonly markForRemoval = output<string>();
  readonly unmarkRemoval = output<string>();

  protected getRepoName(repositoryId: string): string {
    return this.repoMap().get(repositoryId)?.displayName ?? repositoryId;
  }
}
