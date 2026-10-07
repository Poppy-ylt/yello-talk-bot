'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('GME auth uses local credentials and refuses missing values', () => {
  const previousAppId = process.env.GME_SDK_APP_ID;
  const previousSecret = process.env.GME_SECRET;
  const authPath = require.resolve('./auth');

  try {
    delete process.env.GME_SDK_APP_ID;
    delete process.env.GME_SECRET;
    delete require.cache[authPath];
    const missingCredentials = require('./auth');
    assert.throws(
      () => missingCredentials.generateAuthBuffer('test-user', 'test-room'),
      /credentials are not configured in the local environment/,
    );

    process.env.GME_SDK_APP_ID = '123456789';
    process.env.GME_SECRET = Buffer.alloc(16, 65).toString('ascii');
    delete require.cache[authPath];
    const configured = require('./auth');
    const authBuffer = configured.generateAuthBuffer('test-user', 'test-room');
    assert.match(authBuffer, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.ok(authBuffer.length > 0);

    const source = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
    assert.match(source, /process\.env\.GME_SDK_APP_ID/);
    assert.match(source, /process\.env\.GME_SECRET/);
    assert.doesNotMatch(source, /GME_SECRET\s*=\s*['"`]/);
    assert.doesNotMatch(source, /sdkAppId:\s*\d+/);
  } finally {
    if (previousAppId === undefined) delete process.env.GME_SDK_APP_ID;
    else process.env.GME_SDK_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.GME_SECRET;
    else process.env.GME_SECRET = previousSecret;
    delete require.cache[authPath];
  }
});
