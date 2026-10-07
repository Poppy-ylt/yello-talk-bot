'use strict';

function selectFollowedRoom(rooms, following, { excludeRoomId = null, random = Math.random } = {}) {
  const followedUuids = new Set((Array.isArray(following) ? following : [])
    .map(user => String(typeof user === 'string' ? user : user?.uuid || '').trim().toUpperCase())
    .filter(Boolean));
  const excludedId = excludeRoomId == null ? null : String(excludeRoomId);
  const seenRoomIds = new Set();
  const candidates = [];
  for (const room of Array.isArray(rooms) ? rooms : []) {
    const id = String(room?.id || '').trim();
    const ownerUuid = String(room?.ownerUuid || room?.owner?.uuid || '').trim().toUpperCase();
    if (!id || id === excludedId || room?.isPrivate !== false || !ownerUuid || !followedUuids.has(ownerUuid) || seenRoomIds.has(id)) continue;
    seenRoomIds.add(id);
    candidates.push(room);
  }
  if (candidates.length === 0) return null;
  const sample = Number(random());
  const boundedSample = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999999999, sample)) : 0;
  return candidates[Math.floor(boundedSample * candidates.length)];
}

module.exports = { selectFollowedRoom };
