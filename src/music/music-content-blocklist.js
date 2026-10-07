'use strict';

const MAX_MUSIC_BLOCKED_KEYWORDS = 200;
const MAX_MUSIC_BLOCKED_KEYWORD_LENGTH = 100;

function normalizeMusicBlockText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeMusicBlockedKeywords(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of value) {
    const display = String(entry || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
    if (!display || display.length > MAX_MUSIC_BLOCKED_KEYWORD_LENGTH) continue;
    const key = normalizeMusicBlockText(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(display);
    if (result.length >= MAX_MUSIC_BLOCKED_KEYWORDS) break;
  }
  return result;
}

function matchBlockedMusic(metadata, keywords) {
  const normalizedKeywords = normalizeMusicBlockedKeywords(keywords)
    .map(keyword => ({ keyword, normalized: normalizeMusicBlockText(keyword) }));
  if (!normalizedKeywords.length) return { blocked: false };

  const fields = ['title', 'artist', 'channel', 'uploader'];
  for (const field of fields) {
    const raw = metadata?.[field];
    const value = normalizeMusicBlockText(raw);
    if (!value) continue;
    const match = normalizedKeywords.find(entry => value.includes(entry.normalized));
    if (match) {
      return { blocked: true, keyword: match.keyword, field, value: String(raw) };
    }
  }
  return { blocked: false };
}

module.exports = {
  MAX_MUSIC_BLOCKED_KEYWORDS,
  MAX_MUSIC_BLOCKED_KEYWORD_LENGTH,
  matchBlockedMusic,
  normalizeMusicBlockedKeywords,
};
