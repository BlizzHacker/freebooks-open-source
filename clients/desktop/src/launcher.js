'use strict';
const $ = id => document.getElementById(id);
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function renderProfiles() {
  const profiles = await window.freebooks.profiles();
  $('profiles').replaceChildren();
  if (!profiles.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No saved servers yet. Connect one below, or start a local server.'; $('profiles').append(empty);
  }
  for (const profile of profiles) {
    const row = document.createElement('div'); row.className = 'profile';
    const details = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = profile.name;
    const address = document.createElement('small'); address.textContent = profile.origin;
    details.append(name, address);
    const open = document.createElement('button'); open.textContent = 'Open'; open.addEventListener('click', async () => { try { await window.freebooks.openProfile(profile.id); } catch(error) { message(error.message, true); } });
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.className = 'secondary'; remove.addEventListener('click', async () => {
      if (!window.confirm('Remove this connection and its saved sign-in session? Your server data will remain.')) return;
      try { await window.freebooks.removeProfile(profile.id); await renderProfiles(); } catch(error) { message(error.message, true); }
    });
    const browser = document.createElement('button'); browser.textContent = 'Browser'; browser.className = 'secondary'; browser.addEventListener('click', async () => { try { await window.freebooks.openBrowser(profile.id); } catch(error) { message(error.message, true); } });
    row.append(details, open, browser, remove); $('profiles').append(row);
  }
}
$('profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await window.freebooks.saveProfile({ name: $('name').value, origin: $('origin').value, authOrigins: $('auth-origins').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) });
    event.target.reset(); await renderProfiles(); message('Server saved. Open it above to sign in.');
  } catch(error) { message(error.message, true); }
});
window.freebooks.onProgress(text => {
  $('progress').hidden = false;
  $('progress').textContent = ($('progress').textContent + text).slice(-12000);
  $('progress').scrollTop = $('progress').scrollHeight;
});
$('start-local').addEventListener('click', async () => {
  $('start-local').disabled = true; $('progress').textContent = ''; message('Starting your local FreeBooks server…');
  try {
    await window.freebooks.startLocal(); await renderProfiles();
    $('owner-details').open = true; message('Local server ready. Create the first owner, or open it to sign in.');
  } catch(error) { message(error.message, true); }
  finally { $('start-local').disabled = false; }
});
$('owner-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button'); button.disabled = true;
  try {
    const values = { firstName: $('first-name').value, lastName: $('last-name').value, email: $('email').value, password: $('password').value };
    const request = window.freebooks.createOwner(values);
    $('password').value = ''; values.password = '';
    await request; event.target.reset(); message('Owner created. Open My local FreeBooks and complete your organization setup.');
  } catch(error) { message(error.message, true); }
  finally { $('password').value = ''; button.disabled = false; }
});
renderProfiles().catch(error => message(error.message, true));
