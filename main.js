const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const https = require('https');
const http = require('http');
const mm = require('music-metadata');

// ⚠️ MOUHIM: setName 9bel whenReady
app.setName('OutFix Player');
app.setAppUserModelId('com.vexix.outfix');

let mainWindow;
let miniWindow = null;
let currentDownloadProc = null;   // ← #4 Download cancel

const BIN_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'bin')
  : path.join(__dirname, 'bin');

const YTDLP = path.join(BIN_DIR, 'yt-dlp.exe');
const FFMPEG_DIR = BIN_DIR;
const FFMPEG = path.join(BIN_DIR, 'ffmpeg.exe');
const DEFAULT_DIR = path.join(app.getPath('music'), 'OutFix Player');
const LIB_PATH = path.join(app.getPath('userData'), 'outfix_library.json');
const CFG_PATH = path.join(app.getPath('userData'), 'outfix_config.json');

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

const ICON_PATH = path.join(__dirname, 'logo.png');

function log(...args) {
  console.log('[OutFix]', ...args);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    title: 'OutFix Player',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      // ⚠️ SECURITY FIX #1: preload + contextIsolation
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      partition: 'persist:outfix',
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    log('=== OutFix Player started ===');
    log('UserData path:', app.getPath('userData'));
    log('Library path:', LIB_PATH);
    log('Config path:', CFG_PATH);
    log('Bin path:', BIN_DIR);
    log('Save dir:', loadConfig().saveDir);
    ensureBinFolder();
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// =========================================================
// MINI PLAYER WINDOW (#3)
// =========================================================

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }
  miniWindow = new BrowserWindow({
    width: 340,
    height: 120,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#0e0e12',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  miniWindow.loadFile(path.join(__dirname, 'mini.html'));
  miniWindow.on('closed', () => { miniWindow = null; });
}

function broadcastMiniUpdate(data) {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('mini:update', data);
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'OutFix Player',
      applicationVersion: '1.0.0',
      copyright: '© 2025 vexix-07',
      authors: ['vexix-07'],
      website: 'https://github.com/vexix-07',
      iconPath: ICON_PATH,
    });
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// =========================================================
// AUTO-DOWNLOAD BIN
// =========================================================

