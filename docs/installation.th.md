# คู่มือติดตั้ง Yello Music Bot (Windows)

คู่มือนี้อธิบายการติดตั้งจาก Git clone จนถึงเปิดหน้า control portal และเตรียมบอทเล่นเพลง ใช้ขั้นตอน Windows เพราะเป็น adapter ที่ผ่านการ build ในโปรเจกต์นี้แล้ว การ build บน Linux, Web H5 และ Android/Redroid รวมถึงการทดสอบเสียงจริง ยังไม่ผ่านการยืนยัน

## สิ่งที่ต้องเตรียม

- Windows 64-bit และ Git
- Node.js 20.9.0 ขึ้นไป
- Visual Studio พร้อม workload **Desktop development with C++** และ x64 Native Tools Command Prompt
- บัญชี YelloTalk สำหรับบอท: JWT, UUID และชื่อแสดงผล
- GME AppID และ SDK key ขนาด 16 bytes จากบัญชี GME ของคุณ
- `yt-dlp` และ FFmpeg ติดตั้งไว้และเรียกได้จาก `PATH`

GME SDK headers/libraries ที่ adapter ใช้รวมอยู่ใน repository แล้ว แต่ AppID, SDK key และ token ส่วนตัวไม่ได้รวมมาด้วย Groq เป็นตัวเลือกเสริมสำหรับคำตอบ AI เท่านั้น ไม่จำเป็นต่อการเล่นเพลง

## 1. Clone และติดตั้ง dependencies

เปิด PowerShell ในโฟลเดอร์ที่จะเก็บโปรเจกต์ แล้วรัน:

```powershell
git clone https://github.com/Poppy-ylt/yello-talk-bot.git
cd yello-talk-bot
npm.cmd ci
npm.cmd --prefix web-portal-2 ci
```

ตรวจว่าเครื่องมือตัดต่อเสียงอยู่ใน `PATH`:

```powershell
yt-dlp --version
ffmpeg -version
```

หาก PowerShell บล็อก `npm.ps1` ให้ใช้ `npm.cmd` ตามตัวอย่าง

## 2. สร้างและตั้งค่าไฟล์ local

เริ่ม API หนึ่งครั้งเพื่อสร้างไฟล์ตั้งค่าและ owner token แล้วหยุดด้วย `Ctrl+C`:

```powershell
npm.cmd start
```

จากโฟลเดอร์หลักของโปรเจกต์ เปิด `config.local.json` และกรอกค่าของบัญชีบอทใน `account.jwtToken`, `account.userUuid` และ `account.displayName` ไฟล์ `owner-token.txt` มี token สำหรับเข้า portal และถูกสร้างให้อัตโนมัติ

สร้างค่าสุ่มสำหรับ `adapter.token` (อย่างน้อย 32 ตัวอักษร) ได้ด้วย:

```powershell
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

ใส่ค่านั้นใน `adapter.token` แล้วใช้ค่าเดียวกันกับ `GME_ADAPTER_TOKEN` ตอนเริ่ม adapter ในขั้นตอนถัดไป ค่า `adapter.baseUrl` ใช้ค่าเริ่มต้น `http://127.0.0.1:9876` ได้

เก็บ JWT, owner token และ credentials ไว้ในเครื่องเท่านั้น ห้าม commit หรือส่งผ่านหน้าเว็บ ไฟล์ `config.local.json` และ `owner-token.txt` ถูก ignore โดย Git อยู่แล้ว หาก JWT หมดอายุ ระบบนี้ไม่มี refresh อัตโนมัติ ต้องใส่ JWT ใหม่ในไฟล์ local แล้วเริ่ม API ใหม่

## 3. Build และเริ่ม Windows GME adapter

เปิด **x64 Native Tools Command Prompt for Visual Studio** แล้วเปลี่ยนไปยังโฟลเดอร์หลักของ repo จากนั้น build:

```bat
adapters\windows-native\build_windows.cmd
```

สคริปต์จะสร้าง `adapters\windows-native\build\gme-music-bot-windows.exe` และคัดลอก runtime DLL ที่จำเป็นไว้ข้าง executable

ใน PowerShell อีกหน้าต่างหนึ่งที่อยู่ในโฟลเดอร์หลัก ตั้ง credentials เฉพาะ process แล้วเริ่ม adapter:

```powershell
$env:GME_SDK_APP_ID = Read-Host 'GME AppID'
$env:GME_SDK_KEY = Read-Host 'GME SDK key (16 bytes)'
$localConfig = Get-Content .\config.local.json -Raw | ConvertFrom-Json
$env:GME_ADAPTER_TOKEN = $localConfig.adapter.token
Remove-Variable localConfig
.\adapters\windows-native\build\gme-music-bot-windows.exe
```

อย่าบันทึก AppID/SDK key ลง source code หรือ commit ลง Git หาก adapter แจ้งว่า credentials ไม่ครบ ให้ตรวจว่าตั้ง `GME_SDK_APP_ID` และ `GME_SDK_KEY` ใน PowerShell หน้าต่างเดียวกับที่ใช้เริ่ม executable และ SDK key ยาว 16 bytes

## 4. เริ่ม API และ portal

เปิด PowerShell อีกสองหน้าต่างที่โฟลเดอร์หลักของ repo

หน้าต่าง API:

```powershell
npm.cmd start
```

หน้าต่าง portal:

```powershell
npm.cmd run portal:dev
```

เปิด `http://localhost:5254` แล้วใส่ owner token จาก `owner-token.txt` API ใช้พอร์ต `5353` อย่าเปิด port forwarding หรือเผยแพร่หน้า control portal/API ไปยังเครือข่ายที่ไม่น่าเชื่อถือ

## 5. เข้า room และทดสอบคำสั่งเพลง

เมื่อ API, adapter และ portal ทำงานแล้ว ใช้ portal โหลด/เลือกห้องและสั่ง join เอง ระบบไม่ได้ auto-join ห้องให้ ส่ง `.help` ในห้องเพื่อดูคำสั่ง เช่น:

```text
.play <ชื่อเพลงหรือ YouTube URL>
.add <ชื่อเพลงหรือ YouTube URL>
.pause
.resume
.skip
.stop
```

เพลงต้องมาจาก YouTube และ YouTube live stream ยังไม่รองรับ ต้องมี `yt-dlp` และ FFmpeg ใน `PATH` จึงจะดาวน์โหลด/แปลงเสียงได้

## ตัวเลือกเสริม

- Groq API key ใช้กับ chat/fortune replies เท่านั้น และปิดไว้โดยค่าเริ่มต้น ไม่จำเป็นต่อ music playback
- Azure Speech key และ region ใช้สำหรับ TTS; ต้องเปิด TTS และ adapter ต้องรองรับ speech effects
- อย่าเปิดฟีเจอร์เสริมจนกว่าจะตั้ง credentials ของตัวเองใน `config.local.json`

## ตรวจสอบและข้อจำกัด

รัน checks จากโฟลเดอร์หลักได้ด้วย:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run portal:typecheck
```

การติดตั้ง dependencies, การเริ่ม API จาก clone สะอาด และการ build Windows adapter เคยผ่านการตรวจแล้ว แต่การ join room และการได้ยินเสียงเพลงจริงยังไม่ได้ผ่าน end-to-end test ในสภาพแวดล้อมนี้ ให้ถือว่าการเล่นเสียงยังต้องทดสอบด้วยบัญชีและ GME credentials ของคุณเอง
