// Electron shell. In dev it loads the Vite server; in production it serves dist/
// over a local http server, because YouTube embeds refuse to play from file://
// (no Referer -> error 153).
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
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

function isOpenAtLogin() {
  return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setToolTip(isPlaying ? 'Ambient Sound Mixer — playing' : 'Ambient Sound Mixer');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Ambient Sound Mixer', click: showWindow },
      {
        label: isPlaying ? 'Pause' : 'Play',
        click: () => {
          if (win && !win.isDestroyed()) win.webContents.send('toggle-play');
          else showWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: isOpenAtLogin(),
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] });
          buildTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
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

  // Closing the window hides it to the tray so the sounds keep playing.
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
    if (!readSettings().trayHintShown && tray) {
      tray.displayBalloon({
        iconType: 'info',
        title: 'Still playing in the tray',
        content: 'Ambient Sound Mixer keeps running here. Right-click the tray icon to quit.',
      });
      writeSettings({ trayHintShown: true });
    }
  });

  win.on('closed', () => {
    win = null;
  });

  // Start the local server once; a recreated window must reuse the same origin
  // (localStorage and the search API's allowed origins depend on it).
  appUrl ??= DEV_URL || (await serveDist());
  await win.loadURL(appUrl);
}

function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch {
    /* updater unavailable — skip */
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    createTray();
    await createWindow();
    checkForUpdates();
  });
  app.on('before-quit', () => {
    isQuitting = true;
  });
  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {});
}
