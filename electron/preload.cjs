const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ambient', {
  isElectron: true,
  platform: process.platform,
});
