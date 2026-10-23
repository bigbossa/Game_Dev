// Faint aura lights on the actual equipment by grade, independent of level and enhancement.
// Pose anchors and glow stamps are cached; animation never reads canvas pixels.
(function () {
  const EG = window.EquipmentGlints = {};
  const COLORS = [null, '#69c8ff', '#bc8aff', '#ffdc72', '#ff9c43', '#ff3346'];
  const anchors = new Map(), stamps = new Map();
  EG.color = (grade, faction = 'dharma') => grade >= 3 ? C.gradeLight(faction, grade) : COLORS[grade] || null;

  // Choose solid pixels near two garment inlays, not the empty centre of a mask.
  // Called once per slot/pose. Thin or occluded pieces may have just one light.
  EG.pick = function (w, h, contains, lower = false) {
    const pixels = [];
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!contains(x, y) || !contains(x - 1, y) || !contains(x + 1, y) ||
          !contains(x, y - 1) || !contains(x, y + 1)) continue;
      pixels.push([x, y]); x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (!pixels.length) return [];
    const result = [];
    for (const q of [.28, .72]) {
      const tx = x0 + (x1 - x0) * q, ty = y0 + (y1 - y0) * (lower ? .68 : .46);
      let best = null, score = Infinity;
      for (const p of pixels) {
        if (result.some(a => Math.hypot(a[0] - p[0], a[1] - p[1]) < 8)) continue;
        const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2;
        if (d < score) { score = d; best = p; }
      }
      if (best) result.push(best);
    }
    return result;
  };

  function armor(e, F, meta) {
    const key = ModelTiers.key(e.faction, F.atk, e.cls), col = C.DIR_COL[F.dir];
    const dual = window.DualbladeModel?.ready && DualbladeLook.is(e),stage=dual?DualbladeLook.stageOf(e.lvl):0;
    const archer=e.cls==='archer'&&window.ArcherModel?.ready,arcTier=archer?ModelTiers.tierOf(e.lvl||1):0;
    const spearTier=e.cls==='spearman'?ModelTiers.tierOf(e.lvl||1):0;
    const id = `${key}|${e.faction}|${F.frame}|${col}|${dual?DualbladeModel.styleOf(stage):archer?ArcherModel.styleOf(arcTier):e.cls==='spearman'?SpearmanLook.hairStage(spearTier):''}`;
    if (!anchors.has(id)) {
      const points = archer?ArcherModel.glintAnchors(key,F.frame,col,arcTier):dual ? DualbladeModel.glintAnchors(key,F.frame,col,stage,e.faction) : e.cls === 'spearman' ? SpearmanLook.glintAnchors(key,F.frame,col,spearTier) : e.cls === 'archer'
        ? ArcherGear.glintAnchors(key, F.frame, col)
        : ArmorLook.glintAnchors(key, F.frame, col);
      anchors.set(id, points.map(slot => slot.map(p => [p[0] - meta.anchorX, p[1] - meta.anchorY])));
    }
    return anchors.get(id);
  }

  // Public for visual regression checks; positions are relative to the feet.
  EG.points = function (e, F, meta) {
    if (e.dead) return [];
    const out = [], grades = [e.gg?.[0] ?? e.wg ?? 0, ...[0, 1, 2, 3].map(i => e.ar?.[i] ? e.gg?.[i + 1] || 0 : 0)];
    const top = Math.max(...grades);
    if (!grades.some(g => EG.color(g))) return out;
    const gear = armor(e, F, meta);
    for (let slot = 0; slot < 5; slot++) {
      const grade = grades[slot], color = EG.color(grade, e.faction);
      if (top >= 3 && grade < top) continue; // Lower grades cannot add a second aura colour or extra lights.
      if (!color) continue;
      const candidates = slot ? gear[slot - 1] : WeaponLook.points(F, e.wt || 0, e) || [];
      const count = Math.min(candidates.length, grade >= 3 ? 2 : 1);
      for (let n = 0; n < count; n++) {
        const p = candidates[Math.floor(n * candidates.length / count)];
        out.push({ x: p[0], y: p[1], slot, grade, color, phase: slot * 1.7 + n * 2.3 });
      }
    }
    return out;
  };

  // a soft aura: the grade colour fading out to nothing, no solid dot or sparkle cross (changed on request)
  function stamp(color) {
    if (stamps.has(color)) return stamps.get(color);
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = c.getContext('2d');
    const halo = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    halo.addColorStop(0, color + '66'); halo.addColorStop(.35, color + '33');
    halo.addColorStop(.7, color + '10'); halo.addColorStop(1, color + '00');
    g.fillStyle = halo; g.fillRect(0, 0, 64, 64);
    stamps.set(color, c); return c;
  }

  EG.draw = function (g, e, F, meta, x, y, scale, time = performance.now() / 1000) {
    const points = EG.points(e, F, meta);
    if (!points.length) return;
    g.save();
    // Added light: a faint glow over the piece rather than a painted mark.
    g.globalCompositeOperation = 'lighter';
    const alpha = g.globalAlpha;
    for (const p of points) {
      const pulse = .8 + .2 * Math.sin(time * 1.6 + p.phase);
      const radius = (10 + p.grade * 1.4) * scale;
      const px = x + p.x * scale, py = y + p.y * scale;
      g.globalAlpha = alpha * (.32 + p.grade * .05) * pulse;
      g.drawImage(stamp(p.color), px - radius, py - radius, radius * 2, radius * 2);
    }
    g.restore();
  };
})();
