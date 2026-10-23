# Demon-immortal model revision

The adharma archer now uses a new painted body: charcoal Chinese martial armour, gold dragon-scroll trim, fitted sleeves and boots, and split robe tails. Three asymmetric/half-up hairstyles replace the blunt fringe and curled twin tails. The runtime material preserves the painted strands while colouring the roots black and tips crimson. The existing level-dependent bow, crown and separated wing/constellation effects follow the new faction-specific rig.

Adharma spearmen now have four high-topknot bodies with loose tails and no braids:

| Levels | Hair model |
| --- | --- |
| 1–29 | Short tail at the neck |
| 30–59 | Medium tail around the shoulders |
| 60–99 | Long tail to the waist |
| 100–130 | Long flowing tail towards the calves |

Each spear variant has its own walk/attack rig. The loader, equipment compositor, weapon enhancement and equipment glints select the same variant. Foot anchors stay fixed, while the painted spear tip and gripping hand are measured separately for each stride. This prevents the replacement spearhead from appearing beside the original blade.

## Assets and generation

- Tool: built-in `image_gen.imagegen`, transparent PNG generation/editing.
- Accepted source images and exact prompts: `class-art/demon-models/`, `PROMPTS.md` and `ATTACK-FIX.md` in that folder.
- Three archer source atlases plus one targeted attack correction. Only row 4, column 4 of the correction is consumed, to align the medium hairstyle's attack arm with its facing.
- Four spear hair-edit atlases. Original face, body, costume and spear composition serve as the reference for the edit.
- Reviewed landmarks: `archer-rig.json` and `spearman-rig.json` in the source folder.
- Packed archer outputs: `public/assets/archer-v2/dark-*.png`, `dark-model.json`.
- Packed spear outputs: `public/assets/adharma-hair/spearman-adharma*.png`, `spearman.json` (version 3 with per-style entries).
- Source bodies remain standalone project assets; no runtime reference points outside the repository.

Rebuild only these dark assets:

```powershell
node tools/build-archer-v2.cjs --adharma-hair
node tools/build-spearman.js --adharma-hair
```

## Validation and preview

- `node tools/check-archer-rig.cjs`: 96 facing checks, 120 hand anchors, 192 padded walk/idle frames.
- `node tools/check-archer-v2.cjs http://localhost:3901 9334`: 1,008 rendered frames, zero skin changes, face occlusions, alpha leaks, cache misses or hot pixel reads. All 144 wing/constellation separation cases and 24 black/crimson hairstyle cases pass.
- `node tools/check-spearman-browser.cjs http://localhost:3901 9334`: actual equipment renderer, both factions, weapons, armour, anchors and class effects.
- `node tools/check-demon-models.cjs http://localhost:3901 9334`: 224 packed spear frames, four unique hair silhouettes, 392 rendered direction/pose/level frames, 14 unchanged dharma asset hashes and no browser exceptions.
- `node tools/check-demon-preview.cjs`: seven offline atlases, class/pose/direction controls and six review screenshots.
- Open `artifacts/demon-models-preview.html` to compare levels and play idle, walk and attack in all eight directions. The preview uses captures from the actual renderer; changing its controls does not require a running server.

Checks use a separate port and player-data file. No combat settings or live account data are modified. Source atlas generation is reviewed artwork, not a skeletal animation system; walking uses the game's existing authored frame timing.
