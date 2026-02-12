import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';

@Component({
  selector: 'app-branch-combobox',
  standalone: true,
  templateUrl: './branch-combobox.html',
  imports: [TranslocoDirective, HlmAutocompleteImports],
})
export class BranchComboboxComponent {
  /** フィルタリング対象のブランチ名一覧 */
  readonly branches = input.required<string[]>();

  /** 現在の選択値 */
  readonly value = input<string | null>(null);

  /** プレースホルダーテキスト */
  readonly placeholder = input.required<string>();

  /** 無効状態 */
  readonly disabled = input<boolean>(false);

  /** 候補選択時のイベント */
  readonly valueChange = output<string | null>();

  /** 検索テキスト変更時のイベント */
  readonly searchChange = output<string>();

  /** 検索テキスト（spartan-ng の [(search)] と双方向バインディング） */
  protected readonly search = signal('');

  /** フィルタリング結果 */
  protected readonly filteredBranches = computed(() => {
    const q = this.search().toLowerCase();
    if (q === '') return this.branches();
    return this.branches().filter((b) => b.toLowerCase().includes(q));
  });
}
