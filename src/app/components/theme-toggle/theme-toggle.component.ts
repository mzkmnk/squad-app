import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { provideIcons } from '@ng-icons/core';
import { computed } from '@angular/core';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
  imports: [HlmButtonImports, HlmIconImports],
  providers: [provideIcons({ lucideSun, lucideMoon })],
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly isDarkMode = computed(() => this.themeService.isDarkMode());
  protected readonly currentIcon = computed(() => (this.isDarkMode() ? 'lucideMoon' : 'lucideSun'));

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
