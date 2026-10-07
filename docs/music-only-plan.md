# Yello Music Bot — แผนฉบับสรุปและ checklist

วันที่: 2026-10-07
สถานะ: clean staging เผยแพร่แล้ว; SDK bundle เพิ่มตามคำสั่งเจ้าของ แต่ยังไม่ผ่าน audio E2E

ฉบับนี้แทนแผนสะสมคำถามเดิมทั้งหมด ใช้ข้อกำหนดด้านล่างเป็นขอบเขตปัจจุบัน คู่มือปลายทาง: [clean-public-setup.md](clean-public-setup.md)

SDK bundle update (2026-10-07): at the owner's explicit request, versioned GME
SDK assets for Windows/Linux, Android/Redroid, and Web H5 are now included under
`adapters/`; see `bundled-gme-sdks.md`. The Windows adapter builds from the
bundled SDK. Linux/Web/Redroid builds and all live room/audio E2E remain
unverified. This update supersedes older checklist notes below that say SDK
payloads are absent or must be kept out. No account credentials or signing keys
were added.

## เป้าหมาย

Implementation update (2026-10-06): All auto-join modes and automatic room-switch fallbacks are disabled until a verified speaker-availability preflight is available. The earlier following-only implementation entered a room before checking for a free speaker, which conflicts with the owner's choice to wait for a verified endpoint. Same-room recovery remains bounded and queue-preserving; after it is exhausted the bot stays disconnected for an explicit owner action. No join-as-probe is used. Adapter-outage recovery also remains open.

Export audit (2026-10-06): Compared the original control-server route surface and project inventory with this clean staging tree. The public-facing staging inventory is limited to its own Node API, portal, source, tests, manifests, example config, and docs; legacy fleet/person/monitoring/tunnel/shutdown, mic/relay/remote-room-control, and old portal surfaces are omitted. No original `.git`, local runtime files, SDKs, adapter binaries, or legacy build scripts were copied. This is an audit of the staging export, not a new Git history review.

Live-test update (2026-10-06): One user-authorized join attempt through the existing legacy server used the bot token to fetch accessible public/private rooms, then failed its exact string ID match for the supplied room and returned `Room not found` before opening the YelloTalk room session. No room was joined and no audio was played. Cleanup verified the bot stopped, no current room, and auto-join still disabled. GME status checks stayed out-of-room/not-playing but alternated between online-idle and offline; the latest check was offline. This is not a clean-staging adapter E2E result. The single approved attempt has been used; another live attempt needs fresh authorization and an ID returned by this bot's room list.

Speaker-preflight research update (2026-10-06): Checked YelloTalk's public site and official app listing, but found no public developer API contract for checking speaker availability before room entry. This does not prove a private/internal endpoint does not exist; keep following/public auto-join disabled and do not guess an endpoint or join-as-probe.

Auto-join preference update (2026-10-06): the user chose to keep auto-join disabled after the one-room test. The live status endpoint reports the test bot stopped, no room, and `autoJoinRandomRoom=false`; the explicit disable endpoint returned success, and this server's setting store performs a synchronous config write. The `config.json` in this workspace still records `true`, so it appears the live process uses a different working-directory/config copy; do not edit this checkout as a proxy. No restart was performed.

โปรเจกต์คลีนชื่อ **Yello Music Bot** บอทเพลงบัญชีเดียว ทีละห้อง พร้อม TTS, คุยเล่น/ดูดวง และทักทาย/บอกลา เว็บใหม่เรียบง่ายแบ่งควบคุมเพลง แชต และตั้งค่า

รองรับ Windows/Linux พร้อม native, Web และ Redroid เตรียม public repo ใหม่และ history ใหม่จาก clean export ไม่มีบัญชี/keys/ข้อมูลเดิม ผู้ติดตั้งเพิ่มภายหลังผ่าน local config และคู่มือ

ทำงานใน clean staging แยกจาก worktree เดิม ไม่ล้างข้อมูลจริง ไม่ restart/ย้าย live bots ไม่สร้าง GitHub repo/push/deploy

## ผลวิเคราะห์โปรเจกต์

- `bot-server.js` มากกว่า 15,000 บรรทัดรวม startup/เพลง/ห้อง/AI/TTS/ผู้ใช้/API/cleanup ต้องตรวจ callbacks/timers และแยกตามหน้าที่
- `src/music/` มี playback ปน monitor/mic/relay/hidden listeners/remote controls จึงไม่เก็บทั้งโฟลเดอร์
- `src/commands/` มี dot commands ปนภาษาไทย/AI และคำสั่งนอกขอบเขต ต้องย่อ dispatch/help
- `web-portal-2/` เป็น Next.js/React ต้องทำ UI ใหม่และถอด API/subscriptions/types/state ที่ไม่ใช้
- `bot.js` เป็น entry point ซ้ำที่มี Gemini/แชต/ควบคุมห้อง ต้องจัด entry point เดียว
- Adapters อยู่ใน `gme-music-bot/`, `gme-web-bot/`, `gme-redroid-bot/` ต้องตรวจ capability แยก
- Worktree มีงานเดิมจำนวนมาก ต้อง snapshot และนำ source ล่าสุดไปพื้นที่แยก ไม่ export จาก HEAD อย่างเดียว
- Ignore ยังไม่ครอบคลุม snapshots/`.tmp-*`/conversation history/native artifacts ครบ และไม่ล้าง tracked files/history

