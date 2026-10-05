'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { serverOrigin, validateProfile, authorizedSender, navigationAllowed, externalHttps } = require('../src/security.cjs');
test('server origins permit HTTPS and exact loopback HTTP only', () => {
  for(const origin of ['https://books.example.com', 'http://127.0.0.1:8740', 'http://localhost:8740', 'http://[::1]:8740']) assert.equal(serverOrigin(origin + '/'), origin);
  for(const origin of ['http://192.168.50.10', 'http://127.1', 'http://localhost.attacker.com', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@books.example.com', 'https://books.example.com/path', 'https://books.example.com/?token=secret', 'https://books.example.com/#secret']) assert.throws(() => serverOrigin(origin));
});
test('profiles only retain allowlisted fields', () => {
  assert.deepEqual(validateProfile({ name: ' Home ', origin: 'https://books.example.com/', authOrigins: ['https://auth.example.com/'], password: 'do-not-save' }), { name:'Home', origin:'https://books.example.com', authOrigins:['https://auth.example.com'] });
  assert.throws(() => validateProfile({ name:'',origin:'https://example.com' }));
  assert.throws(() => validateProfile({ name:'Home',origin:'https://example.com',authOrigins:Array(5).fill('https://auth.example.com') }));
});
test('remote and child frames cannot invoke privileged launcher IPC', () => {
  const frame = { url: pathToFileURL('/app/launcher.html').href };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  assert.equal(authorizedSender({sender:contents,senderFrame:frame},window,'/app/launcher.html'),true);
  assert.equal(authorizedSender({sender:{mainFrame:frame},senderFrame:frame},window,'/app/launcher.html'),false);
  assert.equal(authorizedSender({sender:contents,senderFrame:{url:frame.url}},window,'/app/launcher.html'),false);
  frame.url='https://books.example.com'; assert.equal(authorizedSender({sender:contents,senderFrame:frame},window,'/app/launcher.html'),false);
});
test('navigation permits explicit auth origins and no arbitrary protocol handlers', () => {
  const profile={origin:'https://books.example.com',authOrigins:['https://auth.example.com']};
  assert.equal(navigationAllowed('https://auth.example.com/flow',profile),true);
  assert.equal(navigationAllowed('https://books.example.com.attacker.com/',profile),false);
  assert.equal(externalHttps('https://support.example.com/help'),true);
  for(const url of ['file:///etc/passwd','mailto:a@example.com','javascript:alert(1)','https://user:secret@example.com']) assert.equal(externalHttps(url),false);
});
