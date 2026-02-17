import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'squad-app-theme';
  private readonly themeSignal = signal<ThemeMode>(this.getInitialTheme());

  constructor() {
    // Effect to persist theme changes to localStorage and DOM
    effect(() => {
      const theme = this.themeSignal();
      this.applyTheme(theme);
      this.persistTheme(theme);
    });
  }

  private getInitialTheme(): ThemeMode {
    // Check localStorage first
    const stored = localStorage.getItem(this.THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Default to light
    return 'light';
  }

  private applyTheme(theme: ThemeMode): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private persistTheme(theme: ThemeMode): void {
    localStorage.setItem(this.THEME_STORAGE_KEY, theme);
  }

  getCurrentTheme(): ThemeMode {
    return this.themeSignal();
  }

  toggleTheme(): void {
    const current = this.themeSignal();
    const newTheme: ThemeMode = current === 'light' ? 'dark' : 'light';
    this.themeSignal.set(newTheme);
  }

  setTheme(theme: ThemeMode): void {
    this.themeSignal.set(theme);
  }

  isDarkMode(): boolean {
    return this.themeSignal() === 'dark';
  }
}
