const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const isDev = !app.isPackaged;

// Extract initial file path from command-line arguments (e.g. double-click on .md file)
const rawArgs = process.argv.slice(isDev ? 2 : 1);
const initialFilePath = rawArgs.find(a =>
  (a.endsWith('.md') || a.endsWith('.markdown')) && fsSync.existsSync(a)
) ? path.resolve(rawArgs.find(a =>
  (a.endsWith('.md') || a.endsWith('.markdown')) && fsSync.existsSync(a)
)) : null;

// Global error handling (4.5)
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Multi-window support (3.14)
const windows = new Set();
let store = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  windows.add(win);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'out/frontend/index.html'));
  }

  // Unsaved changes protection: ask renderer if there are unsaved changes before closing
  win.on('close', (e) => {
    e.preventDefault();
    win.webContents.send('request-close');
  });

  win.on('closed', () => {
    windows.delete(win);
  });

  return win;
}

// Initialize store and register ALL IPC handlers BEFORE creating the window
app.whenReady().then(async () => {
  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' http://localhost:*; script-src 'self' 'unsafe-inline' http://localhost:*; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: file:;"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: file:;"
        ]
      }
    });
  });

  // Initialize electron-store BEFORE creating window (fixes race condition)
  try {
    const Store = (await import('electron-store')).default;
    store = new Store({
      defaults: {
        recentFiles: [],
        favoriteFiles: [],
        theme: 'dark',
        zoomLevel: 100,
        spellcheck: false
      }
    });
  } catch (e) {
    console.error('Failed to initialize electron-store:', e);
  }

  // Register ALL IPC handlers before the window loads
  registerIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  // Path validation: reject suspicious paths (1.8)
  const isValidFilePath = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false;
    // Reject null bytes (path traversal attack vector)
    if (filePath.includes('\0')) return false;
    // Normalize and check that it's an absolute path
    const normalized = path.resolve(filePath);
    return normalized === path.normalize(filePath);
  };

  // --- File I/O (async, with path validation) ---
  ipcMain.handle('read-file', async (event, filePath) => {
    if (!isValidFilePath(filePath)) {
      console.error('Invalid file path rejected:', filePath);
      return null;
    }
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      console.error('File read error:', e);
      return null;
    }
  });

  ipcMain.handle('write-file', async (event, { filePath, content }) => {
    if (!isValidFilePath(filePath)) {
      console.error('Invalid file path rejected:', filePath);
      return false;
    }
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('File write error:', e);
      return false;
    }
  });

  // --- Dialogs ---
  ipcMain.handle('show-open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('show-save-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePath) {
      return result.filePath;
    }
    return null;
  });

  // --- Image copy (async) ---
  ipcMain.handle('copy-image', async (event, sourcePath) => {
    try {
      const assetsDir = path.join(app.getPath('userData'), 'assets');
      try {
        await fs.access(assetsDir);
      } catch {
        await fs.mkdir(assetsDir, { recursive: true });
      }

      const fileName = path.basename(sourcePath);
      const uniqueFileName = `${Date.now()}_${fileName}`;
      const destPath = path.join(assetsDir, uniqueFileName);

      await fs.copyFile(sourcePath, destPath);

      return `assets/${uniqueFileName}`;
    } catch (e) {
      console.error('File copy error:', e);
      return null;
    }
  });

  // --- Store handlers (with null-safety) ---
  ipcMain.handle('store-get', (event, key) => {
    if (!store) return null;
    return store.get(key);
  });

  ipcMain.handle('store-set', (event, key, value) => {
    if (!store) return false;
    store.set(key, value);
    return true;
  });

  ipcMain.handle('add-recent-file', (event, fileObj) => {
    if (!store) return [];
    let recents = store.get('recentFiles') || [];
    recents = recents.filter(f => f.path !== fileObj.path);
    recents.unshift({ ...fileObj, lastOpened: Date.now() });

    if (recents.length > 15) recents.pop();

    store.set('recentFiles', recents);
    return recents;
  });

  ipcMain.handle('add-favorite', (event, fileObj) => {
    if (!store) return [];
    let favorites = store.get('favoriteFiles') || [];
    if (!favorites.some(f => f.path === fileObj.path)) {
      favorites.push(fileObj);
      store.set('favoriteFiles', favorites);
    }
    return favorites;
  });

  ipcMain.handle('remove-favorite', (event, filePath) => {
    if (!store) return [];
    let favorites = store.get('favoriteFiles') || [];
    favorites = favorites.filter(f => f.path !== filePath);
    store.set('favoriteFiles', favorites);
    return favorites;
  });

  // --- Export PDF (3.8) ---
  ipcMain.handle('export-pdf', async (event, htmlContent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return false;
    try {
      // Create a hidden window with only the rendered markdown content
      const pdfWin = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        margins: { top: 1, bottom: 1, left: 1, right: 1 }
      });
      pdfWin.destroy();

      await fs.writeFile(result.filePath, pdfData);
      return result.filePath;
    } catch (e) {
      console.error('PDF export error:', e);
      return false;
    }
  });

  // --- Export HTML (3.8) ---
  ipcMain.handle('export-html', async (event, htmlContent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
    });
    if (result.canceled || !result.filePath) return false;
    try {
      await fs.writeFile(result.filePath, htmlContent, 'utf-8');
      return result.filePath;
    } catch (e) {
      console.error('HTML export error:', e);
      return false;
    }
  });

  // --- Print (3.13) ---
  ipcMain.handle('print-document', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.webContents.print({ printBackground: true }, (success, errorType) => {
      if (!success) console.error('Print failed:', errorType);
    });
    return true;
  });

  // --- Open external URL (3.12) ---
  ipcMain.handle('open-external', async (event, url) => {
    try {
      // Only allow http/https URLs for safety
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        await shell.openExternal(url);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to open external URL:', e);
      return false;
    }
  });

  // --- Window controls ---
  ipcMain.on('window-control', (event, command) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    if (command === 'close') win.close();
    if (command === 'minimize') win.minimize();
    if (command === 'maximize') {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  // Close confirmation from renderer (3.14: per-window)
  ipcMain.on('confirm-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.removeAllListeners('close');
      win.close();
    }
  });

  // New window (3.14)
  ipcMain.handle('new-window', () => {
    createWindow();
    return true;
  });

  // Return the initial file path for the renderer to open on startup
  ipcMain.handle('get-initial-file', () => initialFilePath);
}
