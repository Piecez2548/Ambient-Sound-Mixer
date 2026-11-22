// Electron shell. In dev it loads the Vite server; in production it serves dist/
// over a local http server, because YouTube embeds refuse to play from file://
// (no Referer -> error 153).
const { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const PROD_PORT = 47821;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serveDist() {
  const root = path.join(__dirname, '..', 'dist');
  const server = http.createServer((req, res) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (pathname === '/') pathname = '/index.html';
    const file = path.normalize(path.join(root, pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    const listen = (port) => {
      server.once('error', (err) => {
        // Fixed port keeps API-key referrer restrictions stable; fall back if taken.
        if (err.code === 'EADDRINUSE' && port !== 0) listen(0);
        else reject(err);
      });
      server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
    };
    listen(PROD_PORT);
  });
}

let win = null;
let appUrl = null;
let tray = null;
let isQuitting = false;
let isPlaying = false;
const startHidden = process.argv.includes('--hidden');
const ICON = path.join(__dirname, '..', 'build', 'icon.png');

// Tiny JSON settings file in userData (remembers we already showed the tray hint).
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(patch) {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), ...patch }));
  } catch {
    /* ignore */
  }
}

function showWindow() {
  // The window can be gone (e.g. the page closed itself) — make a new one.
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Tray menu and close-dialog text. The renderer reports the language the user
// picked; before that, guess like the web app does (Thai locale or timezone).
const TEXT = {
  en: {
    open: 'Open Ambient Sound Mixer',
    play: 'Play',
    pause: 'Pause',
    startWithWindows: 'Start with Windows',
    keepPlaying: 'Keep playing when the window is closed',
    quit: 'Quit',
    updateReady: 'Restart to update to v{v}',
    version: 'Version {v}',
    tooltipPlaying: 'Ambient Sound Mixer — playing',
    askMessage: 'Keep playing after closing the window?',
    askDetail:
      'Keep playing: the window closes but sounds continue from the tray icon next to the clock. Right-click it to pause or quit.\n\nQuit: closing the window stops everything.\n\nYour choice is remembered. Change it any time from the tray menu.',
    askTray: 'Keep playing in tray',
    askQuit: 'Quit',
    askCancel: 'Cancel',
  },
  th: {
    open: 'เปิด Ambient Sound Mixer',
    play: 'เล่น',
    pause: 'หยุดชั่วคราว',
    startWithWindows: 'เปิดพร้อม Windows',
    keepPlaying: 'เล่นต่อเมื่อปิดหน้าต่าง',
    quit: 'ออกจากแอป',
    updateReady: 'รีสตาร์ทเพื่ออัปเดตเป็น v{v}',
    version: 'เวอร์ชัน {v}',
    tooltipPlaying: 'Ambient Sound Mixer — กำลังเล่น',
    askMessage: 'เล่นเสียงต่อหลังปิดหน้าต่างไหม?',
    askDetail:
      'เล่นต่อ: หน้าต่างจะปิด แต่เสียงยังเล่นต่อจากไอคอนข้างนาฬิกา คลิกขวาที่ไอคอนเพื่อหยุดหรือออกจากแอป\n\nออกจากแอป: ปิดหน้าต่างแล้วหยุดทุกอย่าง\n\nแอปจะจำคำตอบไว้ เปลี่ยนได้ตลอดจากเมนูที่ไอคอน',
    askTray: 'เล่นต่อใน tray',
    askQuit: 'ออกจากแอป',
    askCancel: 'ยกเลิก',
  },
};
function guessLang() {
  try {
    if (app.getLocale().toLowerCase().startsWith('th')) return 'th';
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Bangkok') return 'th';
  } catch {
    /* ignore */
  }
  return 'en';
}
const text = () => TEXT[readSettings().lang] ?? TEXT[guessLang()];

ipcMain.on('language-changed', (_event, lang) => {
  if (!TEXT[lang] || readSettings().lang === lang) return;
  writeSettings({ lang });
  buildTrayMenu();
});

// Play/Pause from anywhere — tray menu and the global shortcut use this.
const PLAY_SHORTCUT = 'CommandOrControl+Alt+P';
function togglePlay() {
  if (win && !win.isDestroyed()) win.webContents.send('toggle-play');
  else showWindow();
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

let asking = false;
async function askCloseAction() {
  if (asking || !win || win.isDestroyed()) return;
  asking = true;
  try {
    const tx = text();
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Ambient Sound Mixer',
      message: tx.askMessage,
      detail: tx.askDetail,
      buttons: [tx.askTray, tx.askQuit, tx.askCancel],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 2) return;
    const action = response === 0 ? 'tray' : 'quit';
    writeSettings({ closeAction: action });
    buildTrayMenu();
    if (action === 'quit') quitApp();
    else win.hide();
  } finally {
    asking = false;
  }
}

function isOpenAtLogin() {
  return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
}

function buildTrayMenu() {
  if (!tray) return;
  const tx = text();
  tray.setToolTip(isPlaying ? tx.tooltipPlaying : 'Ambient Sound Mixer');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...(updateVersion
        ? [{ label: tx.updateReady.replace('{v}', updateVersion), click: installUpdate }, { type: 'separator' }]
        : []),
      { label: tx.open, click: showWindow },
      {
        label: isPlaying ? tx.pause : tx.play,
        accelerator: globalShortcut.isRegistered(PLAY_SHORTCUT) ? PLAY_SHORTCUT : undefined,
        registerAccelerator: false,
        click: togglePlay,
      },
      { type: 'separator' },
      {
        label: tx.startWithWindows,
        type: 'checkbox',
        checked: isOpenAtLogin(),
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] });
          buildTrayMenu();
        },
      },
      {
        label: tx.keepPlaying,
        type: 'checkbox',
        checked: readSettings().closeAction === 'tray',
        click: (item) => {
          writeSettings({ closeAction: item.checked ? 'tray' : 'quit' });
          buildTrayMenu();
        },
      },
      { type: 'separator' },
      { label: tx.version.replace('{v}', app.getVersion()), enabled: false },
      { label: tx.quit, click: quitApp },
    ]),
  );
}

