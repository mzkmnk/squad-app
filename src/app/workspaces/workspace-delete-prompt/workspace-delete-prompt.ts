import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';

@Component({
  selector: 'app-workspace-delete-prompt',
  standalone: true,
  templateUrl: './workspace-delete-prompt.html',
  imports: [TranslocoDirective, HlmAlertDialogImports, HlmButtonImports, HlmCardImports],
})
export class WorkspaceDeletePromptComponent {
  readonly workspaceName = input.required<string>();
  readonly deleteConfirmed = output();
}
