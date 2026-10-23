# นักพรต (Taoist) — prompt สร้างภาพโมเดลและสกิลด้วย AI

ใช้กับ ChatGPT (สร้างภาพ) หรือ AI วาดภาพตัวอื่น: คัดลอก prompt ในกรอบโค้ด (ภาษาอังกฤษ ได้ผลแม่นกว่า) ไปวางทีละอัน
แล้วบันทึกไฟล์ PNG ตามชื่อในหัวข้อลงโฟลเดอร์ `class-art/taoist/`

สไตล์เดียวกับดาบคู่ (`model.png`, `model-2.png`) และมอนสเตอร์ (`monster-art/PROMPTS.md`):
chibi อนิเมะ 2D แบบโยวกัง เส้นขอบเข้มชัด ลงสีแบบ cel shading

## ขั้นตอนที่แนะนำ

1. สร้าง **แผ่นออกแบบตัวละคร** ของแต่ละฝ่ายก่อน (หัวข้อ A) เลือกภาพที่ชอบที่สุด
2. ทุกภาพต่อจากนั้น **แนบแผ่นออกแบบไปกับข้อความด้วย** แล้วเติมประโยคนี้ไว้หน้า prompt ตัวละครจะได้หน้าตาเหมือนเดิมทุกแผ่น:
   `Use the attached image as the exact character design: same face, hair, outfit, colours and weapon.`
3. ตั้งขนาดภาพตามที่บอกในแต่ละหัวข้อ (ChatGPT: แนวนอน 1536×1024 · จัตุรัส 1024×1024)
4. ตรวจภาพที่ได้ด้วย checklist ท้ายไฟล์ ถ้าจำนวนช่องผิด สั่งซ้ำว่า `Regenerate with exactly 8 columns and 4 rows, same character.`

> ภาพเดินและภาพโจมตีขอแบบ **ตารางเท่ากันทุกช่อง ไม่มีตัวหนังสือ** (ต่างจาก `model.png` ที่มีป้ายชื่อ) เพราะตัดเป็นสไปรต์ได้ด้วยโปรแกรมเลย
> ปีก วงแหวนเทพ เขามาร และออร่าตามเลเวล เกมวาดด้วยโค้ดอยู่แล้ว (`model-tiers.js`, `wings.js`) **จึงห้ามมีปีกหรือออร่าในสไปรต์หลัก**

---

## แนวคิดอาชีพ

**นักพรต** — ผู้บำเพ็ญเต๋า ใช้ **แส้ปัดฝุ่น** (拂尘) คู่กับ **ยันต์กระดาษ** โจมตีด้วยเวทระยะไกล ฟื้นพลังและป้องกันให้ปาร์ตี้ได้
เป็นอาชีพสาย support ที่เข้ากับระบบปาร์ตี้ (แบ่ง EXP) · เลือดน้อยกว่าดาบคู่ ปราณมากกว่า

| | ธรรมะ (นักพรตเต๋า) | อธรรม (นักพรตมาร) |
|---|---|---|
| ผม | น้ำตาลเข้ม มวยสูงปักปิ่นหยกขาว ริบบิ้นฟ้ายาวสองเส้น | ดำยาวรวบหลวมๆ ไฮไลต์แดง ปิ่นกระดูกดำ พู่แดง |
| ตา | น้ำเงิน สงบ อ่อนโยน | แดง คมเย็นชา |
| ชุด | เสื้อคลุมนักพรตสีขาว แขนเสื้อกว้างพลิ้ว คอเสื้อและขอบฟ้าอ่อน ลายเมฆสีทอง หลังเสื้อเป็นตราหยินหยาง | เสื้อคลุมดำ ซับในและขอบแดงเข้ม ลายเปลวไฟผีสีทองหม่น หลังเสื้อเป็นตราผนึกมารสีแดง |
| เอว | ผ้าคาดน้ำเงินเข้ม หัวเข็มขัดทอง ห้อยยันต์เหลือง น้ำเต้าเล็กๆ ที่สะโพก | ผ้าคาดแดงเลือดนก ห้อยยันต์ม่วงดำอักษรแดง น้ำเต้าดำ |
| ขา / รองเท้า | กางเกงน้ำเงินเข้ม รองเท้าผ้าพันแข้งขาว | กางเกงดำ รองเท้าผ้าพันแข้งดำขลิบแดง |
| อาวุธ | แส้ปัดฝุ่นด้ามไม้ขลิบทอง ขนแส้สีขาว (มือขวา) · ยันต์เหลืองอักษรแดง (มือซ้าย) | แส้ด้ามดำ ขนแส้แดงเข้ม · ยันต์ม่วงดำอักษรแดงเรืองแสง |
| สีเอฟเฟกต์ | ขาว · ฟ้า `#9edbff` · น้ำเงิน `#3a8dff` · ทอง | ชมพูขาว · แดง `#ff3b3b` · แดงเลือด `#4a0006` · ทองหม่น |

