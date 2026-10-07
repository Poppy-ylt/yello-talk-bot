# คู่มือตั้งค่าโปรเจกต์คลีนสำหรับ Public Repository

ชื่อผลิตภัณฑ์: **Yello Music Bot** เว็บใช้ชื่อกลางนี้ ไม่มีภาพหรือชื่อบอทเดิมของผู้พัฒนา ชื่อเรียกบอทและ persona ตั้งภายหลังใน local config

Status as of 2026-10-07: the clean export is published to `Poppy-ylt/yello-talk-bot` on `main` at initial commit `454b0a8`. The owner states rights to the included project source are theirs and requested no further rights review; this is an owner assertion, not independent verification. The Windows native adapter compiled locally and failed closed without credentials; Linux/Web/Redroid builds, future bundle notices, and live audio E2E remain unverified.

Adapter source inclusion decision (2026-10-06): the user selected inclusion of original adapter source trimmed to music/TTS only, excluding account data, credentials, binaries, SDK payloads, and `node_modules`. Source files are staged under `adapters/`; unrelated native relay, microphone-control, listener, sharing, progress, and crossfade code has been removed. Web and native GME credentials are supplied through local environment variables. Windows source compiled against local SDK inputs, but SDK/source redistribution rights and Linux/Web/Redroid builds remain open. See `music-only-plan.md` for the adapter checklist and capability gaps.

## สิ่งที่มาพร้อม repository

The clean export contains API/portal source, preliminary adapter source and build instructions, tests, manifests, lockfiles, docs, and example config. It excludes adapter accounts/secrets, binaries, proprietary SDK payloads, user data, old queues/cache/recordings, and developer-machine files.

ขณะนี้มี setup API/portal, owner token, การโหลดห้องสาธารณะ, manual room session, YouTube request/download/playback, allowlisted music commands, chat UI แบบ owner-auth พร้อม buffer ใน RAM จำกัด 100 ข้อความ, Azure TTS queue/ducking ที่ต้องใช้ adapter ซึ่งประกาศ speech-effect capability, Groq คุยเล่น/ดูดวงแบบ stateless เมื่อมีการเรียกชื่อ และข้อความทักทาย/บอกลาจากการเปลี่ยนสมาชิกทีละคน การหลุดจาก YelloTalk จะ retry ห้องเดิมสูงสุด 5 ครั้งและรักษาคิว; หากไม่สำเร็จจะคง disconnected และรอเจ้าของเลือกห้องเอง—ยังไม่ auto-join/fallback เพราะไม่มี verified speaker-availability preflight และห้าม probe ด้วยการเข้าเป็น listener. ยังไม่มี recovery เมื่อ adapter เสียงล้ม. ยังไม่ bundle/validate SDK adapter จริง จึงยังยืนยันเสียง end-to-end หรือรูปแบบ participant event กับ live session ไม่ได้

## เตรียมเครื่อง

Current status correction (2026-10-07): adapter sources, manifests and platform build instructions are present under `adapters/`; no proprietary SDK or compiled adapter is included. Web/Redroid surfaces and native HTTP entry points have been narrowed; Linux and Windows unrelated roster/sharing/mic-control/relay/listener/progress/crossfade implementation has been pruned, and native credentials/callbacks have been removed. A local Windows compile passed using SDK inputs outside staging; the owner directed that no further source-rights review be done. Platform-support claims remain blocked pending Linux/Web/Redroid builds and live audio E2E; runtime-bundle notices remain open only if such a bundle is produced.

Verification update (2026-10-07): `npm test` passed 138/138 and `npm run typecheck` passed. The public repo contains exactly the 88 audited files in commit `454b0a8`; the local worktree is clean and `main` tracks `origin/main`. No suspicious config/runtime/binary/SDK paths or common private-key/token signatures were found. Root and portal `node_modules`, plus `web-portal-2/.next` build/cache output, remain local and ignored. Windows native C++ compiled successfully to Temp using SDK inputs outside the export; no-credential startup exited before HTTP/GME. No room join or live audio E2E was performed.

### Adapter compatibility

Latest adapter status (2026-10-07): Web and Redroid HTTP surfaces are narrowed to room/music controls, and their karaoke-progress/mic-control/callback paths are removed. Native Windows/Linux expose only allowlisted music endpoints and report declared music capabilities; callbacks and embedded SDK credentials were removed. Unrelated native roster/sharing/mic-control/relay/listener/progress/crossfade implementation is pruned. Source matrix: Windows music/quality/TTS, Linux music/quality, Web music only, Redroid music/quality. Windows compilation passed locally, but no platform has passed room/playback/audio E2E. The clean client requires room join/playback/volume/leave; room quality and TTS effects are optional capabilities.

