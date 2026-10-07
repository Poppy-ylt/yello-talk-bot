'use strict';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

function extractUrl(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const match = value.match(/(?:https?:\/\/[^\s<>]+|(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be|music\.youtube\.com)\/[^\s<>]+)/i);
  if (!match) return null;
  const cleaned = match[0].replace(/[),.!?]+$/u, '');
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function detectMusicLink(text) {
  const raw = extractUrl(text);
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname)) return null;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.port && !['80', '443'].includes(url.port)) return null;

  if (hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (!VIDEO_ID.test(id)) return null;
    const playlistId = url.searchParams.get('list') || '';
    if (PLAYLIST_ID.test(playlistId) && !/^RD/i.test(playlistId)) {
      return {
        source: 'youtube',
        kind: 'playlist',
        id: playlistId,
        url: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
      };
    }
    return { source: 'youtube', kind: 'video', id, url: `https://www.youtube.com/watch?v=${id}` };
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'live') {
    return { source: 'youtube', kind: 'rejected', reason: 'live' };
  }

  const playlistId = url.searchParams.get('list') || '';
  const videoId = url.searchParams.get('v') || '';
  if (PLAYLIST_ID.test(playlistId) && !(videoId && /^RD/i.test(playlistId))) {
    return {
      source: 'youtube',
      kind: 'playlist',
      id: playlistId,
      url: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    };
  }

  if (segments[0]?.toLowerCase() === 'shorts') {
    const id = segments[1] || '';
    if (VIDEO_ID.test(id)) return { source: 'youtube', kind: 'video', id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (VIDEO_ID.test(videoId)) {
    return { source: 'youtube', kind: 'video', id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  return null;
}

module.exports = { detectMusicLink };
