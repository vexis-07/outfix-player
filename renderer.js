// =========================================================
// OutFix Player v1.0 — Frontend
// =========================================================

const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const cancelBtn = document.getElementById('cancel-btn');
const trackRowsContainer = document.getElementById('track-rows');
const formatSelect = document.getElementById('format-select');
const qualitySelect = document.getElementById('quality-select');

const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');

const playBtn = document.getElementById('play-btn');
const heroPlayBtn = document.getElementById('hero-play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');

const mainHeartBtn = document.getElementById('main-heart-btn');
const themeSelector = document.getElementById('theme-selector');

const navAll = document.getElementById('nav-all');
const navFav = document.getElementById('nav-fav');
const navSettings = document.getElementById('nav-settings');

const viewLibrary = document.getElementById('view-library');
const viewSettings = document.getElementById('view-settings');

const pickFolderBtn = document.getElementById('pick-folder-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const saveFolderPath = document.getElementById('save-folder-path');

const playlistModal = document.getElementById('playlist-modal');
const playlistModalTitle = document.getElementById('playlist-modal-title');
const btnCreatePlaylist = document.getElementById('btn-create-playlist');
const closePlaylistModal = document.getElementById('close-playlist-modal');
const savePlaylistBtn = document.getElementById('save-playlist-btn');
const playlistNameInput = document.getElementById('playlist-name-input');
const playlistListContainer = document.getElementById('playlist-list-container');

const lyricsBtn = document.getElementById('lyrics-btn');
const lyricsSidebar = document.getElementById('lyrics-sidebar');
const closeLyricsPanel = document.getElementById('close-lyrics-panel');
const lyricsScrollContainer = document.getElementById('lyrics-scroll-container');

const sliderBg = document.getElementById('slider-bg');
const sliderFill = document.getElementById('slider-fill');
const currTime = document.getElementById('curr-time');
const durTime = document.getElementById('dur-time');

const volumeBg = document.getElementById('volume-bg');
const volumeFill = document.getElementById('volume-fill');
const volumeIcon = document.getElementById('volume-icon');

const videoModal = document.getElementById('video-modal');
const videoPlayer = document.getElementById('video-player');
const closeVideoBtn = document.getElementById('close-video');

const featTitle = document.getElementById('feat-title');
const featSubtitle = document.getElementById('feat-subtitle');
const featImg = document.getElementById('feat-img');

const miniBtn = document.getElementById('mini-btn');
const toastContainer = document.getElementById('toast-container');
const confirmModal = document.getElementById('confirm-modal');
const dropOverlay = document.getElementById('drop-overlay');
const trackContextMenu = document.getElementById('track-context-menu');

let audio = new Audio();
let tracks = [];
let playlists = [];
let activeIndex = -1;
let currentView = 'all';
let currentTab = 'library';

let isShuffle = false;
let isRepeat = false;

let parsedLyrics = [];
let editingPlaylistIndex = -1;
let contextMenuTrackIndex = -1;

// =========================================================
// UI HELPERS
// =========================================================

function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirm(message, onConfirm) {
  if (!confirmModal) { if (confirm(message)) onConfirm(); return; }
  const msgEl = confirmModal.querySelector('#confirm-message');
  const okBtn = confirmModal.querySelector('#confirm-ok');
  const cancelBtn = confirmModal.querySelector('#confirm-cancel');
  if (msgEl) msgEl.textContent = message;
  confirmModal.style.display = 'flex';
  const cleanup = () => { confirmModal.style.display = 'none'; okBtn.onclick = null; cancelBtn.onclick = null; };
  okBtn.onclick = () => { cleanup(); onConfirm(); };
  cancelBtn.onclick = cleanup;
}

// =========================================================
// CONFIG
// =========================================================

const LOCAL_CFG_KEY = 'outfix_ui';

function loadUICfg() {
  try { return JSON.parse(localStorage.getItem(LOCAL_CFG_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveUICfg(cfg) {
  try { localStorage.setItem(LOCAL_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
}

function applyUICfg() {
  const cfg = loadUICfg();
  if (cfg.theme && themeSelector) {
    document.documentElement.setAttribute('data-theme', cfg.theme);
    themeSelector.value = cfg.theme;
  }
  if (cfg.search) searchInput.value = cfg.search;
  if (cfg.sort) sortSelect.value = cfg.sort;
  if (cfg.volume !== undefined) {
    audio.volume = cfg.volume;
    videoPlayer.volume = cfg.volume;
    volumeFill.style.width = `${cfg.volume * 100}%`;
    updateVolumeIcon(cfg.volume);
  }
}

applyUICfg();

// =========================================================
// INIT
// =========================================================

async function init() {
  try {
    const data = await window.api.loadLibrary();
    if (data) {
      tracks = data.tracks || [];
      playlists = data.playlists || [];
    }
    const cfg = await window.api.loadConfig();
    if (cfg && cfg.saveDir && saveFolderPath) {
      saveFolderPath.textContent = cfg.saveDir;
    }
  } catch (e) { console.error(e); }
  renderTracks();
  renderPlaylists();
  if (tracks.length > 0) updateFeaturedCard(tracks[tracks.length - 1]);
}

async function saveLibrary() {
  try {
    await window.api.saveLibrary({ tracks, playlists });
  } catch (e) { console.error(e); }
}

// =========================================================
// TAB NAVIGATION
// =========================================================

function switchTab(tab) {
  currentTab = tab;
  viewLibrary.classList.toggle('active', tab === 'library');
  viewSettings.classList.toggle('active', tab === 'settings');
  resetNavActive();
  if (tab === 'settings') navSettings.classList.add('active');
  else if (currentView === 'fav') navFav.classList.add('active');
  else navAll.classList.add('active');
}

navSettings.addEventListener('click', () => switchTab('settings'));

// =========================================================
// THEME
// =========================================================

if (themeSelector) {
  themeSelector.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    const cfg = loadUICfg();
    cfg.theme = e.target.value;
    saveUICfg(cfg);
  });
}

// =========================================================
// SEARCH + SORT
// =========================================================

searchInput.addEventListener('input', () => {
  renderTracks();
  const cfg = loadUICfg();
  cfg.search = searchInput.value;
  saveUICfg(cfg);
});

sortSelect.addEventListener('change', () => {
  renderTracks();
  const cfg = loadUICfg();
  cfg.sort = sortSelect.value;
  saveUICfg(cfg);
});

function getFilteredAndSorted() {
  let list = [...tracks];
  if (currentView === 'fav') list = list.filter(t => t.isLiked);
  else if (currentView !== 'all') {
    const pl = playlists.find(p => p.name === currentView);
    list = pl ? [...pl.tracks] : [];
  }
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    list = list.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q)
    );
  }
  const s = sortSelect.value;
  if (s === 'title-asc') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (s === 'title-desc') list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  else if (s === 'artist-asc') list.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
  else if (s === 'date-desc') list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  else if (s === 'date-asc') list.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  return list;
}

// =========================================================
// NAV
// =========================================================

navAll.addEventListener('click', () => { currentView = 'all'; switchTab('library'); renderTracks(); });
navFav.addEventListener('click', () => { currentView = 'fav'; switchTab('library'); renderTracks(); });

function resetNavActive() {
  navAll.classList.remove('active');
  navFav.classList.remove('active');
  navSettings.classList.remove('active');
  document.querySelectorAll('#playlist-list-container .nav-item').forEach(el => el.classList.remove('active'));
}

// =========================================================
// SAVE FOLDER
// =========================================================

pickFolderBtn.addEventListener('click', async () => {
  const dir = await window.api.pickSaveFolder();
  if (dir) {
    if (saveFolderPath) saveFolderPath.textContent = dir;
    showToast('Save folder changed', 'success');
  }
});

openFolderBtn.addEventListener('click', () => { window.api.openSaveFolder(); });

// =========================================================
// DOWNLOAD
// =========================================================

fetchBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) { showToast('Please paste a link first!', 'warning'); return; }

  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
  if (cancelBtn) cancelBtn.style.display = 'flex';

  try {
    const res = await window.api.fetchAndDownload(url, formatSelect.value, qualitySelect.value);
    if (res.success) {
      const newTrack = { ...res.track, isLiked: false };
      tracks.push(newTrack);
      await saveLibrary();
      renderTracks();
      urlInput.value = '';
      updateFeaturedCard(newTrack);
      playTrack(tracks.length - 1);
      showToast('Downloaded: ' + newTrack.title, 'success');
    } else {
      showToast('Download failed: ' + (res.error || 'unknown'), 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Download error: ' + err.message, 'error');
  }

  fetchBtn.disabled = false;
  fetchBtn.innerHTML = '<i class="fa-solid fa-download"></i> Fetch';
  if (cancelBtn) cancelBtn.style.display = 'none';
});

if (cancelBtn) {
  cancelBtn.addEventListener('click', async () => {
    const ok = await window.api.cancelDownload();
    if (ok) showToast('Download cancelled', 'warning');
  });
}

window.api.onProgress((d) => {
  if (d && d.percent !== undefined && fetchBtn.disabled) {
    fetchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${Math.round(d.percent)}%`;
  }
});

// =========================================================
// FEATURED CARD
// =========================================================

function updateFeaturedCard(track) {
  if (!track) return;
  if (featTitle) featTitle.textContent = track.title || 'Unknown';
  if (featSubtitle) featSubtitle.textContent = `${track.artist || 'Unknown'} • ${track.ext || 'AUDIO'}`;
  if (featImg) featImg.src = track.cover || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300';
}

// =========================================================
// RENDER TRACKS
// =========================================================

function renderTracks() {
  trackRowsContainer.innerHTML = '';
  const displayTracks = getFilteredAndSorted();

  if (displayTracks.length === 0) {
    const msg = searchInput.value.trim() ? 'No tracks match your search.' : 'No tracks found in this view.';
    trackRowsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--text-muted); font-size:13px;">${msg}</div>`;
    return;
  }

  displayTracks.forEach((track) => {
    const realIndex = tracks.findIndex(t => t.id === track.id);
    if (realIndex < 0) return;

    const row = document.createElement('div');
    row.className = `track-row ${realIndex === activeIndex ? 'active' : ''}`;
    row.innerHTML = `
      <div style="font-size:12px; color:var(--text-muted);">${realIndex + 1}</div>
      <div class="heart-btn ${track.isLiked ? 'liked' : ''}"><i class="${track.isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i></div>
      <div class="track-meta">
        <img src="${track.cover || ''}" alt="" onerror="this.style.display='none'">
        <div>
          <div style="font-size:13px; font-weight:700; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.title}</div>
          <div style="font-size:11px; color:var(--text-muted);">${track.artist}</div>
        </div>
      </div>
      <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.album}</div>
      <div style="font-size:11px; color:var(--accent); font-weight:700;">${track.ext}</div>
      <div class="action-btn add-pl-btn" title="Add to Playlist"><i class="fa-solid fa-plus"></i></div>
      <div class="action-btn delete-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></div>
      <div class="playlist-dropdown"></div>
    `;

    row.querySelector('.heart-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      tracks[realIndex].isLiked = !tracks[realIndex].isLiked;
      saveLibrary(); renderTracks(); updateMainHeart();
    });

    row.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(`Delete "${track.title}"?`, () => removeTrack(realIndex));
    });

    const addPlBtn = row.querySelector('.add-pl-btn');
    const dropdown = row.querySelector('.playlist-dropdown');

    addPlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.playlist-dropdown').forEach(d => d.style.display = 'none');
      if (playlists.length === 0) { showToast('Create a playlist first!', 'warning'); return; }
      dropdown.innerHTML = '';
      playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = pl.name;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!pl.tracks.find(t => t.id === track.id)) {
            pl.tracks.push(track);
            saveLibrary();
            showToast('Added to ' + pl.name, 'success');
          }
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });
      const rect = e.target.getBoundingClientRect();
      dropdown.style.left = (rect.left - 100) + 'px';
      dropdown.style.top = (rect.bottom + 4) + 'px';
      dropdown.style.display = 'flex';
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuTrackIndex = realIndex;
      if (trackContextMenu) {
        trackContextMenu.style.left = e.clientX + 'px';
        trackContextMenu.style.top = e.clientY + 'px';
        trackContextMenu.style.display = 'flex';
      }
    });

    row.addEventListener('click', () => playTrack(realIndex));
    trackRowsContainer.appendChild(row);
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.playlist-dropdown').forEach(d => d.style.display = 'none');
  if (trackContextMenu) trackContextMenu.style.display = 'none';
});

function removeTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  const removed = tracks[index];
  playlists.forEach(pl => { pl.tracks = pl.tracks.filter(t => t.id !== removed.id); });

  if (index === activeIndex) {
    audio.pause(); audio.src = ''; activeIndex = -1; updatePlayUI(false);
  } else if (index < activeIndex) activeIndex--;

  tracks.splice(index, 1);
  saveLibrary(); renderTracks();
  showToast('Track removed', 'info');
}

// =========================================================
// TRACK CONTEXT MENU
// =========================================================

if (trackContextMenu) {
  trackContextMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (contextMenuTrackIndex < 0) return;
      const track = tracks[contextMenuTrackIndex];
      if (!track) return;
      if (action === 'play') playTrack(contextMenuTrackIndex);
      else if (action === 'like') {
        tracks[contextMenuTrackIndex].isLiked = !tracks[contextMenuTrackIndex].isLiked;
        saveLibrary(); renderTracks(); updateMainHeart();
      } else if (action === 'delete') {
        showConfirm(`Delete "${track.title}"?`, () => removeTrack(contextMenuTrackIndex));
      }
      trackContextMenu.style.display = 'none';
    });
  });
}

// =========================================================
// PLAY TRACK
// =========================================================

function playTrack(i) {
  if (i < 0 || i >= tracks.length) return;
  activeIndex = i;
  const track = tracks[i];
  updateFeaturedCard(track);

  if (track.type === 'video') {
    document.getElementById('np-cover').src = track.cover || '';
    document.getElementById('np-title').textContent = track.title;
    document.getElementById('np-artist').textContent = track.artist;
    updateMainHeart(); renderTracks(); openVideoModal(track);
    sendMiniState();
    return;
  }

  audio.src = track.localPath;
  audio.load();
  audio.play().then(() => updatePlayUI(true)).catch(e => console.error(e));

  document.getElementById('np-cover').src = track.cover || '';
  document.getElementById('np-title').textContent = track.title;
  document.getElementById('np-artist').textContent = track.artist;

  updateMainHeart(); renderTracks();
  fetchLyrics(track.artist, track.title);
  sendMiniState();
}

