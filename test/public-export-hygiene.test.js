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

test('adapter export contains only allowlisted GME SDK payloads and no local build artifacts', () => {
  // Local build output is excluded by .gitignore and is not part of the export.
  const adapterFiles = listFiles(adaptersRoot).filter((file) => !/(^|\/)build\//i.test(file));
  const allowedSdk = (file) =>
    /^windows-native\/vendor-sdk\/(bin\/[^/]+\.dll|include\/[a-z0-9_.-]+\.h|lib\/gmesdk\.lib)$/i.test(file)
      || /^linux-native\/vendor-sdk\/(include\/[a-z0-9_.-]+\.h|lib\/(\.patched|libgme[a-z0-9_-]+\.so)|stubs\/[a-z0-9_.-]+)$/i.test(file)
      || /^redroid\/vendor-sdk\/android\/libs\/(gmesdk\.jar|(arm64-v8a|armeabi-v7a|x86|x86_64)\/libgme[a-z0-9_-]+\.so)$/i.test(file)
      || /^web-h5\/sdk\/WebRTCService\.js$/i.test(file);
  const forbidden = adapterFiles.filter((file) =>
    (/(^|\/)(sdk|vendor-sdk)(\/|$)/i.test(file) && !allowedSdk(file))
      || (!allowedSdk(file) && /\.(exe|dll|lib|obj|pdb|so|dylib|a|apk|aar|jar|zip)$/i.test(file))
      || /(^|\/)node_modules(\/|$)/i.test(file)
  );

  assert.deepEqual(forbidden, []);
  assert.ok(adapterFiles.includes('windows-native/vendor-sdk/lib/gmesdk.lib'));
  assert.ok(adapterFiles.includes('linux-native/vendor-sdk/lib/libgmesdk.so'));
  assert.ok(adapterFiles.includes('redroid/vendor-sdk/android/libs/gmesdk.jar'));
  assert.ok(adapterFiles.includes('web-h5/sdk/WebRTCService.js'));
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
