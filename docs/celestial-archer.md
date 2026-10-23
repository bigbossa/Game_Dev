# Celestial archer

Dharma now matches the newly redesigned demon archer's painted scale and Chinese martial-fantasy style, with its own ivory silk, jade insets and gold phoenix/cloud armour. Half-up crown knots progress from neck-length loose hair (Lv.1–49), through waist-length (Lv.50–99), to flowing long hair (Lv.100–130). The existing level hair colours progress from brown to pale jade and ivory.

The authored costume includes boots, sleeves, chest, waist and split robe panels in every animation frame. The material compositor preserves ivory silk separately from jade, keeps skin and green eyes unchanged, and adds equipment-tier engraving within the same silhouette. The existing bow attaches to newly measured fists; back decorations and crown use the faction's new head/collar rig. No gameplay or movement timing changes.

## Source assets

Generated with the built-in `image_gen.imagegen` tool, with transparent backgrounds:

- `class-art/celestial-archer/short-source.png`
- `class-art/celestial-archer/medium-source.png`
- `class-art/celestial-archer/long-source.png`
- `class-art/celestial-archer/medium-attack-fix.png`: only bottom-row right-profile cell is used; the extended bow arm was missing from the first generated medium atlas.
- `class-art/celestial-archer/rig.json`: measured cell bounds, neck centres, collars and hand anchors.
- Exact prompts: `class-art/celestial-archer/PROMPTS.md` and `ATTACK-FIX.md`.

Build: `node tools/build-archer-v2.cjs`. Outputs are the six unprefixed sheets and `model.json` in `public/assets/archer-v2/`. The `--adharma-hair` path continues to build the independent demon sources.

## Checks

- `node tools/check-archer-rig.cjs`: both factions, 96 facing checks, 120 walk/idle hands, 192 padded frames.
- `node tools/check-celestial-archer.cjs`: 72 attack hands and padded attack frames; 18 dark archer/spear asset hashes unchanged.
- `node tools/check-archer-v2.cjs http://localhost:3901 9334`: actual browser renderer, both factions, nine levels, 1,008 animation frames; alpha, skin, green eyes, bow/face occlusion, glints, back-decoration separation and warmed cache checks.
- `node tools/check-archer-motion.cjs`: offline preview, idle/walk/attack captures.

Open `artifacts/archer-v2-preview.html` for motion in eight directions and the level-comparison gallery. This uses captured frames from the real renderer and works offline.

The older `demon-models-dharma-before.json` archer hashes are historical: the user explicitly requested this later dharma redesign. The demon regression test still enforces its original unchanged dharma spear assets. Current unrelated dark assets are protected by `celestial-archer-unchanged-before.json`.