เป็นการสำรวจโครงสร้าง/imports/routes/parser/manifests/config ตัวอย่าง ยังไม่ใช่ dependency audit ครบหรือผลทดสอบ runtime

## ข้อกำหนดที่เก็บ

### บัญชี ห้อง และ speaker

- บัญชีเดียว ห้องเดียว คิวเดียว ไม่มีบัญชีเริ่มต้น
- เลือกห้องจากรายการผ่านเว็บ, สร้างห้อง หรือกดเริ่ม auto-join ไม่รับลิงก์ห้อง
- สร้างห้องสาธารณะเท่านั้น ใช้ช่อง `topic` เป็นชื่อห้องตาม API/flow เดิม ไม่มีคำอธิบายแยก
- ใช้ช่อง speaker ว่างอัตโนมัติ เก็บ self join/leave/ผลยืนยัน ไม่มี manual slot selector
- Auto-join เลือกระหว่างห้องของคนที่บัญชีติดตาม กับห้องสาธารณะที่ speaker ว่าง กรองก่อนสุ่มและตรวจ availability ก่อนเข้า
- Following อ่านอย่างเดียวจากบัญชี ไม่มีเว็บ follow/unfollow
- เหลือบอทตัวเดียวก็อยู่และเล่นต่อ

### เพลง

- YouTube ชื่อเพลง/URL/playlist ไม่มี Spotify
- เก็บ play/add/queue/skip/pause/resume/stop, playlist/remove/clear, now playing, volume และ help
- แชตห้องใช้ dot commands เท่านั้น ทุกคนในห้องใช้ได้ URL เปล่าไม่ทำงาน ไม่มีภาษาไทย/AI ควบคุมเพลง
- เก็บ **Autoplay, Repeat, Loop; ตัด Autoplay2 ทั้งหมด**
- Fade คงที่ 1500 ms ไม่มีตัวปรับ ไม่มี Crossfade/EQ/loudness normalization
- เลือก format `m4a`/`hq`/`mp3` ผ่านเว็บตามความหมายโหมดเดิม แยกจาก HQ คุณภาพห้อง
- Room quality Fluency/Standard/HQ ผ่านเว็บและ `.sq` ทุกคนในห้องใช้ได้
- Music blocklist เจ้าของแก้ผ่านเว็บ บังคับใช้ทุกช่องทางรวม playlist/autoplay
- ไม่รับ YouTube live; max duration เริ่ม 60 นาที/3600 วินาที เจ้าของปรับผ่านเว็บได้ รับเพลงไม่เกินค่าที่ตั้ง
- Cache/retry/prefetch เฉพาะรอบที่โปรแกรมหลักรัน ไม่ใช้ cache รอบก่อน

### TTS

- Azure TTS อ่านแชตทั่วไปอัตโนมัติ ไม่อ่านคำสั่งเพลง/TTS ไม่มี `.say` หรือโหมดอ่านเฉพาะคำสั่ง
- เปิด/ปิด เลือกเสียง ความเร็ว pitch ความดัง และสถานะ ผ่านเว็บ/`.tts` ทุกคนในห้องใช้ `.tts` ได้
- ลดเพลงเหลือ 30% ของ volume ล่าสุดระหว่างอ่าน คืนค่าล่าสุดเมื่อจบ/ล้มเหลว/ยกเลิก ไม่ persist volume ที่ลดแล้ว
- เก็บ queue/rate limits/session guards/SSML escaping ป้องกัน echo อ่านซ้ำ
- ไม่มีตัวกรองคำหยาบหรือ usage statistics เหลือสถานะ/errors

### คุยเล่น ดูดวง ทักทาย และบอกลา

- Groq เท่านั้น เชื่อมตรงด้วย local key ไม่มี project relay/proxy ไม่เปลี่ยน system proxy
- คุยเล่น/ดูดวงเมื่อเรียกชื่อหรือ mention เท่านั้น ไม่มี `.chat`/`.ดวง`/`.fortune` หรือเลือกตอบทั่วไปเอง
- ใช้ persona และข้อความเรียกครั้งนั้น ไม่จำบทสนทนาใน RAM/ไฟล์
- ชื่อ/aliases/persona คงที่ตั้งภายหลังใน local config ไม่มี editor เว็บ ไม่มี identity เดิม
- ส่งคำตอบในแชต เจ้าของเปิด/ปิด TTS อ่านคำตอบผ่านเว็บได้ แยก toggle แต่เคารพ TTS master
- ทักทายเข้า/บอกลาออกเป็นข้อความเท่านั้น เจ้าของเปิด/ปิดและแก้ข้อความผ่านเว็บได้
- เก็บ participant/session state ขั้นต่ำเพื่อเข้า/ออกและ speaker ไม่เก็บประวัติติดตามคน

