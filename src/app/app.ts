import { Component, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideGitFork, lucideLayers, lucidePanelLeft, lucideSettings } from '@ng-icons/lucide';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import {
  HlmSidebar,
  HlmSidebarContent,
  HlmSidebarGroup,
  HlmSidebarGroupContent,
  HlmSidebarGroupLabel,
  HlmSidebarHeader,
  HlmSidebarInset,
  HlmSidebarMenu,
  HlmSidebarMenuButton,
  HlmSidebarMenuItem,
  HlmSidebarRail,
  HlmSidebarTrigger,
  HlmSidebarWrapper,
} from '@spartan-ng/helm/sidebar';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { ThemeService } from './services/theme.service';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';
import { UpdateNotificationComponent } from './components/update-notification.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoDirective,
    HlmSidebar,
    HlmSidebarContent,
    HlmSidebarGroup,
    HlmSidebarGroupContent,
    HlmSidebarGroupLabel,
    HlmSidebarHeader,
    HlmSidebarInset,
    HlmSidebarMenu,
    HlmSidebarMenuButton,
    HlmSidebarMenuItem,
    HlmSidebarRail,
    HlmSidebarTrigger,
    HlmSidebarWrapper,
    ThemeToggleComponent,
    UpdateNotificationComponent,
    ...HlmIconImports,
    ...HlmToasterImports,
  ],
  providers: [provideIcons({ lucideLayers, lucideGitFork, lucidePanelLeft, lucideSettings })],
})
export class App {
  constructor(private themeService: ThemeService) {
    // Initialize theme service - effect will run automatically
    effect(() => {
      // Trigger effect by accessing the service's method
      this.themeService.getCurrentTheme();
    });
  }
}
