PinMap - Login + Forgot Password

สิ่งที่เพิ่ม:
1. ปุ่ม “ลืมรหัสผ่าน?” ในหน้าต่างเข้าสู่ระบบ
2. กรอกอีเมลแล้วระบบใช้ Supabase Auth ส่งลิงก์ตั้งรหัสผ่านใหม่
3. เมื่อผู้ใช้กดลิงก์จากอีเมล จะกลับมาที่หน้า PinMap และเปิดหน้าตั้งรหัสผ่านใหม่
4. ตั้งรหัสผ่านใหม่และยืนยันรหัสผ่านก่อนบันทึก

สำคัญ: ใน Supabase Dashboard > Authentication > URL Configuration
ให้เพิ่ม Site URL / Redirect URL ของเว็บ PinMap ที่ใช้งานจริง เช่น
https://chakrawat2003.github.io/Datamap/

โค้ดจะใช้ URL ปัจจุบันของหน้า PinMap เป็น redirectTo อัตโนมัติ

ไฟล์ config.js และ seven11-data.js ไม่ได้รวมในแพ็กเกจ เพื่อไม่เปิดเผยค่าการตั้งค่า/ข้อมูลของผู้ใช้
