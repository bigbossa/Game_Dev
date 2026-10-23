# นักรบแนวหน้า V2 — หมวกอัศวิน ผมสั้น → ผมยาว ชุด/อาวุธตามเลเวล

แผ่นออกแบบ: ดูในหน้า artifact "แบบนักรบแนวหน้า V2" (ลิงก์ในแชท) — ใช้เป็นต้นแบบก่อนสร้างภาพจริง
ต้นแบบสไตล์/สัดส่วน/การจัดกริด: `../warrior-v1/dharma-source.png`, `../spearman-v2/dharma-short-source.png`, `../spearman-v2/dharma-source.png`

## ไฟล์ที่ต้องสร้าง (4 ภาพ โปร่งใสจริง ขนาด 1402×1122 กริด 5 คอลัมน์ × 4 แถว เท่าภาพเดิม)

| ไฟล์ | ใช้ที่เลเวล | หมายเหตุ |
|---|---|---|
| `dharma-short-source.png` | Lv.1–29 | ผมสั้นโผล่จากใต้หมวกเล็กน้อย |
| `dharma-source.png` | Lv.30+ | ผมยาวสยายออกจากท้ายหมวก |
| `adharma-short-source.png` | Lv.1–29 | แก้สีจาก dharma-short (ตำแหน่ง/ท่าเดิมทุกช่อง) |
| `adharma-source.png` | Lv.30+ | แก้สีจาก dharma (ตำแหน่ง/ท่าเดิมทุกช่อง) |

กติกาเดียวกับอาชีพอื่น (`ModelTiers.LEVELS` = 0/15/30/50/60/80/100/130): ผมสั้นก่อน Lv.30 แล้วสลับเป็นฐานผมยาว สีผมเปลี่ยนตามขั้นด้วยโค้ด Lv.50 ใช้ **ยอดหมวก (crest)** แทนมงกุฎ (หมวกบังมงกุฎ) ปีก/รัศมี Lv.60–130 วาดด้วยโค้ดเหมือนเดิม

**สำคัญต่อการเปลี่ยนชุด/อาวุธตามเลเวล:** วาดเกราะเป็นพื้นผิวโลหะสีเรียบไม่ลายซับซ้อน (โค้ดจะย้อมวัสดุ/สีตามชุดเกราะ 13 ชุด เหมือนทวน) และวาด **ดาบสั้นกับโล่เป็นแบบเรียบสีเทาเงินไม่มีลวดลาย** ให้แยกขอบชัดจากตัว เพื่อให้ตัวประกอบภาพลบแล้ววางอาวุธตามขั้น (14 แบบของ `warrior-weapons.js`) ทับตรงมือ/แขนเดิม

## Prompt 1 — ธรรมะ ผมยาว (`dharma-source.png`, สร้างใหม่)

Use case: stylized-concept / production game sprite atlas. Input images are STYLE, PROPORTION and POSE-LAYOUT REFERENCES ONLY. Redesign into a NEW male FRONTLINE SWORD-AND-SHIELD KNIGHT for the same Chinese wuxia chibi 2D MMORPG. Match the references' detailed anime painting, large expressive head, small sturdy body, crisp outlines; NOT flat vector, NOT low-poly, NOT realistic adult proportions. He wears an ORIENTAL KNIGHT HELMET: rounded steel bowl with a short brim and cheek guards, OPEN FACE (no visor covering the face), a small plain round crest socket on top (no plume, no crown, no horns), and a layered steel neck guard. LONG dark teal hair flows OUT from under the back of the helmet in one thick tied ponytail reaching the mid back, plus two thin side locks in front of the ears. Blue eyes, youthful determined face clearly visible in front and three-quarter views. Plain smooth ivory-silver plate armor with dark teal cloth: breastplate, rounded shoulder pauldrons, gauntlets, short split armored skirt, greaves, boots — SIMPLE flat-shaded metal surfaces with only thin edge trim, NO embossed motifs (materials are recolored per level in-game). ONE SHORT plain grey-silver single-edged dao in the RIGHT anatomical hand and ONE PLAIN undecorated grey round-top kite shield on the LEFT forearm; weapons must have clean separate silhouettes not merging with the body. No cape, no wings, no aura, no glow. EXACTLY FIVE COLUMNS and FOUR ROWS = TWENTY complete figures, consistent grid, generous transparent margins, nothing touching neighbors, nothing cropped. Columns: front, front-right three-quarter, right profile, back-right three-quarter, full back (ponytail clearly visible over the back). Rows: idle guarded stance, walk left foot forward, walk right foot forward, attack short sword slash with shield raised. Same face, helmet, armor, scale and body height in every cell, soles on consistent row baselines, shield left / sword right correct in back views. TRUE transparent background, no shadows, labels, lines, particles or environment.

