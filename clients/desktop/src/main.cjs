'use strict';
const { app, BrowserWindow, ipcMain, session, shell, Menu } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { authorizedSender, validateProfile, navigationAllowed, externalHttps } = require('./security.cjs');
let launcher, busy = false;
const children = new Set();
const launcherPath = path.join(__dirname, 'launcher.html');
const localOrigin = 'http://127.0.0.1:8740';
const securePreferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false };
const profileFile = () => path.join(app.getPath('userData'), 'servers.json');
const localRoot = () => path.join(app.getPath('userData'), 'local-server');
async function readProfiles() {
  try {
    const saved = JSON.parse(await fs.readFile(profileFile(), 'utf8'));
    if (!Array.isArray(saved)) return [];
    return saved.slice(0, 20).flatMap(value => {
      try {
        if (typeof value.id !== 'string' || !/^[a-f0-9]{32}$/.test(value.id)) return [];
        return [{ id: value.id, ...validateProfile(value) }];
      } catch { return []; }
    });
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return [];
    throw error;
  }
}
async function writeProfiles(profiles) {
  await fs.mkdir(app.getPath('userData'), { recursive: true, mode: 0o700 });
  const temp = profileFile() + '.new';
  await fs.writeFile(temp, JSON.stringify(profiles, null, 2), { mode: 0o600 });
  await fs.rename(temp, profileFile());
}
function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!authorizedSender(event, launcher, launcherPath)) throw new Error('Only the FreeBooks launcher can perform this action.');
    try { return await handler(...args); }
    catch (error) { throw new Error(error.message || 'Action failed.'); }
  });
}
function openServer(profile) {
  const serverSession = session.fromPartition('persist:freebooks-' + profile.id);
  serverSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const view = new BrowserWindow({ width: 1360, height: 940, minWidth: 420, minHeight: 540, title: 'FreeBooks — ' + profile.name, icon: path.join(__dirname, 'brand-icon.png'), webPreferences: { ...securePreferences, session: serverSession } });
  view.webContents.on('will-navigate', (event, url) => {
    if (!navigationAllowed(url, profile)) {
      event.preventDefault();
      if (externalHttps(url)) shell.openExternal(url);
    }
  });
  view.webContents.on('will-redirect', (event, url) => {
    if (!navigationAllowed(url, profile)) event.preventDefault();
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (externalHttps(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  view.webContents.on('will-attach-webview', event => event.preventDefault());
  view.loadURL(profile.origin + '/');
}
function progress(text) {
  if (launcher && !launcher.isDestroyed()) launcher.webContents.send('local:progress', text);
}
async function pythonCommand() {
  const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []]];
  for (const [command, prefix] of candidates) {
    const ok = await new Promise(resolve => {
      const child = spawn(command, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)'], { shell: false, windowsHide: true, stdio: 'ignore' });
      child.once('error', () => resolve(false));
      child.once('exit', code => resolve(code === 0));
    });
    if (ok) return { command, prefix };
  }
  throw new Error('Install Python 3.11 or newer, then restart FreeBooks.');
}
async function runManager(args, payload) {
  const python = await pythonCommand();
  const script = path.join(localRoot(), 'deploy', 'beta', 'manage.py');
  await fs.access(script);
  return new Promise((resolve, reject) => {
    const child = spawn(python.command, [...python.prefix, script, ...args], { cwd: path.dirname(script), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(child);
    let tail = '';
    const collect = chunk => {
      // Owner output is intentionally not forwarded: credentials must never reach renderer logs.
      if (payload) return;
      const text = chunk.toString('utf8');
      tail = (tail + text).slice(-1200);
      progress(text.slice(-1600));
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', error => { children.delete(child); reject(new Error('Unable to run the local setup tool: ' + error.message)); });
    child.once('exit', code => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(payload ? 'Owner setup failed. Check that the server is running and that an owner does not already exist.' : 'Local server setup failed. ' + tail));
    });
    child.stdin.end(payload ? JSON.stringify(payload) : undefined);
  });
}
async function prepareLocal() {
  const destination = localRoot();
  try { await fs.access(path.join(destination, 'deploy/beta/manage.py')); return; } catch {}
  const source = app.isPackaged ? path.join(process.resourcesPath, 'server') : process.env.FREEBOOKS_BUNDLE_DIR;
  if (!source) throw new Error('The self-host server bundle is missing from this development build.');
  await fs.access(path.join(source, 'deploy/beta/manage.py'));
  progress('Copying the bundled server source into your private app data directory.\n');
  await fs.mkdir(destination, { recursive: true, mode: 0o700 });
  await fs.cp(source, destination, { recursive: true, filter: item => !['.env', '.git', 'node_modules'].includes(path.basename(item)) });
}
async function withLocalLock(fn) {
  if (busy) throw new Error('A local server operation is already running.');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}
async function createLauncher() {
  launcher = new BrowserWindow({ width: 1000, height: 860, minWidth: 440, minHeight: 620, title: 'FreeBooks', icon: path.join(__dirname, 'brand-icon.png'), webPreferences: { ...securePreferences, preload: path.join(__dirname, 'preload.cjs') } });
  launcher.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  launcher.webContents.on('will-navigate', event => event.preventDefault());
  launcher.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  await launcher.loadFile(launcherPath);
}
app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'FreeBooks', submenu: [{ label: 'Server launcher', click: () => { if (launcher && !launcher.isDestroyed()) { launcher.show(); launcher.focus(); } else createLauncher(); } }, { role: 'quit' }] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }
  ]));
  register('profiles:list', readProfiles);
  register('profiles:save', async input => {
    const profile = validateProfile(input);
    const profiles = await readProfiles();
    if (profiles.length >= 20) throw new Error('Remove a saved server before adding another.');
    const saved = { id: crypto.randomBytes(16).toString('hex'), ...profile };
    profiles.push(saved);
    await writeProfiles(profiles);
    return saved;
  });
  register('profiles:remove', async id => {
    const profiles = await readProfiles();
    const removed = profiles.find(profile => profile.id === id);
    await writeProfiles(profiles.filter(profile => profile.id !== id));
    if (removed) await session.fromPartition('persist:freebooks-' + removed.id).clearStorageData();
  });
  register('profiles:open', async id => {
    const profile = (await readProfiles()).find(value => value.id === id);
    if (!profile) throw new Error('Server profile not found.');
    openServer(profile);
  });
  register('profiles:browser', async id => {
    const profile = (await readProfiles()).find(value => value.id === id);
    if (!profile) throw new Error('Server profile not found.');
    await shell.openExternal(profile.origin + '/');
  });
  register('local:start', () => withLocalLock(async () => {
    await prepareLocal();
    progress('Checking local prerequisites and preparing the server. Docker Engine or Docker Desktop must be running.\n');
    await runManager(['init']);
    await runManager(['start', '--build']);
    const profiles = await readProfiles();
    let profile = profiles.find(value => value.origin === localOrigin);
    if (!profile) {
      if (profiles.length >= 20) throw new Error('The server is ready. Remove a profile and add http://127.0.0.1:8740.');
      profile = { id: crypto.randomBytes(16).toString('hex'), name: 'My local FreeBooks', origin: localOrigin, authOrigins: [] };
      profiles.push(profile);
      await writeProfiles(profiles);
    }
    progress('The local server is ready. Create the first owner if this is a new installation.\n');
    return profile;
  }));
  register('local:owner', input => withLocalLock(async () => {
    if (!input || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128 ||
      typeof input.firstName !== 'string' || !input.firstName.trim() || input.firstName.length > 80 ||
      typeof input.lastName !== 'string' || !input.lastName.trim() || input.lastName.length > 80) throw new Error('Enter your name, email, and a password of 12–128 characters.');
    await runManager(['owner', '--from-stdin'], { email: input.email.trim(), password: input.password, firstName: input.firstName.trim(), lastName: input.lastName.trim() });
    return { success: true };
  }));
  await createLauncher();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createLauncher(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// Closing the app leaves Docker's local server running. It does not delete your books or volumes.