### เว็บและสิทธิ์

- UI ใหม่ Yello Music Bot ไม่มีภาพ/ชื่อบอทเดิม: ควบคุมเพลง แชต ตั้งค่า พร้อม status/errors
- Localhost/LAN ผ่าน owner token ระดับเดียว ไม่มี Admin/User split หรือ public tunnel integration
- HTTP/Socket.IO ตรวจ auth/session; internal/adapter callback auth แยก Owner token เป็น bearer credential
- แชตสด/ส่งข้อความผ่านบัญชีบอท ใช้ buffer จำกัด ไม่ persist history/ไม่ใช้เป็น AI context
- ข้อความทั่วไปจากเว็บอ่านเมื่อ TTS เปิด; dot commands ส่งข้อความเท่านั้น ไม่ dispatch/ไม่อ่าน ใช้ปุ่มเว็บควบคุม
- ไม่มี roster/รูป/modal รายบุคคล เหลือจำนวนคนและชื่อผู้ส่งในแชต
- Error log เฉพาะ bounded RAM ไม่เขียนไฟล์/restore เก็บ internal checks/recovery ที่จำเป็น
- เก็บ native Windows/Linux และ Web/Redroid แต่ต้องตรวจ capability/setup แยกก่อนอ้างว่ารองรับเท่ากัน

## State และค่าเริ่มต้น

| เหตุการณ์ | พฤติกรรม |
| --- | --- |
| ไม่มีบัญชี | แสดงยังไม่ตั้งค่า ไม่เชื่อมบริการภายนอก |
| เปิดโปรแกรมหลักใหม่ | Idle รอสั่งเข้าห้อง คิวว่าง คืน settings ไม่ใช้ cache/log รอบก่อน |
| ออก/เปลี่ยนห้องเอง | หยุดเพลง ล้างคิว ยกเลิกงาน session เก่า ไม่เล่นในห้องใหม่เอง |
| YelloTalk session หลุดระหว่างรัน | retry ห้องเดิมสูงสุด 5 ครั้ง รักษาคิว; ถ้าเริ่ม playback ใหม่จะเริ่มเพลงปัจจุบันจากต้นแล้วเล่นคิวต่อ |
| audio adapter/process ล้ม | ยังไม่มี health monitoring หรือ adapter-outage recovery; แสดงข้อจำกัดและให้เจ้าของแก้ adapter/เชื่อมใหม่เอง |
| Recovery ห้องเดิมปิด/speaker ไม่ว่าง | retry ห้องเดิมตามขอบเขต; เมื่อครบให้หยุดและรักษาคิว รอเจ้าของเลือกห้องเอง; ไม่ auto-join โดยไม่มี verified preflight |
| เหลือบอทตัวเดียว | อยู่และเล่นต่อ |

จำ settings ล่าสุด: volume/format/quality/Autoplay/Repeat/Loop, TTS, feature toggles, greeting/farewell templates, blocklist/max duration ไม่คืนค่าฟังก์ชันที่ตัด

Fresh defaults ปิด TTS/คุยเล่น-ดูดวง/ทักทาย-บอกลา/Autoplay/Repeat/Loop/AI reply speech ก่อน เปิดผ่านเว็บเมื่อ config พร้อมแล้วจำค่า ไม่ปิดกลับทุก restart Fade 1500 ms, ducking 0.30, max duration 3600 วินาที

## รายการตัด

| กลุ่ม | สิ่งที่ถอด |
| --- | --- |
| เพลง/คำสั่ง | Spotify, Autoplay2/ประวัติเฉพาะ, Crossfade, EQ, normalization, ตัวปรับ Fade, AI/ภาษาไทยควบคุมเพลง, URL auto-play |
| เสียง | Monitor/ฟังห้อง, mic/browser mic, relay/helper/virtual cable controls, hidden listeners/incidents, remote mute/lock/user-volume/blacklist |
| ผู้ใช้/ห้อง | Fleet/หลายบัญชี, find/directory/person/nickname UI, watch list/avoided users/activity history, follow mutations, moderation/bulk/mute/kick/lock/hijack/owner refresh/close-live controls, private/public mutation, manual slot, empty-room auto-leave |
| AI/กิจกรรม | OpenAI/Gemini, groq-relay, conversational memory/history/context buffers, เกม/สุ่มคน/ตัวเลข, ตอบทั่วไปเอง, name/persona editor |
| เว็บ/สถิติ | Person/Directory/Tracking/Memory/Reports/Health/Terminal เดิม, reports/`.report`, CPU/RAM dashboard, event history, TTS usage/profanity editor, roster/user modal, Admin/User split |
| การใช้งาน | macOS, public tunnel/deployment/URL discovery, legacy entry points ซ้ำ, persistent queue/cache/chat/error/usage history, ภาพ/identity เดิม |