(สีเอฟเฟกต์ตรงกับ `FACTIONS.*.fx` ใน `shared/common.js` · ถ้าอยากได้นักพรตหญิง แก้คำว่า `young male` เป็น `young female` ในทุก prompt)

---

## A. แผ่นออกแบบตัวละคร (ภาพอ้างอิง)

### `taoist-dharma-design.png` — ธรรมะ · 1536×1024

```
Character design reference sheet for a 2D wuxia MMORPG. A young male Taoist priest, cute chibi proportions (big head, about 2.5 heads tall), calm gentle face with blue eyes, dark brown hair in a neat high topknot held by a white jade hairpin with two long light-blue ribbons. White Taoist robe with wide flowing sleeves, light-blue inner collar and trim, gold cloud embroidery, a yin-yang (taiji) emblem on the back. Navy sash with a gold buckle, yellow paper talismans with red runes hanging from the sash, a small gourd at the hip, navy trousers, white cloth-wrapped boots. Holds a Taoist fly-whisk (wooden handle with gold caps, long white horsetail hair) in the right hand and a yellow paper talisman between the fingers of the left hand. Layout: three full-body views in a row (front, right side, back) on the left two thirds; on the right a large face close-up, the fly-whisk alone, and a single talisman alone. Cute chibi anime 2D MMORPG game art (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Pure white background, no text, no labels, no wings, no aura.
```

### `taoist-adharma-design.png` — อธรรม · 1536×1024

```
Character design reference sheet for a 2D wuxia MMORPG. A young male dark Taoist sorcerer, cute chibi proportions (big head, about 2.5 heads tall), cold sharp face with red eyes, long black hair with crimson streaks loosely tied back with a black bone hairpin and red tassels. Black Taoist robe with wide flowing sleeves, crimson inner lining and trim, dull dark-gold ghost-fire cloud embroidery, a red demonic seal emblem on the back. Crimson sash, purple-black paper talismans with glowing red runes hanging from the sash, a small black gourd at the hip, black trousers, black cloth-wrapped boots with red trim. Holds a fly-whisk with a black handle and long dark-crimson horsetail hair in the right hand and a purple-black talisman between the fingers of the left hand. Layout: three full-body views in a row (front, right side, back) on the left two thirds; on the right a large face close-up, the fly-whisk alone, and a single talisman alone. Cute chibi anime 2D MMORPG game art (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Pure white background, no text, no labels, no wings, no aura.
```

---

## B. ท่ายืน + ท่าเดิน 8 ทิศ (แทน `model.png`)

ตาราง **8 คอลัมน์ × 4 แถว** · คอลัมน์ = ทิศ: หน้า, หน้า-ขวา, ขวา, หลัง-ขวา, หลัง, หลัง-ซ้าย, ซ้าย, หน้า-ซ้าย
แถว 1 = ท่ายืน (ใช้ตัดภาพหน้าตรงเป็น portrait) · แถว 2–4 = ท่าเดิน 3 เฟรม

