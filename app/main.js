const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let win;
let dataRoot;      // all app data: config + one folder per region
let regionDir;     // the region pack being shown (built-in or a folder the user opened)
let region;        // its region.json
let dataDir;       // where this region's areas / contacts are saved
let backupDir;
let lastBackupAt = 0;

const STORE_FILE = () => path.join(dataDir, 'store.json');
const CONFIG_FILE = () => path.join(dataRoot, 'config.json');
const EMPTY_STORE = () => ({ version: 1, areas: [], sah: {}, updated: null });
const BUILTIN = () => path.join(app.getAppPath(), 'regions');
const titleOf = r => (r && r.name ? `${r.name}${r.number ? ' ' + r.number : ''} · Sanyojak Map` : 'Sanyojak Map');

if (process.env.CHUNAV_DATA_DIR) app.setPath('userData', path.join(process.env.CHUNAV_DATA_DIR, '_profile'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const forced = (process.env.CHUNAV_WIN || '').split('x').map(Number);
  const W = forced[0] || Math.min(1500, wa.width), H = forced[1] || Math.min(920, wa.height);
  win = new BrowserWindow({
    width: W,
    height: H,
    minWidth: Math.min(1000, wa.width),
    minHeight: Math.min(620, wa.height),
    show: false,
    backgroundColor: '#1d1f1a',
    title: titleOf(region),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    if (!forced[0] && (wa.width < 1600 || wa.height < 950)) win.maximize();
    win.show();
  });
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());

  const SHOT = process.env.CHUNAV_SHOT;
  if (SHOT) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    win.webContents.on('console-message', (_e, level, msg, line) => console.log(`[renderer ${level}] ${msg} (line ${line})`));
    win.webContents.once('did-finish-load', async () => {
      await wait(3500);
      if (process.env.CHUNAV_SCRIPT) {
        try {
          const r = await win.webContents.executeJavaScript(fs.readFileSync(process.env.CHUNAV_SCRIPT, 'utf8'));
          console.log('SCRIPT_RESULT', JSON.stringify(r));
        } catch (e) { console.log('SCRIPT_ERROR', e.message); }
        await wait(2500);
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(SHOT, img.toPNG());
      app.quit();
    });
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const isRegion = dir => !!dir && fs.existsSync(path.join(dir, 'region.json')) && fs.existsSync(path.join(dir, 'panchayats.json'));
function builtinRegions() {
  try {
    return fs.readdirSync(BUILTIN(), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(BUILTIN(), d.name)).filter(isRegion)
      .map(dir => { const r = readJson(path.join(dir, 'region.json'), {}); return { dir, id: r.id || path.basename(dir), name: r.name || path.basename(dir), number: r.number || '' }; });
  } catch { return []; }
}

/* Pick the region: CHUNAV_REGION env, then the last one used, then the first built-in pack. */
function loadRegion() {
  const cfg = readJson(CONFIG_FILE(), {});
  const env = process.env.CHUNAV_REGION;
  const cands = [env && (isRegion(env) ? env : path.join(BUILTIN(), env)), cfg.regionDir, ...builtinRegions().map(r => r.dir)];
  regionDir = cands.find(isRegion) || null;
  region = regionDir ? readJson(path.join(regionDir, 'region.json'), {}) : null;
  const id = String((region && region.id) || (regionDir ? path.basename(regionDir) : 'none')).replace(/[^\w.-]+/g, '_');
  dataDir = path.join(dataRoot, 'regions', id);
  backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  lastBackupAt = 0;
}

function useRegion(dir) {
  if (!isRegion(dir)) throw new Error('This folder has no region.json and panchayats.json. Build one with analysis/build_region.py.');
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify({ ...readJson(CONFIG_FILE(), {}), regionDir: dir }, null, 1));
  loadRegion();
  win.setTitle(titleOf(region));
  win.webContents.reload();
  return true;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  dataRoot = process.env.CHUNAV_DATA_DIR || path.join(app.getPath('appData'), 'chunav_toolkit_data');
  fs.mkdirSync(dataRoot, { recursive: true });
  loadRegion();
  createWindow();
});

app.on('window-all-closed', () => app.quit());

