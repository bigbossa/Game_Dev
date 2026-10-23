# Monster sprite prompts (AI image generator)

สร้างภาพมอนสเตอร์ทีละตัวด้วย AI วาดภาพ (เช่น ChatGPT / Midjourney / Leonardo / SDXL) ด้วย prompt ด้านล่าง
แล้วบันทึกเป็น `monster-art/<id>.png` (ชื่อไฟล์ = id ในหัวข้อ) จากนั้นสั่ง `npm run monsters` แล้วรีเฟรชเกม

- เลย์เอาต์มาตรฐาน: **8 คอลัมน์ × 3 แถว** พื้นขาวล้วน (หรือพื้นโปร่งใส) แต่ละช่องตัวเดียวเต็มตัว
- คอลัมน์ = ทิศ: หน้า (หันเข้ากล้อง), หน้า-ขวา, ขวา, หลัง-ขวา, หลัง, หลัง-ซ้าย, ซ้าย, หน้า-ซ้าย · แถว = เฟรมท่าเดิน 3 เฟรม
- ถ้า AI ให้ภาพแค่ด้านข้างแถวเดียว ใส่ใน `monster-art/grid.json` เช่น `{ "boar": [1, 1] }` (หันขวา เกมจะกลับด้านให้เอง) หรือจำนวนช่องที่ได้จริง
- ตัวไหนยังไม่มีภาพ เกมใช้ภาพวาดด้วยโค้ดแทน

## หมู่บ้านเซียนน้อย (Lv.1-20)

### `spirit` — ภูตน้ำค้าง (Lv.1)

```
a small round floating dew spirit, translucent pale-blue jelly body, big cute dark eyes, wispy tail, no legs. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `mushroom` — เห็ดพิษปีศาจน้อย (Lv.3)

```
a small walking toadstool, red cap with white spots, cream stem body with a grumpy face and tiny feet. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `boar` — หมูป่าเขี้ยวเลื่อย (Lv.5)

```
a wild boar with brown bristly fur, spiky dark mane along the back, curved ivory tusks, glowing red eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `greensnake` — อสรพิษหญ้าเขียว (Lv.8)

```
a coiled green grass snake with a pale yellow belly, darker green diamond markings, yellow eyes, forked tongue. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `wolf` — หมาป่าเงาจันทร์ (Lv.12)

```
a lean shadow wolf with dark violet-grey fur, wisps of purple shadow smoke, glowing red eyes, bushy tail. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `bandit` — โจรหมวกฟาง (Lv.16)

```
a human mountain bandit in a patched brown robe, wide straw hat, red sash, holding a curved sabre. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `kingboar` — จ้าวหมูป่าเกราะเหล็ก (Lv.20 · บอส)

```
A large imposing boss: a huge boss boar, dark brown fur, silver-white mane, iron armour plates riveted on its back, golden eyes, giant tusks. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## ด่านผาหลิว (Lv.20-40)

### `scorpion` — แมงป่องผาทราย (Lv.22)

```
a giant sand scorpion with a tan segmented shell, big pincers, tail curled high with an orange stinger. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `passbandit` — โจรคลุมหน้าด่านผา (Lv.25)

```
a hooded canyon bandit in dark grey clothes with gold trim, face hidden by a hood, holding a long spear. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `golem` — ยักษ์หินผาหลิว (Lv.28)

```
a hulking rock golem made of grey boulders, moss on the shoulders, glowing cyan eyes and a cyan crack on the chest. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `ironeagle` — อินทรีปีกเหล็ก (Lv.32)

```
a large steel-grey eagle with metallic feathers, white crest, yellow beak and talons, wings spread while hovering. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `fireleopard` — เสือดาวลายเพลิง (Lv.36)

```
an orange fire leopard with dark spots, flames flickering along its back, bright yellow eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `banditlord` — ขุนโจรดาบโลหิต (Lv.40 · บอส)

```
A large imposing boss: a big boss bandit lord in a blood-red robe with gold trim, iron helmet, dark cape, wielding a huge sabre. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## ป่ามารสามเศียร (Lv.40-60)

### `treant` — ต้นไม้อสูรพันราก (Lv.42)

```
a walking demon tree, dark bark trunk with an angry face, root legs, branch arms, green leafy crown, yellow glowing eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `spider` — แมงมุมม่วงพิษร้าย (Lv.45)

```
a giant purple venom spider with a dark abdomen marked with a glowing violet diamond, eight long legs, red eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `foxfire` — ภูตจิ้งจอกไฟผี (Lv.48)

```
a floating fox-fire spirit, pale green ghostly flame body with small fox ears and a flame tail. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `demonmonk` — นักพรตมารเงา (Lv.52)

```
a demonic monk in dark purple robes, white hair, pale skin, holding a staff topped with a glowing violet orb. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `blackbear` — หมีดำบ้าคลั่ง (Lv.56)

```
a massive black bear with thick dark fur, round ears, open roaring mouth, glowing red eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `elderwood` — พฤกษามารพันปี (Lv.60 · บอส)