Clean staging includes source under `adapters/windows-native`, `adapters/linux-native`, `adapters/web-h5`, and `adapters/redroid`; unrelated adapter features were trimmed. Windows native C++ compiled locally and the executable exited before HTTP/GME initialization when credentials were absent; no adapter has passed room/playback/audio E2E against `GmeAdapterClient`. No SDK or binary is included. The app accepts `adapter.type` values `native`, `web`, and `redroid`, but that value does not select or verify an implementation. Do not treat any platform as supported until its adapter is built and tested.

| Target | Included here | Music playback | TTS effects | Build / live verification |
| --- | --- | --- | --- | --- |
| Windows native | Trimmed source; build output kept in Temp | Compiled locally against local SDK inputs; room/audio behavior unverified | Source advertises effects; unverified | No live E2E |
| Linux native | Trimmed source; no SDK payload | Unbuilt: no Linux host/WSL distro or `pkg-config` | Source advertises no speech effects | Not tested |
| Web/browser | Trimmed source; H5 SDK excluded | Unbuilt: SDK asset and adapter-local dependencies absent | Source advertises no speech effects | Not tested |
| Redroid | Trimmed bridge source; no SDK/APK | Unbuilt: Android SDK, GME JAR/JNI, and signing inputs absent | Source advertises no speech effects | Not tested |

The generic client permits plain HTTP only on `localhost` or `127.0.0.1`. A music adapter must report `features.status`, `features.health`, and `features.playMusic` as true and advertise `/join`, `/play`, `/stop`, `/pause`, `/resume`, `/volume`, `/room-quality`, and `/leave`; `/status`, `/health`, and `/capabilities` are also required by the client. TTS is optional and additionally requires `features.effects` plus `/effect-play`, `/effect-stop`, and `/effect-volume`. These checks validate an adapter's declared contract, not its SDK license or actual audio output.

The playback service implements a fixed 1.5-second fade-in/out as 100 ms software volume steps through the adapter's required `/volume` endpoint. It runs on track start, stop, skip, and room detach; it does not require a native fade endpoint, and a manual volume or TTS-ducking change cancels the in-progress ramp so the newer level wins. Unit tests verify the step timing, stop-before-release ordering, and cancellation. Actual audio smoothness and timing still depend on the selected adapter and remain unverified without a live GME audio test.

1. ใช้ Node.js >=20.9.0 ตาม engine requirement ของ Next.js 16.1.1; staging นี้ตรวจด้วย Node.js 24.14.0/npm 11.9.0 เท่านั้น
2. ติดตั้ง dependencies จาก lockfiles ด้วย `npm ci` และ `npm --prefix web-portal-2 ci`; ต้องมี `yt-dlp` และ FFmpeg ใน PATH เมื่อใช้งานดาวน์โหลด/แปลงเสียง เครื่อง QA Windows นี้พบ `yt-dlp 2026.08.19` และ `FFmpeg 8.1.2-full_build-www.gyan.dev`; ยังไม่ pin หรือรับรองเวอร์ชันเหล่านี้ และไม่ได้ทดสอบ download/audio E2E จริง
3. Build portal ด้วย `npm --prefix web-portal-2 run build`. Native build scripts are under `adapters/`; Windows was compiled locally. Linux requires a Linux toolchain and `pkg-config`; Web requires the separately obtained H5 SDK and adapter dependencies; Redroid requires Android SDK plus separate GME JAR/JNI and local signing inputs. Those inputs are not configured here. Never copy SDKs or generated binaries into the public export.

คำสั่ง Node API/portal ใช้ได้ทั้ง Windows และ Linux แต่การทดสอบนี้ไม่ได้รับรอง adapter หรือ audio output ข้ามระบบปฏิบัติการ ห้ามติดตั้ง/แจกจ่าย SDK ก่อนตรวจ license ของ adapter ที่เลือก

### ติดตั้ง เริ่ม และหยุด

รันจากโฟลเดอร์โปรเจกต์ใน terminal แรก:

```sh
npm ci
npm --prefix web-portal-2 ci
npm start
```

ใน terminal ที่สองเริ่ม portal:

```sh
npm run portal:dev
```