ถอด code/API/events/config/dependencies/tests เฉพาะรายการตัด ไม่ใช่ซ่อนปุ่ม ตรวจ shared consumers ก่อนลบ เก็บ SDK init/session/callback/health ที่ฟังก์ชันที่เลือกยังใช้

## แผนและ checklist

### Adapter source scope amendment (2026-10-06)

Latest adapter pass (2026-10-07): 15 adapter source/manifest/build files are staged. Web and Redroid no longer expose karaoke progress or a separate mic-control route; Web, Redroid, Linux and Windows legacy song-ended callbacks are removed. Web joins receive-only and opens its private GME uplink only while playing generated music. Native Windows/Linux require GME app credentials from local environment variables and gate HTTP requests through explicit music endpoint allowlists. Linux and Windows voice-roster, room-sharing, exposed mic-control, relay, listener, crossfade, and accompaniment-progress logic has been removed; native GME microphone mixes remain muted internally where required for music uplink. Windows has source-level regression guards, but no vendor SDK build. SDK/license review and platform verification remain open.

The clean adapter contract now treats room quality as optional: core room/music endpoints are required, while `/room-quality` must be advertised before the client calls it. Effects remain optional and are required only when TTS is enabled. Current source capability matrix: Windows music + room quality + TTS effects; Linux music + room quality; Web music only; Redroid music + room quality. These are source declarations, not verified platform support.

The user chose to include original adapter source trimmed to music/TTS only. This supersedes the earlier staging choice to leave all adapter source out. The public export must still contain no account configuration, credentials/tokens, binaries, SDK payloads, or `node_modules`.

Source audit update (2026-10-07): unrelated relay, microphone/device, remote-speaker, listener, roster, sharing, progress, and crossfade implementation has been physically removed from the native Windows/Linux adapters. Web, Linux and Windows GME credentials are read from local environment variables, not embedded source values. Web `sdk/` and `node_modules/` remain excluded. The latest adapter inventory found no `LICENSE`, `NOTICE`, or `COPYING` file and no SPDX/copyright header; `web-h5/auth.js` identifies itself as a Node.js port of `gme_auth.py` without a source attribution/license notice. This is not license clearance.

Redistribution review (2026-10-07): Tencent's [GME SDK download guide](https://cloud.tencent.com/document/product/607/18521) identifies Tencent Cloud as the SDK provider and points to separate SDK usage/compliance documents, but the guide itself does not state a source- or binary-redistribution grant. The [Tencent Cloud Service Agreement, §7.1](https://cloud.tencent.com/document/product/301/1967) describes IP ownership and authorization requirements at the service level; it is not a product-specific GME SDK license. The SDK and adapter-source rights therefore remain uncleared. Keep vendor SDK payloads out and obtain the applicable written terms/rights-holder approval before public redistribution.

The legacy Web adapter lockfile lists 187 packages with declared license metadata and no missing `license` fields; expressions include MIT, Apache-2.0, ISC, BSD-2/3-Clause, 0BSD, and one Python-2.0 entry. The direct dependencies are Express and Puppeteer. This is a metadata inventory, not legal advice. Per the owner's 2026-10-07 instruction, no further project-source rights review is requested; no vendor GME SDK payload is included. Runtime-bundle notices still need review if dependencies are packaged. There are 15 source/manifest/build files under `adapters/`; Web and native GME credentials are supplied through local environment inputs, and build scripts avoid modifying or bundling vendor SDKs. Platform builds/E2E remain open.

Clean-contract comparison: the clean server requires `/capabilities` and `/health` plus `/join`, `/play`, `/stop`, `/pause`, `/resume`, `/volume`, and `/leave`; `/room-quality` is optional and is called only when advertised. TTS additionally requires `/effect-play`, `/effect-stop`, and `/effect-volume`. Source declares Windows music/quality/TTS, Linux music/quality, Web core music only, and Redroid music/quality. Native allowlists block unrelated routes and the corresponding legacy implementations have been removed. These are unbuilt source declarations, not verified compatibility.

