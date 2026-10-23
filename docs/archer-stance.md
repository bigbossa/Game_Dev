# Archer direction and ready stance revision

The reviewed source atlases put a **back-left** figure in source column 3. The old packer interpreted it as back-right, so north-east movement selected a left-facing head and body. The packer now mirrors that entire cell and all attachment coordinates for north-east, and leaves it unmirrored for north-west. Shared movement input directions are unchanged.

Idle figures now hold a near-vertical bow at the hip, with the tips pointing outward away from the face and torso. Idle reuses the authored neutral walking pose, so its body proportions and foot anchor match exactly. Both factions retain separately measured collars and grips. This replaces the previous diagonal, waist-crossing stance at the user's request.

Archer back decorations are now an open spirit-bow constellation, with no wing images: jade/gold recurved limbs for dharma and obsidian/crimson limbs for adharma. Lv.60 starts the frame, Lv.80 adds floating arrows, Lv.100 adds a crest and outer tracks, and Lv.120/130 add more arrows and orbiting gems. One rear pass owns all pieces, with a transparent central envelope and no foreground pass. Its physical size uses the neutral pose so crouching to shoot does not shrink the ornament. Inventory wing scaling cannot collapse it into the hair. The old moon disc, arrow fan and secondary feathers remain disabled; royal leaf particles stop before constellation stages.

The hair material mask includes violet highlights as well as blue-grey strands. Previously a green/red threshold skipped lavender, and the skin predicate also protected some violet hair edges. Warm skin is now distinguished from cool hair before recolouring. This removes the apparent old purple hairstyle from both factions without adding another hair layer. Adharma retains black roots/crimson ends; dharma retains its level palette. Authored alpha, warm skin, green eyes and strand shading remain intact.

Adharma now has its own `dark-model.json`. Body materials, crowns, back decorations, bow grips, weapon sparks and enhancement lines use the appropriate faction rig. Front and side views draw the bow over the outfit and restore the gripping fingers and head; back views draw the bow behind the body. Bow ornaments use 72% of the legacy ornament size to fit the new body. Foreground weapon enhancement strokes and particles are suppressed where the torso hides the weapon.

## Assets and rebuilding

- Active body sources: `class-art/celestial-archer/` (dharma) and `class-art/demon-models/` (adharma). Both now use newly authored Chinese immortal armour and three hairstyles. See `docs/celestial-archer.md` and `docs/demon-models.md` for source prompts, calibration and validation. Earlier sources in `class-art/archer-v2/`, `class-art/archer-stance/` and the dark archer files in `class-art/adharma-hair/` are historical artwork and are no longer packed.
- Packed game assets and both rigs: `public/assets/archer-v2/`.
- `npm run archer` rebuilds both factions, including the revised idle row.
- Both factions use separately measured heads, collars, fists and source row boundaries. The dharma rig is `class-art/celestial-archer/rig.json`; the adharma rig is `class-art/demon-models/archer-rig.json`. The level-dependent weapon designs are retained. No combat rules or player saves change.

## Validation

- `npm run check:archer-rig`: 8 input vectors, 96 artwork-facing checks, 120 hand anchors, 192 padded walking/idle frames, and standing/walking collar heights.
- `node tools/check-archer-v2.cjs http://localhost:3901 9334`: isolated browser renderer; 1,008 frames over both factions and nine levels; outfit alpha, protected skin, glint positions, faction anchors, bow occlusion, unobscured opaque face pixels, cache reuse, and no pixel reads in the warmed drawing path. All checks pass; browser errors, face occlusions, alpha leaks and warmed pixel reads are zero.
- `node tools/check-archer-motion.cjs`: offline preview loads both atlases and captures standing, walking and attacking poses.
- Constellation separation: 640 combinations of faction, level, facing, pose, time and inventory/world sizing; zero painted pixels in the protected central envelope, no wing image calls and no foreground ornament. Ten distinct faction/level designs. Black/crimson hair verified in 24 hair-length/direction combinations; 3,528,438 cool source samples across 1,008 frames leave no blue/violet residue. Warm skin and green eyes are unchanged.
- Visual review: `artifacts/archer-v2-preview.html`, `archer-v2-levels.png`, and the two motion atlases. The earlier dharma hairstyle hash baseline predates this explicitly requested archer stance revision and is a historical comparison, not an invariant for these newly replaced archer assets.