```
A large imposing boss: a giant ancient demon tree boss, gnarled dark trunk, crimson-pink corrupted leaves, glowing red eyes and a gaping mouth. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## จวนแม่ทัพร้าง (Lv.60-80)

### `ghostsoldier` — ทหารวิญญาณเฝ้าจวน (Lv.62)

```
a translucent ghost soldier in blue-grey armour and helmet, faded legs, glowing cyan eyes, holding a spear. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `stonepython` — งูหลามหินผา (Lv.65)

```
a large python with stone-grey rocky scales, bone horns on the head, orange eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `guardstatue` — รูปปั้นทวารบาล (Lv.68)

```
an animated temple guardian statue of grey carved stone, moss in the cracks, glowing red eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `dancer` — วิญญาณนางรำคืนจันทร์ (Lv.72)

```
a floating ghost dancer, pale pink translucent body, long flowing ribbon sleeves, sad dark eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `headless` — องครักษ์ไร้เศียร (Lv.76)

```
a headless armoured bodyguard in black lacquered armour with a dark red cape, blue ghost flame where the head should be, holding a sabre. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `ghostgeneral` — แม่ทัพผีพันศพ (Lv.80 · บอส)

```
A large imposing boss: a towering ghost general boss in dark steel-blue armour, horned helmet, pale blue skin, glowing white eyes, giant cleaver blade. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## ประตูเทพยุทธ์ (Lv.80-100)

### `whitetiger` — พยัคฆ์ขาวพิทักษ์ (Lv.82)

```
a white tiger with black stripes and icy blue eyes, noble guardian pose. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `firecrane` — กระเรียนเพลิงสวรรค์ (Lv.85)

```
an elegant red-crowned crane with white feathers and black wing tips, trailing small flames. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `gatemonk` — ภิกษุพิทักษ์ทวาร (Lv.88)

```
a bald warrior monk in saffron-orange robes with a red sash, holding a wooden staff. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `bronzegolem` — ยักษ์สำริดเทวาลัย (Lv.92)

```
a temple golem of polished bronze plates, green patina, glowing golden eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `jadenaga` — พญานาคหยกมรกต (Lv.96)

```
a jade-green naga serpent with a hooded head, golden horns and golden markings, glowing aura. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `wardemon` — ราชันอสูรสงคราม (Lv.100 · บอส)

```
A large imposing boss: a colossal war demon king boss in golden-bronze armour, ivory horns, spiked shoulder plates, giant cleaver, burning eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## วังน้ำแข็งทะเลเหนือ (Lv.100-115)

### `snowwolf` — หมาป่าพายุหิมะ (Lv.101)

```
a white snow wolf with frosty blue-grey shading, icy blue eyes, breath of cold mist. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `icewisp` — วิญญาณเกล็ดน้ำแข็ง (Lv.104)

```
a floating ice wisp spirit, crystal-blue translucent body with small white ice horns. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `icegolem` — ยักษ์ธารน้ำแข็ง (Lv.107)

```
a golem made of pale blue ice blocks, white frost cracks, glowing white eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `frostserpent` — มังกรงูน้ำแข็ง (Lv.110)

```
a frost serpent with pale ice-blue scales, white horns, frozen glowing aura. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `snowguard` — องครักษ์วังหิมะเงิน (Lv.113)

```
an ice palace guard in white-silver armour and helmet, blue trim and cape, holding an ice spear. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `icequeen` — จักรพรรดินีหิมะนิรันดร์ (Lv.115 · บอส)

```
A large imposing boss: a tall ice empress boss in white and ice-blue robes, crystal crown, long white hair, staff with a frozen orb. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## หุบเขาเพลิงทักษิณ (Lv.115-130)

### `lavascorpion` — แมงป่องลาวาเดือด (Lv.116)

```
a black obsidian scorpion with glowing lava cracks, orange molten stinger. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `firetiger` — พยัคฆ์อัคคี (Lv.119)

```
a blazing orange tiger with black stripes, its back wreathed in flames, white glowing eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `lavagolem` — ยักษ์หินหลอมเหลว (Lv.122)

```
a golem of dark volcanic rock with glowing orange lava seams and flames on the shoulders. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `phoenix` — หงส์ไฟฟีนิกซ์ (Lv.125)

```
a phoenix of orange and gold flames, long burning tail feathers, wings spread. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `firedrake` — มังกรเพลิงเยาว์ (Lv.128)

```
a young red fire drake with bat-like wings, orange belly, dark horns, breathing small flames. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

### `elderdragon` — มังกรอัคคีบรรพกาล (Lv.130 · บอส)

```
A large imposing boss: an ancient elder fire dragon boss, dark crimson scales, golden belly, huge wings, ivory horns, fire breath. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```

## สนามรบธรรมะ-อธรรม (Lv.10-130)

### `boss` — ราชันมารโลหิต (Lv.35 · บอส)

```
A large imposing boss: a colossal blood demon king boss in crimson armour, ivory curved horns, spiked pauldrons, black cape, giant cleaver, burning yellow eyes. cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details. Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.
```
