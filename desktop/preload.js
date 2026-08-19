// Sandboxed preload: the only bridge between the game page and the desktop
// shell. The game sees window.desktop with exactly two capabilities; on the
// web build window.desktop simply doesn't exist and the game no-ops.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('app:quit'),
  unlock: (id) => ipcRenderer.send('ach:unlock', String(id)),
});
