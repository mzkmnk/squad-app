import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SquadStore } from './store/squad-store.js';
import { createSquadPaths } from './store/squad-paths.js';
import { GitService } from './git/git-service.js';
import { CodeWorkspaceService } from './git/code-workspace-service.js';
import { registerIpcHandlers } from './ipc/ipc-handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null;

async function initializeServices(): Promise<void> {
  const paths = createSquadPaths();
  const store = new SquadStore();
  await store.initialize();
  const gitService = new GitService(paths);
  const codeWorkspaceService = new CodeWorkspaceService(paths);

  registerIpcHandlers({ store, gitService, codeWorkspaceService, paths });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    void mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/squad-app/browser/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  initializeServices()
    .then(() => {
      createWindow();
    })
    .catch((error: unknown) => {
      console.error('Failed to initialize services:', error);
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

import { IpcChannels } from './ipc/ipc-channels.js';

ipcMain.handle(IpcChannels.PING, () => 'pong');
