# นักพรต v2 — ธรรมะ / อธรรม

Generated with the built-in `image_gen` tool. Reference artwork: `class-art/warrior-v1/dharma-source.png` (painted chibi style), `public/assets/taoist-dharma-portrait.png` (class identity). Original source alpha is retained; build tooling only packs, scales and mirrors the figures.

## Dharma prompt

Use case: stylized-concept. Asset type: production transparent 2D wuxia MMORPG character sprite atlas.
Create a NEW redesigned young male TAOIST / talisman sorcerer character sprite sheet matching the painted chibi style of the provided warrior reference, NOT a warrior. The second reference shows the old Taoist only to explain his class identity (fly whisk, paper talismans, layered robe).
Exactly 5 columns by 5 rows, evenly spaced cells, 25 full-body figures. Wide canvas 1536x1536 or larger square. Every figure wholly inside its cell, generous transparent gutters, identical head size and body proportions across all 25 cells. No text, no grid, no floor, no cast shadows, no glow effects or floating particles.
Columns from left: facing FRONT/SOUTH, front-right/SOUTHEAST, RIGHT/EAST profile, back-right/NORTHEAST, BACK/NORTH. All five rows follow these same five directions. Back views must show back of head, not faces.
Rows: 1 neutral standing with whisk at side and talisman in other hand; 2 walking left leg forward; 3 walking right leg forward; 4 casting wind-up with whisk raised diagonally and talisman held near chest; 5 casting release with talisman hand extended forward and whisk sweeping out. Grounded feet. Real distinct leg and arm poses. No extra hands. No duplicates.
Art direction: premium detailed hand-painted chibi wuxia fantasy RPG sprites, compact 2.7-head-tall body and large expressive eyes matching the warrior reference, rich fabric shading and clean dark silhouette, elegant layered Taoist robes and wide sleeves, clearly visible separated boots, cloud embroidery, gold filigree, yin-yang circular waist ornament, talisman pouch and small gourd. No shield, no blade, no heavy armor, no wings, no halo. Recognizable traditional fly whisk with a short decorated handle and flowing white horsehair. Right hand holds whisk, left hand holds a single rectangular paper talisman.
DHARMA palette: porcelain white layered robe, deep teal and sky-blue sash and robe panels, restrained antique gold trim and jade clasp. Dark blue-black hair with a swept fringe in a tidy high topknot and gold/jade Taoist hairpin. White whisk hair, yellow paper talisman with tiny red abstract markings. Same outfit and hairstyle in every frame. All 25 figures isolated on genuine transparent alpha background. Match design and detail density of reference without copying its warrior costume.

## Adharma prompt

Use case: stylized-concept. Asset: transparent game sprite atlas.
Create the ADHARMA dark faction counterpart of the attached Taoist sprite sheet. Preserve the EXACT same 5 columns x 5 rows, 25 poses, camera directions and chibi proportions. Columns FRONT, FRONT-RIGHT, RIGHT, BACK-RIGHT, BACK. Rows standing, step A, step B, whisk raised casting, forward talisman casting. Same male Taoist with fly whisk and paper talisman, same detailed hand-painted wuxia style. This is a dark Taoist, not a warrior.
Change costume palette to black/charcoal layered silk with deep crimson panels, restrained antique gold embroidery and crimson jewel. Change hair to charcoal black with deep wine-red tips, topknot and gold/crimson hairpin. Warm pale skin, red-brown eyes. Ivory-gray whisk fibres, ebony handle, pale yellow talisman with dark red symbols. Gold yin-yang waist ornament, gourd and talisman pouch. Preserve elegant robes, no armor or shields.
All 25 figures completely visible and consistently sized, exactly five evenly spaced columns and five evenly spaced rows. Add generous fully transparent padding around every figure including whisk, with clear transparent gutters so no silhouettes touch each other or the outer image edge. Last row must be fully visible, not compressed. Large square canvas. No labels, no grid, no cast shadows, no painted background, no floor, no glow effects. Genuinely transparent alpha background.

## Rebuild

`npm run taoist` packs the sources and `rig.json` into `public/assets/taoist-v2/`. Columns S, SE, E, NE, N are mirrored for NW, W, SW. Walk rows are step A / neutral / step B / neutral. Cast rows are neutral / raised whisk / talisman release. Painted pose landmarks replace the legacy anatomical deformation and equipment anchors. The old artwork and `npm run taoist:legacy` remain available.
