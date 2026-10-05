'use strict';
const { pathToFileURL } = require('node:url');
function serverOrigin(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Enter a valid server address.');
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a full server address, including https://.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/i.test(input.trim());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Use HTTPS, or HTTP for a local loopback server.');
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) throw new Error('Use the server origin without credentials, paths, or query strings.');
  return url.origin;
}
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Invalid profile.');
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (!name || name.length > 80) throw new Error('Use a server name between 1 and 80 characters.');
  const origin = serverOrigin(profile.origin);
  const authOrigins = Array.isArray(profile.authOrigins) ? profile.authOrigins : [];
  if (authOrigins.length > 4) throw new Error('Use at most four sign-in origins.');
  return { name, origin, authOrigins: [...new Set(authOrigins.map(serverOrigin))] };
}
function authorizedSender(event, window, launcherPath) {
  return !!window && !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === pathToFileURL(launcherPath).href;
}
function navigationAllowed(address, profile) {
  try { return [profile.origin, ...profile.authOrigins].includes(new URL(address).origin); } catch { return false; }
}
function externalHttps(address) {
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
module.exports = { serverOrigin, validateProfile, authorizedSender, navigationAllowed, externalHttps };