เปิด portal ที่ `http://localhost:5254`; API ใช้พอร์ต `5353`. หยุดแต่ละโปรเซสด้วย `Ctrl+C`; API จะพยายามหยุด playback/TTS, ออกจาก audio adapter และออกจากห้องก่อนจบโปรเซส การ build portal ใช้ `npm --prefix web-portal-2 run build`. หาก PowerShell ปิดการรัน `npm.ps1` ให้เรียก `npm.cmd` แทน `npm`.

ครั้งแรก API สร้าง `config.local.json` และ `owner-token.txt` ใน working directory (ปรับ path ได้ด้วย `YMB_CONFIG_PATH` และ `YMB_OWNER_TOKEN_PATH`) ไฟล์ทั้งสองเป็นข้อมูลลับเฉพาะเครื่องและถูก ignore โดย Git; ตั้ง JWT/UUID, Groq/Azure keys และ adapter token ใน config โดยตรง ไม่ส่งผ่านหน้าเว็บ การ rotate owner token ให้หยุด API, แทนเนื้อหา `owner-token.txt` ด้วยค่าสุ่มใหม่อย่างน้อย 32 ตัวอักษร แล้วเริ่ม API และใส่ token ใหม่ใน portal; token ใน portal อยู่ใน session storage ของ tab เท่านั้น หาก YelloTalk JWT หมดอายุให้แทน `account.jwtToken` ใน local config ด้วย token ที่เจ้าของบัญชีออกใหม่แล้ว restart API—ระบบนี้ไม่มี refresh-token flow อัตโนมัติ

## เพิ่มบัญชีบอทภายหลัง

### ทางเลือก adapter

Windows native, Linux native, Web และ Redroid มี preliminary source อยู่ใต้ `adapters/`; ผู้ใช้ต้องจัดหา proprietary GME SDK, platform toolchain และ credentials ที่มีสิทธิ์ใช้งานเอง ไม่มี SDK/binary แนบมา ตารางด้านบนบันทึก capability ที่ประกาศใน source เท่านั้น ห้ามอ้างว่า playback, fade, TTS, room quality หรือ recovery ทำงานจริงบน platform ใดจนกว่าจะ build และทดสอบ adapter ของ platform นั้น

1. คัดลอก config ตัวอย่างปลายทางเป็น local config ตาม schema หลัง refactor ห้ามใช้ข้อมูลบัญชีเดิมของผู้พัฒนา
2. ใส่บัญชี YelloTalk ของคุณหนึ่งบัญชี โดยกรอก JWT/UUID และค่าที่ระบบจำเป็นต้องใช้เฉพาะใน local config
3. ตั้งชื่อเรียก/aliases และ persona คงที่ใน local config หากใช้คุยเล่น/ดูดวง
4. ตั้ง Groq API key/model สำหรับคุยเล่น/ดูดวง (เชื่อม Groq โดยตรง ไม่ใช้ relay/proxy ของโปรเจกต์) และ Azure TTS credentials หากใช้ TTS; เก็บ keys ในช่องทาง local ที่ implementation รองรับ ไม่ใส่ในตัวอย่าง
5. ใช้ owner token แบบสุ่มที่ API สร้างแยกต่อเครื่อง; วิธี rotate อยู่ในหัวข้อ “ติดตั้ง เริ่ม และหยุด” ไม่ใช้ token จาก portal/เครื่องอื่น
6. ตั้ง portal/API origins และ LAN address ของเครื่องตนเอง ห้ามใส่ URL/token/IP ส่วนตัวจากเครื่องผู้พัฒนาใน release

ขณะยังไม่ใส่บัญชี ระบบปลายทางต้องแสดงสถานะยังไม่ตั้งค่าและไม่พยายามเชื่อมบริการภายนอก วิธีแก้ token หมดอายุ/สร้าง token ใหม่และตำแหน่ง config จริงจะเติมหลังทดสอบ

ใน implementation ปัจจุบัน API สร้าง `config.local.json` ว่างเมื่อเริ่มครั้งแรก การตั้ง JWT/UUID, keys ของ Groq/Azure, ชื่อเรียก, aliases และ persona ทำในไฟล์นี้บนเครื่องเท่านั้น หน้าเว็บไม่รับหรือส่ง credentials ส่วน settings ที่ไม่ใช่ความลับจึงค่อยแก้ผ่าน owner token ได้ TTS จะเปิดได้เมื่อมี Azure key/region และ adapter ตอบรับ `/effect-play`, `/effect-stop`, `/effect-volume` พร้อม `features.effects: true`

## สิ่งที่ใช้ได้ใน implementation ปัจจุบัน

