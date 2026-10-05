'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow } = require('electron');
const home = process.env.FREEBOOKS_SMOKE_HOME;
assert.ok(home, 'Set FREEBOOKS_SMOKE_HOME to an empty private test directory.');
fs.mkdirSync(home, { recursive: true, mode: 0o700 });
app.setPath('userData', home);
process.env.FREEBOOKS_BUNDLE_DIR = path.join(__dirname,'fixtures/server');
const deadline = setTimeout(() => { console.error('Desktop runtime smoke timed out.'); app.exit(1); }, 20000);
const fixture = http.createServer((_request,response) => {
  response.setHeader('Content-Security-Policy', "default-src 'none'");
  response.end('<!doctype html><html><head><title>FreeBooks test fixture</title></head><body>Empty synthetic accounting server</body></html>');
});
let passed = false;
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    if (passed || !window.webContents.getURL().startsWith('file:')) return;
    try {
      const prefs = window.webContents.getLastWebPreferences();
      assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation,true); assert.equal(prefs.nodeIntegration,false);
      const port = fixture.address().port;
      const profile = await window.webContents.executeJavaScript(
        'window.freebooks.saveProfile(' + JSON.stringify({name:'Synthetic desktop smoke',origin:'http://127.0.0.1:' + port,authOrigins:[],password:'must-not-persist'}) + ')');
      const persisted = fs.readFileSync(path.join(home,'servers.json'),'utf8');
      assert.ok(!persisted.includes('must-not-persist'));
      if (process.env.FREEBOOKS_DESKTOP_SCREENSHOT) {
        const screenshot = await window.webContents.capturePage();
        fs.writeFileSync(process.env.FREEBOOKS_DESKTOP_SCREENSHOT, screenshot.toPNG());
      }
      const remoteReady = new Promise(resolve => app.once('browser-window-created', (_event, remote) => remote.webContents.once('did-finish-load', () => resolve(remote))));
      await window.webContents.executeJavaScript('window.freebooks.openProfile(' + JSON.stringify(profile.id) + ')');
      const remote = await remoteReady;
      const remotePrefs = remote.webContents.getLastWebPreferences();
      assert.equal(remotePrefs.sandbox,true); assert.equal(remotePrefs.contextIsolation,true); assert.equal(remotePrefs.nodeIntegration,false);
      assert.ok(!remotePrefs.preload);
      assert.deepEqual(await remote.webContents.executeJavaScript('({node:typeof require,native:typeof window.freebooks})'), {node:'undefined',native:'undefined'});
      await window.webContents.executeJavaScript('window.freebooks.removeProfile(' + JSON.stringify(profile.id) + ')');
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home,'servers.json'),'utf8')),[]);
      await window.webContents.executeJavaScript('window.freebooks.startLocal()');
      await window.webContents.executeJavaScript(`(() => {
        document.getElementById('email').value='owner@example.test';
        document.getElementById('first-name').value='Test';
        document.getElementById('last-name').value='Owner';
        document.getElementById('password').value='synthetic-owner-passphrase-1';
        document.getElementById('owner-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        return new Promise((resolve,reject) => {
          const deadline=Date.now()+8000;
          const timer=setInterval(() => {
            const message=document.getElementById('message');
            if(message.textContent.startsWith('Owner created.')) { clearInterval(timer); resolve(true); }
            else if(message.classList.contains('error') || Date.now()>deadline) { clearInterval(timer); reject(new Error(message.textContent || 'Owner form timed out')); }
          },30);
        });
      })()`);
      assert.equal(await window.webContents.executeJavaScript('document.getElementById("password").value'),'');
      const calls = JSON.parse(fs.readFileSync(path.join(home,'local-server/deploy/beta/calls.json'),'utf8'));
      assert.deepEqual(calls.map(call => call.args), [['init'],['start','--build'],['owner','--from-stdin']]);
      assert.equal(calls[2].owner_fields_received,true);
      assert.ok(!JSON.stringify(calls).includes('synthetic-owner-passphrase-1'));
      assert.equal(await window.webContents.executeJavaScript('document.getElementById("progress").textContent.includes("synthetic-owner-passphrase-1")'),false);
      passed = true; clearTimeout(deadline); fixture.close();
      console.log('Desktop runtime smoke passed: sandboxed launcher, profile save/open/remove, no credential persistence, isolated remote window without Node or native API, synthetic local CLI arguments and owner stdin with output suppressed.');
      app.exit(0);
    } catch(error) { clearTimeout(deadline); fixture.close(); console.error(error); app.exit(1); }
  });
});
fixture.listen(0,'127.0.0.1',() => require('../src/main.cjs'));