- [x] Prune unrelated implementation blocks from native Windows source; Linux and Windows now retain room session, music playback, optional room quality, Windows TTS, and the loopback/auth boundary. Relay, mic/device control, roster/sharing, listener, progress, and crossfade code is removed; Windows source-level guards cover the trimmed endpoint/status contract.
- [x] Verify after the Windows source trim: native source guards pass (4/4), `npm test` passes (138/138), and `npm run typecheck` passes. Windows native C++ also compiled against local SDK inputs and its no-credential startup exited before opening HTTP or initializing GME. No room join or audio E2E was run; other adapters remain unbuilt.
- [x] Audit Web and Redroid API/source scope: karaoke progress, separate mic control, and legacy callbacks removed; auth/settings use local environment inputs; no SDK, account config, or binary payload is staged. Web retains only the private GME uplink needed to transmit generated music.
- [x] Preliminary clean-export scan (2026-10-07): 88 non-ignored candidate files, no suspicious config/runtime/binary/SDK paths, and no common private-key/token signatures; local root/portal `node_modules` and `web-portal-2/.next` build/cache output are ignored and outside the candidate export. Windows build output is directed outside staging; adapter `build/` is also ignored.
- [x] Fresh local Git export reviewed and published (2026-10-07): branch `main`, commit `454b0a8`, 88 audited files; no suspicious paths/credential signatures. `node_modules`/`.next` are ignored and excluded.
- [x] Audit dependency lock metadata and upstream notice cases; findings and conditional distribution actions are in `docs/dependency-license-audit.md`. No dependency package source is vendored.
- [ ] Review exact package artifacts/notices for any future installer or runtime bundle and include required attributions/notices; the source-only export is not distribution clearance.
- [x] Owner states rights to included project source are theirs and asked to skip further source-rights review (2026-10-07); no vendor SDK files are included in this repository.
- [ ] Build and test Linux, Web, and Redroid adapters against the clean server contract. Their required host/toolchain or SDK inputs are unavailable here; the Windows build alone does not establish platform/audio support.

### A — ขอบเขตและวางแผน

- [x] สำรวจโครงสร้างและ worktree
- [x] สรุปคำตอบล่าสุด ล้างข้อกำหนดเก่าที่ขัดกัน
- [x] เลือก public repo ใหม่ history ใหม่ ไม่มีบัญชีเริ่มต้น
- [x] ทำร่างคู่มือเพิ่มบัญชีภายหลัง
- [x] ผู้ใช้อนุมัติให้เริ่ม implementation

### B — เตรียมพื้นที่แยกและ audit

- [x] สร้าง clean staging `yello-music-bot-clean/` แยกจาก worktree เดิม ไม่มี `.git`/runtime config/keys/node_modules ที่ tracked
- [x] เก็บแผนและคู่มือ setup ไว้ใน staging โดยไม่เปลี่ยน remote เดิม
- [x] Staging source/export audit บันทึกใน plan แล้ว: เทียบ legacy API surface กับ clean router inventory, ตรวจรายการไฟล์ใน staging และบันทึกหมวดที่จงใจไม่นำเข้า; fresh Git history ยังเป็น blocker ก่อน publish
- [x] Audit startup/dispatch/HTTP/Socket.IO/timers/adapter callbacks/cleanup/shared consumers; ตรวจ room-listener detach, recovery cancellation, TTS cancellation, queue-monitor timer cleanup, bounded room actions และ graceful shutdown ที่ idempotent พร้อม regression test
- [x] Baseline: server syntax และ portal checks ผ่าน; `npm test` เดิม 621/622 ผ่าน (มี structural test เดิม fail ที่ `test/queue-playback-session.test.js`)
- [x] Adapter matrix บันทึกแล้ว: source ของ Windows native/Linux native/Web/Redroid อยู่ใน clean staging แต่ไม่มี vendor SDK/binaries; capability matrix มาจาก source declaration เท่านั้นและยังไม่ถือว่า platform verified

### C — Core และ state