1. ติดตั้ง dependencies แล้วเริ่ม API/portal ตามคำสั่งใน README
2. แก้ `config.local.json` บนเครื่องที่รันบอทเพื่อใส่ JWT, UUID และชื่อแสดงผลของบัญชี ห้ามส่งข้อมูลนี้ผ่านเว็บ
3. เปิด portal แล้วใส่ owner token จาก `owner-token.txt`
4. กดโหลดห้องสาธารณะแล้วเลือกเข้าห้อง หรือระบุ Room ID เพื่อให้ API ดึงรายละเอียดห้องก่อน join; กดออกจากห้องเมื่อต้องการ

การเข้าห้องเริ่ม YelloTalk session และจะ join GME adapter ด้วยหากตั้งค่า `adapter.type`, `adapter.baseUrl` และ `adapter.token` ใน local config พร้อมเริ่ม adapter แยกต่างหาก ระบบเพลงเปิดคำขอ YouTube และ queue controls เมื่อ adapter พร้อมแล้ว ทุกคนในห้องใช้ allowlisted music dot commands ได้; `.tts` ตั้งค่าการอ่านแชตทั่วไปโดยไม่อ่านคำสั่งหรือข้อความสะท้อนจากบอท เมื่อเปิด TTS ระบบตรวจ speech-effect capability ก่อนเล่นและคืน volume เพลงที่ตั้งล่าสุดหลังพูดจบ ทั้ง music/TTS ยังไม่มีการยืนยัน E2E กับ SDK adapter ที่ bundle โดยโปรเจกต์นี้. การสร้างห้อง public มีแล้ว; auto-join ทั้งสองโหมดปิดไว้จนกว่าจะพบ verified speaker-availability preflight.

ตั้ง Azure `subscriptionKey` และ `region` ใน local config แล้วใช้ Settings หรือ `.tts on` เพื่อเปิดอ่านแชต; `.tts voice`, `.tts speed`, `.tts pitch` และ `.tts vol` ปรับเสียงได้ การเปิดใช้จะถูกปฏิเสธถ้า credentials ไม่ครบหรือ adapter ไม่ประกาศ speech effects

Update (2026-10-06): Per the selected scope, public-room creation uses only the existing `topic` field as the room name, with no separate description. The flow activates the room and joins as host after the REST create request. Auto-join (following/public) is disabled until a verified speaker-availability preflight exists; entering a room as a listener to test capacity is intentionally not used.

Manual join makes an authenticated room-detail request and normalizes both the YelloTalk room ID and GME voice ID before opening a room session. If the response has no valid room/voice identity, the clean API returns 404 without opening the session or invoking the adapter; API transport failures return 502. Select IDs from the bot's own room directory rather than guessing them.

Update (2026-10-06): After all five same-room recovery attempts fail, the bot stays disconnected and preserves the queue for an explicit owner action. It does not auto-switch to a followed room without checking speaker availability. Public-room availability-based selection and recovery from a separate audio-adapter outage remain unimplemented.

## พฤติกรรมเป้าหมายและรายการที่ยังเหลือ

เว็บปลายทางใช้หน้าใหม่แบบเรียบง่าย มีสามส่วนหลัก: ควบคุมเพลง, แชต และตั้งค่า พร้อมสถานะพื้นฐานและ error log ไม่ใช้เมนูระบบเดิมทั้งหมด

เมื่อ setup ใหม่และยังไม่มี settings เดิม TTS, คุยเล่น/ดูดวง, ทักทาย/บอกลา, Autoplay/Repeat/Loop และการอ่านคำตอบ AI เริ่มเป็นปิด เปิดผ่านเว็บเมื่อ config/key พร้อม หลังเปลี่ยนค่าจะจำค่าล่าสุด ไม่ปิดกลับทุกครั้งที่ restart ไม่มี Autoplay2

หลัง config/build พร้อม ใช้ start commands ที่ตรวจแล้วสำหรับ Windows/Linux เปิดเว็บด้วย owner token จาก localhost หรือ LAN เลือกห้องจากรายการหรือสร้างห้อง public ไม่มีการรับลิงก์ห้อง; ปุ่ม auto-join ยังปิดจนกว่าจะตรวจ speaker ว่างล่วงหน้าได้อย่างยืนยัน

เมื่อมี verified speaker-availability preflight แล้ว auto-join จะเลือกได้ระหว่างห้องของคนที่บอทติดตามกับห้อง public อื่นที่มีช่อง speaker ว่าง และสุ่มเฉพาะห้องที่ผ่านการตรวจ; ปัจจุบันทั้งสองโหมดปิดอยู่

