# Yello Music Bot

Clean project for controlling one YelloTalk music bot. First run creates a local setup configuration and owner token. No bot account or provider credential is included in this repository.

## Current development state

The clean project contains empty-account setup, owner-authenticated room browsing and explicit one-room join/leave, plus public-room creation using the existing topic-only API flow (no separate description field, per the selected scope). Room creation activates the new room and joins as host. Auto-join (following and public) is disabled until a verified speaker-capacity preflight is available; the bot never joins a room as a listener just to test capacity. The project also includes YouTube request/download/playback orchestration, allowlisted room music commands, and an owner-authenticated live chat tab backed by a bounded in-memory buffer. Autoplay/Repeat/Loop work without Autoplay2. Azure TTS synthesis, bounded speech queue, echo filtering, volume ducking, and cancellable effect playback are implemented only for adapters that explicitly advertise effect support. Stateless Groq chat/fortune replies require a configured name/alias mention; optional greeting/farewell messages use single-person participant changes. Same-room YelloTalk disconnect recovery retries up to five times and preserves/restarts the queue. If all retries fail, the bot stays disconnected and preserves the queue for an explicit owner action; adapter-outage recovery is not implemented. Versioned GME SDK assets for Windows, Linux, Web H5, and Android/Redroid are bundled under `adapters/`; credentials remain local. The Windows native adapter compiles from the bundled SDK; Linux/Web/Redroid builds and live audio/TTS behavior remain unverified against a live session. See [the SDK bundle inventory](docs/bundled-gme-sdks.md).

See [the implementation plan](docs/music-only-plan.md) and [the setup guide](docs/clean-public-setup.md) for the target behavior and remaining work.

## Local development

Use Node.js 20.9.0 or newer (the portal framework's declared engine requirement). From a fresh clone, install the lockfiles and start the API and portal in separate terminals:

```powershell
npm.cmd ci
npm.cmd --prefix web-portal-2 ci
npm.cmd start
```

In a second terminal, run `npm.cmd run portal:dev`. The API creates `config.local.json` and `owner-token.txt` on first start; both are local and Git-ignored. Enter the owner token in the portal. Stop each process with Ctrl+C. If PowerShell blocks `npm.ps1`, use `npm.cmd`.

### What is required for music playback

Groq is optional and only powers mention-triggered chat/fortune replies; a Groq key does not enable music playback. Playback requires all of the following, kept local:

- A YelloTalk account JWT, UUID, and display name in `config.local.json`.
- `yt-dlp` and FFmpeg available on `PATH` for resolving and downloading YouTube audio.
- A running GME adapter. For the verified Windows build, use an x64 Native Tools Command Prompt for Visual Studio and run `adapters\windows-native\build_windows.cmd`. Then start `adapters\windows-native\build\gme-music-bot-windows.exe` in a separate terminal with process-only `GME_SDK_APP_ID`, `GME_SDK_KEY` (16 bytes), and `GME_ADAPTER_TOKEN` environment variables. The adapter token must match `adapter.token` in `config.local.json`; the default adapter URL is `http://127.0.0.1:9876`.
- GME app credentials issued for your account. They are separate from the YelloTalk JWT and Groq API key.

After the adapter is healthy, use the owner portal to explicitly load/select and join one room. Auto-join remains disabled. The Windows adapter build and clean-clone API startup have been verified, but joining a live room and hearing actual playback have not; treat those as unverified until you test with your own credentials. Linux, Web, and Android/Redroid builds and audio behavior are also unverified.

The owner token is randomly generated; rotate it by stopping the API, replacing the file with a new random value of at least 32 characters, restarting, and entering the new value in the portal. Edit bot identity, adapter URL/token, and provider credentials directly in `config.local.json`; the portal does not send secrets over the network. If a YelloTalk JWT expires, replace it locally and restart; automatic refresh is not implemented. With a complete local YelloTalk account, the owner can explicitly load public rooms, create a public room using the existing `topic` field, join one room, and leave it. Creating a room immediately activates and joins it as host; both auto-join modes are withheld until speaker availability can be verified before joining. There is no separate description field by the selected scope. No room connection occurs until requested.

Room dot commands are allowlisted and available to participants after joining. `.tts` controls speech settings; ordinary chat is read only when TTS is enabled, Azure credentials are local, and the selected adapter reports separate speech-effect support. Owner web chat is authenticated, capped to the most recent 100 messages in RAM, and cleared on room leave/disconnect; web dot commands are sent as text but never dispatched or read aloud. Commands and bot echoes are not read aloud. Groq features and greetings are off by default; Groq replies do not keep conversation history, while greeting/farewell templates are text-only and use transient session deltas without persisting a roster.

## Public release

This is the public clean export. Keep local config, tokens, user data, caches, logs, recordings, and generated build outputs out of additional release artifacts. The selected GME SDK bundles are intentionally included per the repository owner's direction; versions and provenance are recorded in `docs/bundled-gme-sdks.md`. Credentials and signing keys are never included. The Windows native adapter compiles from the bundled SDK; Linux/Web/Redroid builds and live audio E2E remain pending.
