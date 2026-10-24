# Divine Arbiter — existing character style

## References inspected

- `class-art/warrior-v4/dharma-source.png` and `adharma-source.png`: painted chibi wuxia body, open face, tied topknot, armor shading, directional sheet layout.
- `public/assets/warrior-v4/dharma-portrait.png`, `public/assets/spearman-dharma-portrait.png`, Taoist portrait and dualblade source: compare proportions and readability with the actual game characters.

The selected design keeps the oversized head (roughly 40–45% of total body height), compact limbs, layered armor and painted edges. A single straight oath sword and empty off hand distinguish it from the sword-and-shield warrior. Dharma uses blue hair and ivory/blue/gold armor; Adharma uses dark plum hair and black/crimson/violet armor. Level effects are separate runtime layers.

## Production design prompt / regeneration brief

Use the existing warrior source sheet as the style and layout reference. Create the original Divine Arbiter oath swordsman in the same hand-painted CHIBI wuxia MMORPG style: oversized head, small compact body, large expressive eyes, tied topknot, layered armor and cloth. Match the reference's proportions, linework, shading, sprite scale and camera exactly. One straight sword in the right hand; empty left hand; no shield and no second held sword. Do not turn this into a tall realistic fantasy knight.

Five directional columns: front, front-right, right side, back-right, back. Four pose rows: idle, left step, right step, sword attack. One complete figure per cell with transparent spacing around hair, feet and sword. No labels, background, floor shadow, halo, wings or floating swords. True transparent alpha. Dharma: ivory white, pale blue, gold trim, blue sash and blue topknot. Adharma variant: preserve the same character proportions, poses, camera and sheet layout; use black/plum armor, crimson cloth, violet details and dark plum hair.

This is a reusable brief for the selected design, not a transcript of the archived tall exploration. Generation used the built-in image generation tool with reference images and transparent background.

## Source provenance

- `dharma-source.png`: generated output `exec-d321af6a-7ba8-4fbf-9ad7-97a9de7d4f9a.png`.
- `adharma-source.png`: generated output `exec-6cda6c57-552f-4cec-9f7d-98ad6f98b19e.png`.
- Both were copied from Codex `generated_images/01a16b71-1d93-7971-8d4f-37b3475a6916/` and retained here at 1402×1122 with alpha.
- `archive/` contains the superseded tall 4×4 exploration. It is excluded from runtime asset loading.

## Build and visual review

`npm run arbiter` crops authored cells, removes isolated matte dust, scales and mirrors them into the existing 320×280 frame format. It does not repaint the artwork. Output: eight directions, four walk frames and three attack frames per faction, sole anchor `(160,252)`, direction order through `C.DIR_COL`.

`public/js/arbiter-look.js` draws these atlases at the game's normal player scale and uses shared `ModelTiers` geometry, `Wings` and `EquipmentAura`. Halo at Lv.30, wings at Lv.70, larger wings at Lv.110, sun/eclipse aura during the ten-second transformation. Learned Astral Blades orbit beside the body without covering the face.

Browser review outputs in `artifacts/arbiter/`: `create.png`, `style-comparison.png`, `progression.png` and `directions.png`. These are generated evidence, not runtime images.
