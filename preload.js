const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // CONFIG
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  // FOLDER
  pickSaveFolder: () => ipcRenderer.invoke('folder:pick-save'),
  openSaveFolder: () => ipcRenderer.invoke('folder:open-save'),

  // LIBRARY
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (data) => ipcRenderer.invoke('library:save', data),

  // FILES
  pickFiles: () => ipcRenderer.invoke('files:pick'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // ✅ DRAG & DROP FIX
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return null;
    }
  },

  // DOWNLOAD
  fetchAndDownload: (url, format, quality) =>
    ipcRenderer.invoke('fetch-and-download', { url, format, quality }),
  cancelDownload: () => ipcRenderer.invoke('download:cancel'),
  onProgress: (cb) => ipcRenderer.on('download-progress', (_, d) => cb(d)),

  // LYRICS
  fetchLyrics: (artist, title) => ipcRenderer.invoke('lyrics:fetch', { artist, title }),

  // MINI PLAYER
  openMini: () => ipcRenderer.invoke('mini:open'),
  closeMini: () => ipcRenderer.invoke('mini:close'),
  sendMiniState: (data) => ipcRenderer.send('mini:state', data),
  onMiniCommand: (cb) => ipcRenderer.on('mini:command', (_, cmd) => cb(cmd)),
  onMiniUpdate: (cb) => ipcRenderer.on('mini:update', (_, data) => cb(data)),

  // BIN STATUS
  onBinStatus: (cb) => ipcRenderer.on('bin-status', (_, d) => cb(d)),
});