function openVideoModal(track) {
  videoPlayer.src = track.localPath;
  videoPlayer.play().catch(e => console.error(e));
  videoModal.style.display = 'flex';
}

closeVideoBtn.addEventListener('click', () => {
  videoPlayer.pause(); videoPlayer.src = '';
  videoModal.style.display = 'none';
  updatePlayUI(false);
});

function updatePlayUI(isPlaying) {
  if (isPlaying) {
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    heroPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
  } else {
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    heroPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play Song';
  }
  sendMiniState();
}

function togglePlayPause() {
  if (tracks.length === 0) return;
  if (activeIndex === -1) { playTrack(0); return; }
  const track = tracks[activeIndex];
  if (track.type === 'video') {
    if (videoModal.style.display === 'flex') {
      if (videoPlayer.paused) { videoPlayer.play(); updatePlayUI(true); }
      else { videoPlayer.pause(); updatePlayUI(false); }
    } else openVideoModal(track);
    return;
  }
  if (audio.paused) { audio.play(); updatePlayUI(true); }
  else { audio.pause(); updatePlayUI(false); }
}

playBtn.addEventListener('click', togglePlayPause);
heroPlayBtn.addEventListener('click', togglePlayPause);

function handleNextTrack() {
  if (tracks.length === 0) return;
  if (isShuffle && tracks.length > 1) {
    let r = Math.floor(Math.random() * tracks.length);
    while (r === activeIndex) r = Math.floor(Math.random() * tracks.length);
    playTrack(r);
  } else {
    if (activeIndex < tracks.length - 1) playTrack(activeIndex + 1);
    else playTrack(0);
  }
}

