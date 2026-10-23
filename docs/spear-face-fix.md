# Adharma spear face clarity, Lv.100–130

The original royal sprite faces were intact. The material classifier treated warm facial shading, eyebrows and parts of the eyes as crimson hair or armour. The increasingly bright Lv.100–130 hair palette made those incorrectly recoloured patches especially visible. Static eye ellipses inherited from earlier art did not follow the current topknot atlas.

`SpearmanGear` now finds the exposed facial skin component separately in each directional frame, protects its convex boundary with a small edge margin, and includes adjacent facial/ear components. This preserves the original eyes, eyebrows, lips, cheeks and antialiased edges before any hair, equipment or weapon masks are assigned. Dharma retains its existing classification.

The royal dark body also keeps its authored equipment silhouette. Scaling disconnected garment-mask islands sideways created cracks at fine seams, particularly with high equipment tiers; these frames now apply fitted materials in place. The existing original atlas resolution and high-quality frame resampling are retained. Clarity comes from preserving original detail rather than repainting or blurring the face. Mask preparation is cached and performs no pixel reads during warmed drawing.

Validation:

- `node tools/check-spear-face.cjs`: Lv.100/110/120/130, both walk and attack sheets, all eight directions: 224 frames, 72,336 sampled facial pixels unchanged, 1,453,212 body pixels checked with no holes, zero warmed pixel reads or browser exceptions.
- `node tools/check-spear-face.cjs --before`: reproduces the former classifier and garment stretching only in an isolated browser page. The old code changes 20,664 sampled facial pixels; the on-disk implementation is never reverted.
- `node tools/check-spearman-browser.cjs http://localhost:3901 9334`: equipment, weapon and class effect regressions pass.
- Review: `artifacts/spear-face-review.html`, with actual renderer captures before and after the fix.

No source images, packed assets, combat settings or player records are changed. Tests run on a separate server and browser profile.