- [x] Entry point เดียวประกอบ services; room/music/chat/settings แยก routers และ TTS แยก service
- [x] Setup-only entry point เดียวสร้าง config ว่างและ owner token โดยไม่เชื่อม YelloTalk
- [x] Core room-session รองรับบัญชีเดียว/ห้องเดียว, join ACK timeout, speaker-slot request, live message/count callbacks, bounded room-message send, manual leave และ recovery callback โดยไม่ล้างคิว
- [x] YelloTalk API client ดึง public rooms แบบจำกัดหน้า, ตรวจ room ID/voice ID และดึงรายละเอียดห้อง; owner-only API/UI สั่ง list/join/leave ได้โดยไม่ auto-connect
- [x] สร้างห้อง public ด้วย `topic` แบบเดิมเท่านั้น: API สร้างห้องสาธารณะ ตั้ง speaker limit 1, เปิดใช้งานผ่าน `create_room` ACK แล้ว join ในฐานะ host; ไม่มี description แยกตามข้อสรุปล่าสุด
- [x] YelloTalk API client อ่าน following แบบ read-only และแบ่งหน้า; ตัดรายการ blocked, deduplicate UUID แบบไม่สน case และ fail-closed เมื่อ response ไม่ใช่ list
- [ ] Auto-join ทั้ง following/public: รอ verified speaker-availability preflight ก่อนเลือก/เข้า; ห้าม join เป็น listener เพื่อ probe
- [ ] Following-only auto-join เมื่อ preflight พร้อม: กรองห้อง public ตาม owner UUID ที่ follow, ตัดห้องปัจจุบันออก แล้วสุ่มเฉพาะห้องที่ยืนยันช่องว่าง
- [x] Connection recovery ห้องเดิมแบบ bounded backoff 5 attempts; preserve queue และเริ่มเพลงปัจจุบันใหม่จากต้นเมื่อ reconnect; หลัง retry ครบคงสถานะ disconnected และเก็บคิวไว้โดยไม่สลับห้อง; adapter-outage recovery ยังไม่ทำ
- [x] บัญชีเดียว/คิวเดียว/empty-account startup ไม่เชื่อมจนตั้งค่าครบ; tests ยืนยัน setup-required และไม่ connect จนสั่งเข้าห้อง
- [x] Allowlist parser/help เหลือคำสั่งเพลงและ `.tts`; `.autoplay2`/`.find`/`.report` ถูกตัด และ URL ลอยไม่ถูก parse เป็น command
- [x] ต่อ parser เข้ากับ room event แล้ว: ทุกคนในห้องใช้ allowlisted music commands ได้; ignore bot echo/unknown commands, cooldown ต่อผู้ส่ง, ไม่ dispatch URL เปล่า/AI music
- [x] Public room list/detail และ manual join/leave ผ่าน owner-only control panel
- [x] Create public room ด้วย topic เดิมและ join เป็น host
- [ ] Following list/สุ่มเข้าห้อง public: ปิดไว้จนกว่าจะยืนยัน speaker-availability preflight ได้
- [x] Auto-request speaker slot หลัง join เมื่อได้รับ `speaker_changed` ที่มีช่องว่าง
- [ ] สุ่มห้อง public ตาม speaker availability หลังยืนยัน preflight endpoint
- [x] State transitions/cancellation/stale guards: tests ครอบคลุม false-result retry, bounded failure/cancel/stale recovery, manual leave ยกเลิก in-flight join, manual room change เทียบกับ recovery queue semantics และ stale playback หลัง skip
- [x] Bounded same-room retry/backoff/recovery/current-song restart ไม่เพิ่ม/เลื่อนคิวซ้ำ; เมื่อ retry ครบคง disconnected พร้อมเก็บคิวไว้; verified speaker preflight/cache/adapter-health recovery ยังเปิดอยู่
- [x] Settings persistence/defaults/migration อยู่ใน local config; session/queue อยู่ใน RAM และ audio cache ใช้เฉพาะรอบโปรแกรม

### D — เพลงและฟังก์ชันเสริม

- [x] Request resolver/queue-state สำหรับ YouTube search/URL/playlist พร้อม live/duration/blocklist guards, คิวจำกัดขนาด และ stale-generation guard
- [x] Core yt-dlp download/retry, session-only file ownership, queue-to-adapter play/poll and stop/pause/resume/skip controls; live SDK E2E remains unverified
- [x] Autoplay/Repeat/Loop และ settings persist; Autoplay resolve ผ่าน live/duration/blocklist guard; ไม่มี Autoplay2
- [x] Fade in/out คงที่ 1500 ms ทำใน playback service ด้วย `/volume` software steps ทุก 100 ms สำหรับ start/stop/skip/room detach; volume/TTS ducking ใหม่ยกเลิก ramp เก่า และ stop เกิดก่อน release; ทดสอบ timing/order/cancellation แล้ว; actual audio smoothness/timing ยังรอ live adapter E2E; ถอด Crossfade/EQ/loudnorm/transcode/cache options เฉพาะ
- [x] Format/quality/`.sq` มี validation/settings ร่วม; adapter quality capability ถูกตรวจตอนเข้าใช้
- [x] Blocklist/no-live/max duration บังคับใช้กับ search/URL/playlist/autoplay
- [x] Cache ownership: cache map อยู่ใน client process, ไฟล์ดาวน์โหลดมี run ID, `release()` ลบเฉพาะไฟล์ที่ client เป็นเจ้าของ และ failed-run cleanup ลบเฉพาะ prefix ของ run; playback stop adapter ก่อน release และมี regression test; ไม่มี prefetch/Autoplay2; crash อาจทิ้งไฟล์ orphan ใน ignored cache directory
- [x] Azure TTS provider/queue/settings/`.tts`/SSML escaping, own-effect cleanup, cancellation และ ducking 0.30 คืน base volume ล่าสุด; ต้องมี adapter effects capability, live audio E2E ยังไม่ยืนยัน
- [x] ไม่มี profanity/usage tracking; คง SSML escaping, bounded chat/rate limits และไม่ log เนื้อหาแชต
- [x] Groq direct stateless name/mention chat/fortune ไม่ควบคุมเพลง; มี sender cooldown และจำกัด concurrent requests, ไม่มี conversation history
- [x] AI reply TTS toggle แยกจากข้อความทักทาย/บอกลาที่เป็น text-only; มี template editor, ปิดโดยค่าเริ่มต้น, ใช้ single-person participant delta ใน RAM, ไม่ทัก baseline/ไม่เก็บ roster ถาวร/ข้าม batch และกัน bot echo
- [x] ถอดระบบ multi-bot/portal monitoring/tunnel/relay/mic/room moderation และระบบเดิมนอกขอบเขตจาก clean staging; route inventory เหลือ status/settings/rooms/chat/music/TTS ที่เลือกกับ lifecycle timers ที่จำเป็น