function handlePrevTrack() {
  if (tracks.length === 0) return;
  if (audio.currentTime > 3) audio.currentTime = 0;
  else {
    if (activeIndex > 0) playTrack(activeIndex - 1);
    else playTrack(tracks.length - 1);
  }
}

nextBtn.addEventListener('click', handleNextTrack);
prevBtn.addEventListener('click', handlePrevTrack);

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active-toggle', isShuffle);
});

repeatBtn.addEventListener('click', () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle('active-toggle', isRepeat);
});

audio.addEventListener('ended', () => {
  if (isRepeat) { audio.currentTime = 0; audio.play(); }
  else handleNextTrack();
});

// =========================================================
// MINI PLAYER
// =========================================================

function sendMiniState() {
  if (activeIndex < 0 || activeIndex >= tracks.length) return;
  const t = tracks[activeIndex];
  window.api.sendMiniState({
    title: t.title,
    artist: t.artist,
    cover: t.cover,
    playing: t.type === 'video' ? !videoPlayer.paused : !audio.paused,
  });
}

if (miniBtn) miniBtn.addEventListener('click', () => window.api.openMini());

window.api.onMiniCommand((cmd) => {
  if (cmd === 'prev') handlePrevTrack();
  else if (cmd === 'next') handleNextTrack();
  else if (cmd === 'toggle') togglePlayPause();
});

