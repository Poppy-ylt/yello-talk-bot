'use strict';

const DOT_COMMAND_HELP_MESSAGES = Object.freeze([
  [
    '🎵 คำสั่งเพลง 1/2',
    '.play <ชื่อเพลงหรือ YouTube URL> — เปิดเพลง',
    '.add <ชื่อเพลงหรือ YouTube URL> — เพิ่มเข้าคิว',
    '.skip — ข้ามเพลง',
    '.pause / .resume — พักหรือเล่นต่อ',
    '.stop — หยุดเพลงและล้างคิว',
    '.np — ดูเพลงที่กำลังเล่น',
    '.playlist — ดูคิวเพลง',
  ].join('\n'),
  [
    '🎛️ คำสั่งเพลง 2/2',
    '.remove <ลำดับ> — ลบเพลงจากคิว',
    '.clear — ล้างเพลงที่รอในคิว',
    '.vol [0-100] — ดูหรือปรับความดัง',
    '.autoplay on/off — เปิดหรือปิดเล่นต่ออัตโนมัติ',
    '.repeat on/off — เล่นเพลงเดิมซ้ำ',
    '.loop on/off — วนคิวเพลง',
    '.sq <1-3> — เลือกคุณภาพห้อง',
    '.tts [on/off|voice <name>|speed <0.5-1.5>|pitch <-50-50>|vol <0-100>|status] — ตั้งค่าอ่านข้อความ',
    '.help — ดูคำสั่ง',
  ].join('\n'),
]);

module.exports = { DOT_COMMAND_HELP_MESSAGES };
