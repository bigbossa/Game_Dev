# Class skill art

> 21 Oct 2026: the skill sets were redesigned (see [class-skills.md](class-skills.md)). The renderers now live in
> `SkillFX.render.<skill id>` and are dispatched by `SkillFX.play(fxEvent)`; the helpers, budgets and test rules below still apply,
> the per-skill descriptions below describe the previous skill set.

`public/js/skill-fx.js` installs the 27 class skill renderers over the existing
`FX` API. Load it after `fx.js`. Shared hit text, monster effects, equipment
effects and the effect lifecycle stay in `fx.js`. Skill art and hit accents
are chosen by class, independently of weapon colour.

| Class | Visual language | Dharma / Adharma |
| --- | --- | --- |
| Dual blades | Paired steel cuts, sharp fractures, speed echoes, spectral blades and blade dragons | Ice blue / crimson steel |
| Taoist | Written charms, eight trigrams, lotus healing, ritual swords, armoured guardians and yin-yang | Jade and parchment gold / ember and dark parchment |
| Archer | Fletched arrows, feathers, living vines, eagle dives and long-tailed phoenixes | Forest green and gold / wine black and crimson |

Level stages are 1, 30, 60, 100 and 130. These progressively add echoes,
feather layers, glyph detail, orbiting charms and richer silhouettes.
Small visual scaling also increases continuously with level, capped at 28%.
Skill evolution retains its separate server-defined volley, wave and target
counts. Damage, costs, cooldowns, unlocks and hit areas are unchanged.
The guardian event now forwards its caster ID so its art uses the caster's level.

Ground geometry is drawn below actors. Character silhouettes keep their
normal rendering. These skill renderers do not add screen flashes, generate
random particles during drawing, or create timers. Delays use FX timestamps.
Draw callbacks cannot enqueue effects, and at most 180 skill effect nodes
remain active together; the oldest skill node is removed on overflow.

`tools/check-skill-fx.cjs` uses an isolated CDP browser on port 9334 and a local
test server on port 3901. It disconnects before creating local-only actors,
dispatches the real socket handler for all 27 skills, checks both factions,
five level stages, all directions, canvas state, expiry, crowd limits and
level progression at a fixed weapon/evolution. It writes three class galleries
and `artifacts/skill-fx-check.json`. Gallery low-level rows illustrate the visual
scale; they do not represent unlocking those advanced skills at that level.
