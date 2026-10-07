'use strict';

const DEFAULT_PLAYER_CLIENTS = Object.freeze(['web_embedded', 'android_vr', 'default']);
// YouTube availability can differ by player client. Retry this response so the
// download path tries its remaining clients before the queue searches a new result.
const RETRYABLE_DOWNLOAD_ERROR = /403|forbidden|network|timed?\s*out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|requested format is not available|drm protected|only images are available|video (?:is )?unavailable/i;
// A different client can select a source that FFmpeg can convert successfully.
// Do not retry arbitrary Invalid argument errors (for example invalid CLI options).
const RETRYABLE_CONVERSION_ERROR = /Postprocessing:\s*audio conversion failed:[^\r\n]*Error opening output files:\s*Invalid argument/i;

function downloadErrorMessage(stderr) {
  const lines = String(stderr || '').split(/\r?\n/);
  const errors = lines.filter(line => /^ERROR:/i.test(line.trim()));
  return (errors.length ? errors.join('\n') : String(stderr || '')).trim().slice(0, 500);
}

function playerClientForAttempt(attempt, override) {
  if (override) return override;
  const index = Math.max(0, Math.min(Number(attempt || 1) - 1, DEFAULT_PLAYER_CLIENTS.length - 1));
  return DEFAULT_PLAYER_CLIENTS[index];
}

function downloadNetworkArgs(attempt, { playerClient } = {}) {
  return [
    '--force-ipv4',
    '--extractor-args',
    `youtube:player_client=${playerClientForAttempt(attempt, playerClient)}`,
  ];
}

function isRetryableDownloadError(error) {
  const message = error?.message || String(error || '');
  const stderr = error?.stderr || '';
  const details = `${message}\n${stderr}`;
  return RETRYABLE_DOWNLOAD_ERROR.test(details) || RETRYABLE_CONVERSION_ERROR.test(details);
}

module.exports = {
  DEFAULT_PLAYER_CLIENTS,
  RETRYABLE_DOWNLOAD_ERROR,
  playerClientForAttempt,
  downloadNetworkArgs,
  isRetryableDownloadError,
  downloadErrorMessage,
};
