# นักรบแนวหน้า — ภาพต้นฉบับ

สร้างด้วย built-in `image_gen` ตามสกิล imagegen ไม่ใช้ CLI หรือ API key ภาพทั้งสองมี alpha โปร่งใสจริง
ใช้ภาพของทวนและดาบคู่ในโปรเจกต์เป็นต้นแบบสไตล์ สัดส่วน และการจัดท่า ไม่ใช้ตัวละครเวกเตอร์รุ่นแรกในเกมแล้ว

- `dharma-source.png`: ธรรมะ ผมคราม เกราะหยกน้ำเงิน/เงิน ขลิบทอง โล่สิงห์
- `adharma-source.png`: อธรรม ผมดำม่วง ตาแดง เกราะดำ/แดงเลือดหมู ขลิบทอง
- 5 มุมที่วาด × 4 ท่า; เครื่องมือแพ็กขยายเป็น 8 ทิศทางด้วยการกลับภาพแบบเดียวกับตัวละครเดิม
- `../../tools/build-warrior.cjs` แพ็ก atlas และภาพเลือกตัวละครไปที่ `../../public/assets/warrior-v1/`
- ภาพต้นฉบับคงเดิม การแพ็กตัดตามขอบที่ตรวจแล้ว รักษา alpha กรองเศษ matte เล็ก และจัดพื้นรองเท้าเข้าจุดยึด
- ภาพโจมตีเป็นท่าย่อตัว ความสูงทั้งตัวลดลงโดยไม่ขยายศีรษะกลับขึ้นมาจนผิดสัดส่วน

## Prompt: ธรรมะ

Use case: stylized-concept / production game sprite atlas. Input images are STYLE, PROPORTION and POSE-LAYOUT REFERENCES ONLY. Redesign the character into a NEW male FRONTLINE SWORD-AND-SHIELD warrior for the same Chinese wuxia chibi 2D MMORPG. Match these references' gorgeous detailed anime painting, large expressive head, small sturdy body, crisp gold filigree and shaded materials exactly; NOT flat vector, NOT low-poly, NOT realistic adult proportions. Short textured dark teal hair with small tied topknot and gold jade hair ornament, blue eyes, visible youthful determined face, NO enclosing helmet. Broad heavy ivory-silver and dark teal lamellar breastplate, layered sculpted shoulder guards with gold cloud motifs, fitted blue-black underclothes, short split armored skirt, heavy gold-trim boots, gauntlets. One SHORT single-edged silver dao sword gripped in the RIGHT anatomical hand, one large rounded kite-shaped jade-blue shield with embossed golden guardian lion face firmly held on LEFT forearm; clearly just ONE sword and ONE shield. Shield must be a dominant readable silhouette and never obscure the face. No cape, no wings, no aura or glow. EXACTLY FIVE COLUMNS and FOUR ROWS = TWENTY complete figures, landscape atlas, consistent uniform grid with generous transparent margins in every cell, no touching neighbors, no cropped sword/shield/feet. Columns: front, front-right three-quarter, right profile, back-right three-quarter, full back. Rows: idle guarded stance, walk left foot forward, walk right foot forward, attack short sword slash while shield stays raised. Same face, clothing, equipment, scale and anatomical body height in every cell. All figures fully visible head to toe, soles on consistent row baselines. Preserve shield left/sword right correctly in back views. Compact sword so poses fit. TRUE transparent background, no cast shadows, no labels, no lines, no particles, no environment. High-quality detailed hand-painted game-ready chibi anime atlas matching the supplied game art.

References: `../spearman-v2/dharma-short-source.png`, `../dualblade-v2/short-source.png`.

## Prompt: อธรรม

Edit this exact production transparent sprite atlas into the ADHARMA dark-faction variant for the same Chinese wuxia chibi MMORPG. Preserve all TWENTY figures in exactly the same 5-column 4-row cell locations, canvas size, directions, faces, body proportions, feet baselines, shield and sword hands, equipment shapes, idle/walk/attack poses. Change ONLY palette and small insignia: short dark-teal hair becomes black-violet hair with burgundy highlights, eyes become ruby red, teal cloth and shield become deep burgundy/crimson, ivory armor becomes charcoal-black steel with polished silver reflections, gold filigree stays antique gold, golden lion shield crest becomes a fierce golden demon-lion crest of SAME silhouette. Keep handsome cute determined face visible, no helmet, no large horns, no wings, no cape, no added objects. Detailed rich painted anime finish identical to source, clean dark outlines, readable gold edges. ONE short dao sword in right hand and ONE shield on left forearm in every frame. No effects, no shadows, no text, no lines. Genuine transparent alpha background. Do not resize, recrop, add figures, move figures or change the 5 by 4 layout.

Edit target: `dharma-source.png`.
