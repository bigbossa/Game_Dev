# Bandit Lord production sprite prompts

Generated with built-in image_gen, transparent_background: true. Reference for all final sources: banditlord-concept.png.

The runtime packer uses south rows 0–2 (12 poses), all north rows (16 poses), and the separate attack strip (4 poses). The south sheet's original attack row has touching silhouettes and is deliberately excluded. The separate attack strip uses scale 0.56 to match its body size to the idle source before per-direction normalization. No merged silhouettes are used in game.

## South and north sheets

Use case: stylized-concept. Create a NEW production sprite sheet of ONLY the HUMAN red-caped bandit lord from this model reference, preserving design. Transparent RGBA background, NO background colors or gradients, NO floor, NO shadows, NO text or grid. Square 1024x1024. Exactly FOUR columns and FOUR rows (16 complete isolated full-body figures). Each figure must fit inside 200x210 pixels at the center of a 256x256 cell, with at least 25 transparent pixels between any cape/sword and the cell borders. Compact cape and diagonal sword poses, same scale all figures. Rows: walk A opposite arms/feet; idle with both feet grounded; walk B with opposite feet from walk A; attack contact low diagonal dao slash. Elevated orthographic 25 degree RPG camera. Finely painted chibi wuxia game quality, rich readable cloth/metal. The HUMAN BLOODBLADE BANDIT LORD shown in the boss reference. Compact chibi adult male, broad shoulders, tan stern face, black moustache and short beard. Low blue-black iron helmet with brass trim and short burgundy crest. Oxblood robe, dark burgundy split cape, blue-black lamellar shoulder/waist plates with muted brass cloud edges, wrapped dark boots, small jade seal at waist. ONE large curved silver single-edged DAO with dark red blade inset and small red hilt tassel, held consistently in RIGHT hand. No demon traits or additional swords. Walk opposite feet and subtle cape sway; idle dao down/outward; attack low compact diagonal slash with bent knees, full sword inside cell. Back views show cape and helmet rear, no face. Preserve outfit across all 32 poses, no detached particles or blood. 

### banditlord-south-source.png

Columns left to right: S fully facing viewer; SE front-right; E pure right profile; NE back-right with back cape visible and very little face. Exactly these four directions in every row.

### banditlord-north-source.png

Columns left to right: N fully back facing away with NO face; NW back-left with back cape visible and very little face; W pure left profile; SW front-left. Exactly these four directions in every row.

## banditlord-attack-source.png

Use case: stylized-concept. Production transparent RPG sprite strip of the SAME human red-robed bandit lord from this reference. EXACTLY FOUR isolated complete full-body figures in ONE HORIZONTAL ROW on a wide landscape canvas 1536x512. All four are in a compact crouched melee attack CONTACT pose with one curved silver dao slash held close to torso. Left to right directions: FRONT facing viewer (S), front RIGHT three-quarter (SE), pure RIGHT PROFILE (E), REAR RIGHT three-quarter (NE, back cape dominant). Give each character only the central 60 percent of its cell width: HUGE EMPTY TRANSPARENT GAPS between ALL figures. Entire sword and tucked cape must be contained within own cell. Identity same: tan adult man black short beard/moustache, iron brass-edged helmet red crest, oxblood robe, blue-black lamellar shoulders and waist with brass, burgundy split cape, dark boots, jade belt seal, ONE silver curved DAO with dark red inlay in right hand. Chibi game proportions, elevated orthographic camera, detailed painterly rendering. Genuine transparent alpha background, no floor, shadows, text, frame or grid. Do NOT reproduce the reference layout or large props. Four figures only; no additional studies. Keep weapon compact, no long horizontal swing into neighboring cells.

