# นักรบแนวหน้า V3 — เกราะพิทักษ์

Created with the built-in imagegen tool. Original alpha is preserved; source atlases are packed by `npm run warrior`.

## Dharma source

Use case: stylized-concept. Production transparent sprite atlas for the existing Chinese wuxia chibi MMORPG. The provided image is a STYLE AND POSE reference only. Completely REDESIGN the frontline sword-and-shield male warrior. New sturdy armored sentinel silhouette: broad layered shoulder plates, ivory silver lamellar breastplate with restrained brass edges, dark teal split waist tabard, heavy greaves, open-face oriental helmet with swept cheek plates and small central crest, cropped dark teal hair visible beneath helmet. Youthful determined face and blue eyes, large head, 2.7 heads tall. A substantial angular kite shield with a simple teal center and brass geometric rim on anatomical LEFT forearm; one short broad single-edged silver dao in RIGHT hand. Strong clear metal planes, crisp painted anime game art matching reference; not vector. Helmet must be part of painted design. No cape, wings, particles, aura, shadow, environment, text or grid lines. EXACTLY 5 equal columns and 4 equal rows, TWENTY full-body figures with generous transparent margins inside every cell. Request canvas 1600x1280. Column views: front, front-right 45 degrees, right profile (nose points RIGHT), back-right, full back. Row 1: upright idle guard; row 2: walking left foot forward; row 3: walking right foot forward; row 4: low attacking stance sword swept outward and shield braced. Row 4 must have noticeably different attack arm pose. Consistent same character size, equipment, helmet, face, proportions throughout. Both feet, helmet, sword tip and shield completely inside each cell. Background genuinely transparent alpha.

Reference: `../warrior-v1/dharma-source.png` (style and poses).

## Adharma source

Use case: precise-object-edit. Edit target: the provided transparent 5-column 4-row warrior sprite sheet. Make the ADHARMA dark faction variant. Preserve EXACTLY all twenty character poses, directions, faces, positions, head and body sizes, armor and helmet silhouettes, swords and shields, feet baselines, grid and canvas dimensions. Change PALETTE ONLY throughout: ivory-silver armor becomes polished charcoal gunmetal, gold trim becomes warm antique copper-gold, teal cloth and shield centers become deep crimson red, dark teal hair becomes black with burgundy highlights, blue eyes become ruby red. Keep metal highlight planes readable. Skin remains natural and unchanged. Keep sword blades bright silver. No horns, wings, added elements, effects, backdrop or shadows. Preserve true alpha transparency and all full figures.

Edit target: `dharma-source.png`.

## Runtime

Painted helmet, angular kite shield, layered silver/gunmetal armor and teal/crimson cloth. Eight directions, four walk frames and three attack frames; feet anchored at (160,252). The painted helmet replaces the old procedural helmet. Level hair, plume, wings and aura remain runtime layers. Four independently equipped armor surfaces, weapon designs, rarity lights and enhancement effects follow the spearman's shared rules. See `../../docs/warrior-v3.md`.