### `taoist-dharma-walk.png` · 1536×1024 (แนบ `taoist-dharma-design.png`)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Sprite sheet of the young male Taoist priest in white robe with light-blue trim, gold cloud embroidery, high topknot with jade hairpin and light-blue ribbons, fly-whisk in the right hand and a yellow talisman in the left hand. Exactly 8 columns and 4 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Row 1: relaxed standing idle pose. Rows 2 to 4: 3 frames of a walking animation (left foot forward, passing pose, right foot forward), sleeves and ribbons swaying. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. The same character, same size in every cell, feet on the same baseline in each row, whole body visible, nothing cut off at the cell edges. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no wings, no aura.
```

### `taoist-adharma-walk.png` · 1536×1024 (แนบ `taoist-adharma-design.png`)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Sprite sheet of the young male dark Taoist sorcerer in black robe with crimson lining, long black hair with crimson streaks, red eyes, dark-crimson fly-whisk in the right hand and a purple-black talisman with red runes in the left hand. Exactly 8 columns and 4 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Row 1: relaxed standing idle pose. Rows 2 to 4: 3 frames of a walking animation (left foot forward, passing pose, right foot forward), sleeves and hair swaying. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. The same character, same size in every cell, feet on the same baseline in each row, whole body visible, nothing cut off at the cell edges. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no wings, no aura.
```

---

## C. ท่าโจมตีปกติ — ปายันต์ (แทน `model-2.png`)

ตาราง **8 คอลัมน์ × 3 แถว** · แถว = 3 เฟรม: ง้าง → ปา → ตามแรง · ขอแค่ประกายเล็กที่ยันต์ (เอฟเฟกต์ใหญ่แยกไว้ในหัวข้อ F)

### `taoist-dharma-attack.png` · 1536×1024 (แนบแผ่นออกแบบธรรมะ)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Attack sprite sheet of the young male Taoist priest (white robe, light-blue trim, jade hairpin, fly-whisk, yellow talisman). Exactly 8 columns and 3 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of the basic attack, all thrown toward the facing direction: row 1 wind-up, pulling a yellow talisman from the sleeve with the fly-whisk raised; row 2 throw, left arm thrust forward with the talisman leaving the fingers and a small light-blue glow; row 3 follow-through, fly-whisk swept forward, sleeves and robe flowing. Compact poses that fit inside each cell. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. Same character, same size in every cell, feet on the same baseline in each row, whole body visible. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no big effects, no wings, no aura.
```

### `taoist-adharma-attack.png` · 1536×1024 (แนบแผ่นออกแบบอธรรม)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Attack sprite sheet of the young male dark Taoist sorcerer (black robe, crimson lining, black hair with crimson streaks, red eyes, dark-crimson fly-whisk, purple-black talisman). Exactly 8 columns and 3 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of the basic attack, all thrown toward the facing direction: row 1 wind-up, pulling a purple-black talisman from the sleeve with the fly-whisk raised; row 2 throw, left arm thrust forward with the talisman leaving the fingers and a small crimson glow; row 3 follow-through, fly-whisk swept forward, sleeves and robe flowing. Compact poses that fit inside each cell. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. Same character, same size in every cell, feet on the same baseline in each row, whole body visible. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no big effects, no wings, no aura.
```

---

## D. ท่าร่ายเวท (ใช้กับสกิล 2–9)

ตาราง **8 คอลัมน์ × 3 แถว** · แถว = ประสานมือ → ชูแส้ขึ้นฟ้า → ผลักฝ่ามือปล่อยพลัง

