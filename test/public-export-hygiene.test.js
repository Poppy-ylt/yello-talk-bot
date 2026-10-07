'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');
const adaptersRoot = path.join(projectRoot, 'adapters');

function listFiles(directory, relativeTo = directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(relativeTo, absolutePath).replace(/\\/g, '/');
    if (entry.isDirectory()) files.push(...listFiles(absolutePath, relativeTo));
    else files.push(relativePath);
  }
  return files;
}

test('adapter export contains no compiled payloads, SDK bundles, or dependency trees', () => {
  // Local build output is excluded by .gitignore and is not part of the export.
  const adapterFiles = listFiles(adaptersRoot).filter((file) => !/(^|\/)build\//i.test(file));
  const forbidden = adapterFiles.filter((file) =>
    /(^|\/)(node_modules|sdk|vendor-sdk|build|gme-[^/]*-sdk)(\/|$)/i.test(file)
      || /\.(exe|dll|lib|obj|pdb|so|dylib|a|apk|aar|jar|zip)$/i.test(file)
  );

  assert.deepEqual(forbidden, []);
});

test('ignore rules cover local dependencies, credentials, runtime state, and native binaries', () => {
  const rules = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8')
    .split(/\r?\n/);

  for (const requiredRule of [
    'node_modules/',
    'web-portal-2/node_modules/',
    'config.local.json',
    '.env',
    '.env.*',
    '*.exe',
    '*.dll',
    '*.lib',
    '*.so',
    '*.apk',
    '*.aar',
    'adapters/**/build/',
    'adapters/**/sdk/',
    'adapters/**/vendor-sdk/'
  ]) {
    assert.ok(rules.includes(requiredRule), `missing ignore rule: ${requiredRule}`);
  }
});