async function ensureBinFolder() {
  try {
    if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

    const ytdlpOk = fs.existsSync(YTDLP);
    const ffmpegOk = fs.existsSync(FFMPEG);

    if (ytdlpOk && ffmpegOk) {
      log('[bin] already installed');
      sendBinStatus('ready', 'Tools ready');
      return;
    }

    log('[bin] missing tools, downloading...');
    sendBinStatus('downloading', 'Installing yt-dlp & ffmpeg (first run)...');

    if (!ytdlpOk) {
      sendBinStatus('progress', 'Downloading yt-dlp...');
      await downloadFile(YTDLP_URL, YTDLP);
      log('[bin] yt-dlp downloaded');
    }

    if (!ffmpegOk) {
      sendBinStatus('progress', 'Downloading ffmpeg (~80 MB)...');
      const zipPath = path.join(BIN_DIR, 'ffmpeg.zip');
      await downloadFile(FFMPEG_URL, zipPath);

      sendBinStatus('progress', 'Extracting ffmpeg...');

      try {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`, { stdio: 'ignore' });
      } catch (e) {
        log('extract error:', e.message);
      }

      const entries = fs.readdirSync(BIN_DIR);
      for (const entry of entries) {
        const full = path.join(BIN_DIR, entry);
        if (fs.statSync(full).isDirectory() && entry.startsWith('ffmpeg-')) {
          const subBin = path.join(full, 'bin');
          if (fs.existsSync(subBin)) {
            for (const f of fs.readdirSync(subBin)) {
              fs.copyFileSync(path.join(subBin, f), path.join(BIN_DIR, f));
            }
          }
          try { fs.rmSync(full, { recursive: true, force: true }); } catch (e) {}
        }
      }

      try { fs.unlinkSync(zipPath); } catch (e) {}
      log('[bin] ffmpeg extracted');
    }

    sendBinStatus('ready', 'Tools installed');
  } catch (e) {
    log('ensureBinFolder error:', e.message);
    sendBinStatus('error', 'Failed: ' + e.message);
  }
}

function sendBinStatus(status, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bin-status', { status, message });
  }
}

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));

    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'OutFixPlayer/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(() => resolve(dest)); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

// =========================================================
// COVER EXTRACTION
// =========================================================

async function extractMetadata(filePath) {
  const result = { title: null, artist: null, album: null, duration: 0, cover: '' };

  try {
    const metadata = await mm.parseFile(filePath, { duration: true });

    if (metadata.common.title) result.title = metadata.common.title;
    if (metadata.common.artist) result.artist = metadata.common.artist;
    if (metadata.common.album) result.album = metadata.common.album;
    if (metadata.format.duration) result.duration = metadata.format.duration;

    const pic = metadata.common.picture && metadata.common.picture[0];
    if (pic) {
      const b64 = pic.data.toString('base64');
      result.cover = `data:${pic.format};base64,${b64}`;
      log('[cover] extracted', result.cover.length, 'bytes from', path.basename(filePath));
    } else {
      log('[cover] no picture in metadata:', path.basename(filePath));
    }
  } catch (e) {
    log('[cover] metadata error:', e.message);
  }

  return result;
}

// =========================================================
// CONFIG
// =========================================================

function loadConfig() {
  try {
    if (fs.existsSync(CFG_PATH)) {
      const data = fs.readFileSync(CFG_PATH, 'utf-8');
      log('config loaded:', data);
      return JSON.parse(data);
    }
  } catch (e) {
    log('config load error:', e.message);
  }
  return { saveDir: DEFAULT_DIR };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
    log('config saved:', JSON.stringify(cfg));
  } catch (e) {
    log('config save error:', e.message);
  }
}

ipcMain.handle('config:load', () => loadConfig());
ipcMain.handle('config:save', (_, cfg) => { saveConfig(cfg); return true; });

ipcMain.handle('folder:pick-save', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const cfg = loadConfig();
  cfg.saveDir = result.filePaths[0];
  saveConfig(cfg);
  return cfg.saveDir;
});

ipcMain.handle('folder:open-save', () => {
  const cfg = loadConfig();
  if (fs.existsSync(cfg.saveDir)) shell.openPath(cfg.saveDir);
});

// =========================================================
// LIBRARY
// =========================================================

ipcMain.handle('library:load', () => {
  try {
    if (fs.existsSync(LIB_PATH)) {
      const data = fs.readFileSync(LIB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      log('library loaded:', parsed.tracks ? parsed.tracks.length : 0, 'tracks');
      return parsed;
    }
    log('library file not found:', LIB_PATH);
  } catch (e) {
    log('library load error:', e.message);
  }
  return { tracks: [], playlists: [] };
});

ipcMain.handle('library:save', (_, data) => {
  try {
    fs.writeFileSync(LIB_PATH, JSON.stringify(data, null, 2));
    log('library saved:', data.tracks ? data.tracks.length : 0, 'tracks');
    return true;
  } catch (e) {
    log('library save error:', e.message);
    return false;
  }
});

// =========================================================
// FILE PICKER
// =========================================================

ipcMain.handle('files:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'm4a', 'opus', 'wav', 'flac', 'ogg', 'aac'] },
      { name: 'Video', extensions: ['mp4', 'webm', 'mkv', 'mov', 'avi'] },
      { name: 'All', extensions: ['*'] },
    ],
  });
  if (result.canceled) return [];

  const tracks = [];
  for (const f of result.filePaths) {
    const baseName = path.basename(f);
    const ext = path.extname(f).slice(1).toLowerCase();
    let title = baseName.replace(/\.[^.]+$/, '');
    let artist = 'Local file';
    let album = 'Local';
    let duration = 0;
    let cover = '';

    try {
      const meta = await extractMetadata(f);
      if (meta.title) title = meta.title;
      if (meta.artist) artist = meta.artist;
      if (meta.album) album = meta.album;
      if (meta.duration) duration = meta.duration;
      if (meta.cover) cover = meta.cover;
    } catch (e) {
      log('metadata error:', e.message);
    }

    const isVideo = ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);
    tracks.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title, artist, album, cover, duration,
      localPath: 'file://' + f.replace(/\\/g, '/'),
      path: f, ext: ext.toUpperCase(),
      type: isVideo ? 'video' : 'audio',
      isLiked: false,
    });
  }
  return tracks;
});

// =========================================================
// DOWNLOAD
// =========================================================

ipcMain.handle('fetch-and-download', async (event, { url, format, quality }) => {
  return new Promise((resolve) => {
    const cfg = loadConfig();
    const SAVE_DIR = cfg.saveDir || DEFAULT_DIR;
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

    if (!fs.existsSync(YTDLP)) {
      resolve({ success: false, error: 'yt-dlp.exe ma kaynch. 3awd run app.' });
      return;
    }

    format = format || 'mp3';
    quality = quality || '192';

    let args;
    const outTemplate = path.join(SAVE_DIR, '%(title)s.%(ext)s');

    if (format === 'mp3') {
      args = ['-x', '--audio-format', 'mp3', '--audio-quality', quality + 'K',
        '--embed-thumbnail', '--add-metadata',
        '-o', outTemplate, '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    } else if (format === 'm4a') {
      args = ['-x', '--audio-format', 'm4a', '--audio-quality', quality + 'K',
        '--embed-thumbnail', '--add-metadata',
        '-o', outTemplate, '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    } else if (format === 'flac') {
      args = ['-x', '--audio-format', 'flac',
        '--embed-thumbnail', '--add-metadata',
        '-o', outTemplate, '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    } else if (format === 'mp4') {
      const h = quality === '1080' ? 1080 : quality === '720' ? 720 : 480;
      args = ['-f', `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/best`,
        '--merge-output-format', 'mp4',
        '-o', outTemplate, '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    } else if (format === 'webm') {
      args = ['-f', 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best',
        '-o', outTemplate, '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    } else {
      args = ['-f', 'best', '-o', outTemplate,
        '--ffmpeg-location', FFMPEG_DIR,
        '--newline', '--no-playlist', url];
    }

    const proc = spawn(YTDLP, args, { windowsHide: true });
    currentDownloadProc = proc;   // ← #4
    let lastFile = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const dest = line.match(/\[download\] Destination: (.+)/);
        if (dest) lastFile = dest[1].trim();
        const already = line.match(/\[download\] (.+) has already been downloaded/);
        if (already) lastFile = already[1].trim();
        const extract = line.match(/\[ExtractAudio\] Destination: (.+)/);
        if (extract) lastFile = extract[1].trim();
        const merge = line.match(/\[Merger\] Merging formats into "(.+)"/);
        if (merge) lastFile = merge[1].trim();
        const pct = line.match(/\[download\]\s+([\d.]+)%/);
        if (pct) event.sender.send('download-progress', { percent: parseFloat(pct[1]) });
      }
    });

    proc.stderr.on('data', (d) => stderr += d.toString());

    proc.on('close', async (code) => {
      currentDownloadProc = null;
      if (code === 0 && lastFile && fs.existsSync(lastFile)) {
        const baseName = path.basename(lastFile);
        const ext = path.extname(lastFile).slice(1).toLowerCase();
        let title = baseName.replace(/\.[^.]+$/, '');
        const isVideo = ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);
        const sizeMB = (fs.statSync(lastFile).size / 1024 / 1024).toFixed(1);

        let artist = 'YouTube';
        let album = 'OutFix Library';
        let duration = 0;
        let cover = '';

        try {
          const meta = await extractMetadata(lastFile);
          if (meta.title) title = meta.title;
          if (meta.artist) artist = meta.artist;
          if (meta.album) album = meta.album;
          if (meta.duration) duration = meta.duration;
          if (meta.cover) cover = meta.cover;
        } catch (e) {
          log('metadata error:', e.message);
        }

        resolve({
          success: true,
          track: {
            id: Date.now().toString(),
            title, artist, album,
            cover: cover || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500',
            duration,
            localPath: 'file://' + lastFile.replace(/\\/g, '/'),
            path: lastFile,
            ext: ext.toUpperCase(),
            type: isVideo ? 'video' : 'audio',
            size: sizeMB + ' MB',
            isLiked: false,
          }
        });
      } else {
        resolve({ success: false, error: stderr || `exit ${code}` });
      }
    });

    proc.on('error', (e) => { currentDownloadProc = null; resolve({ success: false, error: e.message }); });
  });
});

// #4 Cancel download
ipcMain.handle('download:cancel', () => {
  if (currentDownloadProc) {
    try {
      currentDownloadProc.kill('SIGKILL');
      currentDownloadProc = null;
      log('[download] cancelled by user');
      return true;
    } catch (e) {
      log('[download] cancel error:', e.message);
      return false;
    }
  }
  return false;
});

// =========================================================
// MINI PLAYER IPC (#3)
// =========================================================

ipcMain.handle('mini:open', () => { createMiniWindow(); return true; });
ipcMain.handle('mini:close', () => {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
  return true;
});
ipcMain.on('mini:command', (_, cmd) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini:command', cmd);
  }
});
ipcMain.on('mini:state', (_, data) => {
  broadcastMiniUpdate(data);
});

// =========================================================
// READ FILE
// =========================================================

ipcMain.handle('file:read', (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath);
    const b64 = data.toString('base64');
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = {
      mp3: 'audio/mpeg', m4a: 'audio/mp4', opus: 'audio/opus',
      wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', aac: 'audio/aac',
      mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
      mov: 'video/quicktime', avi: 'video/x-msvideo',
    }[ext] || 'application/octet-stream';
    return 'data:' + mime + ';base64,' + b64;
  } catch (e) { return null; }
});

// =========================================================
// LYRICS
// =========================================================

ipcMain.handle('lyrics:fetch', async (_, { artist, title }) => {
  return new Promise((resolve) => {
    const cleanTitle = (title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
    const cleanArtist = (artist || '').replace(/\(.*\)|\[.*\]/g, '').trim();
    const urlExact = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;

    https.get(urlExact, { headers: { 'User-Agent': 'OutFixPlayer/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && (parsed.syncedLyrics || parsed.plainLyrics)) {
            resolve({ success: true, data: parsed });
            return;
          }
          resolveFallback(cleanArtist, cleanTitle, resolve);
        } catch (e) {
          resolveFallback(cleanArtist, cleanTitle, resolve);
        }
      });
    }).on('error', () => {
      resolve({ success: false, error: 'network error' });
    });
  });
});

function resolveFallback(artist, title, resolve) {
  const urlSearch = `https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`;
  https.get(urlSearch, { headers: { 'User-Agent': 'OutFixPlayer/1.0' } }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const arr = JSON.parse(data);
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr.find(x => x.syncedLyrics || x.plainLyrics) || arr[0];
          resolve({ success: true, data: first });
        } else {
          resolve({ success: false, error: 'no lyrics found' });
        }
      } catch (e) {
        resolve({ success: false, error: 'parse error' });
      }
    });
  }).on('error', () => {
    resolve({ success: false, error: 'network error' });
  });
}