function snapshot(reason) {
  const f = STORE_FILE();
  if (!fs.existsSync(f)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(f, path.join(backupDir, `store-${stamp}${reason ? '-' + reason : ''}.json`));
  const all = fs.readdirSync(backupDir).filter(n => n.startsWith('store-')).sort();
  while (all.length > 40) fs.unlinkSync(path.join(backupDir, all.shift()));
  lastBackupAt = Date.now();
}

ipcMain.handle('data:load', () => {
  const dir = regionDir;
  return {
    region: region || {},
    regionDir: dir,
    regions: builtinRegions(),
    panchayats: dir ? readJson(path.join(dir, 'panchayats.json'), []) : [],
    basemap: dir ? readJson(path.join(dir, 'basemap.json'), {}) : {},
    history: dir ? readJson(path.join(dir, 'history.json'), {}) : {}
  };
});

ipcMain.handle('region:use', (_e, dir) => useRegion(dir));
ipcMain.handle('region:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open a region folder (with region.json and panchayats.json)', properties: ['openDirectory'] });
  if (r.canceled) return false;
  return useRegion(r.filePaths[0]);
});
ipcMain.handle('region:openFolder', () => regionDir && shell.openPath(regionDir));
ipcMain.handle('region:saveJson', (_e, obj) => {
  if (!regionDir || !obj || typeof obj !== 'object') throw new Error('No region loaded');
  if (app.isPackaged && regionDir.startsWith(BUILTIN())) throw new Error('Built-in regions are read-only. Copy the folder and open the copy.');
  const f = path.join(regionDir, 'region.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(obj, null, 1), 'utf8');
  fs.renameSync(f + '.tmp', f);
  region = obj;
  return true;
});

ipcMain.handle('store:load', () => {
  const store = readJson(STORE_FILE(), null);
  if (!store) return EMPTY_STORE();
  if (!lastBackupAt) snapshot('start');
  return store;
});

ipcMain.handle('store:save', (_e, store) => {
  if (!store || !Array.isArray(store.areas) || typeof store.sah !== 'object') throw new Error('Invalid data');
  if (Date.now() - lastBackupAt > 5 * 60 * 1000) snapshot();
  store.updated = new Date().toISOString();
  const tmp = STORE_FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1), 'utf8');
  fs.renameSync(tmp, STORE_FILE());
  return { ok: true, updated: store.updated };
});

ipcMain.handle('store:restore', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose a backup file to restore',
    defaultPath: backupDir,
    filters: [{ name: 'Backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (r.canceled) return null;
  const store = readJson(r.filePaths[0], null);
  if (!store || !Array.isArray(store.areas) || typeof store.sah !== 'object') throw new Error('This file is not a Sanyojak Map backup.');
  if (store.region && region && region.id && store.region !== region.id) throw new Error(`This backup belongs to region "${store.region}", not "${region.id}".`);
  snapshot('before-restore');
  return store;
});

ipcMain.handle('store:exportJson', async (_e, store) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Save backup',
    defaultPath: `sanyojak-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, JSON.stringify(store, null, 1), 'utf8');
  return r.filePath;
});

ipcMain.handle('export:xlsx', async (_e, sheets) => {
  const XLSX = require('xlsx');
  const r = await dialog.showSaveDialog(win, {
    title: 'Export to Excel',
    defaultPath: `Sanyojak-Report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (r.canceled) return null;
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = (s.widths || []).map(w => ({ wch: w }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, r.filePath);
  return r.filePath;
});

ipcMain.handle('shell:whatsapp', (_e, digits) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (!/^\d{10,13}$/.test(d)) return false;
  shell.openExternal(`https://wa.me/${d.length === 10 ? '91' + d : d}`);
  return true;
});

ipcMain.handle('shell:openDataFolder', () => shell.openPath(dataDir));

ipcMain.handle('print:doc', async (_e, { html, landscape, mode }) => {
  const file = path.join(app.getPath('temp'), `sanyojak-print-${Date.now()}.html`);
  fs.writeFileSync(file, html, 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  try {
    await pw.loadFile(file);
    if (mode === 'pdf') {
      let out = process.env.CHUNAV_PDF_OUT;
      if (!out) {
        const r = await dialog.showSaveDialog(win, {
          title: 'Save as PDF',
          defaultPath: `Sanyojak-Print-${new Date().toISOString().slice(0, 10)}.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (r.canceled) return null;
        out = r.filePath;
      }
      const data = await pw.webContents.printToPDF({ landscape: !!landscape, printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
      fs.writeFileSync(out, data);
      if (!process.env.CHUNAV_PDF_OUT) shell.openPath(out);
      return { path: out };
    }
    return await new Promise(res => pw.webContents.print({ silent: false, printBackground: true, landscape: !!landscape },
      (ok, err) => res(ok ? { ok: true } : (err && !/cancel/i.test(err) ? { error: err } : null))));
  } finally {
    pw.destroy();
    try { fs.unlinkSync(file); } catch { /* temp file */ }
  }
});
