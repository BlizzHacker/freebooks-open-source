const path = require('node:path');
const fs = require('node:fs');
const bundle = process.env.FREEBOOKS_BUNDLE_DIR;
if (!bundle || !fs.existsSync(path.join(bundle, 'deploy/beta/manage.py'))) {
  throw new Error('Set FREEBOOKS_BUNDLE_DIR to the sanitized FreeBooks source bundle, including deploy/beta/manage.py.');
}
module.exports = {
  appId: 'org.freebooks.desktop',
  productName: 'FreeBooks',
  artifactName: 'FreeBooks-${version}-${os}-${arch}.${ext}',
  directories: { output: process.env.FREEBOOKS_DESKTOP_OUTPUT || 'release' },
  files: ['src/**/*', 'package.json', 'README.md'],
  extraResources: [{ from: bundle, to: 'server', filter: ['**/*', '!clients/**', '!**/node_modules/**', '!**/.git/**', '!**/.env', '!**/.env.tmp', '!**/.owner-created', '!**/backups/**', '!**/smoke-results.json', '!**/dist/**', '!**/release/**'] }],
  asar: true,
  linux: { target: ['tar.gz'], category: 'Office', icon: 'src/brand-icon.png' },
  win: { target: ['zip'], signExecutable: false, icon: 'src/brand-icon.png' },
  mac: { target: ['dmg'], category: 'public.app-category.finance' }
};
