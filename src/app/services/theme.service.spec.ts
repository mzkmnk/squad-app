import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    // Clear localStorage before each test
    localStorage.clear();

    // Clear dark class
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return light theme as default', () => {
    expect(service.getCurrentTheme()).toBe('light');
  });

  it('should toggle theme from light to dark', () => {
    service.toggleTheme();
    expect(service.getCurrentTheme()).toBe('dark');
  });

  it('should toggle theme from dark to light', () => {
    service.setTheme('dark');
    service.toggleTheme();
    expect(service.getCurrentTheme()).toBe('light');
  });

  it('should persist theme to localStorage', () => {
    service.setTheme('dark');
    expect(localStorage.getItem('squad-app-theme')).toBe('dark');
  });

  it('should apply dark class to root when theme is dark', (done) => {
    service.setTheme('dark');
    // Wait for effect to run
    setTimeout(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      done();
    }, 0);
  });

  it('should remove dark class from root when theme is light', (done) => {
    service.setTheme('dark');
    setTimeout(() => {
      service.setTheme('light');
      setTimeout(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        done();
      }, 0);
    }, 0);
  });

  it('should return true for isDarkMode when theme is dark', () => {
    service.setTheme('dark');
    expect(service.isDarkMode()).toBe(true);
  });

  it('should return false for isDarkMode when theme is light', () => {
    service.setTheme('light');
    expect(service.isDarkMode()).toBe(false);
  });

  it('should load theme from localStorage on initialization', () => {
    localStorage.setItem('squad-app-theme', 'dark');
    const newService = new ThemeService();
    expect(newService.getCurrentTheme()).toBe('dark');
  });
});
