// Character looks by player level (Lv.15 / 30 / 50 / 60 / 80 / 100): recoloured hair (and eyes), hair crowns,
// the faction head (ธรรมะ long hair + floating halo, อธรรม wild spiky hair + demon-god horns, from Lv.1),
// ribbons, scarves and a halo, composed onto the walk / attack sheets frame by frame (no capes: removed on request).
// The same code powers the game (ModelTiers.compose) and the model studio page (studio.html).
(function () {
  const MT = {};
  window.ModelTiers = MT;
  const TAU = Math.PI * 2;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  MT.LEVELS = [0, 15, 30, 50, 60, 80, 100, 130];
  MT.NAMES = ['ศิษย์ฝึกหัด', 'นักดาบหนุ่ม', 'ยอดนักดาบ', 'ขุนดาบพยัคฆ์', 'จอมยุทธ์', 'ขุนพลมังกร', 'เทพยุทธ์', 'เทพเซียน · เทพมาร'];
  // Lv.130: the faction's own title
  // นักพรต: ธรรมะ grows into a healing deity (เทพรักษา), อธรรม into a destroyer demon (มารทำลาย)
  MT.TAO_NAMES = {
    dharma: ['ศิษย์นักพรต', 'นักพรตหยกขาว', 'นักพรตชีวา', 'ปรมาจารย์หยก', 'เซียนบัวหยก', 'เทพโอสถ', 'เซียนรักษา', 'เทพรักษา'],
    adharma: ['ศิษย์สำนักมาร', 'นักพรตยันต์โลหิต', 'นักพรตเงาผี', 'ปรมาจารย์มาร', 'มารเพลิงนรก', 'จอมมารผลาญ', 'มารล้างกัลป์', 'มารทำลาย'],
  };
  // นักธนู: ธรรมะ grows into a forest / celestial archer, อธรรม into a demon archer
  MT.ARC_NAMES = {
    dharma: ['นักธนูเอลฟ์', 'ผู้พิทักษ์พงไพร', 'เอลฟ์มงกุฎใบไม้', 'เจ้าหญิงวสันต์', 'เจ้าหญิงหยกจันทรา', 'ราชินีศรสุริยัน', 'ราชินีเอลฟ์ดารา', 'มหาราชินีเอลฟ์พฤกษา'],
    adharma: ['นักธนูดาร์คเอลฟ์', 'ผู้พิทักษ์ราตรี', 'เอลฟ์กุหลาบเงา', 'เจ้าหญิงสนธยา', 'เจ้าหญิงอเมทิสต์', 'ราชินีศรจันทรา', 'ราชินีดาร์คเอลฟ์ดารา', 'มหาราชินีดาร์คเอลฟ์รัตติกาล'],
  };
  MT.SPEAR_NAMES = {
    dharma: ['ศิษย์ทวนเมฆา', 'มือทวนหยกฟ้า', 'ยอดทวนเกล็ดเงิน', 'ขุนทวนมังกรขาว', 'จอมทวนดารา', 'เซียนทวนมังกรฟ้า', 'ราชันเทพทวน', 'มหาเทพทวนมังกรฟ้า'],
    adharma: ['ศิษย์ทวนรัตติกาล', 'มือทวนทับทิม', 'ยอดทวนเกล็ดนิล', 'ขุนทวนมังกรดำ', 'จอมทวนจันทราโลหิต', 'มารทวนมังกรเพลิง', 'ราชันมารทวน', 'มหาเทพทวนมังกรโลหิต'],
  };
  MT.nameOf = (tier, faction, cls) => (cls === 'warrior' ? ['ทหารโล่ฝึกหัด','นักรบโล่เหล็ก','ผู้พิทักษ์แนวหน้า','ขุนพลโล่ศิลา','จอมปราการ','ขุนพลโล่มังกร','ราชันผู้พิทักษ์',faction === 'adharma' ? 'มหาปราการมาร' : 'มหาปราการสวรรค์'][tier]
    : cls === 'spearman' ? MT.SPEAR_NAMES[faction === 'adharma' ? 'adharma' : 'dharma'][tier]
    : cls === 'taoist' || cls === 'archer' ? MT[cls === 'taoist' ? 'TAO_NAMES' : 'ARC_NAMES'][faction === 'adharma' ? 'adharma' : 'dharma'][tier]
    : tier === 7 ? (faction === 'adharma' ? 'เทพมาร' : 'เทพเซียน') : MT.NAMES[tier]);
  MT.tierOf = (lvl) => { let t = 0; MT.LEVELS.forEach((l, i) => { if (i && lvl >= l) t = i; }); return t; };
  // short description of what a level look adds
  MT.describe = (tier) => [
    'ลักษณะเริ่มต้น', 'ผมน้ำเงินเข้ม · ปิ่นเงิน · ริบบิ้น', 'ผมปลายฟ้า · ผ้าพันคอปลิว · ปิ่นเงิน',
    'ผมเงินคราม · ขนนกหงส์ทอง · ผ้าพันคอขลิบทอง', 'ผมสีเงิน · มงกุฎหยก · ปีกขนนก',
    'ผมทอง · มงกุฎมังกร · ดวงตาเรืองแสง · ปีกมหาปักษาขอบทอง', 'ผมขาวเรืองแสง · มงกุฎสวรรค์ · รัศมี · ปีกเทพสวรรค์สองคู่',
    'ธรรมะ (เทพเซียน): ผมขาวทองเรืองแสง · มงกุฎบัวเซียน · จานรัศมีหลังศีรษะ · ปีกเทพสามคู่ · บัวทองใต้เท้า | ' +
    'อธรรม (เทพมาร): ผมดำปลายเพลิง · มงกุฎเหล็กมาร · เขาใหญ่สองคู่ · เปลวมารรอบกาย · ปีกพังผืดมาร · ตรามารใต้เท้า',
  ][tier] || '';

  // sheet column -> view: S SE E NE N NW W SW
  const VIEW = ['front', 'front', 'side', 'back', 'back', 'back', 'side', 'front'];
  // which way the back of the character points on screen (cape / ribbons trail that way)
  const TRAIL = [0, -0.55, -1, -0.45, 0, 0.45, 1, 0.55];

  // ------------------------------------------------------------ colour helpers
  function hsl2rgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v) => Math.max(0, Math.min(1, v));

  // ------------------------------------------------------------ per-tier designs
  // hair(ln, f): ln = normalised original lightness (shading), f = 0 at the hair tie .. 1 at the tips
  const HAIR = {
    dharma: [
      null,
      (ln) => hsl2rgb(222, 0.5, 0.07 + ln * 0.42),                                         // blue-black
      (ln, f) => lerp3(hsl2rgb(224, 0.55, 0.07 + ln * 0.4), hsl2rgb(198, 0.9, 0.45 + ln * 0.35), f * f * 0.85), // sky tips
      (ln) => hsl2rgb(212, 0.32, 0.26 + ln * 0.45),                                        // steel blue
      (ln) => hsl2rgb(212, 0.2, 0.5 + ln * 0.45),                                          // silver
      (ln, f) => hsl2rgb(40 + f * 6, 0.88, 0.34 + ln * 0.5),                               // gold
      (ln, f) => lerp3(hsl2rgb(48, 0.45, 0.8 + ln * 0.18), hsl2rgb(195, 0.95, 0.6 + ln * 0.3), f * f),  // white -> sky tips
      (ln, f) => lerp3(hsl2rgb(46, 0.35, 0.86 + ln * 0.13), hsl2rgb(42, 1, 0.58 + ln * 0.3), Math.pow(f, 1.4)),  // radiant white -> gold
    ],
    adharma: [
      null,
      (ln) => hsl2rgb(352, 0.55, 0.07 + ln * 0.36),                                        // red-black
      (ln, f) => lerp3(hsl2rgb(350, 0.5, 0.08 + ln * 0.34), hsl2rgb(18, 0.95, 0.45 + ln * 0.3), f * f * 0.85),  // ember tips
      (ln) => hsl2rgb(4, 0.55, 0.14 + ln * 0.38),                                          // dark crimson-brown
      (ln) => hsl2rgb(352, 0.78, 0.17 + ln * 0.42),                                        // crimson
      (ln, f) => lerp3(hsl2rgb(0, 0, 0.05 + ln * 0.3), hsl2rgb(356, 0.9, 0.3 + ln * 0.4), f * f),         // black -> red tips
      (ln, f) => lerp3(hsl2rgb(0, 0, 0.78 + ln * 0.2), hsl2rgb(350, 0.95, 0.45 + ln * 0.3), f * f),       // silver -> crimson tips
      (ln, f) => lerp3(hsl2rgb(350, 0.25, 0.03 + ln * 0.16), hsl2rgb(356, 1, 0.3 + ln * 0.32), Math.min(1, Math.pow(f, 3) * 1.4)), // black -> blood-fire tips
    ],
  };
  const EYES = { dharma: [null, null, null, null, null, [255, 205, 70], [120, 230, 255], [255, 236, 150]], adharma: [null, null, null, null, null, [255, 60, 60], [255, 200, 60], [255, 30, 30]] };
  const DESIGN = {
    dharma: [
      null,
      { crown: 'guan', metal: 'silver', ribbon: ['#4aa8ff', '#1d5fa8'], ribbonLen: 0.36 },
      { crown: 'guan', metal: 'silver', ribbon: ['#9fd8ff', '#3a8dff'], ribbonLen: 0.38, scarf: { cloth: ['#f4f8ff', '#a9c4e8'], edge: '#3a8dff', tail: 0.42 } },
      { crown: 'phoenix', metal: 'gold', gem: '#46c2ff', ribbon: ['#e8f4ff', '#3a8dff'], ribbonLen: 0.4, plume: ['#ffffff', '#6cc4ff'],
        scarf: { cloth: ['#2a5ad0', '#0e2466'], edge: '#ffd76a', tail: 0.5 } },
      { crown: 'jade', metal: 'gold', gem: '#2bd68f', ribbon: ['#e8f4ff', '#6cc4ff'], ribbonLen: 0.42 },
      { crown: 'dragon', metal: 'gold', gem: '#ff4a3a', ribbon: ['#ffd76a', '#b07a1a'], ribbonLen: 0.46 },
      { crown: 'celestial', metal: 'gold', gem: '#4aa8ff', ribbon: ['#ffffff', '#9fd8ff'], ribbonLen: 0.5, halo: '#bfe6ff', hairGlow: '#9fe0ff' },
      // Lv.130 เทพเซียน: lotus crown, gold-white hair (+ live sun disc, three pairs of wings); no scarf (removed on request)
      { crown: 'lotus', metal: 'gold', gem: '#ffffff', ribbon: ['#fffaf0', '#ffd76a'], ribbonLen: 0.58, halo: '#ffe9a0', hairGlow: '#ffe28a' },
    ],
    adharma: [
      null,
      { crown: 'guan', metal: 'silver', ribbon: ['#ff4d5a', '#7a0d12'], ribbonLen: 0.36 },
      { crown: 'guan', metal: 'silver', ribbon: ['#ff8a5a', '#c3262c'], ribbonLen: 0.38, scarf: { cloth: ['#2e262b', '#120c10'], edge: '#ff3446', tail: 0.42 } },
      { crown: 'phoenix', metal: 'gold', gem: '#ff2a4a', ribbon: ['#ffb040', '#7a0d12'], ribbonLen: 0.4, plume: ['#ffd0a0', '#ff3446'],
        scarf: { cloth: ['#c3262c', '#4a0610'], edge: '#ffb040', tail: 0.5 } },
      { crown: 'jade', metal: 'gold', gem: '#ff2a5a', ribbon: ['#2a2226', '#c3262c'], ribbonLen: 0.42 },
      { crown: 'dragon', metal: 'gold', gem: '#ff2a2a', ribbon: ['#ffb040', '#7a0d12'], ribbonLen: 0.46 },
      { crown: 'celestial', metal: 'gold', gem: '#ff2a5a', ribbon: ['#ff4a6a', '#3a0008'], ribbonLen: 0.5, hairGlow: '#ff4a5a' },
      // Lv.130 เทพมาร: iron demon crown, hellfire hair (+ live demon flames, two pairs of horns, membrane wings); no scarf
      { crown: 'demon', metal: 'iron', gem: '#ff1a2a', ribbon: ['#1a0a0e', '#ff2a3a'], ribbonLen: 0.58, hairGlow: '#b0101c' },
    ],
  };
  MT.design = (faction, tier) => DESIGN[faction === 'adharma' ? 'adharma' : 'dharma'][tier];

  // ---------------- นักพรต: เทพรักษา (jade, white, gold, lotus) / มารทำลาย (abyss black, blood, ember, lava)
  // same level steps as the twin blades; the drawn hair keeps its shape (and the อธรรม red streaks), only its colour
  // follows the level, and the head-pieces are the healer's / destroyer's own
  const TAO_HAIR = {
    dharma: [
      null,
      (ln) => hsl2rgb(168, 0.32, 0.07 + ln * 0.38),                                                       // jade-black
      (ln, f) => lerp3(hsl2rgb(168, 0.38, 0.08 + ln * 0.36), hsl2rgb(150, 0.72, 0.48 + ln * 0.3), f * f * 0.85),  // jade tips
      (ln) => hsl2rgb(160, 0.16, 0.3 + ln * 0.45),                                                        // ash jade-silver
      (ln, f) => lerp3(hsl2rgb(150, 0.1, 0.62 + ln * 0.34), hsl2rgb(155, 0.7, 0.56 + ln * 0.3), f * f),       // silver -> mint tips
      (ln, f) => lerp3(hsl2rgb(52, 0.22, 0.78 + ln * 0.2), hsl2rgb(44, 0.9, 0.55 + ln * 0.3), f * f),          // pearl -> gold tips
      (ln, f) => lerp3(hsl2rgb(150, 0.28, 0.84 + ln * 0.15), hsl2rgb(158, 0.9, 0.6 + ln * 0.3), f * f),       // glowing white -> jade
      (ln, f) => lerp3(hsl2rgb(48, 0.38, 0.86 + ln * 0.13), hsl2rgb(150, 0.85, 0.62 + ln * 0.3), Math.pow(f, 1.4)),   // radiant white-gold -> jade
    ],
    adharma: [
      null,
      (ln) => hsl2rgb(352, 0.45, 0.05 + ln * 0.33),                                                       // blood-black
      (ln, f) => lerp3(hsl2rgb(350, 0.4, 0.06 + ln * 0.3), hsl2rgb(356, 0.9, 0.36 + ln * 0.3), f * f * 0.7),     // blood tips
      (ln) => hsl2rgb(0, 0.22, 0.12 + ln * 0.34),                                                         // ash-black
      (ln, f) => lerp3(hsl2rgb(300, 0.25, 0.05 + ln * 0.28), hsl2rgb(340, 0.9, 0.4 + ln * 0.3), f * f),       // void -> violet-blood tips
      (ln, f) => lerp3(hsl2rgb(0, 0.05, 0.33 + ln * 0.4), hsl2rgb(356, 0.95, 0.38 + ln * 0.3), f * f),        // ash grey -> blood tips
      (ln, f) => lerp3(hsl2rgb(350, 0.3, 0.04 + ln * 0.2), hsl2rgb(2, 1, 0.42 + ln * 0.3), Math.min(1, f * f * 0.9)),   // black -> crimson-fire tips
      (ln, f) => lerp3(hsl2rgb(350, 0.3, 0.03 + ln * 0.15), hsl2rgb(356, 1, 0.32 + ln * 0.32), Math.min(1, Math.pow(f, 3) * 1.4)),  // abyss -> blood-fire
    ],
  };
  const TAO_EYES = { dharma: [null, null, null, null, null, [90, 240, 170], [150, 255, 210], [255, 236, 150]], adharma: [null, null, null, null, null, [255, 70, 40], [255, 140, 40], [255, 30, 30]] };
  const TAO_DESIGN = {
    dharma: [
      null,
      { crown: 'guan', metal: 'silver', ribbon: ['#7cffc4'] },
      { crown: 'guan', metal: 'silver', ribbon: ['#2bd68f'] },
      { crown: 'phoenix', metal: 'gold', gem: '#2bd68f', plume: ['#ffffff', '#7cffc4'] },
      { crown: 'jade', metal: 'gold', gem: '#2bd68f' },
      { crown: 'lotus', metal: 'gold', gem: '#9fffd0' },
      { crown: 'celestial', metal: 'gold', gem: '#5affb0', halo: '#c8ffe4', hairGlow: '#8affc8' },
      { crown: 'lotus', metal: 'gold', gem: '#ffffff', halo: '#fff3c0', hairGlow: '#c8ffd8' },
    ],
    adharma: [
      null,
      { crown: 'guan', metal: 'iron', ribbon: ['#ff2a3a'] },
      { crown: 'guan', metal: 'iron', ribbon: ['#ff7a2a'] },
      { crown: 'phoenix', metal: 'iron', gem: '#ff2a2a', plume: ['#ff8a5a', '#3a0008'] },
      { crown: 'demon', metal: 'iron', gem: '#c01a8a' },
      { crown: 'dragon', metal: 'iron', gem: '#ff3a1a' },
      { crown: 'demon', metal: 'iron', gem: '#ff5a1a', hairGlow: '#ff3a1a' },
      { crown: 'demon', metal: 'iron', gem: '#ff1a2a', hairGlow: '#c0101c' },
    ],
  };

  // ------------------------------------------------------------ frame analysis
  // per pose: frame anchors + indices of hair and iris pixels (sheet-wide), computed once
  const info = {};
  MT.analyse = function (key, img, meta) {
    const fw = meta.frameWidth, fh = meta.frameHeight, W = img.width, H = img.height;
    const c = mk(W, H), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const hair = [], hairF = [], eyes = [], frames = [];
    for (let r = 0; r < (meta.framesPerDir || 3); r++) for (let col = 0; col < 8; col++) {   // นักพรต walk: + standing row
      const X = col * fw, Y = r * fh;
      // body box from opaque pixels that are not baked slash streaks
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      const cls = new Uint8Array(fw * fh);       // 1 = hair candidate, 2 = skin, 3 = iris candidate
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const i = ((Y + y) * W + X + x) * 4;
        if (d[i + 3] < 60) continue;
        const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
        const streak = h > 185 && h < 255 && s > 0.82 && l > 0.35;
        if (streak) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        // hair is a near-neutral dark brown (warm or slightly magenta hue, low saturation)
        if (l < 0.46 && s < 0.5 && (s < 0.12 || h >= 300 || h <= 50 || (meta.paintedTaoist && h >= 190 && h <= 255))) cls[y * fw + x] = 1;
        else if (h >= 8 && h <= 45 && s > 0.3 && l >= 0.55 && l <= 0.93) cls[y * fw + x] = 2;
        else if (h > 190 && h < 250 && s > 0.25 && l > 0.2 && l < 0.7) cls[y * fw + x] = 3;
      }
      if (x1 < 0) { frames.push(null); continue; }
      // A raised whisk is above the head. It must not move the hair recolouring,
      // crown or collar up to the weapon's tip during the casting pose.
      if (meta.poseFrames?.[r*8+col]) {
        y0 = Math.round(meta.poseFrames[r*8+col].headTop);
      } else if (key === 'attack') {
        // Twin-blade sweeps rise above the head. Use anatomical head tops so the
        // crown / hair flood-fill cannot attach to a sword or miss the back of the head.
        const headTop = [[14,16,21,19,15,26,30,18],[28,27,25,27,24,36,28,43],[43,46,53,40,51,51,48,31]];
        y0 = headTop[r][col];
      } else if (key.startsWith('tao-attack-') && r === 1 && window.TaoistGear) {
        const a = TaoistGear.attachment(key, { row:r, col, cx:(x0+x1)/2, y0, BH:y1-y0 });
        y0 = Math.max(y0, Math.round(a[1]-68));
      }
      const BH = y1 - y0;
      // head: hair + skin in the top half
      let sx = 0, n = 0, tieX = 0, tieY = 0, tn = 0;
      const authored = meta.paintedTaoist ? meta.poseFrames?.[r*8+col] : null;
      const headLim = authored ? authored.shoulder[1] : y0 + BH * 0.5;
      for (let y = y0; y < headLim; y++) for (let x = x0; x <= x1; x++) {
        const k = cls[y * fw + x];
        if (k === 1 || k === 2) { sx += x; n++; }
        // hair tie: the gold band at the top of the head (the eyes are further down)
        if (y < y0 + BH * 0.16) {
          const i = ((Y + y) * W + X + x) * 4;
          const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
          if (d[i + 3] > 60 && h > 30 && h < 55 && s > 0.5 && l > 0.4) { tieX += x; tieY += y; tn++; }
        }
      }
      const cx = authored ? authored.shoulder[0] : n ? sx / n : (x0 + x1) / 2;
      const tie = authored ? [cx,y0+(headLim-y0)*.11] : key === 'attack' ? [cx, y0 + BH * .08] : tn > 3 ? [tieX / tn, tieY / tn] : [cx, y0 + BH * 0.07];
      // skin box (face) for the irises
      let fx0 = 1e9, fx1 = -1, fy0 = 1e9, fy1 = -1;
      for (let y = y0; y < headLim; y++) for (let x = x0; x <= x1; x++) if (cls[y * fw + x] === 2) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      // hair = dark pixels connected to the top of the head (flood fill), so raised arms are left alone
      const hairLim = authored ? headLim-4 : y0 + BH * (VIEW[col] === 'back' ? 0.52 : 0.48), halfW = BH * 0.34;
      const isHair = new Uint8Array(fw * fh), queue = [];
      for (let y = y0; y < y0 + BH * 0.14; y++) for (let x = x0; x <= x1; x++) if (cls[y * fw + x] === 1) { isHair[y * fw + x] = 1; queue.push(y * fw + x); }
      while (queue.length) {
        const k = queue.pop(), x = k % fw, y = (k / fw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * fw + nx;
          if (nx < x0 || nx > x1 || ny < y0 || ny >= hairLim || isHair[nk] || cls[nk] !== 1 || Math.abs(nx - cx) > halfW) continue;
          isHair[nk] = 1; queue.push(nk);
        }
      }
      for (let y = y0; y < hairLim; y++) for (let x = x0; x <= x1; x++) {
        const k = cls[y * fw + x], gi = (Y + y) * W + X + x;
        if (isHair[y * fw + x]) {
          hair.push(gi);
          hairF.push(clamp(Math.hypot(x - tie[0], y - tie[1]) / (BH * 0.42)));
        } else if (k === 3 && fx1 > 0 && x > fx0 && x < fx1 && y > fy0 && y < Math.min(fy1, y0 + BH * 0.42)) eyes.push(gi);
      }
      frames.push({
        col, row: r, X, Y, x0, y0, x1, y1, BH, cx, tie,
        neck: [cx, y0 + BH * 0.47], headC: [cx, y0 + BH * 0.24],
        view: VIEW[col], trail: TRAIL[col],
      });
    }
    info[key] = { frames, hair: Int32Array.from(hair), hairF: Float32Array.from(hairF), eyes: Int32Array.from(eyes), W, H, fw, fh, paintedTaoist: !!meta.paintedTaoist };
    return info[key];
  };
  MT.ready = (key) => !!info[key];
  MT.info = (key) => info[key];
  // analysis key of a faction's pose: the อธรรม walk has its own drawing (แผ่นออกแบบตัวละครฝ่ายอธรรม.png) when
  // 'walk-adharma' was analysed; the attack poses share one layout
  // (the นักพรต has its own drawing per faction and pose: 'tao-walk-dharma', 'tao-attack-adharma', ...)
  // (นักธนู: 'arc-walk-dharma', ...)
  const OWN_KEY = { taoist: 'tao', archer: 'arc', spearman: 'spear', warrior: 'war', arbiter: 'arb' };
  MT.key = (faction, atk, cls) => (OWN_KEY[cls] ? `${OWN_KEY[cls]}-${atk ? 'attack' : 'walk'}-${faction === 'adharma' ? 'adharma' : 'dharma'}`
    : atk ? 'attack' : faction === 'adharma' && info['walk-adharma'] ? 'walk-adharma' : 'walk');

  // ------------------------------------------------------------ drawing helpers (frame coordinates)
  const vgrad = (g, a, b, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const METAL = { silver: ['#5a6676', '#ffffff', '#b8c4d4'], gold: ['#7a4c0c', '#fff0a8', '#d39a2a'], iron: ['#08050a', '#8a7a82', '#2a2026'] };
  const metal = (g, m, x0, y0, x1, y1) => {
    const M = METAL[m], gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, M[0]); gr.addColorStop(0.45, M[1]); gr.addColorStop(0.62, M[2]); gr.addColorStop(1, M[0]);
    return gr;
  };
  const OUT = 'rgba(12,8,16,0.85)';
  function gem(g, x, y, r, col) {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, col); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.save(); g.shadowColor = col; g.shadowBlur = r * 2.5; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = OUT; g.lineWidth = Math.max(0.6, r * 0.25); g.stroke();
  }

  // swaying factor for the 3 walk frames (row 0 / 1 / 2)
  const sway = (F) => (F.row - 1);

  function drawCape(g, F, D, faction) {
    const C = D.cape, B = F.BH;
    const [nx, ny] = F.neck;
    const sw = B * 0.14, yb = F.y0 + B * C.len, bw = sw * C.flare;
    const tx = F.trail * B * 0.2 + sway(F) * B * 0.03 * (F.view === 'side' ? 1.6 : 1);
    const p = new Path2D();
    p.moveTo(nx - sw, ny);
    p.quadraticCurveTo(nx, ny - B * 0.03, nx + sw, ny);
    p.quadraticCurveTo(nx + sw * 1.4 + tx * 0.4, ny + (yb - ny) * 0.5, nx + tx + bw, yb);
    // hem: scallops, or two tails for a forked cape
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = nx + tx + bw - 2 * bw * t;
      const lift = C.fork ? (Math.abs(t - 0.5) < 0.13 ? -B * 0.12 : 0) : 0;
      p.quadraticCurveTo(x + bw / n, yb + B * 0.03 + lift * 0.4, x, yb + lift);
    }
    p.quadraticCurveTo(nx - sw * 1.4 + tx * 0.4, ny + (yb - ny) * 0.5, nx - sw, ny);
    p.closePath();
    const back = F.view === 'back';
    const cols = back ? C.outer : C.inner;
    if (C.glow) { g.save(); g.shadowColor = C.glow; g.shadowBlur = B * 0.08; g.fillStyle = cols[1]; g.fill(p); g.restore(); }
    g.fillStyle = vgrad(g, cols[0], cols[1], ny, yb); g.fill(p);
    g.save(); g.clip(p);
    // folds
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = B * 0.012;
    for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(nx + k * sw, ny + B * 0.04); g.quadraticCurveTo(nx + k * bw * 0.8 + tx * 0.5, ny + (yb - ny) * 0.55, nx + tx + k * bw * 1.05, yb); g.stroke(); }
    if (C.stars) {
      g.fillStyle = back ? 'rgba(255,240,180,0.9)' : 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 14; i++) {
        const u = ((i * 37) % 100) / 100, v = ((i * 61) % 100) / 100;
        const x = nx + tx * v + (u - 0.5) * 2 * (sw + (bw - sw) * v), y = ny + (yb - ny) * (0.12 + v * 0.8);
        const r = B * (0.006 + (i % 3) * 0.003);
        g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.5, y); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.5, y); g.closePath(); g.fill();
      }
    }
    g.restore();
    // trim
    g.strokeStyle = C.trim; g.lineWidth = B * 0.018; g.lineJoin = 'round'; g.stroke(p);
    g.strokeStyle = OUT; g.lineWidth = B * 0.006; g.stroke(p);
    // emblem on the back
    if (back && C.emblem) {
      const ex = nx + tx * 0.25, ey = ny + (yb - ny) * 0.3, er = B * 0.07;
      g.save(); g.translate(ex, ey);
      if (C.glow) { g.shadowColor = C.glow; g.shadowBlur = er; }
      g.fillStyle = metal(g, 'gold', -er, -er, er, er); g.beginPath(); g.arc(0, 0, er, 0, TAU); g.fill();
      g.shadowBlur = 0; g.strokeStyle = OUT; g.lineWidth = er * 0.1; g.stroke();
      if (C.emblem === 'dragon') {
        g.strokeStyle = C.inner[1]; g.lineWidth = er * 0.22; g.lineCap = 'round';
        g.beginPath(); g.arc(0, 0, er * 0.55, 0.4, Math.PI * 1.75); g.stroke();
        g.fillStyle = C.inner[1]; g.beginPath(); g.arc(er * 0.5, -er * 0.25, er * 0.17, 0, TAU); g.fill();
      } else {
        g.fillStyle = C.inner[0];
        g.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = i % 2 ? er * 0.35 : er * 0.78; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, er * 0.2, 0, TAU); g.fill();
      }
      g.restore();
    }
  }

  function drawRibbons(g, F, D) {
    const B = F.BH, [hx, hy] = F.tie, L = B * D.ribbonLen * (F.view === 'back' ? 0.55 : 1), w = B * 0.026;
    const side = F.view === 'side' ? [F.trail] : F.view === 'back' ? [-0.12, 0.12] : [-0.6, 0.6];
    side.forEach((s, k) => {
      const sw = sway(F) * B * 0.03 * (k ? -1 : 1);
      const p0 = [hx, hy], p1 = [hx + s * B * 0.22 + sw, hy + L * 0.45], p2 = [hx + s * B * 0.3 + sw * 2, hy + L];
      const strip = new Path2D();
      strip.moveTo(p0[0] - w * 0.5, p0[1]);
      strip.quadraticCurveTo(p1[0] - w, p1[1], p2[0] - w * 0.4, p2[1]);
      strip.lineTo(p2[0] + w * 0.9, p2[1] + w * 1.4);            // swallow-tail end
      strip.lineTo(p2[0] + w * 0.4, p2[1] - w * 0.2);
      strip.quadraticCurveTo(p1[0] + w, p1[1], p0[0] + w * 0.5, p0[1]);
      strip.closePath();
      g.fillStyle = vgrad(g, D.ribbon[0], D.ribbon[1], hy, hy + L); g.fill(strip);
      g.strokeStyle = OUT; g.lineWidth = B * 0.005; g.stroke(strip);
    });
  }

  // scarf wrapped round the neck; tails flow behind the character
  function scarfNeck(F) { return [F.cx, F.y0 + F.BH * 0.495]; }
  function drawScarfTails(g, F, D) {
    const S = D.scarf, B = F.BH, [nx, ny] = scarfNeck(F), w = B * 0.066, L = B * S.tail * 0.7;
    const dirs = F.view === 'side' ? [F.trail * 0.95, F.trail * 0.75] : F.view === 'back' ? [-0.12, 0.2] : [0.75, 0.55];
    dirs.forEach((dx, k) => {
      const sw = sway(F) * B * 0.04 * (k ? -1 : 1);
      const x0 = nx + (F.view === 'side' ? F.trail * B * 0.05 : dx * B * 0.06), y0 = ny + (k ? B * 0.025 : 0);
      const lift = F.view === 'side' ? 0.55 : 1;           // blown back by the wind when walking sideways
      const x2 = x0 + dx * B * 0.36 + sw * 2, y2 = y0 + L * (k ? 0.82 : 1) * lift;
      const xm = x0 + (x2 - x0) * 0.5 + sw, ym = y0 + (y2 - y0) * 0.5 + (F.view === 'side' ? B * 0.04 : 0);
      // widths are offset perpendicular to the tail, so sideways tails keep their width
      const len = Math.hypot(x2 - x0, y2 - y0) || 1, nx2 = -(y2 - y0) / len, ny2 = (x2 - x0) / len;
      const off = (x, y, k2) => [x + nx2 * w * k2, y + ny2 * w * k2];
      const flut = Math.sin(F.row * 2.1 + k) * B * 0.02;
      const p = new Path2D();
      p.moveTo(...off(x0, y0, -0.5));
      p.bezierCurveTo(...off(xm - (x2 - x0) * 0.2, ym - (y2 - y0) * 0.2 + flut, -0.9), ...off(xm + (x2 - x0) * 0.2, ym + (y2 - y0) * 0.2 - flut, -0.6), ...off(x2, y2, -0.35));
      p.lineTo(...off(x2 + (x2 - x0) / len * w * 0.9, y2 + (y2 - y0) / len * w * 0.9, 0.1));   // swallow-tail
      p.lineTo(...off(x2, y2, 0.45));
      p.bezierCurveTo(...off(xm + (x2 - x0) * 0.2, ym + (y2 - y0) * 0.2 - flut, 0.6), ...off(xm - (x2 - x0) * 0.2, ym - (y2 - y0) * 0.2 + flut, 0.9), ...off(x0, y0, 0.5));
      p.closePath();
      g.fillStyle = vgrad(g, S.cloth[0], S.cloth[1], y0, y2); g.fill(p);
      g.strokeStyle = S.edge; g.lineWidth = B * 0.01; g.stroke(p);
      g.strokeStyle = OUT; g.lineWidth = B * 0.004; g.stroke(p);
    });
  }
  function drawScarfWrap(g, F, D) {
    const S = D.scarf, B = F.BH, [nx, ny] = scarfNeck(F);
    const rx = B * (F.view === 'side' ? 0.06 : 0.085), ry = B * 0.025, t = B * 0.042;
    const p = new Path2D();
    p.ellipse(nx, ny - ry * 0.4, rx + t / 2, ry + t / 2, 0, 0.05, Math.PI - 0.05);
    p.ellipse(nx, ny - ry * 0.4, rx - t / 2, Math.max(1, ry - t / 2), 0, Math.PI - 0.05, 0.05, true);
    p.closePath();
    g.fillStyle = vgrad(g, S.cloth[0], S.cloth[1], ny - t, ny + ry + t); g.fill(p);
    g.save(); g.clip(p);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = B * 0.006;
    for (const k of [-0.6, -0.2, 0.2, 0.6]) { g.beginPath(); g.moveTo(nx + k * rx - B * 0.012, ny - t); g.lineTo(nx + k * rx + B * 0.012, ny + ry + t); g.stroke(); }
    g.restore();
    g.strokeStyle = S.edge; g.lineWidth = B * 0.009; g.stroke(p);
    g.strokeStyle = OUT; g.lineWidth = B * 0.004; g.stroke(p);
  }

  function drawCrown(g, F, D) {
    const B = F.BH, [x, y] = F.tie, s = B * 0.05;
    g.save(); g.translate(x, y); g.lineJoin = 'round';
    const m = D.metal;
    if (D.crown === 'guan') {
      // silver hair guan with a pin
      g.fillStyle = metal(g, m, -s, -s, s, s); g.beginPath(); g.ellipse(0, -s * 0.2, s * 0.85, s * 0.6, 0, Math.PI, 0); g.lineTo(s * 0.85, s * 0.25); g.lineTo(-s * 0.85, s * 0.25); g.closePath(); g.fill();
      g.strokeStyle = OUT; g.lineWidth = s * 0.12; g.stroke();
      g.strokeStyle = metal(g, m, -s * 1.6, 0, s * 1.6, 0); g.lineWidth = s * 0.22; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 1.5, -s * 0.15); g.lineTo(s * 1.5, -s * 0.15); g.stroke();
      gem(g, s * 1.55, -s * 0.15, s * 0.22, D.ribbon[0]);
    } else if (D.crown === 'jade') {
      const p = new Path2D();
      p.moveTo(-s, s * 0.3); p.lineTo(-s * 1.05, -s * 0.5); p.lineTo(-s * 0.45, -s * 0.15); p.lineTo(0, -s * 1.05); p.lineTo(s * 0.45, -s * 0.15); p.lineTo(s * 1.05, -s * 0.5); p.lineTo(s, s * 0.3); p.closePath();
      g.fillStyle = metal(g, m, -s, -s, s, s); g.fill(p); g.strokeStyle = OUT; g.lineWidth = s * 0.1; g.stroke(p);
      for (const k of [-1, 1]) {      // small wings
        const w = new Path2D(); w.moveTo(k * s * 0.9, -s * 0.2); w.quadraticCurveTo(k * s * 2.4, s * 0.1, k * s * 2.3, -s * 1.3); w.quadraticCurveTo(k * s * 1.5, -s * 1.0, k * s * 0.9, s * 0.35); w.closePath();
        g.fillStyle = metal(g, m, 0, -s, 0, s); g.fill(w); g.strokeStyle = OUT; g.lineWidth = s * 0.08; g.stroke(w);
      }
      gem(g, 0, -s * 0.05, s * 0.36, D.gem);
    } else if (D.crown === 'phoenix') {
      // gold band with a fan of phoenix plumes
      for (const [a, len] of [[-0.55, 2.4], [0.55, 2.4], [-0.25, 3.0], [0.25, 3.0], [0, 3.4]]) {
        g.save(); g.rotate(a);
        const p = new Path2D();
        p.moveTo(0, -s * 0.2); p.quadraticCurveTo(s * 0.55, -s * len * 0.5, 0, -s * len); p.quadraticCurveTo(-s * 0.55, -s * len * 0.5, 0, -s * 0.2);
        g.fillStyle = vgrad(g, D.plume[0], D.plume[1], -s * len, 0); g.fill(p);
        g.strokeStyle = OUT; g.lineWidth = s * 0.07; g.stroke(p);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = s * 0.05;
        g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(0, -s * len * 0.92); g.stroke();
        g.restore();
      }
      const p = new Path2D(); p.moveTo(-s * 1.0, s * 0.4); p.quadraticCurveTo(0, -s * 0.8, s * 1.0, s * 0.4); p.closePath();
      g.fillStyle = metal(g, m, -s, -s, s, s * 0.4); g.fill(p); g.strokeStyle = OUT; g.lineWidth = s * 0.09; g.stroke(p);
      gem(g, 0, 0, s * 0.32, D.gem);
    } else if (D.crown === 'dragon') {
      for (const k of [-1, 1]) {      // swept horns
        const h = new Path2D(); h.moveTo(k * s * 0.6, -s * 0.3); h.bezierCurveTo(k * s * 2.0, -s * 0.2, k * s * 2.6, -s * 1.1, k * s * 2.6, -s * 2.5);
        h.bezierCurveTo(k * s * 2.0, -s * 1.8, k * s * 1.3, -s * 1.1, k * s * 0.8, s * 0.35); h.closePath();
        g.fillStyle = metal(g, m, 0, -s * 2.4, 0, s * 0.3); g.fill(h); g.strokeStyle = OUT; g.lineWidth = s * 0.09; g.stroke(h);
      }
      const p = new Path2D();
      p.moveTo(-s * 1.1, s * 0.4); p.lineTo(-s * 1.2, -s * 0.7); p.lineTo(-s * 0.55, -s * 0.25); p.lineTo(0, -s * 1.4); p.lineTo(s * 0.55, -s * 0.25); p.lineTo(s * 1.2, -s * 0.7); p.lineTo(s * 1.1, s * 0.4); p.closePath();
      g.fillStyle = metal(g, m, -s, -s * 1.4, s, s * 0.4); g.fill(p); g.strokeStyle = OUT; g.lineWidth = s * 0.1; g.stroke(p);
      gem(g, 0, -s * 0.1, s * 0.38, D.gem);
    } else if (D.crown === 'lotus') {
      // เทพเซียน: a lotus of white-gold petals in two rows, a pearl in the heart, light beads above
      g.save(); g.shadowColor = D.halo; g.shadowBlur = s * 1.6;
      const petal = (a, len, w, c0, c1) => {
        g.save(); g.rotate(a);
        const p = new Path2D(); p.moveTo(0, s * 0.2); p.bezierCurveTo(w, -len * 0.3, w * 0.6, -len * 0.8, 0, -len); p.bezierCurveTo(-w * 0.6, -len * 0.8, -w, -len * 0.3, 0, s * 0.2);
        g.fillStyle = vgrad(g, c0, c1, -len, s * 0.2); g.fill(p); g.strokeStyle = 'rgba(122,76,12,0.9)'; g.lineWidth = s * 0.07; g.stroke(p);
        g.restore();
      };
      for (const a of [-1.15, -0.6, 0.6, 1.15]) petal(a, s * 2.1, s * 0.75, '#ffffff', '#f0c45a');
      for (const a of [-0.32, 0.32]) petal(a, s * 2.6, s * 0.7, '#ffffff', '#ffd76a');
      petal(0, s * 3.0, s * 0.72, '#ffffff', '#ffe9a0');
      g.restore();
      const band = new Path2D(); band.moveTo(-s * 1.25, s * 0.45); band.quadraticCurveTo(0, -s * 0.35, s * 1.25, s * 0.45); band.quadraticCurveTo(0, s * 0.05, -s * 1.25, s * 0.45);
      g.fillStyle = metal(g, m, -s, -s * 0.4, s, s * 0.45); g.fill(band); g.strokeStyle = OUT; g.lineWidth = s * 0.08; g.stroke(band);
      gem(g, 0, -s * 0.15, s * 0.42, '#fffbe8');
      g.fillStyle = '#fffbe0';
      for (const [a, b] of [[0, -3.35], [-0.95, -2.75], [0.95, -2.75]]) { g.beginPath(); g.arc(s * a, s * b, s * 0.16, 0, TAU); g.fill(); }
    } else if (D.crown === 'demon') {
      // เทพมาร: black-iron crown of jagged spikes with glowing red seams and a blood gem
      const pts = [[-1.4, 0.45], [-1.7, -1.5], [-1.0, -0.4], [-0.7, -2.2], [-0.3, -0.5], [0, -2.9], [0.3, -0.5], [0.7, -2.2], [1.0, -0.4], [1.7, -1.5], [1.4, 0.45]];
      const p = new Path2D(); p.moveTo(s * pts[0][0], s * pts[0][1]);
      for (const [a, b] of pts.slice(1)) p.lineTo(s * a, s * b);
      p.quadraticCurveTo(0, s * 0.1, -s * 1.4, s * 0.45); p.closePath();
      g.save(); g.shadowColor = '#ff1a2a'; g.shadowBlur = s * 1.4;
      g.fillStyle = metal(g, m, -s, -s * 2.9, s, s * 0.45); g.fill(p); g.restore();
      g.strokeStyle = '#ff3a2a'; g.lineWidth = s * 0.07;                        // glowing seams up each spike
      for (const [a, b] of [[-1.7, -1.5], [-0.7, -2.2], [0, -2.9], [0.7, -2.2], [1.7, -1.5]]) {
        g.beginPath(); g.moveTo(s * a * 0.55, s * 0.1); g.lineTo(s * a * 0.92, s * b * 0.8); g.stroke();
      }
      g.strokeStyle = OUT; g.lineWidth = s * 0.1; g.stroke(p);
      gem(g, 0, -s * 0.2, s * 0.46, D.gem);
    } else {
      // celestial crown: tall rays, wing flares and a large gem
      g.save(); g.shadowColor = D.halo; g.shadowBlur = s * 1.2;
      const p = new Path2D();
      const pts = [[-1.3, 0.45], [-1.45, -1.1], [-0.85, -0.35], [-0.5, -1.8], [0, -0.55], [0, -2.5], [0, -0.55], [0.5, -1.8], [0.85, -0.35], [1.45, -1.1], [1.3, 0.45]];
      p.moveTo(-s * 1.3, s * 0.45);
      for (const [a, b] of pts) p.lineTo(s * a, s * b);
      p.closePath();
      g.fillStyle = metal(g, m, -s, -s * 2.5, s, s * 0.5); g.fill(p);
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = s * 0.09; g.stroke(p);
      for (const k of [-1, 1]) {
        const w = new Path2D(); w.moveTo(k * s * 1.3, 0); w.quadraticCurveTo(k * s * 2.4, -s * 0.3, k * s * 2.9, -s * 1.6);
        w.lineTo(k * s * 2.4, -s * 1.2); w.lineTo(k * s * 2.5, -s * 1.9); w.lineTo(k * s * 1.9, -s * 0.9); w.quadraticCurveTo(k * s * 1.6, -s * 0.2, k * s * 1.2, s * 0.35); w.closePath();
        g.fillStyle = metal(g, m, 0, -s * 2, 0, s * 0.4); g.fill(w); g.strokeStyle = OUT; g.lineWidth = s * 0.08; g.stroke(w);
      }
      for (const [a, b] of [[-0.5, -1.8], [0, -2.5], [0.5, -1.8]]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * a, s * b, s * 0.13, 0, TAU); g.fill(); }
      gem(g, 0, -s * 0.2, s * 0.48, D.gem);
    }
    g.restore();
  }

  function drawHalo(g, F, D) {
    const B = F.BH, [x, y] = F.headC, r = B * 0.28;
    g.save();
    g.translate(x, y - B * 0.02);
    g.globalAlpha = 0.9;
    g.shadowColor = D.halo; g.shadowBlur = B * 0.06;
    g.strokeStyle = D.halo; g.lineWidth = B * 0.012;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.lineWidth = B * 0.005; g.beginPath(); g.arc(0, 0, r * 0.88, 0, TAU); g.stroke();
    g.globalAlpha = 0.55;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r0 = r * 1.04, r1 = r * (i % 2 ? 1.14 : 1.24);
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------ faction head: ธรรมะ halo, อธรรม horns
  // (from Lv.1; both grow with the level tier; the drawn hair itself is left as it is). Both are drawn live
  // (MT.drawHalo / MT.drawHorns) so they never get cut by the frame.
  // อธรรม: demon-god horns from the temples; longer, curlier, ridged and glowing with the tier.
  // which: 'far' (side views, behind the head) | 'near' (everything else)
  function drawHorns(g, F, tier, which) {
    const B = F.BH, [cx] = F.headC, y = F.y0 + B * 0.085, side = F.view === 'side';
    const len = B * (0.075 + Math.min(tier, 6) * 0.025 + (tier >= 7 ? 0.035 : 0)), bw = B * (0.02 + tier * 0.004), curl = Math.min(1, tier / 6);
    const k0 = F.trail >= 0 ? 1 : -1;
    const roots = side ? (which === 'far' ? [[cx - F.trail * B * 0.03, y - B * 0.01, k0, 0.85]] : [[cx - F.trail * B * 0.005, y + B * 0.01, k0, 1]])
      : which === 'far' ? [] : [[cx - B * 0.12, y, -1, 1], [cx + B * 0.12, y, 1, 1]];
    // centre line: out from the temple, up, the tip curling back in (more curl at higher tiers)
    const P = [[0, 0], [len * 0.55, -len * 0.08], [len * (0.8 - curl * 0.1), -len * 0.7], [len * (0.42 - curl * 0.22), -len * (1.0 - curl * 0.05)]];
    const at = (u) => { const v = 1 - u; return [0, 1].map((i) => v * v * v * P[0][i] + 3 * v * v * u * P[1][i] + 3 * v * u * u * P[2][i] + u * u * u * P[3][i]); };
    const N = 18, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, [x, yy] = at(u), [x2, y2] = at(Math.min(1, u + 0.01)), [x1, y1] = at(Math.max(0, u - 0.01));
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, w = bw * Math.pow(1 - u, 0.75) + 0.3;
      left.push([x - (dy / L) * w, yy + (dx / L) * w]); right.push([x + (dy / L) * w, yy - (dx / L) * w]); mid.push([x, yy, dx / L, dy / L, w]);
    }
    // Lv.130 เทพมาร: a second, smaller pair swept back behind the main horns (drawn first)
    const all = tier >= 7 ? [...roots.map(([rx, ry, k, a]) => [rx + k * B * 0.035, ry - B * 0.02, k, a * 0.95, 0.62, 0.55]), ...roots.map((r) => [...r, 1, 0])] : roots.map((r) => [...r, 1, 0]);
    for (const [rx, ry, k, alpha, sc, rot] of all) {
      g.save(); g.translate(rx, ry); g.scale(k, 1); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = alpha;
      const p = new Path2D();
      left.forEach(([x, yy], i) => (i ? p.lineTo(x, yy) : p.moveTo(x, yy)));
      for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
      p.closePath();
      const tip = at(1);
      const gr = g.createLinearGradient(0, 0, tip[0], tip[1]);
      gr.addColorStop(0, '#1a0e12'); gr.addColorStop(0.55, tier >= 3 ? '#3a1218' : '#3e302c'); gr.addColorStop(1, tier >= 7 ? '#ffb03a' : tier >= 2 ? '#d8303a' : '#9a8a80');
      if (tier >= 5) { g.save(); g.shadowColor = '#ff2a3a'; g.shadowBlur = B * (tier >= 7 ? 0.07 : 0.035); g.fillStyle = gr; g.fill(p); g.restore(); }
      g.fillStyle = gr; g.fill(p);
      if (tier >= 2) {                                   // growth rings across the horn
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = Math.max(0.6, B * 0.003);
        for (let i = 3; i < N - 3; i += 3) { const [x, yy, ux, uy, w] = mid[i]; g.beginPath(); g.moveTo(x - uy * w, yy + ux * w); g.lineTo(x + uy * w, yy - ux * w); g.stroke(); }
      }
      if (tier >= 5) {                                   // glowing cracks
        g.strokeStyle = '#ff5a4a'; g.lineWidth = Math.max(0.6, B * 0.004);
        g.beginPath(); mid.slice(2, 12).forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); g.stroke();
      }
      g.strokeStyle = 'rgba(255,220,200,0.35)'; g.lineWidth = Math.max(0.6, B * 0.004);   // highlight along the inner edge
      g.beginPath(); right.slice(1, N - 2).forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = Math.max(0.8, B * 0.006); g.stroke(p);
      g.restore();
    }
  }

  // อธรรม horns drawn live at the character (pass 'back' = the far horn behind the head on side views)
  MT.drawHorns = function (g, e, F, x, y, s, meta, pass) {
    if (e.cls === 'spearman') return;
    if (window.DualbladeLook && DualbladeLook.is(e)) return;
    if (e.cls === 'archer') return;
    if (e.dead || e.faction !== 'adharma') return;
    const I = info[MT.key(e.faction, F.atk, e.cls)];
    const fr = I && I.frames[F.frame * 8 + C.DIR_COL[F.dir]];
    if (!fr) return;
    if (pass === 'back' && fr.view !== 'side') return;
    g.save(); g.translate(x - meta.anchorX * s, y - meta.anchorY * s); g.scale(s, s);
    drawHorns(g, fr, MT.tierOf(e.lvl || 1), pass === 'back' ? 'far' : 'near');
    g.restore();
  };

  // ธรรมะ halo ring floating above the head, drawn live (gentle bob + glow, nothing spins).
  // F = { atk, dir, frame }, s = sprite scale, meta = sheet meta (anchor)
  const HALO = [
    { rx: 0.075, w: 0.009, col: '#f6e6a8', glow: 0 },
    { rx: 0.08, w: 0.01, col: '#ffe9a0', glow: 0.03 },
    { rx: 0.085, w: 0.011, col: '#fff0b0', glow: 0.04 },
    { rx: 0.09, w: 0.012, col: '#fff3c0', glow: 0.05, inner: true },
    { rx: 0.095, w: 0.013, col: '#fff6cc', glow: 0.06, inner: true },
    { rx: 0.1, w: 0.014, col: '#fffbe0', glow: 0.07, inner: true, beads: true },
    { rx: 0.108, w: 0.016, col: '#ffffff', glow: 0.09, inner: true, beads: true, sky: true },
    { rx: 0.118, w: 0.018, col: '#fffbe6', glow: 0.12, inner: true, beads: true, gold: true },   // Lv.130 (+ the sun disc behind)
  ];
  MT.drawHalo = function (g, e, F, x, y, t, s, meta) {
    if (e.cls === 'spearman') return;
    if (window.DualbladeLook && DualbladeLook.is(e)) return;
    if (e.cls === 'archer') return window.ArcherRoyal && ArcherRoyal.drawHead(g,e,F,x,y,t,s,meta);
    if (e.dead || e.faction === 'adharma') return;
    const I = info[MT.key(e.faction, F.atk, e.cls)];
    const fr = I && I.frames[F.frame * 8 + C.DIR_COL[F.dir]];
    if (!fr) return;
    const H = HALO[MT.tierOf(e.lvl || 1)], B = fr.BH * s;
    const hx = x + (fr.headC[0] - meta.anchorX) * s, hy = y + (fr.y0 - meta.anchorY) * s - B * 0.035 + Math.sin(t * 2 + (e.x || 0) * 0.01) * B * 0.008;
    const rx = B * H.rx, ry = rx * 0.32, jade = e.cls === 'taoist';          // นักพรต เทพรักษา: a jade halo
    g.save();
    if (H.glow) { g.shadowColor = jade ? (H.gold ? '#ffe9a0' : '#5affb0') : H.sky ? '#9fe0ff' : H.gold ? '#ffd24a' : '#ffe08a'; g.shadowBlur = B * H.glow * (0.85 + 0.15 * Math.sin(t * 3)); }
    g.strokeStyle = jade && !H.gold ? '#d6ffec' : H.col; g.lineWidth = Math.max(1, B * H.w);
    g.beginPath(); g.ellipse(hx, hy, rx, ry, 0, 0, TAU); g.stroke();
    if (H.inner) { g.lineWidth = Math.max(0.6, B * H.w * 0.45); g.globalAlpha = 0.75; g.beginPath(); g.ellipse(hx, hy, rx * 0.8, ry * 0.8, 0, 0, TAU); g.stroke(); }
    if (H.beads) {
      g.globalAlpha = 1; g.fillStyle = jade ? '#bfffe0' : H.sky ? '#bfe9ff' : '#fff3c0';
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; g.beginPath(); g.arc(hx + Math.cos(a) * rx, hy + Math.sin(a) * ry, Math.max(0.8, B * 0.008), 0, TAU); g.fill(); }
    }
    g.restore();
  };

  // Lv.130 aura, drawn live behind the character (pass 'back'); gentle pulse / flicker, nothing orbits.
  //   เทพเซียน: a golden sun disc with rays behind the head and a faint mandorla round the body
  //   เทพมาร:   dark hellfire flames rising behind the body and a broken crimson demon ring behind the head
  MT.drawAura = function (g, e, F, x, y, t, s, meta) {
    if (e.cls === 'spearman') return SpearmanLook.drawAura(g,e,F,x,y,t,s,meta);
    if (window.DualbladeLook && DualbladeLook.is(e)) return DualbladeLook.drawAura(g,e,F,x,y,t,s,meta);
    if (e.cls === 'archer') return window.ArcherRoyal && ArcherRoyal.drawAura(g,e,F,x,y,t,s,meta);
    if (e.dead || MT.tierOf(e.lvl || 1) < 7) return;
    const I = info[MT.key(e.faction, F.atk, e.cls)];
    const fr = I && I.frames[F.frame * 8 + C.DIR_COL[F.dir]];
    if (!fr) return;
    const B = fr.BH * s, seed = (e.x || 0) * 0.01;
    const hx = x + (fr.headC[0] - meta.anchorX) * s, hy = y + (fr.headC[1] - meta.anchorY) * s;
    const bx = x + (fr.cx - meta.anchorX) * s, by = y + (fr.y0 + fr.BH * 0.62 - meta.anchorY) * s;
    if (e.cls === 'taoist') return taoAura(g, e, B, hx, hy, bx, by, t, seed);
    g.save();
    if (e.faction !== 'adharma') {
      g.globalCompositeOperation = 'lighter';
      const pulse = 0.85 + 0.15 * Math.sin(t * 2 + seed);
      // mandorla round the body
      g.globalAlpha = 0.28 * pulse; g.strokeStyle = '#ffe08a'; g.lineWidth = Math.max(1, B * 0.012);
      g.beginPath(); g.ellipse(bx, by - B * 0.12, B * 0.4, B * 0.6, 0, 0, TAU); g.stroke();
      const mg = g.createRadialGradient(bx, by - B * 0.12, B * 0.1, bx, by - B * 0.12, B * 0.6);
      mg.addColorStop(0, 'rgba(255,240,190,0.18)'); mg.addColorStop(1, 'rgba(255,220,140,0)');
      g.globalAlpha = pulse; g.fillStyle = mg; g.beginPath(); g.ellipse(bx, by - B * 0.12, B * 0.4, B * 0.6, 0, 0, TAU); g.fill();
      // sun disc + rays behind the head
      const R = B * 0.3;
      g.globalAlpha = 0.55 * pulse; g.fillStyle = '#ffe9a0';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU, L = R * (i % 2 ? 1.18 : 1.42), w = 0.045;
        g.beginPath(); g.moveTo(hx + Math.cos(a - w) * R * 0.6, hy + Math.sin(a - w) * R * 0.6);
        g.lineTo(hx + Math.cos(a) * L, hy + Math.sin(a) * L); g.lineTo(hx + Math.cos(a + w) * R * 0.6, hy + Math.sin(a + w) * R * 0.6); g.fill();
      }
      const sg = g.createRadialGradient(hx, hy, 0, hx, hy, R);
      sg.addColorStop(0, 'rgba(255,255,240,0.95)'); sg.addColorStop(0.55, 'rgba(255,226,140,0.55)'); sg.addColorStop(1, 'rgba(255,200,90,0)');
      g.globalAlpha = 0.8 * pulse; g.fillStyle = sg; g.beginPath(); g.arc(hx, hy, R, 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.strokeStyle = '#fff3c0'; g.lineWidth = Math.max(0.8, B * 0.008);
      g.beginPath(); g.arc(hx, hy, R * 0.82, 0, TAU); g.stroke();
    } else {
      // hellfire tongues behind the shoulders and body (each flickers on its own)
      const N = 9;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1) - 0.5, fx = bx + u * B * 0.48;
        const h = B * (0.34 + 0.18 * (1 - Math.abs(u) * 1.6)) * (0.8 + 0.25 * Math.sin(t * (5 + i * 0.7) + i * 1.7 + seed));
        const base = by + B * 0.08, w = B * 0.07, sway = Math.sin(t * 3.1 + i) * B * 0.04;
        const fl = new Path2D();
        fl.moveTo(fx - w, base);
        fl.quadraticCurveTo(fx - w * 1.1 + sway * 0.5, base - h * 0.55, fx + sway, base - h);
        fl.quadraticCurveTo(fx + w * 1.1 + sway * 0.5, base - h * 0.55, fx + w, base);
        fl.closePath();
        const fg = g.createLinearGradient(0, base, 0, base - h);
        fg.addColorStop(0, 'rgba(255,60,20,0.75)'); fg.addColorStop(0.45, 'rgba(200,10,30,0.5)'); fg.addColorStop(1, 'rgba(60,0,10,0)');
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55; g.fillStyle = fg; g.fill(fl);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.22; g.fillStyle = '#0a0204'; g.fill(fl);   // black smoke core
      }
      // broken demon ring behind the head: six arcs with spikes
      const R = B * 0.27, flick = 0.8 + 0.2 * Math.sin(t * 6 + seed);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.9;
      g.shadowColor = '#ff1a2a'; g.shadowBlur = B * 0.06 * flick;
      g.strokeStyle = '#7a0a14'; g.lineWidth = Math.max(1.2, B * 0.02); g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * TAU + 0.12, a1 = a0 + TAU / 6 - 0.32;
        g.beginPath(); g.arc(hx, hy, R, a0, a1); g.stroke();
        const a = (a0 + a1) / 2;
        g.fillStyle = '#2a0408';
        g.beginPath(); g.moveTo(hx + Math.cos(a - 0.12) * R, hy + Math.sin(a - 0.12) * R);
        g.lineTo(hx + Math.cos(a) * R * 1.32, hy + Math.sin(a) * R * 1.32); g.lineTo(hx + Math.cos(a + 0.12) * R, hy + Math.sin(a + 0.12) * R); g.fill();
      }
      g.shadowBlur = 0; g.strokeStyle = '#ff4a3a'; g.lineWidth = Math.max(0.6, B * 0.006); g.globalAlpha = 0.85 * flick;
      for (let i = 0; i < 6; i++) { const a0 = (i / 6) * TAU + 0.12; g.beginPath(); g.arc(hx, hy, R, a0, a0 + TAU / 6 - 0.32); g.stroke(); }
    }
    g.restore();
  };

  // นักพรต Lv.130:
  //   เทพรักษา: a jade-gold lotus mandorla behind the body, twelve lotus petals turning slowly round it, healing
  //             motes rising, and a jade sun disc with petal rays behind the head
  //   มารทำลาย: a dark vortex turning behind the body, crimson lightning crackling round it, embers swirling up,
  //             and a cracked black sun with a blood corona behind the head
  function taoAura(g, e, B, hx, hy, bx, by, t, seed) {
    g.save();
    const cy = by - B * 0.12;
    if (e.faction !== 'adharma') {
      g.globalCompositeOperation = 'lighter';
      const pulse = 0.85 + 0.15 * Math.sin(t * 2 + seed);
      const mg = g.createRadialGradient(bx, cy, B * 0.05, bx, cy, B * 0.62);
      mg.addColorStop(0, 'rgba(220,255,236,0.22)'); mg.addColorStop(0.6, 'rgba(120,255,190,0.1)'); mg.addColorStop(1, 'rgba(90,255,170,0)');
      g.globalAlpha = pulse; g.fillStyle = mg; g.beginPath(); g.ellipse(bx, cy, B * 0.42, B * 0.62, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.35 * pulse; g.strokeStyle = '#9fffd0'; g.lineWidth = Math.max(1, B * 0.012);
      g.beginPath(); g.ellipse(bx, cy, B * 0.42, B * 0.62, 0, 0, TAU); g.stroke();
      // lotus petals turning round the body
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.35, px = bx + Math.cos(a) * B * 0.46, py = cy + Math.sin(a) * B * 0.66;
        g.save(); g.translate(px, py); g.rotate(a + Math.PI / 2);
        g.globalAlpha = 0.42 * pulse; g.fillStyle = i % 2 ? '#d8fff0' : '#ffe9a0';
        g.beginPath(); g.ellipse(0, 0, B * 0.022, B * 0.055, 0, 0, TAU); g.fill(); g.restore();
      }
      // healing motes rising
      for (let i = 0; i < 10; i++) {
        const q = (t * 0.32 + i / 10 + seed) % 1, ox = Math.sin(i * 2.4 + t) * B * 0.32;
        g.globalAlpha = Math.sin(q * Math.PI) * 0.75; g.fillStyle = i % 3 ? '#9fffd0' : '#ffffff';
        const r = Math.max(1, B * 0.012), mx = bx + ox, my = by + B * 0.3 - q * B * 0.95;
        g.fillRect(mx - r * 0.35, my - r * 1.4, r * 0.7, r * 2.8); g.fillRect(mx - r * 1.4, my - r * 0.35, r * 2.8, r * 0.7);   // tiny cross of light
      }
      // jade sun disc with petal rays behind the head
      const R = B * 0.29;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * 0.1;
        g.save(); g.translate(hx + Math.cos(a) * R * 0.95, hy + Math.sin(a) * R * 0.95); g.rotate(a + Math.PI / 2);
        g.globalAlpha = 0.45 * pulse; g.fillStyle = i % 2 ? '#bfffe0' : '#fff3c0';
        g.beginPath(); g.ellipse(0, 0, R * 0.12, R * (i % 2 ? 0.3 : 0.42), 0, 0, TAU); g.fill(); g.restore();
      }
      const sg = g.createRadialGradient(hx, hy, 0, hx, hy, R);
      sg.addColorStop(0, 'rgba(255,255,245,0.9)'); sg.addColorStop(0.55, 'rgba(170,255,210,0.5)'); sg.addColorStop(1, 'rgba(90,255,170,0)');
      g.globalAlpha = 0.75 * pulse; g.fillStyle = sg; g.beginPath(); g.arc(hx, hy, R, 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.strokeStyle = '#e8fff4'; g.lineWidth = Math.max(0.8, B * 0.008);
      g.beginPath(); g.arc(hx, hy, R * 0.8, 0, TAU); g.stroke();
    } else {
      // dark vortex: spiral arms of black smoke and blood light turning behind the body
      const flick = 0.8 + 0.2 * Math.sin(t * 7 + seed);
      for (let arm = 0; arm < 5; arm++) {
        const p = new Path2D();
        for (let k = 0; k <= 24; k++) {
          const q = k / 24, a = arm * (TAU / 5) - t * 1.4 + q * 3.2, r = B * (0.08 + q * 0.5);
          const px = bx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 1.25;
          k ? p.lineTo(px, py) : p.moveTo(px, py);
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.28; g.strokeStyle = '#0a0204'; g.lineWidth = B * 0.05; g.stroke(p);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 * flick; g.strokeStyle = arm % 2 ? '#ff2a1a' : '#a0081c'; g.lineWidth = Math.max(1, B * 0.012); g.stroke(p);
      }
      // crimson lightning round the body
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        if (Math.sin(t * 9 + i * 2.1 + seed) < 0.2) continue;
        const a0 = t * 2 + i * 2.1, pts = [];
        for (let k = 0; k <= 6; k++) {
          const a = a0 + k * 0.35, r = B * (0.42 + Math.sin(k * 3.7 + t * 20) * 0.05);
          pts.push([bx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.3]);
        }
        for (const [col, w] of [['#ff2a3a', B * 0.02], ['#ffd0c0', B * 0.006]]) {
          g.globalAlpha = 0.7; g.strokeStyle = col; g.lineWidth = Math.max(0.8, w);
          g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        }
      }
      // embers swirling up
      for (let i = 0; i < 12; i++) {
        const q = (t * 0.45 + i / 12 + seed) % 1, a = i * 1.7 + t * 1.2;
        g.globalAlpha = Math.sin(q * Math.PI) * 0.85; g.fillStyle = i % 3 ? '#ff5a1a' : '#ffd08a';
        g.beginPath(); g.arc(bx + Math.cos(a) * B * 0.3 * (1 - q * 0.4), by + B * 0.25 - q * B * 0.9, Math.max(0.8, B * 0.01), 0, TAU); g.fill();
      }
      // cracked black sun with a blood corona behind the head
      const R = B * 0.26;
      const cg = g.createRadialGradient(hx, hy, R * 0.6, hx, hy, R * 1.45);
      cg.addColorStop(0, 'rgba(255,40,30,0.55)'); cg.addColorStop(1, 'rgba(120,0,10,0)');
      g.globalAlpha = flick; g.fillStyle = cg; g.beginPath(); g.arc(hx, hy, R * 1.45, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.85; g.fillStyle = '#0a0204';
      g.beginPath(); g.arc(hx, hy, R * 0.9, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8 * flick; g.strokeStyle = '#ff4a2a'; g.lineWidth = Math.max(0.6, B * 0.006);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.4; g.beginPath(); g.moveTo(hx + Math.cos(a) * R * 0.25, hy + Math.sin(a) * R * 0.25);
        g.lineTo(hx + Math.cos(a + 0.2) * R * 0.6, hy + Math.sin(a + 0.2) * R * 0.6); g.lineTo(hx + Math.cos(a - 0.1) * R * 0.9, hy + Math.sin(a - 0.1) * R * 0.9); g.stroke();
      }
      g.beginPath(); g.arc(hx, hy, R * 0.9, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------ compose
  // src: the sheet to decorate (any of: original / bare / armour-recoloured); key: MT.key(faction, atk).
  // The drawn hair stays as it is; the level look adds hair colours, crowns, ribbons ...
  // own = the class has its own drawn hair (นักพรต design sheets): keep hair, eyes and outfit as drawn and only
  // add the level's head-piece (crown) and halo; ribbons / scarves / hair colours belong to the twin-blade look
  // o.noScarf: the outfit brings its own collar / pauldrons / sash (shirt or shoulder armour worn), so the level
  // look's scarf would only pile up on top of them
  MT.compose = function (src, faction, key, tier, own, o = {}) {
    if (key.startsWith('spear-')) return SpearmanLook.compose(src,faction,key,tier);
    if (key.startsWith('arc-') && window.ArcherRoyal) return ArcherRoyal.compose(src,faction,key,tier);
    const I = info[key];
    if (!I) return src;
    faction = faction === 'adharma' ? 'adharma' : 'dharma';
    const D = own ? TAO_DESIGN[faction][tier] : MT.design(faction, tier);
    if (!D) return src;
    const W = I.W, H = I.H;
    const body = mk(W, H), bg = body.getContext('2d');
    bg.drawImage(src, 0, 0);
    let hairOnly = null;
    if (D) {
      // hair (+ irises) recoloured
      const id = bg.getImageData(0, 0, W, H), d = id.data;
      const hairFn = (own ? TAO_HAIR : HAIR)[faction][tier];
      hairOnly = D.hairGlow ? new ImageData(W, H) : null;
      for (let n = 0; n < I.hair.length; n++) {
        const i = I.hair[n] * 4;
        if (!d[i + 3]) continue;
        const l = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 510;
        let [r, g, b] = hairFn(clamp((l - 0.04) / 0.46), I.hairF[n]);
        // the darkest pixels are the line art: keep them dark so the hair stays crisp
        if (l < 0.13) { const k = 0.25 + (l / 0.13) * 0.35; r = d[i] + (r * 0.45 - d[i]) * k; g = d[i + 1] + (g * 0.45 - d[i + 1]) * k; b = d[i + 2] + (b * 0.45 - d[i + 2]) * k; }
        // Keep the painted strand shading visible beneath the level tint.
        if(I.paintedTaoist){const mix=.42;r=d[i]+(r-d[i])*mix;g=d[i+1]+(g-d[i+1])*mix;b=d[i+2]+(b-d[i+2])*mix;}
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
        if (hairOnly) { hairOnly.data[i] = r; hairOnly.data[i + 1] = g; hairOnly.data[i + 2] = b; hairOnly.data[i + 3] = 255; }
      }
      const eye = (own ? TAO_EYES : EYES)[faction][tier];
      if (eye) for (const k of I.eyes) {
        const i = k * 4;
        const l = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 510;
        d[i] = eye[0] * (0.5 + l); d[i + 1] = eye[1] * (0.5 + l); d[i + 2] = eye[2] * (0.5 + l);
      }
      bg.putImageData(id, 0, 0);
    }

    const out = mk(W, H), g = out.getContext('2d');
    const frames = I.frames.filter(Boolean);
    const clipCell = (F, fn) => { g.save(); g.beginPath(); g.rect(F.X, F.Y, I.fw, I.fh); g.clip(); g.translate(F.X, F.Y); fn(F); g.restore(); };
    // behind the body: back halo, ribbons (front / side views)
    for (const F of frames) clipCell(F, () => {
      if (D.halo) drawHalo(g, F, D);
      if (!own && F.view !== 'back') { drawRibbons(g, F, D); if (D.scarf && !o.noScarf) drawScarfTails(g, F, D); }
    });
    // hair glow
    if (hairOnly) {
      const hc = mk(W, H); hc.getContext('2d').putImageData(hairOnly, 0, 0);
      g.save(); g.shadowColor = D.hairGlow; g.shadowBlur = I.paintedTaoist ? 4 : 8; g.globalAlpha = I.paintedTaoist ? .28 : .9;
      g.drawImage(hc, 0, 0); g.drawImage(hc, 0, 0);
      g.restore();
    }
    g.drawImage(body, 0, 0);
    // in front of the body: ribbons (back views), scarves, crowns
    for (const F of frames) clipCell(F, () => {
      if (!own) {
        if (F.view === 'back') { drawRibbons(g, F, D); if (D.scarf && !o.noScarf) drawScarfTails(g, F, D); }
        if (D.scarf && !o.noScarf) drawScarfWrap(g, F, D);
      }
      drawCrown(g, F, D);
    });
    return out;
  };
})();
