// Electron main-process example: gate the app on launch with a cached license check.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { LicenseGate } = require('../src/index.js');

const gate = new LicenseGate({
  productId: 'YOUR_GUMROAD_PRODUCT_ID',
  storageFile: path.join(app.getPath('userData'), 'license.json'),
  recheckEveryDays: 3,
  offlineGraceDays: 14,
});

ipcMain.handle('license:check', () => gate.check());
ipcMain.handle('license:activate', (_e, key) => gate.activate(key));
ipcMain.handle('license:deactivate', () => gate.deactivate());

app.whenReady().then(async () => {
  const status = await gate.check();
  // Show your gate window if !status.licensed, otherwise the real app window.
  const win = new BrowserWindow({ width: 480, height: 600 });
  win.loadFile(status.licensed ? 'app.html' : 'activate.html');
});

// NOTE: the cache file is plain JSON and user-editable — this reduces friction, it is not
// anti-piracy. For tamper-proof, device-bound, fully-offline licensing, see KeyGate.
