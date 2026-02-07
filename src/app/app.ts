import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('squad-app');

  readonly message = signal<string>('');

  // test code
  async testIPC() {
    const response = await window.electronAPI.ping();
    this.message.set(response);
  }
}
