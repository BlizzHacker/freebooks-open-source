(() => {
  'use strict';

  const STORAGE_KEY = 'freebooks.serverProfiles.v1';
  const MAX_SERVERS = 8;
  const currentOrigin = window.location.origin;
  const list = document.getElementById('server-list');
  const form = document.getElementById('server-form');
  const message = document.getElementById('form-message');
  const installButton = document.getElementById('install-button');
  let deferredInstall = null;

  function canonicalOrigin(value) {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS server address.');
    let url;
    try { url = new URL(value.trim()); } catch (_) { throw new Error('Enter a valid HTTPS server address.'); }
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) || !url.hostname || url.username || url.password ||
        (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      throw new Error('Use the server’s HTTPS address only, such as https://books.example.com.');
    }
    return url.origin;
  }

  function loadProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const seen = new Set([currentOrigin]);
      return parsed
        .filter((profile) => {
          if (!profile || typeof profile.name !== 'string' || profile.name.length > 64) return false;
          try {
            const origin = canonicalOrigin(profile.origin);
            if (seen.has(origin)) return false;
            seen.add(origin);
            return true;
          } catch (_) { return false; }
        })
        .slice(0, MAX_SERVERS);
    } catch (_) { return []; }
  }

  function saveProfiles(profiles) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return true;
    } catch (_) {
      setMessage('This browser cannot save server profiles. Check private browsing or storage settings.');
      return false;
    }
  }

  function setMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle('form-message--success', success);
  }

  function action(text, href, primary, external) {
    const link = document.createElement('a');
    link.className = 'button ' + (primary ? 'button--primary' : 'button--quiet');
    link.textContent = text;
    link.href = href;
    if (external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.referrerPolicy = 'no-referrer';
    }
    return link;
  }

  function serverCard(profile, isCurrent) {
    const card = document.createElement('article');
    card.className = 'server-card' + (isCurrent ? ' server-card--current' : '');

    const top = document.createElement('div');
    top.className = 'server-card__top';
    const icon = document.createElement('span');
    icon.className = 'server-card__icon';
    icon.textContent = '▣';
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    name.className = 'server-card__name';
    name.textContent = profile.name;
    top.append(icon, name);
    if (isCurrent) {
      const tag = document.createElement('span');
      tag.className = 'server-card__tag';
      tag.textContent = 'This server';
      top.append(tag);
    }

    const url = document.createElement('p');
    url.className = 'server-card__url';
    url.textContent = profile.origin;
    const actions = document.createElement('div');
    actions.className = 'server-card__actions';
    const external = !isCurrent;
    actions.append(
      action('Source documents', profile.origin + '/source-documents', true, external),
      action('Banking', profile.origin + '/cashflow-accounts', false, external),
    );
    card.append(top, url, actions);

    if (!isCurrent) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'server-card__remove';
      remove.textContent = 'Remove from this device';
      remove.setAttribute('aria-label', 'Remove ' + profile.name + ' from this device');
      remove.addEventListener('click', () => {
        const remaining = loadProfiles().filter((saved) => saved.origin !== profile.origin);
        if (saveProfiles(remaining)) render();
      });
      card.append(remove);
    }
    return card;
  }

  function render() {
    const profiles = [{ name: 'Current FreeBooks server', origin: currentOrigin }, ...loadProfiles()];
    list.replaceChildren(...profiles.map((profile, index) => serverCard(profile, index === 0)));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const name = document.getElementById('server-name').value.trim();
      if (!name || name.length > 64) throw new Error('Enter a server name (up to 64 characters).');
      const origin = canonicalOrigin(document.getElementById('server-url').value);
      const profiles = loadProfiles();
      if (origin === currentOrigin || profiles.some((profile) => profile.origin === origin)) {
        throw new Error('That server is already listed.');
      }
      if (profiles.length >= MAX_SERVERS) throw new Error('Remove a saved server before adding another.');
      if (saveProfiles([...profiles, { name, origin }])) {
        form.reset();
        setMessage('Server added to this device.', true);
        render();
      }
    } catch (error) {
      setMessage(error.message || 'Could not add the server.');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    installButton.hidden = true;
    document.getElementById('install-help').textContent = 'FreeBooks is installed on this device.';
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    });
  }

  render();
})();
