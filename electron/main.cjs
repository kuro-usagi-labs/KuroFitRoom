'use strict';

const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL || '';
const IS_DEV = DEV_URL.length > 0;
const INDEX_FILE = path.join(__dirname, '..', 'dist', 'index.html');
const APP_URL = IS_DEV ? DEV_URL : pathToFileURL(INDEX_FILE).toString();

let mainWindow = null;

app.setAppUserModelId('com.roomfit.desktop');

function isExternalUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function sendToRenderer(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

function buildMenu() {
  if (process.platform !== 'darwin') {
    // Windows/Linux: the in-app top bar is the only chrome. Alt+F4 still closes.
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'File',
        submenu: [{ label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('roomfit:save') }],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
    ]),
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#f7f6f1',
    title: 'RoomFit',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  });

  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Never allow the app to become an arbitrary browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(APP_URL)) return;
    event.preventDefault();
    if (isExternalUrl(url)) void shell.openExternal(url);
  });

  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.webContents.on('before-input-event', (event, input) => {
    if (IS_DEV && input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.webContents.on('did-fail-load', (_event, code, description) => {
    if (IS_DEV || code === -3) return; // -3 is an intentional abort/navigation.
    void dialog.showMessageBox({
      type: 'error',
      title: 'RoomFit could not start',
      message: 'The application bundle could not be loaded.',
      detail: `${description} (${code})\n\nReinstall RoomFit, or run "npm run build" before starting it from source.`,
      buttons: ['Close'],
    });
  });

  if (IS_DEV) {
    void win.loadURL(DEV_URL);
  } else {
    void win.loadFile(INDEX_FILE);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      // RoomFit needs no camera, microphone, location or notification access.
      callback(false);
    });

    session.defaultSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({
        title: 'Save RoomFit export',
        defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      });
    });

    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
