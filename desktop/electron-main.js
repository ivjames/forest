// Desktop shell for Lost in the Forest (Steam build).
// The game itself is untouched web content in game/; this file only owns the
// window: fullscreen by default (F11 / Alt+Enter to toggle), no menu bar, no
// navigation, no network. Saves live in localStorage, which Electron persists
// under the OS user-data directory.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// One instance — Steam relaunches focus the existing window instead.
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 960,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#000000',
    fullscreen: !process.argv.includes('--windowed'),
    autoHideMenuBar: true,
    title: "Lost in the Forest '88",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, 'game', 'index.html'));

  // The game is fully offline; refuse any navigation or new windows.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // F11 / Alt+Enter toggle fullscreen without stealing keys the game uses.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const f11 = input.key === 'F11';
    const altEnter = input.alt && input.key === 'Enter';
    if (f11 || altEnter) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });

  win.on('closed', () => { win = null; });
}

Menu.setApplicationMenu(null);

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(createWindow);

app.on('activate', () => { if (win === null) createWindow(); }); // macOS dock
app.on('window-all-closed', () => app.quit());
