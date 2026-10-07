'use strict';

const net = require('net');

function stripAddressPort(value) {
  let address = String(value || '').trim();
  if (!address) return '';
  // HTTP Host and Socket.IO handshake values may use bracketed IPv6.
  if (address.startsWith('[')) {
    const end = address.indexOf(']');
    if (end >= 0) address = address.slice(1, end);
  } else if (net.isIP(address) === 0 && address.lastIndexOf(':') === address.indexOf(':')) {
    // Only strip a single trailing port. An unbracketed IPv6 address has more
    // than one colon and must stay intact.
    const colon = address.lastIndexOf(':');
    const port = address.slice(colon + 1);
    if (/^\d+$/.test(port)) address = address.slice(0, colon);
  }
  const zone = address.indexOf('%');
  return (zone >= 0 ? address.slice(0, zone) : address).toLowerCase();
}

function isPrivateLanAddress(value) {
  const address = stripAddressPort(value);
  if (address === 'localhost') return true;
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (net.isIP(normalized) === 4) {
    const parts = normalized.split('.').map(Number);
    const [first, second] = parts;
    return first === 10
      || first === 127
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 169 && second === 254);
  }
  if (net.isIP(normalized) === 6) {
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }
  return false;
}

function normalizeOrigin(value) {
  const origin = String(value || '').trim();
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

function originIsAllowed(value, allowedOrigins = []) {
  const normalized = normalizeOrigin(value);
  if (!normalized) return false;
  return allowedOrigins.some(candidate => normalizeOrigin(candidate) === normalized);
}

module.exports = { isPrivateLanAddress, normalizeOrigin, originIsAllowed, stripAddressPort };