// =========================================================
// KEYBOARD SHORTCUTS
// =========================================================

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.code === 'Escape') e.target.blur();
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); handleNextTrack(); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); handlePrevTrack(); }
  else if (e.code === 'ArrowUp') {
    e.preventDefault();
    const v = Math.min(1, audio.volume + 0.05);
    audio.volume = v; videoPlayer.volume = v;
    volumeFill.style.width = `${v * 100}%`; updateVolumeIcon(v);
    const cfg = loadUICfg(); cfg.volume = v; saveUICfg(cfg);
  }
  else if (e.code === 'ArrowDown') {
    e.preventDefault();
    const v = Math.max(0, audio.volume - 0.05);
    audio.volume = v; videoPlayer.volume = v;
    volumeFill.style.width = `${v * 100}%`; updateVolumeIcon(v);
    const cfg = loadUICfg(); cfg.volume = v; saveUICfg(cfg);
  }
  else if (e.code === 'KeyF' && e.ctrlKey) { e.preventDefault(); switchTab('library'); searchInput.focus(); }
  else if (e.code === 'KeyL' && e.ctrlKey) { e.preventDefault(); lyricsBtn.click(); }
  else if (e.code === 'KeyN' && e.ctrlKey) { e.preventDefault(); btnCreatePlaylist.click(); }
  else if (e.code === 'KeyM' && e.ctrlKey) { e.preventDefault(); audio.muted = !audio.muted; videoPlayer.muted = audio.muted; }
  else if (e.code === 'KeyS' && e.ctrlKey) { e.preventDefault(); switchTab('settings'); }
  else if (e.code === 'Escape') {
    if (videoModal.style.display === 'flex') closeVideoBtn.click();
    else if (playlistModal.style.display === 'flex') closePlaylistModal.click();
    else if (lyricsSidebar.style.display === 'flex') closeLyricsPanel.click();
    else if (confirmModal && confirmModal.style.display === 'flex') confirmModal.querySelector('#confirm-cancel').click();
  }
});

// =========================================================
// LYRICS
// =========================================================

lyricsBtn.addEventListener('click', () => {
  const isVisible = lyricsSidebar.style.display === 'flex';
  lyricsSidebar.style.display = isVisible ? 'none' : 'flex';
  lyricsBtn.classList.toggle('active-toggle', !isVisible);
});

closeLyricsPanel.addEventListener('click', () => {
  lyricsSidebar.style.display = 'none';
  lyricsBtn.classList.remove('active-toggle');
});

async function fetchLyrics(artist, title) {
  lyricsScrollContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; margin-top:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching...</div>';
  parsedLyrics = [];
  try {
    const res = await window.api.fetchLyrics(artist, title);
    const data = res.data;
    if (res.success && data && data.syncedLyrics) {
      parseLRC(data.syncedLyrics);
      renderSyncedLyrics();
    } else if (res.success && data && data.plainLyrics) {
      lyricsScrollContainer.innerHTML = `<div style="font-size:14px; line-height:1.8; color:var(--text-muted); white-space:pre-wrap;">${data.plainLyrics}</div>`;
    } else {
      lyricsScrollContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; margin-top:40px;">No lyrics found for this track.</div>';
    }
  } catch (err) {
    console.error('lyrics error:', err);
    lyricsScrollContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; margin-top:40px;">Unable to load lyrics.</div>';
  }
}

