# Starter village v2 — concept prompts

## Production asset briefs

The following records the production requirements used for the generated assets (condensed from the generation prompts). All use built-in image_gen, stylized-concept, hand-painted chibi wuxia matching the plaza/overview references. Crop/scale only for runtime packaging; preserve alpha. No text, UI, watermarks, or characters.

- **buildings-draft.png:** transparent 3-column, 2-row prop sheet, separated silhouettes with padding; jade-roof pavilion, herbal apothecary, blacksmith forge / timber house, pass gateway, small jade travel stele. Elevated orthographic RPG camera, warm limestone foundations, teal curved roofs, gold trim, soft painted materials. No ground scenery behind the isolated buildings.
- **nature-draft.png:** transparent 3-column, 2-row prop sheet; green broadleaf tree, pink peach tree, bamboo / low rocks, warm lantern on stone pedestal, flowering shrub. Match building camera and lighting, distinct separated silhouettes, no surrounding landscape.
- **courtyard-source.png:** single isolated ancient limestone courtyard ground overlay, elevated orthographic top-down, wide ellipse about 1.45:1, transparent with padding. Warm ivory/honey fitted pavers in concentric rings, worn edges, fine cracks, muted gold details, correct yin-yang with opposing dots, eight cloud/lotus inlays. Matte and readable. No buildings, stairs, plants, lanterns, characters or cast shadow. Style reference: plaza-concept.png.
- **grass-source.png:** opaque full-bleed tileable top-down meadow grass texture only. Soft broad sage/moss/olive patches, warm highlights, restrained contrast near #819467/#789261. A few soft tufts, hints of dry soil and sparse clover. No flowers, rocks, trees, paths, directional shadows, photorealism or noisy high contrast. Runtime mirrors repeated edges.
- **bridge-source.png:** isolated transparent wide horizontal east-west stone bridge, high orthographic top-down 3/4 camera, about 2.6 times as wide as deep. Open east/west ends, low rails only along top/bottom, cloud motif posts, broad flat walkable deck and modest arch. Warm weathered limestone joints and subtle moss. No river, ground, trees, lanterns, shadow or text. Style reference: overview-concept.png.

Selected built-in outputs: buildings `exec-dd7c65b3-2894-47b5-b9d8-c05e6d87ce03`, nature `exec-ba90b377-1159-47bb-8731-98cd92866236`, courtyard `exec-7ed43df9-a04d-4d68-a8c7-aa3bb9187040`, grass `exec-cfe695ab-4bb7-44ff-b5e2-ef626626f27e`, bridge `exec-4982cea1-f452-4fcb-a71c-3c319daf27cb`. The source PNGs are copied into this directory; runtime assets live under `public/assets/village-v2`.

Mode: built-in `image_gen`. Overview and plaza are opaque environment concepts. Production sprites use transparent alpha; grass is opaque. Runtime packing is handled by `tools/build-village.cjs`.

## Overview

References: `artifacts/feral-map-village.png` (current game camera/readability) and `artifacts/taoist-v2/taoist-v2-preview.png` (character style).

Use case: stylized-concept.
Asset type: environment concept art for redesigning the first map of an existing 2D wuxia fantasy MMORPG, a readable world-map overview, not a deployed game screenshot.
Primary request: create a beautiful coherent new STARTER MAP called Little Immortal Village, a neutral shared village for white-blue-gold Dharma heroes and black-crimson-gold Adharma heroes. Match the hand-painted chibi wuxia character art in reference 2. Reference 1 is the CURRENT GAME terrain: use only its overhead camera and general terrain/gameplay readability, upgrade its simplistic grid art to a richer hand-painted environment. Do not copy the reference image layout or its text.
Canvas: landscape 1536x1024 or high resolution same ratio. A single full-map view filling the frame, orthographic elevated 3/4 top-down RPG map, no horizon, no floating island, no cutaway diorama, no UI, no title, no labels, no numbers, no text, no decorative frame.
Map design: a broad lush valley with a small dense safe village near center, arranged around a generous circular pale-stone yin-yang courtyard and modest ancient teal-roof pavilion at its northern end. Five or six human-scale traditional wuxia wooden buildings, dark jade curved tile roofs, ivory plaster, warm timber, small brass/gold details, restrained warm lanterns. West of village runs a curving narrow jade river from upper edge to lower edge; a broad low stone bridge connects western open training meadow to the village. Main road continues from the bridge through central plaza eastwards to a prominent wooden gateway into a rocky mountain pass at the far right. The road is smooth pale sandy earth and paving, softly blended into grass, absolutely no checkerboard tile boundaries.
Distinct navigable regions: southwest bright meadow with pale dew spirits and red mushrooms, southeast low orchard and boar meadow, east bamboo grove with snakes and a small wolf clearing, northeast weathered bandit camp and tiger rocks; at top center a separate rocky iron-boar lair in a shallow alcove, reached by a clearly winding side path, distant from the safe village. Far background consists of terrain viewed overhead, wooded foothills, not sky. Use just a few tiny creatures as scale cues, not crowds.
Important landmarks in village: herbal shop with drying herbs and medicine jars just southwest of plaza; blacksmith with a small outdoor forge southeast; a quiet jade travel stele near the plaza; peach-blossom tree beside the pavilion; tiny matched blue-white and dark-red banner accents around the shared courtyard, visual parity, not separate faction bases.
Composition must emphasize a functional MAP: at least half of the surface is open walkable ground, wide unobstructed paths, all exits clear, buildings not blocking intersections, sparse foreground objects. A viewer can follow the route from safe hub to starter grounds to harder outer zones. Town occupies around a quarter of the image, wilderness takes most of the image.
Art: polished detailed hand-painted 2D fantasy RPG game environment, rounded/chibi architecture proportionate to the character reference, disciplined warm top-left daylight, soft contact shadows, jade and moss greens, warm limestone and honey wood, restrained pink peach blossoms, muted earthy ground so characters will pop. Beautiful broad color masses and readable silhouettes, moderate microtexture, not photoreal, not 3D plastic, not pixel art, not European fantasy castles, no modern objects, no lava or apocalyptic dark zone in a beginner map.

## Gameplay-scale plaza

References: `map-art/village-v2/overview-concept.png` (environment consistency) and `artifacts/taoist-v2/taoist-v2-preview.png` (character style).

undefined
