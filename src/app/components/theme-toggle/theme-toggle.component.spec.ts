import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../../services/theme.service';

describe('ThemeToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display sun icon when in light mode', () => {
    themeService.setTheme('light');
    fixture.detectChanges();
    expect(component.currentIcon()).toBe('lucideSun');
  });

  it('should display moon icon when in dark mode', () => {
    themeService.setTheme('dark');
    fixture.detectChanges();
    expect(component.currentIcon()).toBe('lucideMoon');
  });

  it('should call toggleTheme when button is clicked', () => {
    spyOn(themeService, 'toggleTheme');
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    expect(themeService.toggleTheme).toHaveBeenCalled();
  });

  it('should update isDarkMode computed property when theme changes', () => {
    themeService.setTheme('light');
    expect(component.isDarkMode()).toBe(false);

    themeService.setTheme('dark');
    expect(component.isDarkMode()).toBe(true);
  });
});
