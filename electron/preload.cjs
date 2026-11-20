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
});