โหมดเฉพาะคนที่ติดตามใช้รายชื่อที่บัญชี YelloTalk ติดตามอยู่แล้ว จัดการ follow/unfollow ผ่านบัญชีของคุณเอง เว็บบอทมีเฉพาะตัวเลือกโหมด ไม่จัดการรายชื่อ

เมื่อเลือกสร้างห้อง เจ้าของระบุชื่อในช่อง `topic` เดิมผ่านเว็บ โดยสร้างห้องสาธารณะเท่านั้น ไม่มีช่องคำอธิบายแยก ไม่มีตัวเลือกห้องส่วนตัว และไม่ใช้ข้อมูลห้องเดิมจากเครื่องผู้พัฒนา

บอทเลือกช่อง speaker ว่างอัตโนมัติ ไม่มีตัวเลือกตำแหน่งช่องบนเว็บ

เว็บแสดงแชตสดและให้เจ้าของส่งข้อความเข้าห้องผ่านบัญชีบอทได้ผ่าน owner-auth buffer เก็บใน RAM สูงสุด 100 ข้อความและล้างเมื่อออก/หลุดจากห้อง ไม่บันทึกประวัติลงไฟล์ และไม่ใช้ข้อความก่อนหน้าเป็นบริบทคุยเล่น; ข้อความ dot command จากเว็บส่งเป็นข้อความเท่านั้น ไม่ dispatch และไม่อ่านออกเสียง ส่วนข้อความทั่วไปอ่านได้เมื่อ TTS เปิด

เว็บแสดงจำนวนคนในห้อง แต่ไม่มีรายการชื่อ/รูปผู้เข้าร่วมแยกหรือหน้ารายละเอียดบุคคล ชื่อผู้ส่งยังแสดงในแชตสด

ข้อความทั่วไปที่เจ้าของส่งจากเว็บจะอ่านออกเสียงเมื่อ TTS เปิดอยู่ โดยไม่อ่านซ้ำจากข้อความสะท้อนกลับในห้อง

ช่องแชตเว็บไม่รันคำสั่งจุด เช่น `.play`/`.tts` ให้ใช้ปุ่มบนเว็บควบคุมบอท คำสั่งจากช่องนี้ส่งเป็นข้อความและไม่อ่านออกเสียง ส่วนคำสั่งจุดจากผู้ใช้ในห้องยังใช้ได้

หากทุกคนออกจนเหลือบอทตัวเดียว บอทยังอยู่ในห้องและเล่นต่อ ไม่ย้ายห้องเพียงเพราะห้องว่าง

เมื่อเจ้าของสั่งออกหรือเปลี่ยนห้องเอง เพลงหยุดและคิวถูกล้าง ส่วนการหลุดจาก YelloTalk session จะลองกลับห้องเดิมสูงสุด 5 ครั้งแบบ backoff; หากกลับได้จะรักษาคิวและเริ่มเพลงปัจจุบันจากต้น การตรวจจับ/กู้คืนเมื่อ audio adapter ล้มหรือห้องปิดยังไม่ทำ

หาก same-room recovery สำเร็จและต้องเริ่ม playback ใหม่ จะเริ่มเพลงปัจจุบันจากต้นแล้วเล่นคิวต่อ หากห้องเดิมใช้ไม่ได้หลัง retry ครบ ระบบคง disconnected และเก็บคิวไว้ เจ้าของต้องเลือกห้องใหม่เอง; recovery จะไม่ auto-switch จนกว่าจะมี verified speaker-availability preflight

ทุกคนในห้องใช้คำสั่งจุดเพลงและ `.tts` ได้ URL เพลงเปล่าไม่เพิ่มคิว ใช้ `.play`/`.add` รองรับ YouTube เพลงและ playlist ไม่รองรับ Spotify

ทุกคนในห้องใช้ `.sq` ปรับคุณภาพเสียง Fluency/Standard/HQ ได้เช่นเดียวกับตัวปรับบนเว็บ และระบบจำค่าล่าสุด

ไม่รับ YouTube live และจำกัดความยาวเพลงตามเวลาสูงสุดที่เจ้าของตั้งผ่านเว็บ กฎนี้ใช้กับ playlist และ autoplay ด้วย ค่าเริ่มต้นคือ 60 นาที และจำค่าล่าสุดเมื่อเจ้าของปรับ