### `taoist-dharma-cast.png` · 1536×1024 (แนบแผ่นออกแบบธรรมะ)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Spell-casting sprite sheet of the young male Taoist priest (white robe, light-blue trim, jade hairpin, fly-whisk). Exactly 8 columns and 3 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of casting a spell toward the facing direction: row 1 left hand forming a Taoist hand seal in front of the chest, eyes focused, a faint light-blue glow on the fingers; row 2 fly-whisk raised high to the sky, robe and sleeves lifted by a magic wind; row 3 left palm pushed forward releasing energy, a small burst of light-blue light at the palm. Compact poses that fit inside each cell. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. Same character, same size in every cell, feet on the same baseline in each row, whole body visible. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no wings, no aura.
```

### `taoist-adharma-cast.png` · 1536×1024 (แนบแผ่นออกแบบอธรรม)

```
Use the attached image as the exact character design: same face, hair, outfit, colours and weapon. Spell-casting sprite sheet of the young male dark Taoist sorcerer (black robe, crimson lining, black hair with crimson streaks, red eyes, dark-crimson fly-whisk). Exactly 8 columns and 3 rows of evenly spaced cells. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of casting a spell toward the facing direction: row 1 left hand forming a hand seal in front of the chest, eyes glowing red, faint crimson smoke on the fingers; row 2 fly-whisk raised high to the sky, robe and sleeves lifted by a dark wind; row 3 left palm pushed forward releasing energy, a small burst of crimson light at the palm. Compact poses that fit inside each cell. Cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), 3/4 top-down game view, clean bold dark outlines, cel shading, vivid colours, crisp details. Same character, same size in every cell, feet on the same baseline in each row, whole body visible. Pure white background, no text, no labels, no grid lines, no borders, no ground shadow, no wings, no aura.
```

---

## E. อาวุธ 10 ระดับ — แส้ปัดฝุ่น Lv.10–100 (แทน `item.png`)

### `taoist-weapons.png` · 1024×1536 (แนวตั้ง)

```
Equipment progression concept sheet for a wuxia MMORPG: 10 Taoist fly-whisks (horsetail whisks) from apprentice to legendary, arranged in exactly 5 columns and 2 rows of evenly spaced cells, read left to right, top to bottom, one fly-whisk per cell, standing vertically with the handle on top and the long horsetail hair hanging down. Tier 1: a plain wooden handle with white hair. Each tier becomes more ornate: gold caps, jade rings, light-blue tassels, cloud and taiji carvings, glowing light-blue runes, floating talismans around it, and finally tier 10 with a gold dragon-head handle, a glowing blue orb and white hair shining with a soft blue spiritual light. White, light-blue, navy and gold colour scheme. Painted 2D game item art, clean dark outlines, crisp details. Pure light background, no text, no labels, no numbers.
```

(ฝ่ายอธรรมใช้ prompt เดียวกัน เปลี่ยนท้ายเป็น `black, crimson, dark-red and dull gold colour scheme, crimson glowing runes, dark-crimson hair, a red demon orb at tier 10` แล้วบันทึกเป็น `taoist-weapons-adharma.png`)

---

## F. สกิล 9 ท่า

ใช้โครงเดียวกับดาบคู่ คือปุ่ม 1–9 ปลดล็อกตามเลเวล และพัฒนาร่าง (evo) ทุก 10 เลเวล
**ค่าตัวเลขในตารางเป็นข้อเสนอ ยังไม่ได้อยู่ในเกม**

| ปุ่ม | id | ชื่อสกิล | Lv | MP | คูลดาวน์ | ผล | ร่างพัฒนา |
|---|---|---|---|---|---|---|---|
| 1 | `talisman` | ยันต์อัคนี | 1 | 0 | 0.6 วิ | โจมตีปกติ ปายันต์ไฟใส่เป้าระยะไกล 1 ตัว | Lv.20 **ยันต์อัคนีสามแผ่น** ปา 3 แผ่นแผ่เป็นพัด |
| 2 | `thunder` | อสนีเรียกฟ้า | 1 | 16 | 5 วิ | ฟ้าผ่าลงจุดเป้าหมาย ดาเมจวงเล็ก | Lv.40 **อสนีเก้าสาย** ฟ้าผ่า 9 สายรอบจุดเป้า มีโอกาสชา |
| 3 | `heal` | คาถาฟื้นชีวา | 2 | 22 | 8 วิ | ฟื้น HP ตัวเองและสมาชิกปาร์ตี้รอบตัว | Lv.60 **บัวชีวาสวรรค์** บัวแสงบานใต้เท้า ฟื้นต่อเนื่อง 5 วิ |
| 4 | `ward` | ยันต์คุ้มกาย | 4 | 20 | 15 วิ | เกราะยันต์ลดดาเมจ 20% ให้ปาร์ตี้รอบตัว 8 วิ | Lv.80 **กระดองเต่าเทพ** เกราะรูปกระดองเต่าทอง ลด 35% |
| 5 | `bagua` | ค่ายกลแปดทิศ | 7 | 45 | 24 วิ | วงยันต์แปดทิศบนพื้น ดาเมจต่อเนื่อง และศัตรูช้าลง | Lv.90 **ค่ายกลแปดทิศสวรรค์** วงใหญ่ขึ้น ระเบิดแสงปิดท้าย · Lv.130 **ไท่จี๋พลิกฟ้า** วงหยินหยางยักษ์หมุนบดทั้งสนาม |
| 6 | `flysword` | กระบี่บินเหิน | 10 | 18 | 4 วิ | ส่งกระบี่วิญญาณพุ่งทะลุศัตรูเป็นแนวยาว | Lv.100 **กระบี่บินพันเล่ม** กระบี่ 5 เล่มแผ่เป็นพัด |
| 7 | `seal` | โซ่ยันต์ตรึงวิญญาณ | 30 | 26 | 10 วิ | โซ่ยันต์มัดศัตรูในวง ขยับไม่ได้ 2 วิ | Lv.110 **ผนึกห้าธาตุ** ตรึง 3 วิ และระเบิดธาตุห้าสี |
| 8 | `guardian` | อัญเชิญเทพพิทักษ์ | 50 | 38 | 16 วิ | เรียกขุนพลวิญญาณทองลงมาฟาดจุดเป้าหมาย 3 ครั้ง | Lv.120 **เทพพิทักษ์สี่ทิศ** สี่ขุนพลล้อมฟาดพร้อมกัน |
| 9 | `taiji` | หยินหยางพิฆาตฟ้า | 70 | 50 | 18 วิ | ลูกแก้วหยินหยางยักษ์กลิ้งไปข้างหน้า บดทุกสิ่งที่ขวาง | Lv.130 **มหาไท่จี๋สวรรค์** หยินหยางคู่หมุนพันกันแล้วระเบิดที่ปลายทาง |

**ค่าสถานะที่เสนอ** (เทียบกับดาบคู่ `hp 170 / mp 80 / atk 15 / def 4 / speed 215 / crit 18%`):
`hp 140, hpG 21, mp 130, mpG 16, atk 13, atkG 3.8, def 3, defG 1.1, speed 205, crit 0.12`

### F1. ไอคอนสกิล — `taoist-skill-icons.png` · 1024×1024

```
A sheet of 9 square skill icons for a wuxia fantasy MMORPG, arranged in exactly 3 columns and 3 rows, evenly spaced, read left to right, top to bottom: 1) a flaming yellow paper talisman with red runes flying forward; 2) a white-blue lightning bolt striking down from dark clouds; 3) a glowing green-white lotus with healing sparkles; 4) a golden shield made of overlapping talismans shaped like a turtle shell; 5) a glowing bagua octagon array with trigram symbols; 6) a spirit sword flying with a light-blue trail; 7) glowing talisman chains binding a ghostly silhouette; 8) a golden armoured guardian deity general with a halberd; 9) a giant black-and-white yin-yang orb crackling with light. Each icon has an ornate thin gold frame and a dark blue background, painted 2D game icon style, bold readable shapes, crisp details, white light-blue and gold palette. No text, no numbers, plain white space between icons.
```

(ไอคอนใช้ร่วมกันทั้งสองฝ่าย หรือสั่งใหม่โดยเปลี่ยนท้ายเป็น `dark crimson background, black red and dull gold palette` แล้วบันทึกเป็น `taoist-skill-icons-adharma.png`)

### F2. เอฟเฟกต์สกิล — `fx-<id>.png` · 1536×1024 ทีละท่า

ทุกไฟล์เป็นตาราง **3 คอลัมน์ × 2 แถว = 6 เฟรม** (อ่านซ้ายไปขวา บนลงล่าง จากเริ่มจนจบ) เฉพาะเอฟเฟกต์ ไม่มีตัวละคร
**พื้นดำสนิท** เพื่อเอาไปซ้อนแบบแสง (additive / screen) ในเกม

เอา prompt ด้านล่างไปวาง แล้ว **ต่อท้ายด้วยบล็อกสีของฝ่าย** 1 บล็อก
(ธรรมะ บันทึกเป็น `fx-<id>.png` · อธรรม บันทึกเป็น `fx-<id>-adharma.png`):

ธรรมะ:
```
Colours: white-hot core, light-blue (#9edbff) and blue (#3a8dff) glow, small gold accents, holy and pure feeling.
```
อธรรม:
```
Colours: pale pink-white core, crimson red (#ff3b3b) glow, dark blood-red (#4a0006) smoke, dull gold accents, dark and sinister feeling.
```

#### `fx-talisman` — ยันต์อัคนี (ปุ่ม 1)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a paper talisman with glowing runes flies forward spinning, leaving a short fire trail (frames 1-3), then bursts into a small fiery explosion with flying paper ash and sparks (frames 4-6). Effect only, no character, centred in every cell, nothing cut off. Glowing additive-light look, painted 2D game VFX, crisp shapes. Pure black background (#000000), no text, no grid lines.
```

#### `fx-thunder` — อสนีเรียกฟ้า (ปุ่ม 2)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a small glowing rune circle appears on the ground (frame 1), a thick jagged lightning bolt strikes down into it from above (frames 2-3), an electric blast ring spreads with crackling sparks (frames 4-5), fading smoke and tiny arcs (frame 6). Tall effect, the bolt reaches the top of each cell. Effect only, no character, nothing cut off. Glowing additive-light look, painted 2D game VFX, crisp shapes. Pure black background (#000000), no text, no grid lines.
```

#### `fx-heal` — คาถาฟื้นชีวา (ปุ่ม 3)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a soft healing light circle forms on the ground (frame 1), a translucent lotus of light blooms open (frames 2-3), healing sparkles and small glowing leaves rise upward in spirals (frames 4-5), the lotus dissolves into floating motes (frame 6). Gentle and calm, with soft jade-green highlights mixed into the colours. Effect only, no character, nothing cut off. Glowing additive-light look, painted 2D game VFX. Pure black background (#000000), no text, no grid lines.
```

#### `fx-ward` — ยันต์คุ้มกาย (ปุ่ม 4)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: eight paper talismans fly in and orbit around an empty centre (frames 1-2), they lock together into a glowing dome-shaped barrier with a hexagon turtle-shell pattern (frames 3-4), the barrier pulses once with a bright rim (frame 5), a thin steady shield shell remains (frame 6). The centre is empty where the character will stand. Effect only, no character, nothing cut off. Glowing additive-light look, painted 2D game VFX. Pure black background (#000000), no text, no grid lines.
```

#### `fx-bagua` — ค่ายกลแปดทิศ (ปุ่ม 5 · ท่าไม้ตาย)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, seen from a 3/4 top-down game camera so the circle is an ellipse on the ground. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a large bagua octagon array with the eight trigram symbols and a yin-yang centre draws itself on the ground line by line (frames 1-2), it lights up and rotates while pillars of light rise from the eight trigrams (frames 3-4), a bright flash bursts from the centre (frame 5), the array fades with drifting light motes (frame 6). Wide effect filling the width of each cell. Effect only, no character, nothing cut off. Glowing additive-light look, painted 2D game VFX, ornate and grand. Pure black background (#000000), no text, no grid lines.
```

#### `fx-flysword` — กระบี่บินเหิน (ปุ่ม 6)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, side-on view, the sword flies to the right. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a slim glowing spirit sword materialises from light particles (frame 1), it flies to the right leaving a long luminous trail and cutting wind (frames 2-4), it pierces through with a burst of sword-light (frame 5), the trail fades into sparkles (frame 6). Effect only, no character, nothing cut off. Glowing additive-light look, painted 2D game VFX, sharp and elegant. Pure black background (#000000), no text, no grid lines.
```

#### `fx-seal` — โซ่ยันต์ตรึงวิญญาณ (ปุ่ม 7)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a glowing seal circle with rune script appears on the ground (frame 1), chains made of linked paper talismans shoot up from the circle (frames 2-3), the chains wrap tightly around an empty space in the centre where the enemy stands (frames 4-5), the chains glow brightly then shatter into paper fragments (frame 6). Effect only, no character or enemy, nothing cut off. Glowing additive-light look, painted 2D game VFX. Pure black background (#000000), no text, no grid lines.
```

#### `fx-guardian` — อัญเชิญเทพพิทักษ์ (ปุ่ม 8)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, 3/4 top-down game camera. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: a summoning circle opens on the ground with a pillar of light (frame 1), a huge translucent armoured guardian deity general made of light rises up holding a long halberd (frames 2-3), he swings the halberd down in a powerful strike (frame 4), a shockwave and cracks of light burst on impact (frame 5), the guardian dissolves into glowing particles (frame 6). The guardian is a ghostly, glowing spirit, not a solid character. Tall effect reaching the top of each cell. Nothing cut off. Glowing additive-light look, painted 2D game VFX, majestic. Pure black background (#000000), no text, no grid lines.
```

#### `fx-taiji` — หยินหยางพิฆาตฟ้า (ปุ่ม 9)
```
Magic effect sprite sheet for a 2D wuxia MMORPG, side-on view, the orb rolls to the right. Exactly 3 columns and 2 rows of evenly spaced cells, 6 frames read left to right, top to bottom: light and shadow swirl together into a giant yin-yang orb (frames 1-2), the spinning yin-yang orb rolls to the right crackling with energy and leaving a glowing spiral trail (frames 3-4), it explodes into a massive burst of black and white light rings (frame 5), the rings fade into drifting light motes (frame 6). Black-and-white yin-yang contrast with the faction glow colours around it. Nothing cut off. Glowing additive-light look, painted 2D game VFX, powerful. Pure black background (#000000), no text, no grid lines.
```

> ร่างพัฒนา (evo) ใช้ prompt เดิมได้ เติมท้ายว่า `Evolved, more powerful version: bigger, more layers, more particles, more ornate.` แล้วบันทึกเป็น `fx-<id>-evo.png`

---

## G. ลักษณะตามเลเวล (ภาพแนวคิด ไม่ใช้ตัดสไปรต์)

เกมเปลี่ยนสีผม ชุด และวาดปีก/วงแหวน/เขาตามเลเวลด้วยโค้ด ภาพนี้มีไว้ดูแนวทางตอนเขียน `model-tiers.js` ให้นักพรต

| เลเวล | ธรรมะ | อธรรม |
|---|---|---|
| 15 | ศิษย์นักพรต | ศิษย์สำนักมาร |
| 30 | นักพรตยันต์ทอง | นักพรตยันต์โลหิต |
| 50 | นักพรตเมฆา | นักพรตเงาผี |
| 60 | ปรมาจารย์เต๋า (ปีกขนนก) | ปรมาจารย์มาร (ปีกขนนกดำ) |
| 80 | นักพรตมังกรเมฆ | นักพรตมังกรอเวจี |
| 100 | เซียนเต๋า | เซียนมาร |
| 130 | เทพเซียนไท่จี๋ | จอมมารไท่จี๋ |

### `taoist-tiers-dharma.png` · 1536×1024 (แนบแผ่นออกแบบธรรมะ)

```
Use the attached image as the base character design. Level progression line-up of the same young male Taoist priest, 7 full-body front views in one row, evenly spaced, from left to right getting more powerful: 1) apprentice in a simple white robe; 2) gold talisman priest with gold-trimmed robe and a talisman belt; 3) cloud priest with flowing cloud-pattern scarf and silver-blue hair; 4) Taoist grandmaster with a gold-jade crown and white feather wings; 5) cloud-dragon priest with a dragon crown, golden hair and glowing eyes, large gold-edged wings; 6) Taoist immortal with glowing white hair, heavenly crown, halo behind the head, two pairs of shining wings; 7) supreme taiji deity with radiant white-gold hair, lotus crown, a rotating yin-yang halo, three pairs of white-gold wings and a golden lotus under the feet. Cute chibi anime 2D MMORPG game art (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours. Pure white background, no text, no labels.
```

### `taoist-tiers-adharma.png` · 1536×1024 (แนบแผ่นออกแบบอธรรม)

```
Use the attached image as the base character design. Level progression line-up of the same young male dark Taoist sorcerer, 7 full-body front views in one row, evenly spaced, from left to right getting more powerful: 1) apprentice of the demon sect in a simple black robe; 2) blood talisman priest with crimson-trimmed robe and a belt of red-rune talismans; 3) ghost-shadow priest with a tattered smoky scarf and blood-red hair; 4) demon grandmaster with an iron demon crown and black feather wings; 5) abyss-dragon priest with a horned dragon crown, black hair with red tips, glowing red eyes, large dark wings; 6) demon immortal with silver hair tipped red, small horns, a cracked red halo, two pairs of membrane wings with glowing veins; 7) supreme taiji demon lord with black hair tipped with blood fire, two pairs of big lava-tipped horns, demonic flames behind the body, a broken red yin-yang halo and a cracked lava sigil under the feet. Cute chibi anime 2D MMORPG game art (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours. Pure white background, no text, no labels.
```

---

## Checklist ตรวจภาพก่อนใช้

- [ ] จำนวนช่องถูกต้อง (เดิน 8×4 · โจมตี/ร่าย 8×3 · เอฟเฟกต์ 3×2 · ไอคอน 3×3) และทุกช่องห่างเท่ากัน
- [ ] ทิศเรียงถูก: หน้า → หน้า-ขวา → ขวา → หลัง-ขวา → หลัง → หลัง-ซ้าย → ซ้าย → หน้า-ซ้าย
- [ ] ตัวละครขนาดเท่ากันทุกช่อง เท้าอยู่ระดับเดียวกันในแถว ไม่มีส่วนไหนเกินขอบช่อง
- [ ] พื้นหลังขาวล้วน (เอฟเฟกต์ = ดำล้วน) ไม่มีเงาที่พื้น ตัวหนังสือ เส้นตาราง หรือกรอบ
- [ ] สไปรต์หลักไม่มีปีก/ออร่า แส้อยู่มือขวา ยันต์อยู่มือซ้าย ชุดตรงกับแผ่นออกแบบ
- [ ] ธรรมะกับอธรรมเป็นตัวละครแบบเดียวกัน ต่างกันแค่สีและรายละเอียดตามตาราง

## ไฟล์ทั้งหมดที่ต้องได้

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `taoist-dharma-design.png` / `taoist-adharma-design.png` | ภาพอ้างอิงสำหรับแนบตอนสร้างภาพอื่น |
| `taoist-dharma-walk.png` / `taoist-adharma-walk.png` | ท่ายืน (portrait) + ท่าเดิน 8 ทิศ |
| `taoist-dharma-attack.png` / `taoist-adharma-attack.png` | ท่าโจมตีปกติ |
| `taoist-dharma-cast.png` / `taoist-adharma-cast.png` | ท่าร่ายสกิล |
| `taoist-weapons.png` (+ `-adharma`) | แส้ 10 ระดับ (ภาพอ้างอิงไอคอนไอเทม) |
| `taoist-skill-icons.png` (+ `-adharma`) | ไอคอนสกิล 9 ช่อง |
| `fx-<id>.png` / `fx-<id>-adharma.png` × 9 ท่า | เอฟเฟกต์สกิล |
| `taoist-tiers-dharma.png` / `taoist-tiers-adharma.png` | แนวคิดลักษณะตามเลเวล |

เมื่อได้ภาพครบแล้ว ขั้นต่อไปคือเขียนสคริปต์ตัดสไปรต์ (แบบเดียวกับ `tools/build-sprites.js` แต่ใช้ตารางเท่ากันทุกช่อง)
แล้วเพิ่มอาชีพ `taoist` ใน `CLASSES` ของ `shared/common.js` และเปิดปุ่ม 🔮 นักพรต ในหน้าเลือกอาชีพ
