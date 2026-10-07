'use strict';

const express = require('express');
const { MAX_CHAT_MESSAGE_LENGTH } = require('../yellotalk/room-chat-service');

function createChatRouter({ ownerAuth, session, roomChatService, ttsPlayback } = {}) {
  const router = express.Router();

  router.get('/api/chat/messages', ownerAuth, (_req, res) => {
    const connected = session.snapshot().status === 'joined';
    return res.json({ connected, messages: connected ? roomChatService.snapshot() : [] });
  });

  router.post('/api/chat/send', ownerAuth, async (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.trim().length > MAX_CHAT_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Enter a chat message up to ${MAX_CHAT_MESSAGE_LENGTH} characters` });
    }
    if (session.snapshot().status !== 'joined') return res.status(409).json({ error: 'Join a room before sending chat messages' });
    try {
      const sent = await roomChatService.send(message);
      if (!sent.text.startsWith('.')) {
        try { ttsPlayback?.handleMessage({ message: sent.text, uuid: 'owner-web', pin_name: 'Owner' }); } catch {}
      }
      return res.json({ sent });
    } catch (error) {
      const status = error?.code === 'INVALID_CHAT_MESSAGE' ? 400
        : error?.code === 'CHAT_RATE_LIMIT' ? 429
          : session.snapshot().status !== 'joined' ? 409 : 502;
      const safeMessage = error?.code === 'INVALID_CHAT_MESSAGE' || error?.code === 'CHAT_RATE_LIMIT'
        ? String(error.message).slice(0, 160)
        : 'Could not send the room chat message';
      return res.status(status).json({ error: safeMessage });
    }
  });

  return router;
}

module.exports = { createChatRouter };
