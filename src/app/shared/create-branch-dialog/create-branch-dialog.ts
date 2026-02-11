import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { BrnDialogClose, BrnDialogRef } from '@spartan-ng/brain/dialog';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { BranchComboboxComponent } from '../branch-combobox/branch-combobox';
import { validateBranchName, checkBranchDuplicate } from './branch-validation';
import type { CreateBranchResult } from './create-branch-dialog-types';

@Component({
  selector: 'app-create-branch-dialog',
  standalone: true,
  templateUrl: './create-branch-dialog.html',
  imports: [
    BrnDialogClose,
    TranslocoDirective,
    BranchComboboxComponent,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
  ],
})
export class CreateBranchDialogComponent {
  private readonly dialogRef = inject(BrnDialogRef);
  private readonly transloco = inject(TranslocoService);

  /** リモートブランチ一覧 */
  readonly branches = input.required<string[]>();

  /** デフォルトブランチ名（起点ブランチの初期値） */
  readonly defaultBranch = input.required<string>();

  /** 作成確定時のイベント */
  readonly created = output<CreateBranchResult>();

  protected readonly baseBranch = linkedSignal<string, string | null>({
    source: this.defaultBranch,
    computation: (defaultBranch, previous) => previous?.value ?? defaultBranch,
  });

  /** 新規ブランチ名 */
  protected readonly newBranchName = signal('');

  /** 入力欄がタッチされたか */
  protected readonly touched = signal(false);

  protected readonly branchNameError = computed(() => {
    const name = this.newBranchName();
    if (name === '') return null;

    const validationError = validateBranchName(name, this.transloco);
    if (validationError) return validationError;

    const duplicateError = checkBranchDuplicate(name, this.branches(), this.transloco);
    if (duplicateError) return duplicateError;

    return null;
  });

  /** 表示用エラーメッセージ（touched 後のみ表示） */
  protected readonly displayError = computed(() => {
    if (!this.touched()) return null;
    const name = this.newBranchName();
    if (name === '') return this.transloco.translate('branches.validation.nameRequired');
    return this.branchNameError();
  });

  /** 作成ボタンの有効/無効 */
  protected readonly canCreate = computed(() => {
    const name = this.newBranchName();
    if (name === '') return false;
    if (this.baseBranch() === null) return false;
    if (this.branchNameError() !== null) return false;
    return true;
  });

  /** 作成ボタンクリック時 */
  protected onCreate(): void {
    if (!this.canCreate()) return;
    const baseBranch = this.baseBranch();
    if (baseBranch === null) return;
    this.created.emit({
      baseBranch,
      newBranchName: this.newBranchName(),
    });
    this.dialogRef.close();
  }
}