cache index เพลงใช้ซ้ำเฉพาะระหว่าง process เดียว; track ที่จบ/หยุดจะ release ไฟล์หลัง adapter หยุดแล้ว และ failed download ลบเฉพาะไฟล์ของ run นั้น หาก process ถูก kill/เครื่องดับ ไฟล์ orphan อาจค้างใน `music-cache` ซึ่งถูก ignore และไม่ถูกนำกลับมาใช้หลังเริ่มใหม่; ผู้ใช้ลบ directory นี้เองได้เมื่อโปรแกรมหยุดอยู่ ส่วนค่าตั้งเพลง/TTS ยังจำไว้ตามเดิม

TTS อ่านแชตทั่วไป ลดเสียงเพลงระหว่างอ่าน ตั้งเสียง/ความเร็ว/pitch/ความดังได้ คุยเล่น/ดูดวงต้องเรียกชื่อหรือ mention บอท การอ่านคำตอบเปิด/ปิดบนเว็บได้ ทักทาย/บอกลาเป็นข้อความเท่านั้น; ใช้ snapshot ใน RAM ระหว่าง session เพื่อดูความเปลี่ยนแปลงทีละคน ไม่ทักสมาชิกที่อยู่ก่อนเริ่ม และไม่บันทึก roster/history ลงไฟล์

ระหว่าง TTS อ่าน เสียงเพลงลดเหลือ 30% ของ volume ที่ตั้งไว้ แล้วคืนระดับล่าสุดเมื่ออ่านจบ เช่น ตั้ง volume 80 จะลดเหลือ 24 ชั่วคราว

เว็บแสดงสถานะและข้อผิดพลาดของ TTS ไม่มีหน้าสถิติการใช้หรือการเก็บ usage history

Error log บนเว็บเก็บเฉพาะในหน่วยความจำระหว่างรัน ไม่เขียนลงไฟล์ และเริ่มว่างเมื่อเปิดโปรแกรมใหม่

คุยเล่น/ดูดวงใช้ Groq โดยตอบจากข้อความที่เรียกแต่ละครั้งและ persona ที่ตั้งไว้ ไม่จำบทสนทนาก่อนหน้าและไม่บันทึกประวัติแชตลงไฟล์

## เตรียมไฟล์ก่อนเผยแพร่

วิธีที่เลือก: สร้าง public repository ใหม่ พร้อมประวัติใหม่จาก clean export ที่ตรวจแล้ว ไม่ส่ง `.git` หรือประวัติจาก repository เดิม และไม่เปลี่ยน remote/visibility ของ repository เดิม

- Export เฉพาะ source ที่ตรวจแล้วไป clean release; ไม่คัดลอกทั้ง workspace หรือ `.git` โดยอัตโนมัติ
- ตรวจ secrets/ข้อมูลส่วนบุคคลทั้ง source และ Git history ที่ตั้งใจเผยแพร่ `.gitignore` ป้องกันการเพิ่มไฟล์ใหม่แต่ไม่ล้างประวัติหรือ tracked files
- ไม่รวม runtime JSON, conversation history, local config/access files, `.env`, snapshots, `.tmp-*`, logs, audio/cache/recordings, certificates/private keys, deployment metadata หรือ binary build artifacts จากเครื่องเดิม
- แจก GME SDK/libraries เฉพาะเมื่อสิทธิ์อนุญาต มิฉะนั้นระบุขั้นตอนติดตั้งแยก
- ใช้ fresh clone ทดสอบว่าค่าเริ่มต้นไม่มีบัญชี ไม่มีการเชื่อมต่ออัตโนมัติ และ setup ใหม่ได้จริง
- เตรียม clean export ใน directory แยก รักษา workspace/remote/history เดิมไว้ วิธีเผยแพร่ที่เลือกคือ public repo ใหม่ ไม่ rewrite/push ประวัติเดิม

Preliminary dependency inventory (2026-10-06): the root lockfile has 109 package entries; `xmlhttprequest-ssl@2.1.2` is the only entry without a lockfile license field, while its installed package metadata and `LICENSE` identify MIT, also confirmed in the upstream 2.1.2 tag. The portal lockfile has 136 license expressions, but 32 optional/platform package folders are absent from this Windows QA install; 10 expressions are `LGPL-3.0-or-later` and 3 compound expressions include LGPL. This is an inventory, not a redistribution clearance: verify the upstream license/NOTICE files and target-platform install contents, then approve the release allowlist. The staging package metadata now says `ISC`, matching the original repository's package metadata; neither the original repository nor this staging export contains a `LICENSE` file. The user chose to retain this legacy state; do not invent a copyright holder. Record this repository choice separately from dependency-license review and any legal assessment.

