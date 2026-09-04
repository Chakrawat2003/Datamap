PinMap - Password Reset ลิงก์รีเซ็ตรหัสผ่าน patch
=================================

ไฟล์ที่แก้:
- index.html
- app.js
- style.css

แนวทางใหม่:
กด "ลืมรหัสผ่าน?" -> ส่ง Recovery ลิงก์รีเซ็ตรหัสผ่าน -> กรอกรหัส ลิงก์รีเซ็ตรหัสผ่าน 6 หลักจากอีเมล Outlook -> ตั้งรหัสผ่านใหม่

สำคัญ: ระบบนี้ยังใช้ Supabase Project เดิมและไม่แตะตาราง/ข้อมูลจุดที่ปัก

สิ่งที่ต้องทำใน GitHub:
1. เปิด repository เดิมของ PinMap
2. อัปโหลดทับเฉพาะ index.html, app.js, style.css
3. อย่าลบหรือเปลี่ยน config.js
4. อย่าลบหรือเปลี่ยน seven11-data.js (ถ้าโปรเจกต์เดิมมีไฟล์นี้)
5. 7-11-logo.png ใช้ไฟล์เดิมของโปรเจกต์ได้ ถ้ามีอยู่แล้วไม่ต้องเปลี่ยน

สำคัญมาก: ต้องแก้ Supabase Email Template ด้วย
------------------------------------------------
Supabase Dashboard -> Authentication -> Email Templates -> Reset password (Recovery)

เปลี่ยนเนื้อหา Recovery email ให้ส่ง "รหัส ลิงก์รีเซ็ตรหัสผ่าน" แทนปุ่ม/ลิงก์รีเซ็ตรหัสผ่าน เพื่อป้องกัน Outlook/Microsoft Safe Links เปิดลิงก์ใช้ครั้งเดียวอัตโนมัติ

ตัวอย่างเนื้อหา:

<h2>ตั้งรหัสผ่านใหม่สำหรับ PinMap</h2>
<p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี {{ .Email }}</p>
<p>รหัส ลิงก์รีเซ็ตรหัสผ่าน ของคุณคือ:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;">{{ .Token }}</p>
<p>นำรหัส 6 หลักนี้กลับมากรอกในหน้า PinMap ภายในเวลาที่กำหนด</p>
<p>หากคุณไม่ได้เป็นผู้ขอเปลี่ยนรหัสผ่าน สามารถละทิ้งอีเมลนี้ได้</p>

อย่าใช้ {{ .ConfirmationURL }} ใน Recovery template สำหรับวิธีนี้

Redirect URL:
- Site URL: https://chakrawat2003.github.io/Datamap/
- Redirect URL: https://chakrawat2003.github.io/Datamap/

หมายเหตุ:
- โค้ดจะเรียก resetPasswordForEmail() เพื่อสร้าง recovery ลิงก์รีเซ็ตรหัสผ่าน
- จากนั้นใช้ verifyOtp({ email, token, type: "recovery" })
- เมื่อยืนยันสำเร็จจะเรียก updateUser({ password })
- ไม่ต้องสร้าง Supabase Project ใหม่
- ข้อมูลจุดที่ปักในฐานข้อมูลเดิมไม่ถูกลบจากการเปลี่ยนไฟล์เว็บ

หาก Supabase ของคุณเป็น Free Project ที่สร้างก่อน 3 มิ.ย. 2026 หรือใช้ SMTP ของตัวเอง โดยทั่วไปสามารถปรับ Email Template ได้ตามสิทธิ์ของโปรเจกต์


Password reset: this package uses Supabase resetPasswordForEmail() and an email link, not OTP.
Supabase must have a working SMTP provider and the GitHub Pages URL configured as Site URL/Redirect URL.

Recommended redirect URL: https://chakrawat2003.github.io/Datamap/