### E — เว็บและ adapters

- [x] UI ใหม่สามส่วน (Music/Chat/Settings) พร้อม onboarding ขั้นต้น
- [x] UI เพลงเชื่อม public-room list, manual join/leave, YouTube request and playback controls gated on a configured adapter
- [x] Live chat UI เชื่อม owner-auth HTTP polling/send service; bounded RAM buffer สูงสุด 100 ข้อความ, clear เมื่อออก/หลุด
- [x] Live chat/send ไม่ persist history/roster; web dot command เป็นข้อความเท่านั้น ไม่ dispatch/ไม่ TTS; จำกัด send rate
- [x] Owner auth สำหรับ HTTP APIs/LAN origins และ internal/adapter auth แยก; ไม่เปิด app Socket.IO endpoint (ใช้ HTTP polling)
- [x] Portal staging เหลือหน้าเดียวและเฉพาะเมนูควบคุมเพลง/ห้อง/แชต/ตั้งค่า; ไม่มี legacy pages/types/subscriptions/assets จาก UI เดิม
- [x] Import และ trim adapter source/build instructions ตามขอบเขตเพลง/TTS แล้ว: มี source สำหรับ Windows/Linux/Web/Redroid โดยไม่มี vendor SDK/binaries; การ build และ verify platform จริงยังเปิดอยู่
- [ ] Build/test ทุก adapter: Windows native C++ compile และ no-credential fail-closed smoke ผ่านกับ local SDK inputs (SDK version/terms ยังไม่ยืนยัน); Linux/Web/Redroid ยังไม่ build และยังไม่มี live GME audio E2E จึงยังห้ามอ้าง platform support
- [x] Clean staging ไม่มี macOS/tunnel deployment หรือ legacy deployment scripts; เก็บเฉพาะ build scripts ของ adapter แต่ละ platform และไม่รวม SDK/binaries
- [x] ไม่เขียน/redirect log ลงไฟล์อัตโนมัติ; audit พบเฉพาะ generic console error และ local config/TTS audio writes ตามหน้าที่

### F — Public export และคู่มือ

- [x] ตรวจ direct dependencies กับ imports/installed tree; ถอด `socket.io` server ที่ไม่ใช้ คง `socket.io-client` สำหรับ YelloTalk และยืนยันด้วย `npm ls --depth=0`
- [x] `config.example.json` เป็น JSON ถูกต้อง ตรงกับ `DEFAULT_CONFIG` และ credential/identity fields ว่าง
- [x] Inventory lockfile/installed dependency metadata for all three package trees (root 109/109, portal 104/136, Web adapter 0/187 installed); document missing top-level notices and notable CC-BY-4.0, LGPL, and Python-2.0 entries in `docs/dependency-license-audit.md`. This is not redistribution clearance.
- [ ] Final package-payload/NOTICE review for any installer or runtime bundle, including platform-specific sharp/libvips artifacts and any absent QA packages; retain the selected root `ISC` metadata/no `LICENSE` file and keep GME SDK out pending permission.
- [x] สร้าง clean staging แยก ไม่ copy `.git`/history/runtime; ต้องตรวจ allowlist/secrets ซ้ำก่อนรับรอง public export
- [x] Secret/data scan แบบแสดงเฉพาะ path: ไม่พบ local config/env/token/history/log/cache/audio/binary artifacts; high-entropy credential patterns ที่พบจำกัดอยู่ใน test fixtures เท่านั้น ไม่พบ hits ใน runtime source/docs/config example
- [x] `.gitignore` ครอบคลุม local config/access/env/certs/snapshots/.tmp/history/log/cache/audio/build/deployment; ทดสอบ representative paths ด้วย `git check-ignore`
- [x] สิทธิ์แจก SDK: ไม่มี GME SDK/library bundle หรือ source ใน staging จึงไม่มี SDK ให้ redistribute; ถ้าเลือก adapter ภายนอกภายหลังต้องทวนเงื่อนไขก่อนแจก/อ้างรองรับ
- [x] คู่มือ setup/schema/tool versions/Windows-Linux Node commands/Web-Redroid capability/AI-Azure/token rotation/troubleshooting ครบตามขอบเขตที่ส่งมอบ และระบุข้อจำกัดโดยไม่อ้าง platform support ที่ไม่มี; การ pin SDK และทดสอบ build/start/stop ของ adapter จริงติดตามแยกใน checklist adapter/platform
- [x] Fresh export-like copy ไม่มี `.git`/runtime credentials; รอบ copy เดิม `npm ci` ทั้งสอง lockfile และ first-run API smoke ผ่านโดยบัญชียังว่าง; รอบนั้นมี 104 tests ก่อนแก้ไขเพิ่มเติม ส่วน current staging verification บันทึกแยกในหัวข้อ G
- [x] Historical snapshot only: earlier disposable clone/history test covered 69 files. Current clean export is committed and pushed as `454b0a8` to `Poppy-ylt/yello-talk-bot` on `main` using the configured Git identity.
- [x] ยังไม่สร้าง GitHub repo/push/deploy; ต้องรอคำสั่งเผยแพร่โดยตรง

