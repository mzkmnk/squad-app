import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import fixPath from 'fix-path';
import { SquadStore } from './store/squad-store.js';
import { createSquadPaths } from './store/squad-paths.js';
import { GitService } from './git/git-service.js';
import { CodeWorkspaceService } from './git/code-workspace-service.js';
import { registerIpcHandlers } from './ipc/ipc-handlers.js';
import { detectInstalledIdes } from './ide/ide-detector.js';
import { BackgroundFetchService } from './git/background-fetch-service.js';

// macOS/Linux の GUI アプリではシェルの $PATH が継承されないため、
// ログインシェルから完全な PATH を取得して process.env.PATH を修正する
fixPath();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null;
let backgroundFetchService: BackgroundFetchService | null = null;

async function initializeServices(): Promise<void> {
  const paths = createSquadPaths();
  const store = new SquadStore();
  await store.initialize();
  const gitService = new GitService(paths);
  const codeWorkspaceService = new CodeWorkspaceService(paths);

  registerIpcHandlers({
    store,
    gitService,
    codeWorkspaceService,
    paths,
    ideDetector: { detectInstalledIdes },
  });

  backgroundFetchService = new BackgroundFetchService(gitService, store);
  backgroundFetchService.start();
}

function createWindow(): void {
  // E2E テスト実行時はウィンドウを非表示にし、画面のチラつきを防止する
  const isTest = process.env.NODE_ENV === 'test';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !isTest,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'test';
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

app.on('before-quit', () => {
  backgroundFetchService?.stop();
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