References: `../warrior-v1/dharma-source.png`, `../spearman-v2/dharma-source.png`.

## Prompt 2 — ธรรมะ ผมสั้น (`dharma-short-source.png`, แก้จาก Prompt 1)

Edit this exact 5 columns x 4 rows transparent sprite sheet. Preserve all twenty poses, positions, directions, face identity, helmet, armor, sword and shield in hands, scale, feet baselines and the 1402x1122 layout. ONLY change the hair: remove the long ponytail and side locks completely; leave SHORT cropped dark teal hair visible just below the helmet rim and cheek guards, nothing past the neck guard, nothing behind the shoulders. Reveal the back armor and neck guard anatomically where the ponytail was. Every figure must clearly have short hair. True transparent background, no glow, haze, shadows, text or gridlines.

Edit target: `dharma-source.png`.

## Prompt 3 — อธรรม (`adharma-source.png` และ `adharma-short-source.png`, แก้จากภาพธรรมะแต่ละภาพ)

Edit this exact production transparent sprite atlas into the ADHARMA dark-faction variant. Preserve all TWENTY figures in exactly the same 5-column 4-row cell locations, canvas size, directions, faces, hair LENGTH and silhouette, helmet shape, body proportions, feet baselines, sword and shield hands, idle/walk/attack poses. Palette only: dark teal hair becomes black-violet with burgundy highlights, blue eyes become ruby red, teal cloth becomes deep burgundy/crimson, ivory-silver armor and helmet become charcoal-black steel with polished silver edges, plain weapons stay plain dark-steel grey. Keep the handsome determined face visible, no visor, no horns, no wings, no cape, no added objects, no effects. Genuine transparent alpha background. Do not resize, recrop, add or move figures.

Edit targets: `dharma-source.png` → `adharma-source.png`, `dharma-short-source.png` → `adharma-short-source.png`.

## สถานะตอนนี้ (V2 แบบวาดด้วยโค้ด ใช้ในเกมแล้ว)

ระหว่างยังไม่มีภาพต้นฉบับ 4 ไฟล์ เกมใช้ภาพ V1 + ชั้นที่วาดด้วยโค้ดใน `public/js/warrior-look.js`:
หมวกอัศวิน (แก้มกัน แผ่นกันคอ ยอดหมวกทอง) · ผมหางม้ายาว Lv.30+ · สีผมตามขั้น · พู่ขนม้า Lv.50+ ·
ปีก/รัศมี/เขา/ออร่าร่วมกับอาชีพอื่น (ปีก Lv.60+, รัศมี/เขา Lv.100+) · ผ้าและพื้นโล่ตามสีชุดเกราะตัวที่สวม · ใบดาบย้อมสีตามขั้นอาวุธ
มาสก์และตำแหน่งศีรษะมาจาก `node tools/build-warrior-v2.cjs` (รันใหม่ทุกครั้งที่แพ็ก V1 ใหม่)
รูปทรงดาบ/โล่ยังเป็นแบบที่วาดใน V1 (เปลี่ยนแค่สี) — ถ้าต้องการเปลี่ยนรูปทรงตามขั้น ต้องใช้ภาพต้นฉบับข้างบน

## หลังได้ภาพ

1. วางไฟล์ทั้ง 4 ในโฟลเดอร์นี้ แล้วแจ้งให้ต่อระบบ: แพ็กสองฐานผม (สั้น/ยาว) ใน `tools/build-warrior.cjs`, สลับฐานที่ Lv.30, ย้อมสีผมตามขั้น, ยอดหมวก Lv.50, ย้อมวัสดุเกราะตามชุด 13 ชุด และวางอาวุธตามขั้น 14 แบบที่มือ
2. ตรวจขอบกริดจริงของภาพที่สร้าง (กริดจากเครื่องสร้างภาพไม่เท่ากันเป๊ะ) ก่อนแพ็ก เหมือนที่ทำกับทวน
