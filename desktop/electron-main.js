// Desktop shell for Lost in the Forest (Steam build).
// The game itself is untouched web content in game/; this file only owns the
// window: fullscreen by default (F11 / Alt+Enter to toggle), no menu bar, no
// navigation, no network. Saves live in localStorage, which Electron persists
// under the OS user-data directory.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

// One instance — Steam relaunches focus the existing window instead.
if (!app.requestSingleInstanceLock()) app.quit();

// Steamworks: required for the overlay to hook Electron's compositor.
// If rendering ever misbehaves on odd hardware, these two lines are the
// first thing to suspect.
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('disable-direct-composition');

// Steam client bindings. Outside Steam (dev runs, the web build's tests)
// init throws and everything degrades to a plain window — by design.
let steam = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init();                    // appid comes from the Steam launch (or steam_appid.txt in dev)
  try { steamworks.electronEnableSteamOverlay(); } catch (_) {}
} catch (_) { steam = null; }

// The only achievement ids the renderer may unlock — must match both the
// ach() calls in the game and the API names registered in Steamworks.
const ACHIEVEMENTS = new Set([
  'ACH_RESCUED', 'ACH_DAY_HIKE', 'ACH_BACKCOUNTRY', 'ACH_SURVIVALIST',
  'ACH_BEAR_AWARE', 'ACH_FIRESTARTER', 'ACH_PACK_RAT',
]);
ipcMain.on('ach:unlock', (_e, id) => {
  if (!steam || !ACHIEVEMENTS.has(id)) return;
  try { steam.achievement.activate(id); } catch (_) {}
});
ipcMain.on('app:quit', () => app.quit());

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
      preload: path.join(__dirname, 'preload.js'),
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
