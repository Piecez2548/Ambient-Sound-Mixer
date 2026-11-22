const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ambient', {
  isElectron: true,
  platform: process.platform,
  /** Tray menu "Play/Pause". Returns an unsubscribe function. */
  onTogglePlay(callback) {
    const listener = () => callback();
    ipcRenderer.on('toggle-play', listener);
    return () => ipcRenderer.removeListener('toggle-play', listener);
  },
  /** Keeps the tray menu label and tooltip in sync. */
  setPlaying(playing) {
    ipcRenderer.send('playing-changed', Boolean(playing));
  },
  /** A new version finished downloading. Returns an unsubscribe function. */
  onUpdateReady(callback) {
    const listener = (_event, version) => callback(version);
    ipcRenderer.on('update-ready', listener);
    return () => ipcRenderer.removeListener('update-ready', listener);
  },
  /** Version of an already-downloaded update, or null. */
  getUpdate() {
    return ipcRenderer.invoke('get-update');
  },
  /** Restart and install the downloaded update. */
  installUpdate() {
    ipcRenderer.send('install-update');
  },
  /** UI language ('th' | 'en') for the tray menu and close dialog. */
  setLanguage(lang) {
    ipcRenderer.send('language-changed', String(lang));
  },
});
