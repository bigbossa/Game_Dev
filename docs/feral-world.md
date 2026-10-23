# Feral bestiary and terrain

All 51 currently registered species now render through `public/js/monster-feral.js`. Eleven archetypes have angular, shaded anatomy, narrowed eyes, fangs/claws, plated surfaces and species-specific colours. The old rounded shape module remains historical source and is no longer loaded. Existing feet, sizes, server hit radii, stats, drops and map navigation remain intact.

`monsters.js` caches finite idle/walking/casting/attack frames at 2× resolution, mirrors facing at draw time and applies hit flashes/alpha during compositing. The LRU has a 96 MiB canvas-pixel budget. Cold frame creation still costs more than a cached draw; this is not a guarantee of a particular FPS on players' devices.

Terrain uses muted biome palettes, deterministic grit, fine grass, wet sediment banks, restrained water reflections, faceted rocks and clustered foliage. The random hash now mixes seed channels independently, preventing diagonal texture stripes. Terrain detail stays in the existing chunk cache; props are built once. Collision and map layouts are unchanged.

## Monster attacks

Every species at Lv.80 or higher (23 total) gets exactly one `skill` definition selected by archetype in `shared/world-data.js`. The new signature attack replaces the old generic special for high-level bosses; lower-level boss specials remain unchanged. Normal attacks remain available between casts.

- Wind-up: 1.1–1.6 seconds, fixed circle or directional cone. The monster stops moving/attacking while casting.
- Cooldown: 9–12 seconds from cast start. Damage multiplier: 1.6–1.9 through the existing authoritative damage pipeline.
- Targets are checked at release: moving out avoids damage. Dead players, other maps and safe zones are excluded.
- Monster death, stun, return/leash, target logout/death/map change and respawn invalidate the cast.
- Events and snapshots carry the warning; late viewers see the remaining time. Repeated tokens do not duplicate effects. Map changes clear monster effects.
- The warning uses the same world-space shape and radius as the hit test, rather than a visually flattened circle.

## Validation and review

`node tools/check-monster-skills.cjs`: all 51 level thresholds, 23 attacks, 230 hit/dodge/cancellation scenarios and cone wrapping. No account store, sockets or live server required.

`node tools/check-combat-balance.cjs`: existing 296 player-skill combat regressions.

`node tools/check-feral-browser.cjs`: isolated server 3901 / Edge CDP 9334; 408 monster frames, 8 deterministic map previews, 6 representative warning/release/cancel effects, cold/warm crowd timings. Results are written to `artifacts/feral-check.json`.

Open `artifacts/feral-preview.html` for all species and eight map themes. These are component previews using real game renderers, with monsters placed on walkable preview terrain.

Refresh the browser for artwork changes. Restart the running game server to load new server-side skill definitions and AI. Validation uses a separate data file and does not modify live player saves.