function createTray() {
  const image = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.on('click', showWindow);
  buildTrayMenu();
}

ipcMain.on('playing-changed', (_event, playing) => {
  isPlaying = Boolean(playing);
  buildTrayMenu();
});

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: !(startHidden && appUrl === null),
    backgroundColor: '#0a0b10',
    title: 'Ambient Sound Mixer',
    icon: ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0b10', symbolColor: '#c4c6d4', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });

  // Links (e.g. "Watch on YouTube") open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // X button: the first time, ask whether to keep playing in the tray or quit,
  // and remember the answer (changeable from the tray menu).
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    const action = readSettings().closeAction;
    // Quit on the next tick: quitting from inside this (cancelled) close event is ignored.
    if (action === 'quit') return setImmediate(quitApp);
    if (action === 'tray') return win.hide();
    askCloseAction();
  });

  win.on('closed', () => {
    win = null;
  });

  // Start the local server once; a recreated window must reuse the same origin
  // (localStorage and the search API's allowed origins depend on it).
  appUrl ??= DEV_URL || (await serveDist());
  await win.loadURL(appUrl);
}

// ---------- Updates ----------
// electron-updater downloads new versions in the background. We tell the window
// (title-bar button) and the tray menu when one is ready, and install it on
// request with a restart. Without a click it still installs when the app quits.
let updateVersion = null;
// `--simulate-update=9.9.9` fakes a downloaded update in dev (for testing the UI only).
const SIMULATE_UPDATE = !app.isPackaged ? process.argv.find((a) => a.startsWith('--simulate-update='))?.split('=')[1] : undefined;

function setUpdateReady(version) {
  updateVersion = version;
  if (win && !win.isDestroyed()) win.webContents.send('update-ready', version);
  buildTrayMenu();
}

function installUpdate() {
  if (!updateVersion) return;
  if (!app.isPackaged) {
    globalThis.__installRequested = true; // dev simulation: nothing to install
    return;
  }
  isQuitting = true; // let the close handler step aside
  try {
    require('electron-updater').autoUpdater.quitAndInstall(true, true); // silent, then relaunch
  } catch {
    isQuitting = false;
  }
}

ipcMain.handle('get-update', () => updateVersion);
ipcMain.on('install-update', installUpdate);

const UPDATE_CHECK_MS = 6 * 3600 * 1000; // the app can sit in the tray for days

function checkForUpdates() {
  if (SIMULATE_UPDATE) {
    setTimeout(() => setUpdateReady(SIMULATE_UPDATE), 3000);
    return;
  }
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => setUpdateReady(info.version));
    autoUpdater.on('error', () => {});
    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    check();
    setInterval(check, UPDATE_CHECK_MS).unref?.();
  } catch {
    /* updater unavailable — skip */
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    // Fails quietly if another app already owns the combination.
    try {
      globalShortcut.register(PLAY_SHORTCUT, togglePlay);
    } catch {
      /* ignore */
    }
    createTray();
    await createWindow();
    checkForUpdates();
  });
  app.on('before-quit', () => {
    isQuitting = true;
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {});
}
