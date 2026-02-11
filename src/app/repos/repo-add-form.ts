import { Component, inject, output, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toast } from 'ngx-sonner';
import { BrnDialogClose, BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { RepositoryService } from '../services/repository.service';
import type { Repository } from '../../../electron/types/models';

@Component({
  selector: 'app-repo-add-form',
  standalone: true,
  templateUrl: './repo-add-form.html',
  imports: [
    BrnDialogClose,
    TranslocoDirective,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
  ],
})
export class RepoAddFormComponent {
  private readonly repoService = inject(RepositoryService);
  private readonly dialogRef = inject(BrnDialogRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly remoteUrl = signal('');
  protected readonly submitting = signal(false);
  protected readonly validationError = signal<string | null>(null);

  readonly submitted = output<Repository>();

  private validate(): string | null {
    const url = this.remoteUrl().trim();
    if (url.length === 0) {
      return this.transloco.translate('repos.validation.urlRequired');
    }
    if (!url.startsWith('https://') && !url.startsWith('git@')) {
      return this.transloco.translate('repos.validation.urlInvalidFormat');
    }
    return null;
  }

  protected async onSubmit(): Promise<void> {
    this.validationError.set(null);

    const error = this.validate();
    if (error) {
      this.validationError.set(error);
      return;
    }

    this.submitting.set(true);

    const result = await this.repoService.addRepository(this.remoteUrl().trim());
    if (result.success) {
      this.remoteUrl.set('');
      this.submitted.emit(result.data);
      this.dialogRef.close();
    } else {
      toast.error(result.error.message);
    }

    this.submitting.set(false);
  }
}
