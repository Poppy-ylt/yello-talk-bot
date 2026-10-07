'use strict';

const crypto = require('crypto');

const ADAPTER_TOKEN_HEADER = 'x-gme-adapter-token';

function createAdapterToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeToken(value) {
  const token = Array.isArray(value) ? value[0] : value;
  return typeof token === 'string' ? token.trim() : '';
}

function tokensMatch(expected, candidate) {
  const left = Buffer.from(normalizeToken(expected), 'utf8');
  const right = Buffer.from(normalizeToken(candidate), 'utf8');
  return left.length > 0
    && left.length === right.length
    && crypto.timingSafeEqual(left, right);
}

function adapterHeaders(token, headers = {}) {
  const result = { ...headers };
  const normalized = normalizeToken(token);
  if (normalized) result[ADAPTER_TOKEN_HEADER] = normalized;
  return result;
}

function requestToken(req) {
  return normalizeToken(req?.headers?.[ADAPTER_TOKEN_HEADER]);
}

function isAdapterRequestAuthorized(req, expectedToken, { required = true } = {}) {
  if (!required) return true;
  const expected = normalizeToken(expectedToken);
  return tokensMatch(expected, requestToken(req));
}

function createAdapterAuthMiddleware(expectedToken, {
  required = true,
  publicPaths = [],
} = {}) {
  const isPublicPath = pathname => publicPaths.some(pattern => {
    if (typeof pattern === 'function') return pattern(pathname);
    if (pattern instanceof RegExp) return pattern.test(pathname);
    return String(pattern) === pathname;
  });

  return (req, res, next) => {
    if (isPublicPath(req.path || req.url || '')) return next();
    const configured = normalizeToken(expectedToken);
    if (required && !configured) {
      return res.status(503).json({
        ok: false,
        error: 'GME adapter authentication is not configured',
      });
    }
    if (!isAdapterRequestAuthorized(req, configured, { required })) {
      res.set('WWW-Authenticate', 'GME-Adapter');
      return res.status(401).json({ ok: false, error: 'Invalid GME adapter token' });
    }
    return next();
  };
}

module.exports = {
  ADAPTER_TOKEN_HEADER,
  adapterHeaders,
  createAdapterAuthMiddleware,
  createAdapterToken,
  isAdapterRequestAuthorized,
  normalizeToken,
  requestToken,
  tokensMatch,
};