Lockfile expression counts: root has 101 MIT, 4 ISC, 1 Apache-2.0, 1 BSD-2-Clause, 1 BSD-3-Clause, and the single missing expression noted above. Portal has 94 MIT, 17 Apache-2.0, 10 LGPL-only, 3 `Apache-2.0 AND LGPL-3.0-or-later`, 1 `Apache-2.0 AND LGPL-3.0-or-later AND MIT`, 8 ISC, 1 BSD-3-Clause, 1 CC-BY-4.0, and 1 0BSD. All 10 LGPL-only package folders are absent from this Windows install. Of the four composite-licensed packages, three folders are absent (`@img/sharp-wasm32`, `@img/sharp-win32-arm64`, and `@img/sharp-win32-ia32`); `@img/sharp-win32-x64` is installed.

The LGPL-bearing portal lock entries are: `@img/sharp-libvips-darwin-arm64`, `@img/sharp-libvips-darwin-x64`, `@img/sharp-libvips-linux-arm`, `@img/sharp-libvips-linux-arm64`, `@img/sharp-libvips-linux-ppc64`, `@img/sharp-libvips-linux-riscv64`, `@img/sharp-libvips-linux-s390x`, `@img/sharp-libvips-linux-x64`, `@img/sharp-libvips-linuxmusl-arm64`, and `@img/sharp-libvips-linuxmusl-x64` (`LGPL-3.0-or-later`, all `1.2.4`); `@img/sharp-wasm32`, `@img/sharp-win32-arm64`, and `@img/sharp-win32-ia32` (`Apache-2.0 AND LGPL-3.0-or-later`, `0.34.5`). These 13 package folders were absent from the Windows QA install. `@img/sharp-win32-x64@0.34.5` is installed in QA and has the same compound expression. Verify upstream license/NOTICE files and actual platform install/build contents before release; lockfile metadata alone is not a license allowlist.

Upstream spot-check (2026-10-06; not a release clearance): in `lovell/sharp-libvips` tag `v1.2.4`, `npm/linux-x64/package.json` declares `LGPL-3.0-or-later`, while the tag's `THIRD-PARTY-NOTICES.md` identifies LGPLv3 components including libvips and several of its dependencies. The same repository distinguishes its Apache-2.0 packaging scripts from the various licenses of the shared libraries in its tarballs. In `lovell/sharp` tag `v0.34.5`, `npm/win32-x64/package.json` declares `Apache-2.0 AND LGPL-3.0-or-later`. This supports the lockfile's warning but does not replace review of each target package's contents, notices, and applicable distribution obligations.

The other non-default portal entries are `caniuse-lite@1.0.30001806` (`CC-BY-4.0`) and `tslib@2.8.1` (`0BSD`). The caniuse-lite upstream README requests attribution by mentioning `caniuse.com`; include that attribution if the browser-compatibility data is redistributed. The installed tslib package includes its 0BSD license text. Record attribution in the release notice if applicable; do not treat this note as a complete third-party notice file.

## One-time live test record

One user-authorized join attempt through the existing legacy server used the bot token to fetch accessible public/private rooms, then failed its exact string ID match for the supplied room and returned `Room not found` before opening the YelloTalk room session. No room was joined and no audio was played. Cleanup verified the bot stopped, no current room, and auto-join still disabled. GME status checks stayed out-of-room/not-playing but alternated between online-idle and offline; the latest check was offline. This does not complete the unchecked adapter/account flow above and is not a clean-staging adapter E2E result. The single approved attempt has been used; another live attempt needs fresh authorization and an ID returned by this bot's room list.

For Windows/Linux native adapters, set `GME_SDK_APP_ID` and `GME_SDK_KEY` only in the local process environment; adapter HTTP control also requires a local `GME_ADAPTER_TOKEN`. Supply SDK include/library paths through the platform build script, obtain the proprietary SDK and credentials only through authorized vendor channels, and never commit them. Redroid SDK/signing inputs are build-time environment variables. No SDK binaries or credential values belong in this public staging tree.

## Installed dependency tree audit (2026-10-06)