function parseLRC(lrcText) {
  parsedLyrics = [];
  const lines = lrcText.split('\n');
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  lines.forEach(line => {
    const m = line.match(regex);
    if (m) {
      const t = parseInt(m[1]) * 60 + parseInt(m[2]) + (parseInt(m[3]) > 99 ? parseInt(m[3]) / 1000 : parseInt(m[3]) / 100);
      const text = m[4].trim();
      if (text) parsedLyrics.push({ time: t, text });
    }
  });
}

function renderSyncedLyrics() {
  lyricsScrollContainer.innerHTML = '';
  parsedLyrics.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    div.id = `lyric-line-${index}`;
    div.textContent = item.text;
    div.addEventListener('click', () => { audio.currentTime = item.time; });
    lyricsScrollContainer.appendChild(div);
  });
}

audio.addEventListener('timeupdate', () => {
  if (parsedLyrics.length === 0) return;
  const curTime = audio.currentTime;
  let activeIdx = -1;
  for (let i = 0; i < parsedLyrics.length; i++) {
    if (curTime >= parsedLyrics[i].time) activeIdx = i;
    else break;
  }
  if (activeIdx !== -1) {
    document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
    const currentLine = document.getElementById(`lyric-line-${activeIdx}`);
    if (currentLine) {
      currentLine.classList.add('active');
      currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

// =========================================================
// HEART
// =========================================================

function updateMainHeart() {
  if (activeIndex >= 0 && activeIndex < tracks.length) {
    const isLiked = tracks[activeIndex].isLiked;
    mainHeartBtn.className = `heart-btn ${isLiked ? 'liked' : ''}`;
    mainHeartBtn.innerHTML = `<i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
  }
}

mainHeartBtn.addEventListener('click', () => {
  if (activeIndex >= 0 && activeIndex < tracks.length) {
    tracks[activeIndex].isLiked = !tracks[activeIndex].isLiked;
    saveLibrary(); updateMainHeart(); renderTracks();
  }
});

// =========================================================
// PLAYLISTS
// =========================================================

btnCreatePlaylist.addEventListener('click', () => {
  editingPlaylistIndex = -1;
  playlistModalTitle.textContent = 'Create New Playlist';
  savePlaylistBtn.textContent = 'Create Playlist';
  playlistModal.style.display = 'flex';
  playlistNameInput.value = '';
  playlistNameInput.focus();
});

closePlaylistModal.addEventListener('click', () => playlistModal.style.display = 'none');

savePlaylistBtn.addEventListener('click', () => {
  const name = playlistNameInput.value.trim();
  if (!name) return;
  if (editingPlaylistIndex >= 0) {
    playlists[editingPlaylistIndex].name = name;
    if (currentView !== 'all' && currentView !== 'fav') currentView = name;
  } else {
    playlists.push({ name, tracks: [] });
  }
  saveLibrary(); renderPlaylists(); renderTracks();
  playlistModal.style.display = 'none';
});

function renderPlaylists() {
  playlistListContainer.innerHTML = '';
  playlists.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.innerHTML = `<i class="fa-solid fa-list-ul"></i> ${p.name}`;
    item.addEventListener('click', () => {
      currentView = p.name;
      switchTab('library');
      resetNavActive();
      item.classList.add('active');
      renderTracks();
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const menu = document.createElement('div');
      menu.className = 'playlist-dropdown';
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      const rename = document.createElement('div');
      rename.className = 'dropdown-item';
      rename.textContent = '✏️ Rename';
      rename.addEventListener('click', () => {
        editingPlaylistIndex = idx;
        playlistModalTitle.textContent = 'Rename Playlist';
        savePlaylistBtn.textContent = 'Rename';
        playlistNameInput.value = p.name;
        playlistModal.style.display = 'flex';
        playlistNameInput.focus();
        menu.remove();
      });

      const del = document.createElement('div');
      del.className = 'dropdown-item';
      del.textContent = '🗑️ Delete';
      del.style.color = 'var(--danger)';
      del.addEventListener('click', () => {
        showConfirm(`Delete playlist "${p.name}"?`, () => {
          playlists.splice(idx, 1);
          if (currentView === p.name) { currentView = 'all'; resetNavActive(); navAll.classList.add('active'); }
          saveLibrary(); renderPlaylists(); renderTracks();
        });
        menu.remove();
      });

      menu.appendChild(rename);
      menu.appendChild(del);
      document.body.appendChild(menu);
      setTimeout(() => { document.addEventListener('click', () => menu.remove(), { once: true }); }, 0);
    });
    playlistListContainer.appendChild(item);
  });
}

// =========================================================
// SLIDERS
// =========================================================

function setupDraggableSlider(sliderEl, onDrag) {
  const handleDrag = (e) => {
    const rect = sliderEl.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onDrag(pos);
  };
  sliderEl.addEventListener('mousedown', (e) => {
    sliderEl.classList.add('dragging');
    handleDrag(e);
    const onMove = (e) => handleDrag(e);
    const onUp = () => {
      sliderEl.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

setupDraggableSlider(sliderBg, (pos) => {
  if (audio.duration) {
    audio.currentTime = pos * audio.duration;
    sliderFill.style.width = `${pos * 100}%`;
  }
});

audio.addEventListener('timeupdate', () => {
  if (audio.duration && !sliderBg.classList.contains('dragging')) {
    const pct = (audio.currentTime / audio.duration) * 100;
    sliderFill.style.width = `${pct}%`;
    currTime.textContent = formatTime(audio.currentTime);
    durTime.textContent = formatTime(audio.duration);
  }
});

function updateVolumeIcon(v) {
  if (v === 0) volumeIcon.className = 'fa-solid fa-volume-xmark';
  else if (v < 0.5) volumeIcon.className = 'fa-solid fa-volume-low';
  else volumeIcon.className = 'fa-solid fa-volume-high';
}

setupDraggableSlider(volumeBg, (pos) => {
  audio.volume = pos;
  videoPlayer.volume = pos;
  volumeFill.style.width = `${pos * 100}%`;
  updateVolumeIcon(pos);
  const cfg = loadUICfg(); cfg.volume = pos; saveUICfg(cfg);
});

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// =========================================================
// DRAG & DROP — FIXED (webUtils)
// =========================================================

let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (dropOverlay && e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
    dropOverlay.style.display = 'flex';
  }
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    if (dropOverlay) dropOverlay.style.display = 'none';
  }
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dropOverlay) dropOverlay.style.display = 'none';

  const files = Array.from(e.dataTransfer.files || []);
  if (files.length === 0) return;

  let added = 0;
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const audioExts = ['mp3', 'm4a', 'opus', 'wav', 'flac', 'ogg', 'aac'];
    const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi'];
    if (!audioExts.includes(ext) && !videoExts.includes(ext)) continue;

    const isVideo = videoExts.includes(ext);

    // ✅ FIX: sta3mel webUtils bach tjib path
    let filePath = null;
    try {
      filePath = window.api.getPathForFile(f);
    } catch (err) {
      console.error('getPathForFile error:', err);
    }

    // Fallback ila webUtils ma khdemch
    if (!filePath && f.path) filePath = f.path;

    if (!filePath) {
      console.warn('[drop] No path for file:', f.name);
      continue;
    }

    tracks.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title: f.name.replace(/\.[^.]+$/, ''),
      artist: 'Local file',
      album: 'Local',
      cover: '',
      duration: 0,
      localPath: 'file://' + filePath.replace(/\\/g, '/'),
      path: filePath,
      ext: ext.toUpperCase(),
      type: isVideo ? 'video' : 'audio',
      isLiked: false,
    });
    added++;
  }

  if (added > 0) {
    await saveLibrary();
    renderTracks();
    showToast(`${added} track(s) added`, 'success');
  } else {
    showToast('No valid audio/video files', 'warning');
  }
});

// =========================================================
// BIN STATUS
// =========================================================

window.api.onBinStatus((d) => {
  if (d.status === 'ready') showToast('Tools ready', 'success');
  else if (d.status === 'error') showToast('Tools error: ' + d.message, 'error');
});

// =========================================================
// INIT
// =========================================================

init();