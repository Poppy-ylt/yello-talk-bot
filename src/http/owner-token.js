'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function ensureOwnerToken(filePath) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  if (!fs.existsSync(resolvedPath)) {
    const token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(resolvedPath, `${token}\n`, { flag: 'wx', mode: 0o600 });
  }
  const token = fs.readFileSync(resolvedPath, 'utf8').trim();
  if (token.length < 32) throw new Error('Owner token file is invalid; replace it with a randomly generated token of at least 32 characters.');
  return token;
}

function tokenMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function ownerTokenMiddleware(token) {
  return (req, res, next) => {
    const authorization = String(req.get('authorization') || '');
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!tokenMatches(token, supplied)) return res.status(401).json({ error: 'Owner token required' });
    return next();
  };
}

module.exports = { ensureOwnerToken, ownerTokenMiddleware, tokenMatches };
