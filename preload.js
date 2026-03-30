const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', { filePath, content }),
    showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
    showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
    copyImage: (sourcePath) => ipcRenderer.invoke('copy-image', sourcePath),
    getFilePath: (file) => webUtils.getPathForFile(file),
    windowControl: (command) => ipcRenderer.send('window-control', command),
    confirmClose: () => ipcRenderer.send('confirm-close'),
    onRequestClose: (callback) => ipcRenderer.on('request-close', callback),
    storeGet: (key) => ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
    addRecentFile: (fileObj) => ipcRenderer.invoke('add-recent-file', fileObj),
    addFavorite: (fileObj) => ipcRenderer.invoke('add-favorite', fileObj),
    removeFavorite: (filePath) => ipcRenderer.invoke('remove-favorite', filePath),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    resolvePath: (basePath, relativePath) => ipcRenderer.invoke('resolve-path', basePath, relativePath),
    showFolderDialog: (defaultPath) => ipcRenderer.invoke('show-folder-dialog', defaultPath),
    scanDirectoryMd: (dirPath) => ipcRenderer.invoke('scan-directory-md', dirPath),
    exportPdf: (htmlContent) => ipcRenderer.invoke('export-pdf', htmlContent),
    exportHtml: (htmlContent) => ipcRenderer.invoke('export-html', htmlContent),
    printDocument: () => ipcRenderer.invoke('print-document'),
    newWindow: () => ipcRenderer.invoke('new-window'),
    getInitialFile: () => ipcRenderer.invoke('get-initial-file')
});

