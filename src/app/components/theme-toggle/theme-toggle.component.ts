import { Component } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { HlmButtonDirective } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { provideIcons } from '@ng-icons/core';
import { computed } from '@angular/core';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
  imports: [HlmButtonDirective, ...HlmIconImports],
  providers: [provideIcons({ lucideSun, lucideMoon })],
})
export class ThemeToggleComponent {
  isDarkMode = computed(() => this.themeService.isDarkMode());
  currentIcon = computed(() => (this.isDarkMode() ? 'lucideMoon' : 'lucideSun'));

  constructor(private themeService: ThemeService) {}

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
