import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toast } from 'ngx-sonner';
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import type { IdeDetectionResult, IdeId } from '../../../electron/types/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.html',
  imports: [TranslocoDirective, ...BrnSelectImports, ...HlmSelectImports, ...HlmSpinnerImports],
})
export class SettingsComponent {
  private readonly transloco = inject(TranslocoService);

  protected readonly ideOptions = signal<IdeDetectionResult[]>([]);
  protected readonly selectedIdeId = signal<IdeId>('vscode');
  protected readonly detectingIdes = signal(true);
  protected readonly saving = signal(false);

  constructor() {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const [settingsResult, idesResult] = await Promise.all([
      window.electronAPI.getSettings(),
      window.electronAPI.detectIdes(),
    ]);

    if (settingsResult.success) {
      this.selectedIdeId.set(settingsResult.data.selectedIde);
    } else {
      toast.error(settingsResult.error.message);
    }

    if (idesResult.success) {
      this.ideOptions.set(idesResult.data);
    } else {
      toast.error(idesResult.error.message);
    }

    this.detectingIdes.set(false);
  }

  protected async onIdeChange(value: string | string[] | undefined): Promise<void> {
    if (typeof value !== 'string') return;
    const newIdeId = value as IdeId;
    const previousIdeId = this.selectedIdeId();
    this.selectedIdeId.set(newIdeId);
    this.saving.set(true);

    const result = await window.electronAPI.updateSettings({ selectedIde: newIdeId });

    if (result.success) {
      toast.success(this.transloco.translate('settings.saveSuccess'));
    } else {
      this.selectedIdeId.set(previousIdeId);
      toast.error(result.error.message);
    }

    this.saving.set(false);
  }
}
