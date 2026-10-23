// Armour appearance on the character sheets.
//   SET (the item level) decides the outfit — the higher the set, the more it looks like an immortal from a novel:
//         shirt     cloth colour + the set's pattern on the robe (+ chest medallion from tier 5), belt ornament,
//                   sash tails behind the legs (4+), front apron (5+) (นักพรต: + celestial ribbon 披帛 behind the body (7))
//         trousers  cloth colour + the set's pattern, greaves on the shins (the drawn boots tinted in the set's
//                   material: linen -> leather -> steel -> silk -> jade -> gold -> white gold, with a trim band)
//         bracers   cloth colour + a bracer pattern per set (wraps, lacing, steel bands, jade / gold plates)
//         shoulders pauldrons: cloth cap -> fur-trimmed leather -> steel lames -> silk cloud -> jade cloud
//                   -> gold dragon -> celestial lotus
//   GRADE (Normal .. Mythic) decides the light: Normal none, then a crisp outline of light around the whole
//         character (highest grade worn, weapon included) in the faction's colour, thicker and deeper with the
//         grade (C.GRADE_LIGHT) — drawn behind the sprite by main.js drawSprite
// Masks come from tools/armor-masks.js; the level look (ModelTiers) is composed in between. Item icons: ItemArt.
(function () {
  const AL = { cache: new Map() };
  window.ArmorLook = AL;
  let IMG = null;
  const masks = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const N_SLOTS = C.ARMOR_SLOTS.length;
  // accent materials in the faction tones: ธรรมะ white-blue (blue jade, slate leather), อธรรม black-red (red jade)
  const TONE = {
    dharma: { jade: '#4aa8e8', jadeHi: '#dff2ff', jadeLo: '#174f8c', leather: '#4e6684', leatherHi: '#9ab2cc', accent: '#3a7ad8', gem: '#8ad8ff', tassel: '#3a7ad8' },
    adharma: { jade: '#c02a3a', jadeHi: '#ffb4b4', jadeLo: '#4a0810', leather: '#3e1a1e', leatherHi: '#8a4448', accent: '#c3262c', gem: '#ff4a5a', tassel: '#c3262c' },
  };
  const tone = (f) => TONE[f === 'adharma' ? 'adharma' : 'dharma'];
  // class being dressed (set by AL.sheet while it builds a sheet): the นักพรต wears Taoist cloth pieces — talisman,
  // cloud, bagua, jade and lotus motifs — instead of the twin blades' steel scales, plates and dragon horns
  let CLS = null;
  const tao = () => CLS === 'taoist';
  // a trigram (three solid / broken bars) centred on (x, y)
  function trigram(g, x, y, w, gap, bits) {
    for (let k = 0; k < 3; k++) {
      const yy = y + (k - 1) * gap;
      g.beginPath();
      if ((bits >> k) & 1) { g.moveTo(x - w, yy); g.lineTo(x + w, yy); } else { g.moveTo(x - w, yy); g.lineTo(x - w * 0.2, yy); g.moveTo(x + w * 0.2, yy); g.lineTo(x + w, yy); }
      g.stroke();
    }
  }
  // a small yin-yang
  function taiji(g, x, y, r, light, dark) {
    g.fillStyle = light; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2); g.arc(x, y + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(x, y - r / 2, r / 2, Math.PI / 2, -Math.PI / 2); g.fill();
    g.fillStyle = light; g.beginPath(); g.arc(x, y + r / 2, r / 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(x, y - r / 2, r / 6, 0, Math.PI * 2); g.fill();
  }
  // a paper talisman (yellow, or purple-black for อธรรม) with a red rune
  function talismanPaper(g, x, y, w, h, faction) {
    g.fillStyle = faction === 'adharma' ? '#4a2058' : '#f2d36a'; g.fillRect(x - w / 2, y, w, h);
    g.strokeStyle = faction === 'adharma' ? '#ff4a5a' : '#c3262c'; g.lineWidth = Math.max(0.6, w * 0.16);
    g.beginPath(); g.moveTo(x, y + h * 0.12); g.lineTo(x, y + h * 0.88); g.moveTo(x - w * 0.3, y + h * 0.35); g.lineTo(x + w * 0.3, y + h * 0.45); g.stroke();
  }

  const readMask = (im) => {
    const c = mk(im.width, im.height), g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    return g.getImageData(0, 0, im.width, im.height).data;
  };
  AL.init = function (images) {
    IMG = images;
    // twin blades + นักพรต (tools/build-taoist.js writes armor-tao-<pose>-<faction>.png)
    for (const k of ['walk', 'attack', 'walk-adharma', 'tao-walk-dharma', 'tao-walk-adharma', 'tao-attack-dharma', 'tao-attack-adharma']) {
      const a = IMG['armor-' + k], b = IMG['armor2-' + k];
      if (!a) continue;
      masks[k] = { a: readMask(a), b: b ? readMask(b) : null };
      if (k.startsWith('tao-') && window.TaoistGear)
        TaoistGear.excludeWeapons(k, masks[k].a, a.width, a.height);
    }
  };

  function hexHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l, hex };
  }
  function hue2(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hsl(h, s, l, out) {
    if (!s) { out[0] = out[1] = out[2] = l * 255; return out; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    out[0] = hue2(p, q, h + 1 / 3) * 255; out[1] = hue2(p, q, h) * 255; out[2] = hue2(p, q, h - 1 / 3) * 255;
    return out;
  }

  // per-slot look for the worn tiers: [{ col, tier } | null] per armour slot
  AL.looks = function (faction, ar) {
    return C.ARMOR_SLOTS.map((_, j) => {
      const t = ar && ar[j];
      return t ? { col: hexHsl(C.ARMOR_SETS[t - 1].look[faction].color), tier: t === 10 ? 5 : t } : null;
    });
  };

  // masks / frame analysis of a faction's pose (the อธรรม walk is its own drawing)
  const poseKey = (faction, atk, cls) => (window.ModelTiers && ModelTiers.key ? ModelTiers.key(faction, atk, cls) : atk ? 'attack' : 'walk');
  // the class's own drawing of a pose
  const sheetOf = (cls) => C.CLASSES[cls] && C.CLASSES[cls].sheet;     // นักพรต / นักธนู: their own drawings
  const baseOf = (faction, atk, cls) => IMG[sheetOf(cls) ? `${sheetOf(cls)}-${faction}${atk ? '-attack' : ''}` : atk ? `${faction}-attack` : faction];
  // recoloured sheet; ar = tiers per armour slot
  function build(faction, atk, ar, cls) {
    const base = baseOf(faction, atk, cls);
    const M = masks[poseKey(faction, atk, cls)];
    if (!base || !M) return { sheet: base };
    const w = base.width, h = base.height, c = mk(w, h), g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    const looks = AL.looks(faction, ar);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const rgb = [0, 0, 0], ma = M.a;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3] || !ma[i + 3]) continue;
      for (let j = 0; j < N_SLOTS; j++) {
        const L = looks[j];
        if (!L) continue;
        const v = j < 3 ? ma[i + j] : 0;            // shoulder armour is not drawn on the body
        if (!v) continue;
        let wgt = v / 255;
        const col = L.col;
        if (j === 0 && wgt < 0.5) wgt += (1 - wgt) * Math.min(0.5, L.tier * 0.07);   // white robe takes more colour on better shirts
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const l = (Math.max(r, gg, b) + Math.min(r, gg, b)) / 510;
        // keep the original shading, pull it toward the cloth colour's brightness
        const nl = Math.min(0.95, l * 0.72 + col.l * 0.3 + (l > 0.6 ? 0.05 : 0));
        hsl(col.h, Math.min(1, col.s * 1.05), nl, rgb);
        d[i] = r + (rgb[0] - r) * wgt; d[i + 1] = gg + (rgb[1] - gg) * wgt; d[i + 2] = b + (rgb[2] - b) * wgt;
      }
    }
    g.putImageData(id, 0, 0);
    return { sheet: c };
  }
  // ------------------------------------------------------------ armour pieces drawn on the body
  const TAU = Math.PI * 2;
  const OUT = 'rgba(12,8,16,0.85)';
  const regions = {};
  function regionsFor(key) {
    if (regions[key]) return regions[key];
    const M = masks[key], I = window.ModelTiers && ModelTiers.info(key);
    if (!M || !I) return null;
    const W = I.W, H = I.H;
    // robe region (accent cloth 230-255 and white robe 90; not the hair ribbon 120 or belt 150)
    const sc = mk(W, H), sg = sc.getContext('2d'), sd = sg.createImageData(W, H);
    for (let k = 0; k < W * H; k++) { const r = M.a[k * 4]; if (r >= 200 || r === 90) sd.data[k * 4 + 3] = 255; }
    sg.putImageData(sd, 0, 0);
    // trousers (G) and bracers (B) masks, and the trouser box per frame (the shins are its lower part)
    const region = (ch) => {
      const c = mk(W, H), cg = c.getContext('2d'), cd = cg.createImageData(W, H);
      for (let k = 0; k < W * H; k++) if (M.a[k * 4 + ch] > 0) cd.data[k * 4 + 3] = 255;
      cg.putImageData(cd, 0, 0);
      return c;
    };
    const legBox = I.frames.map((F) => {
      if (!F) return null;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < I.fh; y++) for (let x = 0; x < I.fw; x++) {
        if (!M.a[((F.Y + y) * W + F.X + x) * 4 + 1]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x0, x1, y0, y1 };
    });
    const shirtBox = I.frames.map((F) => {
      if (!F) return null;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < I.fh; y++) for (let x = 0; x < I.fw; x++) {
        const r = M.a[((F.Y + y) * W + F.X + x) * 4];
        if (!(r >= 200 || r === 90)) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x0, x1, y0, y1 };
    });
    // belt / sash (R = 150): where the belt ornaments hang
    const beltBox = I.frames.map((F) => {
      if (!F) return null;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < I.fh; y++) for (let x = 0; x < I.fw; x++) {
        if (M.a[((F.Y + y) * W + F.X + x) * 4] !== 150) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x0, x1, y0, y1 };
    });
    return (regions[key] = { key, shirt: sc, legs: region(1), arms: region(2), legBox, shirtBox, beltBox, I });
  }

  // Reuse garment masks and the same shoulder attachments as the outfit itself.
  AL.glintAnchors = function (key, row, col) {
    const R = regionsFor(key), M = masks[key], n = row * 8 + col;
    if (!R || !M) return [[], [], [], []];
    const I = R.I, F = I.frames[n], A = anchors(R, n);
    if (!F) return [[], [], [], []];
    const parts = [0, 1, 2].map(ch => EquipmentGlints.pick(I.fw, I.fh, (x, y) => {
      const i = ((F.Y + y) * I.W + F.X + x) * 4;
      return M.a[i + 3] > 128 && (ch ? M.a[i + ch] > 0 : M.a[i] >= 200 || M.a[i] === 90);
    }, ch === 1));
    let shoulders = A ? A.shoulders.map(p => [p[0], p[1] + 2]) : [];
    if (key.startsWith('tao-')) {
      const [x, y, span, slope] = TaoistGear.attachment(key, F);
      shoulders = [-1, 1].map(k => [x + k * span * .7, y + k * span * .7 * slope + 5]);
    }
    return [...parts, shoulders];
  };

  const mixHex = (a, b, t) => {
    const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const METAL = { steel: ['#4f5965', '#ffffff', '#a9b5c3'], gold: ['#7a4c0c', '#fff0a8', '#d39a2a'], white: ['#b8a46a', '#ffffff', '#fff3c8'], bronze: ['#4a2e14', '#f0c890', '#a8743a'] };
  const metal = (g, m, x0, y0, x1, y1) => {
    const M = METAL[m] || m, gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, M[0]); gr.addColorStop(0.45, M[1]); gr.addColorStop(0.62, M[2]); gr.addColorStop(1, M[0]);
    return gr;
  };
  function gem(g, x, y, r, col) {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, col); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = OUT; g.lineWidth = Math.max(0.6, r * 0.25); g.stroke();
  }

  // 24 px pattern tile per shirt tier
  const tiles = new Map();
  function tile(t, col, faction) {
    const key = `${t}|${col}|${faction}|${CLS}`;
    if (tiles.has(key)) return tiles.get(key);
    const S = 24, c = mk(S, S), g = c.getContext('2d'), light = mixHex(col, '#ffffff', 0.55), deep = mixHex(col, '#000000', 0.45);
    g.lineCap = 'round';
    if (tao() && t === 2) {                           // นักพรต: stitched cloud swirls
      g.strokeStyle = light; g.lineWidth = 1.2; g.setLineDash([2, 2]);
      for (const [x, y] of [[6, 7], [18, 19]]) { g.beginPath(); g.arc(x, y, 3.5, Math.PI * 0.9, Math.PI * 2.2); g.stroke(); }
      g.setLineDash([]);
    } else if (tao() && t === 3) {                    // นักพรต: trigrams of the bagua, embroidered
      g.strokeStyle = light; g.lineWidth = 1.3;
      trigram(g, 6, 6, 3.5, 2.4, 5); trigram(g, 18, 18, 3.5, 2.4, 2);
      g.fillStyle = mixHex(col, '#ffd76a', 0.5); g.beginPath(); g.arc(18, 6, 1.1, 0, TAU); g.arc(6, 18, 1.1, 0, TAU); g.fill();
    } else if (tao() && t === 6) {                    // นักพรต: golden lotus embroidery
      for (const [x, y] of [[6, 8], [18, 20]]) for (const a of [-0.6, 0, 0.6]) {
        g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = a ? '#c8a04a' : '#e8c86a';
        g.beginPath(); g.ellipse(0, -3, 1.6, 3.4, 0, 0, TAU); g.fill(); g.restore();
      }
    } else if (t === 1) {                                    // woven linen
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
      for (let i = -S; i < S * 2; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = -S; i < S * 2; i += 6) { g.beginPath(); g.moveTo(i, S); g.lineTo(i + S, 0); g.stroke(); }
    } else if (t === 2) {                             // leather with stitches
      g.fillStyle = tone(faction).leather; g.globalAlpha = 0.55; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
      g.strokeStyle = '#f0d8a8'; g.lineWidth = 1.2; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(0, 6); g.lineTo(S, 6); g.moveTo(0, 18); g.lineTo(S, 18); g.stroke();
    } else if (t === 3 || t === 6) {                  // scale armour (steel / gold)
      const M = t === 6 ? METAL.gold : METAL.steel;
      for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) {
        const x = i * 12 + (row % 2) * 6, y = row * 6;
        const gr = g.createLinearGradient(0, y - 6, 0, y + 6); gr.addColorStop(0, M[1]); gr.addColorStop(1, M[0]);
        g.fillStyle = gr; g.beginPath(); g.arc(x + 6, y, 6, 0, Math.PI); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.8; g.stroke();
        if (t === 6) { g.fillStyle = 'rgba(122,76,12,0.6)'; g.fillRect(x + 4, y + 1, 2, 1.2); }
      }
    } else if (t === 4) {                             // cloud embroidery
      g.strokeStyle = light; g.lineWidth = 1.5;
      for (const [x, y] of [[6, 7], [18, 19]]) {
        g.beginPath(); g.arc(x, y, 3.5, Math.PI * 0.9, Math.PI * 2.2); g.arc(x + 5, y + 1, 2.4, Math.PI * 1.1, Math.PI * 2.3); g.stroke();
      }
    } else if (t === 5) {                             // jade lattice
      g.strokeStyle = '#e8c86a'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(12, 0); g.lineTo(24, 12); g.lineTo(12, 24); g.lineTo(0, 12); g.closePath(); g.stroke();
      g.fillStyle = tone(faction).jade; g.beginPath(); g.arc(12, 12, 2.4, 0, TAU); g.fill();
    } else {                                          // heavenly: stars embroidered in gold thread
      g.fillStyle = '#c8a04a';
      for (const [x, y, r] of [[5, 6, 2.4], [17, 15, 1.8], [10, 20, 1.2], [20, 4, 1.1]]) {
        g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.5, y); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.5, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x, y + r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x, y - r * 0.5); g.closePath(); g.fill();
      }
      g.strokeStyle = deep; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(12, 4, 24, 12); g.stroke();
    }
    tiles.set(key, c);
    return c;
  }
  // pattern strength per set: kept light so the cloth still reads clearly once the sprite is shrunk
  const PATTERN_A = [0, 0.38, 0.45, 0.5, 0.5, 0.5, 0.5, 0.55];

  // tile pattern clipped to a mask region of the sheet (drawn before capes so a cape still covers it)
  // (twin blades: soft-light, so the drawn folds and shading stay readable as a shirt / trousers)
  function regionPattern(sheet, mask, img, alpha) {
    const W = sheet.width, H = sheet.height, oc = mk(W, H), og = oc.getContext('2d');
    // patterns at 1.6x: fine thread work turns to mush when the 187 px frames are drawn ~70 px tall
    const pat = og.createPattern(img, 'repeat');
    if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix([1.6, 0, 0, 1.6, 0, 0]));
    og.fillStyle = pat; og.fillRect(0, 0, W, H);
    og.globalCompositeOperation = 'destination-in'; og.drawImage(mask, 0, 0);
    const g = sheet.getContext('2d');
    g.save(); g.globalAlpha = tao() ? alpha : Math.min(1, alpha * 1.6); g.globalCompositeOperation = tao() ? 'source-atop' : 'soft-light'; g.drawImage(oc, 0, 0); g.restore();
  }
  function shirtPattern(sheet, key, t, faction, look) {
    const R = regionsFor(key);
    if (R && t) regionPattern(sheet, R.shirt, tile(t, look.col.hex, faction), PATTERN_A[t]);
    if (R && t && tao()) taoEmbroidery(sheet, R, t, faction);
  }

  // Broad woven panels and a single legible motif survive the in-game scale.
  // Clip to the robe mask so sleeves, hair, skin and the held whisk retain their art.
  function taoEmbroidery(sheet, R, t, faction) {
    const dark = faction === 'adharma';
    const cloth = (dark
      ? ['', '#58404a', '#672b3d', '#4a244e', '#783353', '#302943', '#811e35', '#261b38']
      : ['', '#b8ad92', '#709e9b', '#345c91', '#75609d', '#277e72', '#193e66', '#e7e3cf'])[t];
    const thread = t >= 5 ? '#ddb35b' : dark ? '#dc9caa' : '#d9dfc9';
    const c = mk(sheet.width,sheet.height), g = c.getContext('2d');
    R.I.frames.forEach((F,f) => {
      const A = anchors(R,f);
      if (!A) return;
      const [cx,cy,hw] = TaoistGear.attachment(R.key,F), y = cy + F.BH*.13;
      const h = Math.min(F.BH*.23, F.y1-y-5), w = hw*.65;
      g.save(); g.beginPath(); g.rect(F.X,F.Y,R.I.fw,R.I.fh); g.clip(); g.translate(F.X,F.Y);
      // Paired coloured lapels continue into the embroidered skirt panels.
      for(const side of [-1,1]) {
        g.beginPath(); g.moveTo(cx+side*4,cy+4);
        g.lineTo(cx+side*(w+3),cy+F.BH*.12);
        g.lineTo(cx+side*(w*1.55),y+h); g.lineTo(cx+side*5,y+h*.95);
        g.closePath(); g.fillStyle=cloth; g.fill();
        g.strokeStyle=thread; g.lineWidth=t>=5?2:1.3; g.stroke();
        const x=cx+side*w*.8, yy=y+h*.48, s=Math.max(4,w*.42);
        g.strokeStyle=thread; g.lineWidth=1.5;
        if(t===3) trigram(g,x,yy,s,2.5,side<0?5:2);
        else if(t===2||t===4) {
          g.beginPath(); g.arc(x,yy,s,.2,Math.PI*1.65); g.arc(x+s*.7,yy+3,s*.6,Math.PI,Math.PI*2); g.stroke();
        } else if(t===5) {
          gem(g,x,yy,s,dark?'#e7899b':'#7de0b4');
        } else if(t===6) {
          for(const a of [-.65,0,.65]) {
            g.save(); g.translate(x,yy+3); g.rotate(a);
            g.beginPath(); g.ellipse(0,-s*.65,s*.35,s,0,0,TAU); g.stroke(); g.restore();
          }
        } else if(t===7) {
          // Gold constellations on deep jade/cranberry inlays.
          g.fillStyle=dark?'#903047':'#236c69'; g.fillRect(x-s-2,yy-s-4,s*2+4,s*2+8);
          g.beginPath(); g.moveTo(x-s,yy-4); g.lineTo(x,yy); g.lineTo(x+s,yy+5); g.stroke();
          for(const [dx,dy] of [[-s,-4],[0,0],[s,5]]) {
            g.fillStyle=thread; g.beginPath(); g.arc(x+dx,yy+dy,1.8,0,TAU); g.fill();
          }
        }
      }
      g.restore();
    });
    g.globalCompositeOperation='destination-in'; g.drawImage(R.shirt,0,0);
    sheet.getContext('2d').drawImage(c,0,0);
  }

  // bracers: 16 px tile per set
  const btiles = new Map();
  function bracerTile(t, col, faction) {
    const key = t + col + faction + CLS, T = tone(faction);
    if (btiles.has(key)) return btiles.get(key);
    const S = 16, c = mk(S, S), g = c.getContext('2d'), light = mixHex(col, '#ffffff', 0.6), deep = mixHex(col, '#000000', 0.5);
    g.lineCap = 'round';
    if (tao() && t >= 2 && t !== 4) {                 // นักพรต sleeves: cords, talismans, jade beads, gold hems
      if (t === 2) { g.strokeStyle = 'rgba(240,226,196,0.85)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, 4); g.lineTo(S, 6); g.moveTo(0, 11); g.lineTo(S, 13); g.stroke(); }
      else if (t === 3) talismanPaper(g, 8, 2, 5, 12, faction);
      else if (t === 5) { for (let x = 2; x < S; x += 4) { g.fillStyle = T.jade; g.beginPath(); g.arc(x, 8, 1.7, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 0.8, 7, 0.9, 0.9); } }
      else if (t === 6) { g.fillStyle = '#e8c86a'; g.fillRect(0, 2, S, 1.6); g.fillRect(0, 12, S, 1.6); g.strokeStyle = '#e8c86a'; g.lineWidth = 1; g.beginPath(); g.arc(8, 8, 2.4, Math.PI * 0.9, Math.PI * 2.2); g.stroke(); }
      else { g.fillStyle = '#ffffff'; for (const [x, y] of [[4, 4], [12, 11]]) { g.fillRect(x - 0.5, y - 2, 1, 4); g.fillRect(x - 2, y - 0.5, 4, 1); } g.fillStyle = '#e8c86a'; g.fillRect(0, 14, S, 1.2); }
      btiles.set(key, c);
      return c;
    }
    if (t === 1) {                                    // cloth wraps
      g.strokeStyle = 'rgba(255,248,230,0.8)'; g.lineWidth = 1.6;
      for (let i = -S; i < S * 2; i += 5) { g.beginPath(); g.moveTo(i, S); g.lineTo(i + S * 0.6, 0); g.stroke(); }
    } else if (t === 2) {                             // leather with cross lacing
      g.fillStyle = T.leather; g.globalAlpha = 0.7; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
      g.strokeStyle = '#f0d8a8'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(2, 2); g.lineTo(14, 14); g.moveTo(14, 2); g.lineTo(2, 14); g.stroke();
      g.fillStyle = '#d9b45a';
      for (const [x, y] of [[2, 2], [14, 2], [2, 14], [14, 14]]) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
    } else if (t === 3 || t === 6 || t === 7) {       // metal bands (steel / gold / white gold)
      const M = t === 6 ? METAL.gold : t === 7 ? METAL.white : METAL.steel;
      for (let y = 0; y < S; y += 8) {
        const gr = g.createLinearGradient(0, y, 0, y + 6); gr.addColorStop(0, M[1]); gr.addColorStop(0.5, M[2]); gr.addColorStop(1, M[0]);
        g.fillStyle = gr; g.fillRect(0, y, S, 6);
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y + 6, S, 1);
        g.fillStyle = t === 7 ? T.gem : t === 6 ? T.accent : '#2a2f36';
        g.beginPath(); g.arc(S / 2, y + 3, 1.2, 0, TAU); g.fill();
      }
    } else if (t === 4) {                             // silk with cloud swirls
      g.strokeStyle = light; g.lineWidth = 1.3;
      g.beginPath(); g.arc(5, 6, 3, Math.PI * 0.9, Math.PI * 2.2); g.arc(10, 7, 2, Math.PI * 1.1, Math.PI * 2.3); g.stroke();
      g.strokeStyle = deep; g.beginPath(); g.moveTo(0, 14); g.lineTo(S, 14); g.stroke();
    } else {                                          // jade plates in gold frames
      g.fillStyle = T.jade; g.fillRect(2, 2, 12, 12);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(3, 3, 5, 3);
      g.strokeStyle = '#e8c86a'; g.lineWidth = 1.4; g.strokeRect(1.5, 1.5, 13, 13);
    }
    btiles.set(key, c);
    return c;
  }

  // twin blades: the drawn boots / shins take the set's material colour (their own shading and line art stay),
  // with one trim band at the top; leather straps on set 2
  const SHIN = ['', '#d8c49a', null, '#b9c4d2', null, null, '#e2b04a', '#f6eedb'];
  function bladeGreaves(sheet, R, t, look, faction) {
    const T = tone(faction), W = sheet.width, H = sheet.height;
    const mat = SHIN[t] || (t === 2 ? T.leather : t === 5 ? T.jade : mixHex(look.col.hex, '#ffffff', 0.45));
    const trim = t === 1 ? null : t === 3 ? '#e8eef6' : t === 5 || t === 6 ? '#e8c86a' : t === 7 ? '#ffd76a' : '#e0b65a';
    const tint = mk(W, H), tg = tint.getContext('2d'), deco = mk(W, H), dg = deco.getContext('2d');
    R.I.frames.forEach((F, f) => {
      const L = R.legBox[f];
      if (!F || !L) return;
      const x0 = F.X + L.x0, x1 = F.X + L.x1, y1 = F.Y + L.y1, ys = F.Y + L.y0 + (L.y1 - L.y0) * 0.56, w = x1 - x0;
      tg.fillStyle = mat; tg.fillRect(x0, ys, w, y1 - ys);
      if (trim) { dg.fillStyle = trim; dg.fillRect(x0, ys, w, 1.6); }
      if (t === 2) for (const k of [0.3, 0.7]) { dg.fillStyle = T.leatherHi; dg.fillRect(x0, ys + (y1 - ys) * k, w, 1.2); }
      if (t >= 3 && t !== 4) {                       // a soft metal sheen down the middle of each shin
        const gr = tg.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        dg.save(); dg.globalAlpha = 0.5; dg.fillStyle = gr; dg.fillRect(x0, ys, w, y1 - ys); dg.restore();
      }
    });
    for (const c of [tint, deco]) { const cg = c.getContext('2d'); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(R.legs, 0, 0); }
    const sg = sheet.getContext('2d');
    sg.save();
    sg.globalCompositeOperation = 'color'; sg.globalAlpha = 0.85; sg.drawImage(tint, 0, 0);      // hue of the material, shading of the drawing
    sg.globalCompositeOperation = 'source-atop'; sg.globalAlpha = 0.9; sg.drawImage(deco, 0, 0);
    sg.restore();
  }
  // greaves on the shins (lower part of the trousers), clipped to the trouser mask
  function greaves(sheet, key, t, look, faction) {
    const T = tone(faction);
    const R = regionsFor(key);
    if (!R || !t) return;
    if (!tao()) return bladeGreaves(sheet, R, t, look, faction);
    const W = sheet.width, H = sheet.height, oc = mk(W, H), g = oc.getContext('2d');
    const light = mixHex(look.col.hex, '#ffffff', 0.55);
    R.I.frames.forEach((F, f) => {
      const L = R.legBox[f];
      if (!F || !L) return;
      const x0 = F.X + L.x0, x1 = F.X + L.x1, y1 = F.Y + L.y1, ys = F.Y + L.y0 + (L.y1 - L.y0) * 0.56, h = y1 - ys, w = x1 - x0;
      g.save(); g.beginPath(); g.rect(F.X, F.Y, R.I.fw, R.I.fh); g.clip();
      if (tao()) {                                  // นักพรต: cloth leg wraps with a band per set
        g.strokeStyle = faction === 'adharma' ? 'rgba(60,40,48,0.95)' : 'rgba(246,240,226,0.95)'; g.lineWidth = 1.6;
        for (let i = -h; i < w + h; i += 4.2) { g.beginPath(); g.moveTo(x0 + i, y1); g.lineTo(x0 + i + h * 0.5, ys); g.stroke(); }
        const by = ys + 1;
        if (t === 2) { g.strokeStyle = '#c8a46a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, by); g.lineTo(x1, by + 1); g.stroke(); }
        else if (t === 3) talismanPaper(g, (x0 + x1) / 2, by, Math.max(3, w * 0.22), h * 0.5, faction);
        else if (t === 4) { g.fillStyle = '#e8c86a'; g.fillRect(x0, by, w, 1.6); }
        else if (t === 5) { g.fillStyle = T.jade; g.fillRect(x0, by, w, 3); g.fillStyle = '#e8c86a'; g.fillRect(x0, by - 1, w, 1); g.fillRect(x0, by + 3, w, 1); }
        else if (t >= 6) {
          g.fillStyle = t === 7 ? '#ffffff' : '#e8c86a'; g.fillRect(x0, by, w, 2.2);
          g.strokeStyle = '#e8c86a'; g.lineWidth = 1; g.beginPath(); g.arc((x0 + x1) / 2, by + h * 0.35, Math.max(2, w * 0.14), Math.PI * 0.9, Math.PI * 2.2); g.stroke();
        }
      } else if (t === 1 || t === 4) {                     // linen wraps / silk wraps with a gold trim
        g.strokeStyle = t === 1 ? 'rgba(240,226,196,0.95)' : light; g.lineWidth = 1.7;
        for (let i = -h; i < w + h; i += 4.5) { g.beginPath(); g.moveTo(x0 + i, y1); g.lineTo(x0 + i + h * 0.55, ys); g.stroke(); }
        if (t === 4) { g.fillStyle = '#e8c86a'; g.fillRect(x0, ys, w, 2); }
      } else if (t === 2) {                         // two leather straps with buckles
        for (const k of [0.25, 0.68]) {
          const y = ys + h * k;
          g.fillStyle = T.leather; g.fillRect(x0, y, w, 3.5);
          g.fillStyle = T.leatherHi; g.fillRect(x0, y, w, 1);
          g.fillStyle = '#e0b65a';
          for (let x = x0 + 3; x < x1; x += 11) g.fillRect(x, y - 0.5, 2.4, 4.5);
        }
      } else {                                      // metal greaves: steel / jade-inlaid / gold / white gold
        const M = t === 6 ? METAL.gold : t === 7 ? METAL.white : METAL.steel;
        const gr = g.createLinearGradient(x0, 0, x1, 0);
        for (let k = 0; k <= 6; k++) gr.addColorStop(k / 6, k % 2 ? M[1] : M[2]);
        g.fillStyle = gr; g.fillRect(x0, ys, w, h);
        g.fillStyle = 'rgba(0,0,0,0.45)';
        for (let y = ys + 5; y < y1 - 2; y += 6) g.fillRect(x0, y, w, 1);   // plate seams
        g.fillStyle = M[0]; g.fillRect(x0, ys, w, 2);                       // top rim
        if (t === 5) {
          const jy = ys + h * 0.4;
          g.fillStyle = T.jade; g.fillRect(x0, jy, w, 3.5);
          g.fillStyle = '#e8c86a'; g.fillRect(x0, jy - 1, w, 1); g.fillRect(x0, jy + 3.5, w, 1);
        }
        if (t === 7) {
          g.fillStyle = '#ffffff';
          for (let x = x0 + 4; x < x1; x += 9) { g.fillRect(x, ys + h * 0.45, 1.2, 4); g.fillRect(x - 1.4, ys + h * 0.45 + 1.4, 4, 1.2); }
        }
      }
      g.restore();
    });
    g.globalCompositeOperation = 'destination-in'; g.drawImage(R.legs, 0, 0);
    const sg = sheet.getContext('2d');
    sg.save(); sg.globalAlpha = tao() ? 0.72 : t >= 3 ? 0.88 : 0.8; sg.globalCompositeOperation = 'source-atop'; sg.drawImage(oc, 0, 0); sg.restore();
  }

  // trousers + bracers: set pattern / bracer pattern + greaves
  function limbPieces(sheet, key, faction, looks) {
    const R = regionsFor(key);
    if (!R) return;
    const legs = looks[1], arms = looks[2];
    if (legs) {
      regionPattern(sheet, R.legs, tile(legs.tier, legs.col.hex, faction), PATTERN_A[legs.tier] * 0.85);
      greaves(sheet, key, legs.tier, legs, faction);
    }
    if (arms) regionPattern(sheet, R.arms, bracerTile(arms.tier, arms.col.hex, faction), arms.tier >= 3 ? 0.8 : 0.65);
  }

  // ------------------------------------------------------------ set garb: higher sets look like immortals
  const vgrad = (g, a, b, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const sway = (F) => F.row - 1;
  // per frame: body height, robe box, shoulder points and the belt (frame coordinates)
  function anchors(R, f) {
    const F = R.I.frames[f], S = R.shirtBox[f];
    if (!F || !S) return null;
    const B = F.BH, w = S.x1 - S.x0, Bt = R.beltBox[f];
    // shoulders hang off the neck point (the robe box starts at the collar and spans the sleeves)
    const [nx, ny] = F.neck, sy = ny + B * 0.045;
    const shoulders = F.view === 'side' ? [[nx - F.trail * B * 0.02, sy, F.trail > 0 ? -1 : 1]]
      : [[nx - B * 0.1, sy, -1], [nx + B * 0.1, sy, 1]];
    return {
      F, B, S, w, shoulders, key: R.key,
      beltX: Bt ? (Bt.x0 + Bt.x1) / 2 : F.cx, beltY: Bt ? (Bt.y0 + Bt.y1) / 2 : S.y0 + (S.y1 - S.y0) * 0.42,
      beltW: Bt ? Bt.x1 - Bt.x0 : w * 0.6,
    };
  }
  const cloud = (p, s) => { // a three-lobed cloud cap, flat side down, centred on (0,0)
    p.moveTo(-s * 1.2, s * 0.35);
    p.quadraticCurveTo(-s * 1.45, -s * 0.35, -s * 0.75, -s * 0.45);
    p.quadraticCurveTo(-s * 0.55, -s * 1.1, 0, -s * 0.85);
    p.quadraticCurveTo(s * 0.55, -s * 1.15, s * 0.8, -s * 0.45);
    p.quadraticCurveTo(s * 1.5, -s * 0.3, s * 1.2, s * 0.35);
    p.quadraticCurveTo(0, s * 0.6, -s * 1.2, s * 0.35);
    p.closePath();
  };
  // shoulder slot: k = -1 left / 1 right (mirrors the shape outward)
  function pauldron(g, t, x, y, s, k, col, faction) {
    const light = mixHex(col, '#ffffff', 0.5), deep = mixHex(col, '#000000', 0.5);
    g.save(); g.translate(x, y); g.scale(k, 1); g.lineJoin = 'round';
    const outline = (p, w = 0.1) => { g.strokeStyle = OUT; g.lineWidth = s * w; g.stroke(p); };
    if (tao() && t !== 5 && t !== 7) {                     // นักพรต: soft cloth shawl caps (no steel, no horns)
      const T = tone(faction), cloth = faction === 'adharma' ? ['#3a2a30', '#120a0e'] : ['#ffffff', '#c9d6e8'];
      const p = new Path2D();
      if (t === 1) { p.ellipse(0, s * 0.05, s * 1.0, s * 0.62, 0.15, Math.PI * 1.02, Math.PI * 2.05); p.closePath(); }
      else cloud(p, s * (t >= 4 ? 1 : 0.9));
      g.fillStyle = vgrad(g, t === 1 ? light : cloth[0], t === 1 ? deep : cloth[1], -s, s * 0.4); g.fill(p);
      g.strokeStyle = t >= 6 ? '#ffd76a' : col; g.lineWidth = s * (t >= 6 ? 0.16 : 0.12); g.stroke(p); outline(p, 0.05);
      if (t === 2) { g.strokeStyle = '#c8a46a'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(-s * 0.9, s * 0.2); g.quadraticCurveTo(0, -s * 0.15, s * 0.9, s * 0.2); g.stroke(); }
      if (t === 3) talismanPaper(g, s * 0.55, s * 0.15, s * 0.42, s * 1.15, faction);      // a talisman hanging from the shawl
      if (t === 4 || t === 6) {                              // tassel (gold one from the lotus set)
        g.strokeStyle = '#e8c86a'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(s * 0.9, s * 0.4); g.lineTo(s * 1.0, s * 1.2); g.stroke();
        g.fillStyle = t === 6 ? '#e8c86a' : T.tassel; g.beginPath(); g.ellipse(s * 1.0, s * 1.35, s * 0.14, s * 0.28, 0, 0, TAU); g.fill();
      }
      if (t === 6) {                                         // golden lotus clasp
        for (const a of [-0.7, 0, 0.7]) { g.save(); g.translate(0, -s * 0.15); g.rotate(a); g.fillStyle = metal(g, 'gold', 0, -s, 0, 0); g.beginPath(); g.ellipse(0, -s * 0.35, s * 0.2, s * 0.42, 0, 0, TAU); g.fill(); g.restore(); }
        gem(g, 0, -s * 0.1, s * 0.2, faction === 'adharma' ? '#ff2a2a' : '#2bd68f');
      }
      g.restore();
      return;
    }
    if (t <= 2) {                                          // cloth cap / fur-trimmed leather
      const p = new Path2D(); p.ellipse(0, 0, s * 1.15, s * 0.8, 0.15, Math.PI * 1.02, Math.PI * 2.08); p.closePath();
      g.fillStyle = t === 1 ? vgrad(g, light, deep, -s, s * 0.3) : vgrad(g, tone(faction).leatherHi, tone(faction).leather, -s, s * 0.3); g.fill(p); outline(p);
      if (t === 2) {
        g.fillStyle = faction === 'adharma' ? '#2a2024' : '#f2f6fc';      // fur trim: white for ธรรมะ, black for อธรรม
        for (let i = 0; i < 6; i++) { const fx = -s + i * s * 0.4; g.beginPath(); g.moveTo(fx, s * 0.05); g.lineTo(fx + s * 0.2, s * 0.45); g.lineTo(fx + s * 0.4, s * 0.05); g.fill(); }
        g.strokeStyle = '#2a1a0a'; g.lineWidth = s * 0.1;
        for (const fx of [-0.5, 0.2]) { g.beginPath(); g.moveTo(s * fx, -s * 0.55); g.lineTo(s * (fx + 0.15), -s * 0.05); g.stroke(); }
      }
    } else if (t === 3) {                                  // three steel lames
      for (let i = 2; i >= 0; i--) {
        const p = new Path2D(); p.ellipse(s * 0.1 * i, s * 0.3 * i - s * 0.2, s * (1.2 - i * 0.12), s * 0.55, 0.2, Math.PI, Math.PI * 2.05); p.closePath();
        g.fillStyle = metal(g, 'steel', -s, -s, s, s); g.fill(p); outline(p, 0.08);
      }
      g.fillStyle = '#2a2f36'; g.beginPath(); g.arc(-s * 0.3, -s * 0.45, s * 0.12, 0, TAU); g.fill();
    } else if (t === 4 || t === 5) {                       // silk cloud (trimmed) / jade cloud (gold rim, gem, second layer)
      if (t === 5) {
        const back = new Path2D(); g.save(); g.translate(s * 0.35, -s * 0.45); cloud(back, s * 0.75); g.restore();
        g.save(); g.translate(s * 0.35, -s * 0.45); g.fillStyle = vgrad(g, tone(faction).jadeHi, tone(faction).jadeLo, -s, s * 0.4); g.fill(back); g.strokeStyle = '#e8c86a'; g.lineWidth = s * 0.1; g.stroke(back); g.restore();
      }
      const p = new Path2D(); cloud(p, s);
      g.fillStyle = t === 4 ? vgrad(g, light, col, -s, s * 0.5) : vgrad(g, tone(faction).jadeHi, tone(faction).jade, -s, s * 0.5); g.fill(p);
      g.strokeStyle = '#e8c86a'; g.lineWidth = s * (t === 5 ? 0.16 : 0.1); g.stroke(p); outline(p, 0.05);
      if (t === 4) { // tassel
        g.strokeStyle = '#e8c86a'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(s * 0.9, s * 0.4); g.lineTo(s * 1.0, s * 1.2); g.stroke();
        g.fillStyle = tone(faction).tassel; g.beginPath(); g.ellipse(s * 1.0, s * 1.35, s * 0.14, s * 0.28, 0, 0, TAU); g.fill();
      } else gem(g, 0, -s * 0.2, s * 0.26, tone(faction).gem);
    } else if (t === 6) {                                  // gold dragon pauldron with a horn
      const horn = new Path2D(); horn.moveTo(s * 0.4, -s * 0.5); horn.quadraticCurveTo(s * 1.4, -s * 1.0, s * 1.5, -s * 2.0); horn.quadraticCurveTo(s * 1.0, -s * 1.2, s * 0.0, -s * 0.6); horn.closePath();
      g.fillStyle = metal(g, 'gold', 0, -s * 2, 0, 0); g.fill(horn); outline(horn, 0.08);
      const p = new Path2D(); p.moveTo(-s * 1.2, s * 0.4); p.quadraticCurveTo(-s * 1.1, -s * 0.8, 0, -s * 0.9); p.quadraticCurveTo(s * 1.2, -s * 0.9, s * 1.5, s * 0.1); p.lineTo(s * 1.0, s * 0.5); p.closePath();
      g.fillStyle = metal(g, 'gold', -s, -s, s, s); g.fill(p); outline(p);
      g.strokeStyle = 'rgba(122,76,12,0.8)'; g.lineWidth = s * 0.07;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-s * 0.4 + i * s * 0.55, s * 0.05, s * 0.3, Math.PI, TAU); g.stroke(); }
      gem(g, 0, -s * 0.35, s * 0.24, faction === 'adharma' ? '#ff2a2a' : '#3a8dff');
    } else {                                               // celestial lotus petals + a floating petal
      const petal = (a, len, wd) => {
        g.save(); g.rotate(a);
        const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(wd, -len * 0.5, 0, -len); p.quadraticCurveTo(-wd, -len * 0.5, 0, 0);
        g.fillStyle = vgrad(g, '#ffffff', light, -len, 0); g.fill(p);
        g.strokeStyle = '#ffd76a'; g.lineWidth = s * 0.08; g.stroke(p); g.restore();
      };
      for (const [a, len] of [[-1.25, 1.3], [-0.65, 1.7], [0, 1.9], [0.65, 1.7], [1.25, 1.3]]) petal(a, s * len, s * 0.5);
      const base = new Path2D(); base.ellipse(0, s * 0.15, s * 1.15, s * 0.45, 0, 0, TAU);
      g.fillStyle = metal(g, 'white', -s, -s, s, s); g.fill(base); outline(base, 0.06);
      gem(g, 0, s * 0.1, s * 0.25, faction === 'adharma' ? '#ff4a6a' : '#8ad8ff');
      g.save(); g.translate(s * 0.9, -s * 2.3); g.rotate(0.5); petal(0, s * 0.8, s * 0.3); g.restore();
    }
    g.restore();
  }
  // นักพรต shoulder shawl: a cloth capelet over both shoulders cut from the robe itself (its cloth, the set's
  // pattern and trim colour), scalloped like clouds; on back views the middle stays open so the hair / ribbons show.
  // The chibi's chin sits at ~55% of the body height, so the collar is placed there (not at the twin blades' neck).
  function taoShawl(g, A, look, faction) {
    const { F, B } = A, t = look.tier, col = look.col.hex, adh = faction === 'adharma';
    const back = F.view === 'back', side = F.view === 'side';
    const attach = window.TaoistGear ? TaoistGear.attachment(A.key, F) : [F.cx, F.y0+B*.52,B*.12,0];
    g.save(); g.translate(attach[0], attach[1]); g.rotate(attach[3]);
    const cx = 0, y = 0, sw = 0;
    const hw = attach[2], depth = B * (0.035 + t * 0.003), k = back ? 0.32 : 0.2;
    const yAt = (u) => y + depth * (0.82 + (1 - Math.abs(2 * u - 1)) * k);
    const xAt = (u) => cx - hw * 1.14 + u * hw * 2.28 + sw;
    const p = new Path2D();
    p.moveTo(cx - hw * 0.32, y);
    p.quadraticCurveTo(cx - hw * 0.9, y - B * 0.006, cx - hw * 1.1, y + B * 0.032);
    p.lineTo(xAt(0), yAt(0));
    const n = 5;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, um = (u0 + u1) / 2;
      p.quadraticCurveTo(xAt(um), yAt(um) + B * 0.024, xAt(u1), yAt(u1));
    }
    p.lineTo(cx + hw * 1.1, y + B * 0.032);
    p.quadraticCurveTo(cx + hw * 0.9, y - B * 0.006, cx + hw * 0.32, y);
    if (!back && !side) p.lineTo(cx, y + B * 0.042);           // V neckline under the chin
    p.closePath();
    g.save();
    if (back) {                                                   // leave the middle open for the hair
      const hole = new Path2D();
      hole.rect(-999, -999, 2000, 2000);
      hole.rect(cx - hw * 0.42, y - B * 0.05, hw * 0.84, depth * 2);
      g.clip(hole, 'evenodd');
    }
    const cloth = t >= 7 ? (adh ? ['#2a0c12', '#08030a'] : ['#ffffff', '#e6f6ee']) : adh ? ['#30262c', '#0e090b'] : ['#ffffff', '#d2dcea'];
    g.fillStyle = vgrad(g, cloth[0], cloth[1], y, y + depth * 1.1); g.fill(p);
    // the set's own pattern on the cloth, light
    const pat = g.createPattern(tile(t, col, faction), 'repeat');
    if (pat) { g.save(); g.clip(p); g.globalAlpha = 0.5; g.fillStyle = pat; g.fill(p); g.restore(); }
    // fold shading
    g.save(); g.clip(p); g.strokeStyle = adh ? 'rgba(255,255,255,0.08)' : 'rgba(60,80,110,0.18)'; g.lineWidth = B * 0.004;
    for (const u of [0.22, 0.4, 0.6, 0.78]) { g.beginPath(); g.moveTo(cx + (u - 0.5) * hw * 0.9, y + B * 0.01); g.lineTo(xAt(u), yAt(u)); g.stroke(); }
    g.restore();
    // hem trim in the set colour (gold edge from the lotus set)
    g.strokeStyle = col; g.lineWidth = B * 0.012; g.stroke(p);
    if (t >= 6) { g.strokeStyle = t >= 7 ? '#fff3c0' : '#ffd76a'; g.lineWidth = B * 0.005; g.stroke(p); }
    g.strokeStyle = OUT; g.lineWidth = B * 0.003; g.stroke(p);
    g.restore();
    // details by set
    const T = tone(faction), clasp = [cx, y + B * 0.03];
    const tassel = (x, yy, c) => {
      g.strokeStyle = '#e8c86a'; g.lineWidth = B * 0.004; g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy + B * 0.04); g.stroke();
      g.fillStyle = c; g.beginPath(); g.ellipse(x, yy + B * 0.05, B * 0.007, B * 0.014, 0, 0, TAU); g.fill();
    };
    const ends = side ? [xAt(F.trail > 0 ? 0.08 : 0.92)] : [xAt(0.06), xAt(0.94)];
    if (t === 2 && !back) { g.strokeStyle = '#c8a46a'; g.lineWidth = B * 0.004; g.beginPath(); g.arc(clasp[0] - B * 0.008, clasp[1], B * 0.007, 0, TAU); g.arc(clasp[0] + B * 0.008, clasp[1], B * 0.007, 0, TAU); g.stroke(); }
    if (t === 3) {
      if (!back && !side) taiji(g, clasp[0], clasp[1], B * 0.013, '#f6f6f0', '#16161e');
      for (const x of ends) talismanPaper(g, x, yAt(0.06), B * 0.022, B * 0.06, faction);
    }
    if (t === 4 || t >= 6) for (const x of ends) tassel(x, yAt(0.06), t >= 6 ? '#e8c86a' : T.tassel);
    if (t === 5) {
      if (!back && !side) { g.fillStyle = vgrad(g, T.jadeHi, T.jadeLo, clasp[1] - B * 0.014, clasp[1] + B * 0.014); g.beginPath(); g.arc(clasp[0], clasp[1], B * 0.014, 0, TAU); g.arc(clasp[0], clasp[1], B * 0.005, 0, TAU, true); g.fill('evenodd'); }
      for (let i = 1; i < 6; i++) { const u = i / 6; gem(g, xAt(u), yAt(u) + B * 0.014, B * 0.006, T.jade); }
    }
    if (t >= 6 && !back) {                                          // golden lotus clasp (white-gold at the top set)
      for (const a of [-0.75, 0, 0.75]) {
        g.save(); g.translate(clasp[0], clasp[1] + B * 0.008); g.rotate(a);
        g.fillStyle = metal(g, t >= 7 ? 'white' : 'gold', 0, -B * 0.03, 0, 0);
        g.beginPath(); g.ellipse(0, -B * 0.012, B * 0.006, B * 0.014, 0, 0, TAU); g.fill(); g.restore();
      }
      gem(g, clasp[0], clasp[1] + B * 0.006, B * 0.006, adh ? '#ff2a1a' : '#5affb0');
    }
    if (t >= 7) for (const [u, dy] of [[0.15, -0.03], [0.85, -0.035], [0.5, -0.05]]) {     // floating petals of light
      g.save(); g.translate(xAt(u), y + B * dy); g.rotate(u * 3);
      g.fillStyle = adh ? 'rgba(255,90,40,0.85)' : 'rgba(220,255,236,0.9)';
      g.beginPath(); g.ellipse(0, 0, B * 0.005, B * 0.011, 0, 0, TAU); g.fill(); g.restore();
    }
    g.restore();
  }
  // two sash tails hanging from the belt and trailing behind
  function sashTails(g, A, len, cols, edge) {
    const { F, B } = A, w = B * 0.03;
    const dirs = F.view === 'side' ? [F.trail * 0.9, F.trail * 0.65] : F.view === 'back' ? [-0.18, 0.18] : [-0.22, 0.28];
    dirs.forEach((dx, k) => {
      const sw = sway(F) * B * 0.03 * (k ? -1 : 1);
      const x0 = A.beltX + (F.view === 'side' ? -F.trail * B * 0.03 : dx * A.beltW * 0.5), y0 = A.beltY;
      const x2 = x0 + dx * B * 0.22 + sw, y2 = y0 + len * (k ? 0.85 : 1) * (F.view === 'side' ? 0.75 : 1);
      const xm = (x0 + x2) / 2 + sw, ym = (y0 + y2) / 2;
      const p = new Path2D();
      p.moveTo(x0 - w * 0.5, y0); p.quadraticCurveTo(xm - w, ym, x2 - w * 0.5, y2);
      p.lineTo(x2 + w * 0.2, y2 + w * 1.3); p.lineTo(x2 + w * 0.8, y2);
      p.quadraticCurveTo(xm + w, ym, x0 + w * 0.5, y0); p.closePath();
      g.fillStyle = vgrad(g, cols[0], cols[1], y0, y2); g.fill(p);
      g.strokeStyle = edge; g.lineWidth = B * 0.006; g.stroke(p);
    });
  }
  // belt ornament per shirt tier (front / side views)
  function beltPiece(g, t, A, col, faction) {
    const { F, B } = A, x = A.beltX, y = A.beltY, s = B * 0.03;
    if (F.view === 'back') return;
    const T = tone(faction), red = T.tassel;
    if (tao() && (t === 3 || t === 6)) {                    // นักพรต: bronze bagua disc / gold taiji with tassels
      if (t === 6) for (const k of [-1, 1]) { g.strokeStyle = red; g.lineWidth = s * 0.25; g.beginPath(); g.moveTo(x + k * s * 0.6, y + s * 0.6); g.lineTo(x + k * s * 0.9, y + s * 2.4); g.stroke(); }
      g.fillStyle = metal(g, t === 6 ? 'gold' : 'bronze', x - s, y - s, x + s, y + s);
      g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; g.lineTo(x + Math.cos(a) * s * 1.15, y + Math.sin(a) * s * 1.15); } g.closePath(); g.fill();
      g.strokeStyle = OUT; g.lineWidth = s * 0.12; g.stroke();
      taiji(g, x, y, s * 0.55, '#f6f6f0', '#16161e');
      return;
    }
    if (t === 1) { g.strokeStyle = '#8a6a3a'; g.lineWidth = s * 0.35; g.beginPath(); g.arc(x - s * 0.5, y, s * 0.45, 0, TAU); g.arc(x + s * 0.5, y, s * 0.45, Math.PI, Math.PI * 3); g.stroke(); }
    else if (t === 2) { g.fillStyle = metal(g, 'gold', x - s, y - s, x + s, y + s); g.fillRect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2); g.strokeStyle = OUT; g.lineWidth = s * 0.15; g.strokeRect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2); }
    else if (t === 3) {
      g.fillStyle = metal(g, 'steel', x - s, y - s, x + s, y + s); g.fillRect(x - s * 1.2, y - s * 0.7, s * 2.4, s * 1.4);
      g.strokeStyle = OUT; g.lineWidth = s * 0.15; g.strokeRect(x - s * 1.2, y - s * 0.7, s * 2.4, s * 1.4);
      g.fillStyle = '#2a2f36'; for (const k of [-0.8, 0.8]) { g.beginPath(); g.arc(x + s * k, y, s * 0.18, 0, TAU); g.fill(); }
    } else if (t === 4) { // silk bow
      g.fillStyle = mixHex(col, '#ffffff', 0.35);
      for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * s * 0.8, y, s * 0.8, s * 0.45, k * 0.3, 0, TAU); g.fill(); g.strokeStyle = '#e8c86a'; g.lineWidth = s * 0.12; g.stroke(); }
      gem(g, x, y, s * 0.3, '#e8c86a');
    } else if (t === 5) { // jade bi pendant on a gold cord + red tassel
      const px = x + A.beltW * 0.3, py = y + s * 2.2;
      g.strokeStyle = '#e8c86a'; g.lineWidth = s * 0.15; g.beginPath(); g.moveTo(px, y); g.lineTo(px, py - s * 0.8); g.stroke();
      g.fillStyle = vgrad(g, T.jadeHi, T.jadeLo, py - s, py + s); g.beginPath(); g.arc(px, py, s * 0.85, 0, TAU); g.arc(px, py, s * 0.3, 0, TAU, true); g.fill('evenodd');
      g.strokeStyle = OUT; g.lineWidth = s * 0.1; g.beginPath(); g.arc(px, py, s * 0.85, 0, TAU); g.stroke();
      g.fillStyle = red; g.beginPath(); g.moveTo(px - s * 0.3, py + s * 0.8); g.lineTo(px + s * 0.3, py + s * 0.8); g.lineTo(px + s * 0.15, py + s * 2.2); g.lineTo(px - s * 0.15, py + s * 2.2); g.fill();
      gem(g, x, y, s * 0.4, T.gem);
    } else if (t === 6) { // gold dragon roundel + two red tassels
      for (const k of [-1, 1]) {
        g.strokeStyle = red; g.lineWidth = s * 0.25; g.beginPath(); g.moveTo(x + k * s * 0.6, y + s * 0.6); g.lineTo(x + k * s * 0.9, y + s * 2.4); g.stroke();
      }
      g.fillStyle = metal(g, 'gold', x - s, y - s, x + s, y + s); g.beginPath(); g.arc(x, y, s * 1.05, 0, TAU); g.fill();
      g.strokeStyle = OUT; g.lineWidth = s * 0.12; g.stroke();
      g.strokeStyle = red; g.lineWidth = s * 0.2; g.beginPath(); g.arc(x, y, s * 0.55, 0.4, Math.PI * 1.7); g.stroke();
    } else { // celestial disc with a glowing gem and rays
      g.save(); g.shadowColor = faction === 'adharma' ? '#ff4a6a' : '#8ad8ff'; g.shadowBlur = s * 2;
      g.fillStyle = metal(g, 'white', x - s, y - s, x + s, y + s); g.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? s * 0.8 : s * 1.3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.restore();
      g.strokeStyle = OUT; g.lineWidth = s * 0.1; g.stroke();
      gem(g, x, y, s * 0.5, faction === 'adharma' ? '#ff4a6a' : '#8ad8ff');
    }
  }
  // front apron panel (蔽膝) hanging from the belt, front views only
  function apron(g, t, A, col, faction) {
    const { F, B } = A;
    if (F.view !== 'front') return;
    const w = Math.max(B * 0.05, A.beltW * 0.3), h = B * (0.13 + (t - 5) * 0.03), x = A.beltX, y = A.beltY + B * 0.01, sw = sway(F) * B * 0.012;
    const p = new Path2D();
    p.moveTo(x - w / 2, y); p.lineTo(x + w / 2, y); p.lineTo(x + w / 2 + sw, y + h); p.lineTo(x + sw, y + h + w * 0.35); p.lineTo(x - w / 2 + sw, y + h); p.closePath();
    const T = tone(faction), dk = faction === 'adharma';
    const fill = t === 5 ? [T.jade, T.jadeLo] : t === 6 ? (dk ? ['#2a0a10', '#0a0204'] : ['#2a5ac8', '#0e2466']) : dk ? ['#3a0a12', '#080406'] : ['#ffffff', '#cfe0f6'];
    g.fillStyle = vgrad(g, fill[0], fill[1], y, y + h); g.fill(p);
    g.save(); g.clip(p);
    if (t === 5) { g.strokeStyle = '#e8c86a'; g.lineWidth = B * 0.005; g.beginPath(); g.arc(x, y + h * 0.5, w * 0.22, Math.PI * 0.9, Math.PI * 2.2); g.stroke(); }
    else if (t === 6 && tao()) { g.strokeStyle = '#e8b040'; g.lineWidth = B * 0.005; for (const v of [0.3, 0.7]) { g.beginPath(); g.arc(x, y + h * v, w * 0.2, Math.PI * 0.9, Math.PI * 2.2); g.stroke(); } }
    else if (t === 6) { g.strokeStyle = '#e8b040'; g.lineWidth = B * 0.005; for (let r = 0; r < 4; r++) for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(x + i * w * 0.33 + (r % 2) * w * 0.16, y + h * 0.15 + r * h * 0.22, w * 0.16, 0, Math.PI); g.stroke(); } }
    else {
      g.fillStyle = '#e8c060';
      for (const [u, v, r] of [[0, 0.3, 1], [-0.25, 0.65, 0.7], [0.25, 0.75, 0.7]]) {
        const sx = x + u * w, sy = y + v * h, rr = w * 0.09 * r;
        g.beginPath(); g.moveTo(sx, sy - rr * 2); g.lineTo(sx + rr * 0.5, sy); g.lineTo(sx, sy + rr * 2); g.lineTo(sx - rr * 0.5, sy); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(sx - rr * 2, sy); g.lineTo(sx, sy + rr * 0.5); g.lineTo(sx + rr * 2, sy); g.lineTo(sx, sy - rr * 0.5); g.closePath(); g.fill();
      }
    }
    g.restore();
    g.strokeStyle = t === 7 ? '#ffd76a' : '#e8c86a'; g.lineWidth = B * 0.008; g.stroke(p);
    g.strokeStyle = OUT; g.lineWidth = B * 0.003; g.stroke(p);
  }
  // Lv.100 set: the celestial ribbon (披帛) arching behind the shoulders and drifting at both sides
  function pibo(g, A, faction) {
    const { F, B, S } = A, cx = (S.x0 + S.x1) / 2;
    // (นักพรต: the robe mask starts above the chin, so the ribbon arches from its shoulders at ~57% instead)
    const hw = A.w * 0.5 + B * 0.07, top = tao() ? A.F.y0 + B * 0.57 : S.y0 - B * 0.03, low = A.beltY + B * 0.04;
    const sw = sway(F) * B * 0.03, tr = F.trail * B * 0.1;
    const cols = tao() ? (faction === 'adharma' ? ['#14060a', '#ff3a1a'] : ['#ffffff', '#9fffd0'])
      : faction === 'adharma' ? ['#3a0a14', '#ff3a5a'] : ['#ffffff', '#8ad8ff'];
    if (tao()) {     // the ends: a lotus bud (เทพรักษา) / torn shreds (มารทำลาย), painted behind like the ribbon
      for (const k of [-1, 1]) {
        const ex = cx + k * (hw + B * 0.1) + tr + (k > 0 ? sw : -sw), ey = low + B * 0.2;
        g.save(); g.translate(ex, ey);
        if (faction === 'adharma') { g.fillStyle = '#ff3a1a'; for (const [dx, dy] of [[-0.012, 0.02], [0.006, 0.03], [0.016, 0.018]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(B * dx, B * dy); g.lineTo(B * (dx + 0.008), B * dy * 0.6); g.fill(); } }
        else for (const a of [-0.6, 0, 0.6]) { g.save(); g.rotate(a + Math.PI); g.fillStyle = a ? '#ffe9a0' : '#ffffff'; g.beginPath(); g.ellipse(0, -B * 0.012, B * 0.006, B * 0.014, 0, 0, TAU); g.fill(); g.restore(); }
        g.restore();
      }
    }
    const p = new Path2D();
    p.moveTo(cx - hw - B * 0.1 + tr - sw, low + B * 0.2);
    p.bezierCurveTo(cx - hw - B * 0.02, low + B * 0.05, cx - hw * 1.15, top + B * 0.08, cx - hw * 0.7, top - B * 0.02);
    p.quadraticCurveTo(cx, top - B * 0.1, cx + hw * 0.7, top - B * 0.02);
    p.bezierCurveTo(cx + hw * 1.15, top + B * 0.08, cx + hw + B * 0.02, low + B * 0.05, cx + hw + B * 0.1 + tr + sw, low + B * 0.2);
    const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
    gr.addColorStop(0, cols[1]); gr.addColorStop(0.5, cols[0]); gr.addColorStop(1, cols[1]);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // destination-over paints behind what is already there, so draw front-most first
    g.strokeStyle = tao() && faction === 'adharma' ? '#ff6a2a' : '#ffd76a'; g.lineWidth = B * 0.008; g.stroke(p);
    g.strokeStyle = gr; g.lineWidth = B * (tao() ? 0.03 : 0.04); g.stroke(p);
    g.strokeStyle = tao() ? (faction === 'adharma' ? 'rgba(255,60,20,0.2)' : 'rgba(140,255,200,0.2)') : faction === 'adharma' ? 'rgba(255,60,90,0.18)' : 'rgba(140,220,255,0.18)'; g.lineWidth = B * 0.06; g.stroke(p);
  }
  // what each set adds on the character (item tooltips), index = set tier
  // นักพรต outfit pieces (tooltips), index = set tier
  AL.GARB_TAO = {
    body: ['', 'ปมเชือกที่เอว', 'เข็มขัดผ้าหัวทองเหลือง · ลายเมฆเย็บ', 'จานยันต์แปดทิศที่เอว · ลายตรีแกรมบนชุด', 'โบว์ผ้าไหม · ชายผ้าคาดเอวปลิว · ลายเมฆ',
      'จี้หยกวงแหวน · ผ้าปิดเข่าหยก · ตราไท่จี๋บนอก', 'จานไท่จี๋ทองที่เอว · พู่แดง · ลายบัวทอง · ผ้าปิดเข่าลายเมฆ', 'จานเทพเรืองแสง · ผ้าปิดเข่าลายดาว · ผ้าคล้องแขนเทพ (披帛) ลอยรอบตัว'],
    legs: ['', 'ผ้าพันแข้ง', 'ผ้าพันแข้งคาดเชือก', 'ผ้าพันแข้งติดยันต์', 'ผ้าพันแข้งขลิบทอง', 'ผ้าพันแข้งคาดหยก', 'ผ้าพันแข้งปักเมฆทอง', 'ผ้าพันแข้งขาวทองประกายดาว'],
    arms: ['', 'ผ้าพันข้อมือ', 'แขนเสื้อคาดเชือก', 'แขนเสื้อติดยันต์', 'แขนเสื้อปักเมฆไหม', 'แขนเสื้อร้อยลูกปัดหยก', 'แขนเสื้อขลิบดิ้นทอง', 'แขนเสื้อประกายดาวขลิบทอง'],
    shoulder: ['', 'ผ้าคลุมไหล่', 'ผ้าคลุมไหล่รูปเมฆ', 'ผ้าคลุมไหล่ห้อยยันต์', 'ผ้าคลุมไหล่ไหมเมฆ · พู่แดง', 'หัวไหล่หยกเมฆสองชั้น', 'ผ้าคลุมไหล่ตะขอบัวทอง · พู่ทอง', 'หัวไหล่กลีบบัวสวรรค์ · กลีบลอย'],
  };
  // Rarity is readable in the same colour family on every class. Faction affects
  // the tint, while class colours remain on the weapons and class effects.
  const LIGHT_NAMES = ['', 'ฟ้า', 'ม่วง', 'ทอง', 'ส้มอำพัน', 'ทับทิม'];
  AL.lightOf = (faction, grade) => C.gradeLight(faction, grade);
  AL.lightName = (faction, cls, grade) => LIGHT_NAMES[grade || 0] || '';
  AL.garbOf = (slot, tier, cls) => ((cls === 'taoist' ? AL.GARB_TAO : AL.GARB)[slot] || [])[tier];
  AL.GARB = {
    body: ['', 'ปมเชือกที่เอว', 'เข็มขัดหนังหัวทองเหลือง', 'แผ่นเหล็กหน้าเข็มขัด', 'โบว์ผ้าไหม · ชายผ้าคาดเอวปลิว',
      'จี้หยกวงแหวน · ผ้าปิดเข่าหยก · ชายผ้าปลิว', 'หัวเข็มขัดมังกรทอง · พู่แดง · ผ้าปิดเข่าลายเกล็ด', 'จานเทพเรืองแสง · ผ้าปิดเข่าลายดาว · ชายผ้าเทพ'],
    shoulder: ['', 'หมวกไหล่ผ้า', 'หัวไหล่หนังขอบขนเสือ', 'หัวไหล่เหล็กสามชั้น', 'หัวไหล่ไหมรูปเมฆ · พู่แดง', 'หัวไหล่หยกเมฆสองชั้น', 'หัวไหล่มังกรทองมีเขา', 'หัวไหล่กลีบบัวสวรรค์ · กลีบลอย'],
  };
  // all garb pieces onto the sheet; returns a canvas with only the pauldrons (mask for their grade light)
  function garb(sheet, key, faction, looks) {
    const R = regionsFor(key);
    if (!R) return null;
    const body = looks[0], sh = looks[3];
    const sg = sheet.getContext('2d');
    const P = sh ? mk(sheet.width, sheet.height) : null, pg = P && P.getContext('2d');
    R.I.frames.forEach((F, f) => {
      const A = anchors(R, f);
      if (!A) return;
      const cell = (g, fn) => { g.save(); g.beginPath(); g.rect(F.X, F.Y, R.I.fw, R.I.fh); g.clip(); g.translate(F.X, F.Y); fn(g); g.restore(); };
      if (body && body.tier >= 7 && tao()) cell(sg, (g) => {   // นักพรต: behind the body (in front of the back on back views)
        if (F.view !== 'back') g.globalCompositeOperation = 'destination-over';
        pibo(g, A, faction);
      });
      if (body) cell(sg, (g) => {
        const t = body.tier, col = body.col.hex;
        if (t >= 4) {
          const len = A.B * (0.16 + (t - 4) * 0.05);
          const cols = tao() && t >= 6 ? (faction === 'adharma' ? (t === 7 ? ['#1a0608', '#ff3a1a'] : ['#140c0e', '#a0101c']) : t === 7 ? ['#ffffff', '#9fffd0'] : ['#ffffff', '#2ab884'])
            : t === 7 ? (faction === 'adharma' ? ['#2a0a10', '#ff3a5a'] : ['#ffffff', '#a8d8ff'])
            : t === 6 ? (faction === 'adharma' ? ['#1a1014', '#c3262c'] : ['#ffffff', '#3a7ad8']) : [mixHex(col, '#ffffff', 0.3), mixHex(col, '#000000', 0.3)];
          // twin blades: the tails trail behind the legs (they covered the trousers in front views)
          if (!tao() && F.view !== 'back') { g.save(); g.globalCompositeOperation = 'destination-over'; }
          sashTails(g, A, len, cols, t >= 6 ? '#ffd76a' : '#e8c86a');
          if (!tao() && F.view !== 'back') g.restore();
        }
        if (t >= 5) apron(g, t, A, col, faction);
        beltPiece(g, t, A, col, faction);
      });
      if (sh) cell(pg, (g) => {
        if (tao()) return taoShawl(g, A, sh, faction);
        const s = A.B * 0.04 * (1 + (sh.tier - 1) * 0.05);
        for (const [x, y, k] of A.shoulders) pauldron(g, sh.tier, x, y, s, k, sh.col.hex, faction);
      });
    });
    if (P) sg.drawImage(P, 0, 0);
    return P;
  }

  // ------------------------------------------------------------ grade light: an outline around the character
  // A ring just outside the silhouette of every frame (the sheet dilated by r px minus the sheet itself), plus a
  // soft glow of the same colour from Legendary. Thickness / glow per grade, in sheet px (frames are drawn ~2.6x smaller).
  const RIM_R = [0, .9, 1.45, 2.05, 2.8, 3.6];
  const RIM_BLUR = [0, .2, .35, .6, 1, 1.5];
  const RIM_ALPHA = [0, .18, .23, .27, .30, .32];
  const RIM_PAD = 16;
  const rims = new WeakMap();
  function outline(sheet, col, grade, cls, pose) {
    let m = rims.get(sheet);
    if (!m) { m = new Map(); rims.set(sheet, m); }
    const key = col + grade + '|' + pose;
    if (m.has(key)) return m.get(key);
    const info = ModelTiers.info(pose), fw = info?.fw || sheet.width, fh = info?.fh || sheet.height;
    const pw = fw + RIM_PAD * 2, ph = fh + RIM_PAD * 2;
    const cols = Math.round(sheet.width / fw), rows = Math.round(sheet.height / fh);
    const out = mk(cols * pw, rows * ph), og = out.getContext('2d');
    const body = mk(pw, ph), bg = body.getContext('2d'), tint = mk(pw, ph), tg = tint.getContext('2d');
    const ring = mk(pw, ph), rg = ring.getContext('2d'), soft = mk(pw, ph), sg = soft.getContext('2d');
    for (let row = 0; row < rows; row++) for (let column = 0; column < cols; column++) {
      for (const ctx of [bg,tg,rg,sg]) { ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,pw,ph); }
      // Copy the pose FIRST. Dilation and blur never see a neighbouring animation cell.
      bg.drawImage(sheet,column*fw,row*fh,fw,fh,RIM_PAD,RIM_PAD,fw,fh);
      tg.drawImage(body,0,0);tg.globalCompositeOperation='source-in';tg.fillStyle=col;tg.fillRect(0,0,pw,ph);
      for(const radius of [RIM_R[grade], RIM_R[grade]*.5])for(let i=0;i<16;i++){
        const a=i*TAU/16;rg.drawImage(tint,Math.cos(a)*radius,Math.sin(a)*radius);
      }
      rg.globalCompositeOperation='destination-out';rg.drawImage(body,0,0);
      sg.filter=`blur(${RIM_BLUR[grade]}px)`;sg.drawImage(ring,0,0);sg.filter='none';
      // Cut the body out AFTER the blur too. Light cannot wash out opaque costume pixels.
      sg.globalCompositeOperation='destination-out';sg.drawImage(body,0,0);
      og.globalAlpha=RIM_ALPHA[grade];og.drawImage(soft,column*pw,row*ph);
    }
    const result = { img: out, pad: RIM_PAD, fw: pw, fh: ph };
    m.set(key, result);
    return result;
  }

  // drawn on top of everything (after capes): the chest medallion of tier 5+ shirts
  function armourTop(sheet, key, shirt) {
    const R = regionsFor(key);
    if (!R) return;
    const g = sheet.getContext('2d');
    R.I.frames.forEach((F) => {
      if (!F) return;
      g.save(); g.beginPath(); g.rect(F.X, F.Y, R.I.fw, R.I.fh); g.clip(); g.translate(F.X, F.Y);
      if (F.view === 'front') {
        const x = F.cx, y = F.y0 + F.BH * 0.585, r = F.BH * 0.03;
        g.fillStyle = metal(g, 'gold', x - r, y - r, x + r, y + r); g.beginPath(); g.arc(x, y, r * 1.35, 0, TAU); g.fill();
        g.strokeStyle = OUT; g.lineWidth = F.BH * 0.005; g.stroke();
        if (tao()) taiji(g, x, y, r * 0.95, '#f6f6f0', '#16161e');    // นักพรต: a taiji badge
        else gem(g, x, y, r * 0.8, shirt.col.hex);
      }
      g.restore();
    });
  }

  // body sheet for a faction / pose: the set outfit (patterns, garb) + the level look (ModelTiers), and the grade
  // outline; gg = grades per equipment slot [weapon, body, legs, arms, shoulder]
  // returns { sheet, rim?, lightTop }
  AL.sheet = function (faction, atk, ar, tier = 0, gg, cls, weaponTier = 0) {
    ar = ar && ar.map(t => t === 10 ? t : C.armorLookTier(t));
    const own = !!sheetOf(cls), base = baseOf(faction, atk, cls);   // นักพรต / นักธนู: keep their drawn hair (own)
    const armoured = ar && ar.some((t) => t);
    // highest grade worn (the weapon always counts, armour only where a piece is worn)
    const top = gg ? Math.max(gg[0] || 0, ...[0, 1, 2, 3].map((j) => (ar && ar[j] ? gg[j + 1] || 0 : 0))) : 0;
    // the grade outline follows the body + armour (v.rimSrc for the twin blades: the sheet before the level look's
    // halo disc, scarf and ribbons, plus the pauldrons), so those pieces do not grow a thick outline behind the body
    const lit = (v) => {
      if (!top) return { sheet: v.sheet, lightTop: 0 };
      const rim = outline(v.rimSrc || v.sheet, AL.lightOf(faction, top, cls), top, cls, pose);
      return { sheet: v.sheet, rim: rim.img, rimMeta: rim, lightTop: top };
    };
    const key = `${cls || 'dualblade'}|${faction}|${atk ? 1 : 0}|${armoured ? ar.join(',') : '-'}|${tier}|${own ? weaponTier : 0}`;
    const pose = poseKey(faction, atk, cls);
    let v = AL.cache.get(key);
    if (v) { AL.cache.delete(key); AL.cache.set(key, v); }
    else if (!own && window.DualbladeLook) {
      // Dual blades own the complete garment masks. Do not place generic endgame badges over their body.
      const R = window.DualbladeModel?.ready ? null : regionsFor(pose);
      v = { sheet: DualbladeLook.compose(base, faction, pose, tier, ar, masks[pose], R, f => R && anchors(R,f)) };
      v.rimSrc = v.sheet;
      AL.cache.set(key, v);
      if (AL.cache.size > 24) AL.cache.delete(AL.cache.keys().next().value);
    } else if(cls==='archer'&&window.ArcherModel?.ready){
      v={sheet:ArcherModel.compose(faction,atk,tier,ar,weaponTier)};v.rimSrc=v.sheet;
      AL.cache.set(key,v);if(AL.cache.size>24)AL.cache.delete(AL.cache.keys().next().value);
    } else if (armoured && ar.some(t => t >= 8 && t <= 9)) {
      let source;
      if (cls === 'spearman') source = SpearmanLook.compose(base, faction, pose, tier, ar, weaponTier);
      else if (cls === 'archer') {
        source = ArcherGear.compose(faction, atk, ar, weaponTier) || base;
        if (ModelTiers.ready(pose)) source = ModelTiers.compose(source, faction, pose, tier, true);
        source = ArcherPose.compose(source, pose);
      } else {
        source = AL.sheet(faction, atk, ar.map(t => t === 10 ? t : Math.min(7, t)), tier, null, cls, weaponTier).sheet;
        const M = masks[pose], I = ModelTiers.info(pose);
        if (M && I) {
          const canvas = mk(source.width, source.height), ctx = canvas.getContext('2d');ctx.drawImage(source,0,0);
          const data = ctx.getImageData(0,0,canvas.width,canvas.height), protectedPixels = new Set([...I.hair,...I.eyes]);
          const palette = ar.map(t => t>=8 && t<=9 ? AscendedGear.palette(faction,t).cloth.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)) : null);
          for(let i=0;i<data.data.length;i+=4){
            if(!M.a[i+3] || !data.data[i+3] || protectedPixels.has(i/4))continue;
            const slot=M.a[i]>=200||M.a[i]===90?0:M.a[i+1]?1:M.a[i+2]?2:-1,P=palette[slot];if(!P)continue;
            const lum=(Math.max(data.data[i],data.data[i+1],data.data[i+2])+Math.min(data.data[i],data.data[i+1],data.data[i+2]))/510;
            if(lum<.12)continue;
            for(let k=0;k<3;k++)data.data[i+k]=Math.min(255,P[k]*(.35+lum*.75)+(faction==='adharma'?lum*36:0));
          }
          ctx.putImageData(data,0,0);source=canvas;
        }
      }
      v = { sheet: AscendedGear.compose(source, pose, cls || 'dualblade', faction, ar) };
      v.rimSrc = v.sheet;
      AL.cache.set(key, v);
      if (AL.cache.size > 24) AL.cache.delete(AL.cache.keys().next().value);
    } else if (cls === 'spearman') {
      v = { sheet: SpearmanLook.compose(base, faction, pose, tier, ar, weaponTier) };
      AL.cache.set(key, v);
      if (AL.cache.size > 24) AL.cache.delete(AL.cache.keys().next().value);
    } else if (cls === 'archer' && window.ArcherGear) {
      const outfit = ArcherGear.compose(faction, atk, ar, weaponTier) || base;
      v = { sheet: window.ModelTiers && ModelTiers.ready(pose) ? ModelTiers.compose(outfit, faction, pose, tier, true) : outfit };
      v.sheet = ArcherPose.compose(v.sheet, pose);
      AL.cache.set(key, v);
      if (AL.cache.size > 24) AL.cache.delete(AL.cache.keys().next().value);
    } else {
      CLS = own ? cls : null;
      const looks = armoured ? AL.looks(faction, ar) : null;
      v = armoured ? build(faction, atk, ar, cls) : { sheet: base };
      if (looks && looks[0]) shirtPattern(v.sheet, pose, looks[0].tier, faction, looks[0]);
      if (looks && (looks[1] || looks[2])) limbPieces(v.sheet, pose, faction, looks);
      const body = v.sheet;
      if (window.ModelTiers && ModelTiers.ready(pose))       // level look (hair colour, crowns, ribbons) from tier 1
        v = { sheet: ModelTiers.compose(v.sheet, faction, pose, tier, own, { noScarf: !!(ar && (ar[0] || ar[3])) }) };
      if (!own) v.rimSrc = body;
      if (!own && looks && looks[0] && looks[0].tier >= 5) armourTop(v.sheet, pose, looks[0]);
      if (looks && v.sheet !== base) v.pauldrons = garb(v.sheet, pose, faction, looks);
      if (!own && v.pauldrons && body !== base) body.getContext('2d').drawImage(v.pauldrons, 0, 0);   // outline them too
      // Fasten the medallion over the cape, rather than hiding it under the shawl.
      if (own && looks && looks[0] && looks[0].tier >= 5) armourTop(v.sheet, pose, looks[0]);
      if (cls === 'taoist' && window.TaoistGear && weaponTier) v.sheet = TaoistGear.decorate(v.sheet, pose, weaponTier);
      AL.cache.set(key, v);
      if (AL.cache.size > 24) AL.cache.delete(AL.cache.keys().next().value);
    }
    return lit(v);
  };

  AL.iconSrc = (id, faction) => ItemArt.iconSrc(id, faction);
})();