Read-only comparison of the lockfiles with installed package metadata found 109/109 root entries and 104/136 portal entries installed; 32 optional/platform portal entries are absent from this Windows QA install. No conflicting `license` fields were found where both the lock entry and installed package metadata declare one. `xmlhttprequest-ssl@2.1.2` is the root lock entry without a `license` field; its installed package uses the legacy `licenses` array declaring MIT and includes a `LICENSE` file. Two installed root packages (`undici-types`, `tr46`) and four installed portal packages (`@next/env`, `@next/swc-win32-x64-msvc`, `client-only`, `dlv`) have no top-level `LICENSE`/`NOTICE` file, although their package metadata declares MIT. This directory-level inventory does not verify every notice's contents or absent platform tarballs; the release allowlist and legal review remain open.

## Troubleshooting

- PowerShell reports that `npm.ps1` is blocked by execution policy: use `npm.cmd` for the documented npm commands; do not weaken the machine-wide policy just for setup.
- The status page says setup is required: first run creates `config.local.json` and `owner-token.txt`. Configure the YelloTalk JWT, UUID, display name, and any provider/adapter credentials locally; never paste them into chat or the public repository.
- Manual room join returns 404: choose a room from the account-authenticated directory and verify that its detail response contains a valid GME voice ID. A 502 means the YelloTalk detail request failed; check network/account validity and current room status before retrying.
- Auto-join returns 409: this is expected until a verified speaker-availability preflight exists. Keep auto-join off; never join as a listener to probe capacity.
- A music request returns 409: the adapter may be missing/unavailable or the queue may be full. The staged adapter source is preliminary and not yet proven compatible; playback remains unavailable until a trimmed adapter passes its capability check. No SDK is bundled.
- TTS cannot be enabled: configure Azure key/region in local config and use an adapter that advertises separate speech-effect support. The server intentionally refuses TTS when either prerequisite is missing.
- If a credential may have been exposed, rotate it at its issuer, update only the local config, restart the API, and do not include the old or new value in bug reports.

## Checklist คู่มือก่อน release

- [x] ใส่ schema config ปลายทางและตัวอย่าง placeholder ที่ไม่ใช่ข้อมูลจริงใน `config.example.json`
- [x] ระบุ Node.js >=20.9.0 ตาม engine ของ Next.js 16.1.1 และ local QA ที่ Node.js 24.14.0/npm 11.9.0
- [x] QA machine snapshot (2026-10-07): Node.js/npm, yt-dlp, FFmpeg, MinGW-w64, and MSVC are present; Windows native compilation passed using available local SDK inputs. `g++` targets Windows, WSL lists no installed distro, and `pkg-config` is absent. Android SDK/JAR/JNI/signing variables and Web H5 SDK assets are not configured. This is not a supported-version claim.
- [ ] กำหนด/pin toolchain และ SDK ที่รองรับ แล้วทดสอบ compatibility/E2E บน adapter จริง; snapshot ข้างต้นยังทดแทนการทดสอบ Windows/Linux/Web/Redroid ไม่ได้
- [x] บันทึก Node API/portal install/start/build/stop commands และ PowerShell `npm.cmd` fallback; Windows test suite, server syntax check, portal typecheck/build และ fresh first-run API smoke ผ่านตามผลตรวจด้านบน
- [ ] Test command flow on a real Linux host, including graceful stop; no Linux host/WSL distro is available, so Linux support remains unverified.
- [x] ระบุ setup prerequisites และ capability/build matrix สำหรับ Web/Redroid; actual platform and audio tests remain open.
- [x] ระบุการสร้าง/เปลี่ยน owner token และแก้บัญชีหมดอายุโดยไม่แสดง secrets
- [x] ตรวจ defaults ของ settings และบริการที่ยังไม่ตั้งค่า
- [x] Fresh export-like copy: `npm ci` ทั้งสอง lockfile และ first-run API smoke ผ่านโดยบัญชีเริ่มว่าง; snapshot เดิมมี 104 tests ก่อน source/test updates รอบล่าสุด ซึ่งตรวจใน staging ปัจจุบันแยกแล้ว
- [x] Historical disposable Git clone/history test covered an earlier export snapshot only. The fresh repo now has initial commit `454b0a8` on `origin/main`.
- [ ] ทดสอบ flow เลือกห้อง/เล่นเพลง/TTS/คุยเล่นกับ adapter/account จริง โดยใช้บัญชีทดสอบและห้องที่ได้รับอนุญาต; credentials were not supplied to this test, and no room was joined in this audit.
- [x] เลือก history strategy: public repo ใหม่ ประวัติใหม่ ไม่ส่ง history เดิม
- [x] Final candidate/index scan (2026-10-07): 88 published files, no suspicious config/runtime/binary/SDK paths or common credential signatures; local `node_modules`/`.next` are ignored and were not pushed. The configured Git identity was used as requested.