### G — ตรวจรับ

- [x] Commands/permissions/queue/format/quality/Autoplay/Repeat/Loop precedence: room allowlist/member commands, owner-auth HTTP routes, queue operations, format/quality validation และ Repeat > Loop > upcoming queue > Autoplay มี test; ไม่มี weighted priority-queue feature
- [x] Blocklist/live/playlist และ duration boundary 3600 วินาที: ครอบคลุม live/unknown duration, playlist filtering, blocked candidates, exact 3600 accept และ 3601 reject
- [x] Startup idle/queue empty/settings restore/manual transition ล้างคิว: setup-required ไม่เชื่อมเอง, config settings อ่านกลับได้, queue เริ่มว่าง และ manual leave/change ล้างหรือ preserve ตามเหตุการณ์
- [x] Recovery/current-song restart และ stale cancellation ของ same-room reconnect; เมื่อ retry ครบไม่ auto-switch และเก็บคิวไว้; verified speaker preflight/cache/adapter-outage recovery ยังเหลือ
- [x] TTS ducking/volume change/error/cancel/คิวต่อเนื่อง/echo: ทดสอบ voice effect volume update, duck/restore, effect failure cleanup, synthesis failure แล้วคิวถัดไปทำต่อ, disable cancellation และ bot echo/dedup
- [x] Groq stateless/name-mention/fortune/config missing/AI speech/greeting-farewell มี unit/integration coverage; live protocol/adapter E2E ยังต้องยืนยัน
- [x] LAN owner auth/web send ไม่ dispatch/no persistent history/log; integration tested
- [x] Regression test ยืนยัน retired bot-management/monitoring/tunnel/playlist/autoplay/mic/following/shutdown routes ตอบ 404; runtime ไม่มี portal event-history server หรือ background bot fleet service
- [x] Staging verification (2026-10-06): `npm test` ผ่าน 130 tests, server typecheck, portal typecheck และ production build ผ่านหลังเพิ่ม graceful-shutdown, fade 1500 ms/timing/stop-order/cancellation, duration-boundary, TTS-failure และ queue-priority regressions; live GME SDK/participant-event E2E ยังไม่ยืนยัน
- [x] Targeted music/session/TTS tests ผ่าน 61/61 หลังเพิ่ม fade timing/stop-order/volume-cancellation และ boundary/error/queue coverage
- [x] Latest source/export verification (2026-10-07): `npm test` passed 138/138 and `npm run typecheck` passed. The current candidate export scan found 88 files with no suspicious paths. Windows native C++ compiled successfully to Temp using the available local header/import library (SDK version and terms unverified); the no-credential startup failed closed with exit 2 before HTTP/GME initialization. No live room/audio E2E was performed; Linux/Web/Redroid builds remain unverified.
- [ ] Remaining technical release checks: build/test Linux, Web, and Redroid adapters and run authorized audio E2E before claiming platform support. Review notices only if producing an installer/runtime bundle. Owner-rights review was waived at the owner's direction; local `node_modules` and `web-portal-2/.next` were not published.

## รายละเอียดเทคนิคที่ต้องตรวจตอนลงมือ

เป็นงาน implementation ไม่ใช่ข้อกำหนดเก่าที่ยังรอคำตอบ:

- Capability ทุก adapter โดยเฉพาะ TTS/ducking/quality และ SDK prerequisites
- Priority Repeat/Loop/Autoplay, metadata duration ไม่ทราบค่า/upcoming, retry bounds/queue limits
- Defaults volume/format/quality/voice, schema/Groq model/token generation/setup commands
- License choice ที่บันทึก: คง package metadata `ISC` และไม่มีไฟล์ `LICENSE` ตาม repo เดิม; ไม่สร้างชื่อ copyright holder เอง การเลือกนี้ไม่ใช่การตรวจ license ทางกฎหมาย; กำหนดชื่อ repo และยืนยัน author-email privacy ก่อน public history

Routine choices ตัดสินจากโค้ด/ผลทดสอบและบันทึกเหตุผลได้ ถ้าข้อจำกัดบังคับเปลี่ยนความสามารถที่เลือก ให้รายงานและถามก่อนเปลี่ยนขอบเขต

## เกณฑ์เสร็จ

โค้ด/UI เหลือรายการที่เลือก ไม่มีเส้นทางซ่อนของระบบตัด ผลตรวจ adapters/ข้อจำกัดชัดเจน State/recovery/settings/cache/TTS ตรงแผน คู่มือ fresh clone ใช้ได้จริง Public export ไม่มีบัญชี/ข้อมูล/history เดิม โดยงานเดิมและ live bots ไม่ถูกกระทบ
