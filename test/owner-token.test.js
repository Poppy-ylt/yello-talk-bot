'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ensureOwnerToken, tokenMatches } = require('../src/http/owner-token');

test('owner token is generated once and persisted outside the example config', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-token-'));
  const tokenPath = path.join(directory, 'owner-token.txt');
  try {
    const token = ensureOwnerToken(tokenPath);
    assert.equal(token.length, 64);
    assert.equal(ensureOwnerToken(tokenPath), token);
    assert.equal(fs.readFileSync(tokenPath, 'utf8').trim(), token);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('owner token comparison rejects missing and wrong values', () => {
  assert.equal(tokenMatches('expected-token-value-at-least-32-chars', 'expected-token-value-at-least-32-chars'), true);
  assert.equal(tokenMatches('expected-token-value-at-least-32-chars', 'other-token-value-at-least-32-chars'), false);
  assert.equal(tokenMatches('', ''), false);
  assert.equal(tokenMatches('expected-token-value-at-least-32-chars', undefined), false);
});
