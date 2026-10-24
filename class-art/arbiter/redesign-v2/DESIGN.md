# เทวทัณฑ์ V2 — ตุลาการสวรรค์

สถานะ: แบบเสนอรูปลักษณ์ใหม่ ยังไม่ใช่ sprite atlas สำหรับโหลดในเกม

## แนวคิด

นักดาบผู้พิพากษาที่สงบนิ่งและคล่องตัว สัดส่วนจิบิหัวใหญ่ประมาณ 40–45% ของความสูง ใบหน้าเปิดชัด เกราะเบาและผ้าพิธีการช่วยให้บุคลิกอาชีพอ่านออกแม้เห็นตัวเล็กในเกม

จุดจำหลักคือเกราะไหล่ซ้ายซ้อนทรงขนนก ตราคำสัตย์รูปข้าวหลามตัดกลางอก และชายผ้ายาวผ่าสองแฉก เห็นขากับรองเท้าระหว่างผ้า ดาบตรงหนึ่งเล่มในมือขวา มือซ้ายว่าง ปลายดาบชี้ลงในท่ายืน

| องค์ประกอบ | ธรรมะ — ตุลาการสุริยัน | อธรรม — ตุลาการรัตติกาล |
|---|---|---|
| ผม | เงินขาว มัดหางสั้นสูง | ดำหมึก ปลายม่วงหม่น |
| เกราะ | งาช้าง ขอบทองเก่า | ถ่านดำและพลัม ขอบโลหะแดงเข้ม |
| ผ้า | น้ำเงินรัตติกาล | แดงเลือดหมู |
| ตราคำสัตย์ | ฟ้าอ่อน | ม่วง |
| รูปทรง | ขนนกเรียงเรียบและลายเมฆ | ขนนกเหลี่ยมคมและรอยแยก |
| ดาบ | เหล็กสว่าง ร่องกลางฟ้า การ์ดทรงตาชั่ง | เหล็กรมดำ ขอบแดง ร่องกลางม่วง |

## พัฒนาการภาพ

- Lv.1–29: ชุดพื้นฐาน ไม่มีปีกหรือรัศมี
- Lv.30–69: เพิ่มรัศมีบางเหนือศีรษะ
- Lv.70–109: เพิ่มปีกขนาดกะทัดรัด เปิดพื้นที่รอบหน้าและดาบ
- Lv.110–130: ปีกขยายและรัศมีแยกชั้น การจุติเพิ่มแสงชั่วคราว
- ดาบบริวารเป็นเอฟเฟกต์จากบัพกดใช้แยกต่างหาก เริ่มเรียนได้ที่ Lv.7 ตามระบบสกิล V2 และแสดงเฉพาะช่วงบัพทำงาน

## แนวทางผลิตโมเดล

ภาพ concept ใช้ตรวจรูปทรง สี และเครื่องแต่งกาย ก่อนผลิตต้นฉบับเดิน/โจมตีหลายทิศ ภาพนี้ไม่ใช่ไฟล์ atlas และไม่ควรนำไปแทนที่ dharma-source.png หรือ adharma-source.png โดยตรง

ขั้นผลิตต้องรักษาเฟรม 320×280, anchor (160,252), 8 ทิศ, เดิน 4 เฟรมและโจมตี 3 เฟรม ตรวจขอบดาบ ชายผ้า เท้า และความต่อเนื่องของมือที่ถือดาบทุกทิศ แยกปีก รัศมี และดาบบริวารออกจากภาพฐานเพื่อใช้เลเยอร์เดิมของเกม

หากเลย์เอาต์ต้นฉบับใหม่ต่างจากชุดเดิม ต้องปรับพิกัด crop ใน tools/build-arbiter-model.cjs ให้ตรงภาพจริงก่อน build ตรวจภาพที่ขนาดใช้งานจริงและทดสอบการวาดด้วยชุดตรวจ arbiter ที่มีอยู่

## การสร้างภาพ

ใช้ built-in image_gen โดยอ้างอิงสัดส่วนและงานวาดจาก artifacts/arbiter/style-comparison.png ภาพต้นแบบเก็บเป็น concept-v2.png ในโฟลเดอร์เดียวกับเอกสารนี้

### Prompt

Use case: stylized-concept.
Create a polished character redesign concept sheet for the existing Thai wuxia chibi MMORPG class "Divine Arbiter", concept V2 "Celestial Magistrate". This is a visual design proposal, not a sprite atlas.
The attached project screenshot is STYLE AND PROPORTION REFERENCE ONLY: match its appealing hand-painted 2.5D chibi rendering, huge expressive head (40–45% height), compact armored body, clear shapes and slightly elevated game camera. Redesign the rightmost single-sword class substantially; avoid merely recoloring the current blue-haired warrior.
Layout: wide landscape premium art direction board on flat warm pale gray parchment, generous whitespace, two equal columns. Left DHARMA, right ADHARMA. Each column has one large full-body front three-quarter base character, a smaller rear view of exactly the same outfit beside it, and one separate sword design detail. Along bottom, four small evolution silhouettes for Dharma labeled "Lv.1", "Lv.30", "Lv.70", "Lv.110". Main figures must be large and beautifully rendered, every boot and sword tip visible.
Design identity: youthful stern male celestial oath judge, open readable face, silver-white swept hair in short high tied ponytail for Dharma, ink-black hair with muted violet tips for Adharma. Small diamond forehead circlet, no helmet, no blindfold. Distinctive narrow structured ceremonial collar, asymmetric single layered feather-shaped shoulder armor on character's left shoulder, light fitted breastplate with ONE large diamond oath seal at the sternum, navy waist sash with square seal clasp, two long separated robe panels over compact armored legs with visible boots. Thin split rear mantle, no bulky cape. Eastern ceremonial magistrate meets elegant mobile swordsman. Armor has restrained geometric cloud engraving, big legible forms, no excessive tiny filigree.
Dharma: ivory ceramic armor, antique gold edges, deep midnight-blue cloth, small pale-cyan glowing oath gem. Adharma: charcoal and dark plum armor, dark red metal edges, crimson cloth, small violet glowing oath gem; angular feather motif rather than cartoon demon horns. Same class silhouette but distinct materials and small edge shapes.
Weapon: exactly ONE straight double-edged sword held in character's RIGHT hand with tip down, free empty LEFT hand. Broad elegant blade about 65% total character height, central engraved luminous diamond channel, compact geometric crossguard resembling balanced scales, gold pommel for Dharma; blackened blade with red edges and violet channel for Adharma. No shield, no second held sword.
Main base figures have NO halo, NO wings, NO floating swords, NO floor magic. Evolution strip: Lv.1 base; Lv.30 add thin hovering gold halo; Lv.70 add compact feather wings; Lv.110 larger wings and split radiant halo, preserve same chibi body. Effects separate concept elements, never hide the face.
Typography: only restrained clean headings "DIVINE ARBITER / V2", "DHARMA", "ADHARMA" and level captions, no paragraphs, no watermark. High-quality finished game character art, crisp silhouettes, soft painted shading, professional character turnaround board. Not tall realistic adult anatomy, not photorealistic, not blocky 3D.

