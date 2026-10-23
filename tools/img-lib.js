// Shared image helpers for the asset build scripts (pure JS, works on {w, h, d} RGBA images).
const fs = require('fs');
const { PNG } = require('pngjs');

const N4 = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

const readPng = (file) => PNG.sync.read(fs.readFileSync(file));
function writePng(file, w, h, data) {
  const png = new PNG({ width: w, height: h });
  png.data = Buffer.from(data);
  fs.writeFileSync(file, PNG.sync.write(png));
}

function crop(src, x0, y0, x1, y1) {
  const W = src.width;
  const w = x1 - x0, h = y1 - y0;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * 4, di = (y * w + x) * 4;
      out[di] = src.data[si]; out[di + 1] = src.data[si + 1];
      out[di + 2] = src.data[si + 2]; out[di + 3] = 255;
    }
  return { w, h, d: out };
}
const cloneImg = (img) => ({ w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) });

// Flood-fill the light background from the crop border and make it transparent.
// opts: bgMin / bgChroma (background test), shadowFrom, loosePockets, glow
function removeBg(img, opts = {}) {
  const { w, h, d } = img;
  const bgMin = opts.bgMin ?? 228, bgChroma = opts.bgChroma ?? 20;
  const isBg = (i) => {
    const mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2]);
    return mn > bgMin && mx - mn < bgChroma;
  };
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (bg[k] || !isBg(k * 4)) return;
    bg[k] = 1; stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Soft grey drop shadow near the bottom
  if (opts.shadowFrom !== null) {
    const shadowY = Math.floor(h * (opts.shadowFrom ?? 0.8));
    const isShadow = (i) => {
      const mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2]);
      return mn > 192 && mx - mn < 36;
    };
    for (let k = shadowY * w; k < w * h; k++) if (bg[k]) stack.push(k);
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k / w) | 0;
      for (const [nx, ny] of N4(x, y)) {
        if (nx < 0 || ny < shadowY || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (!bg[nk] && isShadow(nk * 4)) { bg[nk] = 1; stack.push(nk); }
      }
    }
  }
  // Enclosed pockets of paper-white
  const seen = new Uint8Array(w * h);
  for (let k0 = 0; k0 < w * h; k0++) {
    if (bg[k0] || seen[k0] || !isBg(k0 * 4)) continue;
    const comp = [k0]; seen[k0] = 1; let pure = 0, sumMin = 0;
    for (let n = 0; n < comp.length; n++) {
      const k = comp[n], x = k % w, y = (k / w) | 0, i = k * 4;
      const mnv = Math.min(d[i], d[i + 1], d[i + 2]); sumMin += mnv; if (mnv >= (opts.pureMin ?? 250)) pure++;
      for (const [nx, ny] of N4(x, y)) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (!seen[nk] && !bg[nk] && isBg(nk * 4)) { seen[nk] = 1; comp.push(nk); }
      }
    }
    const pr = pure / comp.length, mean = sumMin / comp.length;
    const loose = opts.loosePockets && ((pr > 0.6 && comp.length > 40) || (comp.length > 300 && mean >= 248.5));
    if ((pr > 0.92 && comp.length > 12) || loose) for (const k of comp) bg[k] = 1;
  }
  // Light-blue/violet glow touching the background -> semi-transparent (un-blend the paper colour)
  if (opts.glow) {
    // glow: true = light-blue/violet (ธรรมะ) · 'red' = pink/crimson (อธรรม)
    const isGlow = opts.glow === 'red'
      ? (i) => d[i] > 200 && d[i] >= d[i + 2] + 10 && d[i + 1] > 90
      : (i) => d[i + 2] > 200 && d[i + 2] >= d[i] + 10 && d[i] > 120;
    const glow = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) if (bg[k]) stack.push(k);
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k / w) | 0;
      for (const [nx, ny] of N4(x, y)) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (!bg[nk] && !glow[nk] && isGlow(nk * 4)) { glow[nk] = 1; stack.push(nk); }
      }
    }
    for (let k = 0; k < w * h; k++) {
      if (!glow[k]) continue;
      const i = k * 4;
      const a = Math.max(0.04, Math.min(1, (255 - d[i]) / 200));
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, 255 - (255 - d[i + c]) / a));
      d[i + 3] = Math.round(a * 255);
    }
  }
  for (let k = 0; k < w * h; k++) if (bg[k]) d[k * 4 + 3] = 0;
  // Soften the light halo on edges next to the background
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x; if (bg[k]) continue;
      let nb = 0;
      for (const [nx, ny] of N4(x, y))
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) nb++;
      if (!nb) continue;
      const i = k * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (l > 200) d[i + 3] = Math.min(d[i + 3], Math.max(0, Math.min(255, (255 - l) * 4.5)));
    }
  return img;
}

function bbox(img) {
  const { w, h, d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

function blit(dst, dw, dh, img, ox, oy) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const dx = ox + x, dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      const si = (y * img.w + x) * 4; if (img.d[si + 3] === 0) continue;
      const di = (dy * dw + dx) * 4;
      dst[di] = img.d[si]; dst[di + 1] = img.d[si + 1]; dst[di + 2] = img.d[si + 2]; dst[di + 3] = img.d[si + 3];
    }
}

// Box-filter downscale with premultiplied alpha
function scaleImg(img, s) {
  const w2 = Math.max(1, Math.round(img.w * s)), h2 = Math.max(1, Math.round(img.h * s));
  const out = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y2 = 0; y2 < h2; y2++) {
    const sy0 = y2 / s, sy1 = (y2 + 1) / s;
    for (let x2 = 0; x2 < w2; x2++) {
      const sx0 = x2 / s, sx1 = (x2 + 1) / s;
      let r = 0, g = 0, b = 0, a = 0, wt = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1) && sy < img.h; sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1) && sx < img.w; sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          const wgt = wx * wy, i = (sy * img.w + sx) * 4, al = img.d[i + 3] / 255;
          r += img.d[i] * al * wgt; g += img.d[i + 1] * al * wgt; b += img.d[i + 2] * al * wgt;
          a += al * wgt; wt += wgt;
        }
      }
      const o = (y2 * w2 + x2) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = (a / wt) * 255; }
    }
  }
  return { w: w2, h: h2, d: out };
}

// ---- colour ----
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const dd = mx - mn;
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    if (mx === r) h = (g - b) / dd + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / dd + 2;
    else h = (r - g) / dd + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// Steel blades: thin, elongated grey components (works for any pose).
// opts: minL, maxThick, minElong, minSize, exclude [x0,y0,x1,y1] (e.g. the head, whose hair highlights look like blades)
function bladeMaskShape(img, opts = {}) {
  const { w, h, d } = img;
  const minL = opts.minL ?? 0.42, maxThick = opts.maxThick ?? 13, minElong = opts.minElong ?? 3.2;
  const cand = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const i = k * 4; if (d[i + 3] < 40) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const l = (mx + mn) / 510, chroma = (mx - mn) / 255;
    const ex = opts.exclude, x = k % w, y = (k / w) | 0;
    if (ex && x >= ex[0] && x <= ex[2] && y >= ex[1] && y <= ex[3]) continue;
    if (l > minL && chroma < 0.15 && d[i] <= d[i + 2] + 24) cand[k] = 1;
  }
  const m = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  for (let k0 = 0; k0 < w * h; k0++) {
    if (!cand[k0] || seen[k0]) continue;
    const comp = [k0]; seen[k0] = 1;
    let sx = 0, sy = 0;
    for (let n = 0; n < comp.length; n++) {
      const k = comp[n], x = k % w, y = (k / w) | 0; sx += x; sy += y;
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (cand[nk] && !seen[nk]) { seen[nk] = 1; comp.push(nk); }
      }
    }
    if (comp.length < (opts.minSize ?? 20)) continue;
    const mx = sx / comp.length, my = sy / comp.length;
    let cxx = 0, cyy = 0, cxy = 0;
    for (const k of comp) { const x = (k % w) - mx, y = ((k / w) | 0) - my; cxx += x * x; cyy += y * y; cxy += x * y; }
    cxx /= comp.length; cyy /= comp.length; cxy /= comp.length;
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(0.01, tr / 2 - disc);
    const length = 4 * Math.sqrt(l1), thick = comp.length / length;
    if (Math.sqrt(l1 / l2) > minElong && thick < maxThick) for (const k of comp) m[k] = 1;
  }
  return m;
}

// Blade layer: luminance in RGB, original alpha where the mask is set, transparent elsewhere.
function bladeLayer(img, mask) {
  const out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.w * img.h * 4) };
  for (let k = 0; k < img.w * img.h; k++) {
    if (!mask[k]) continue;
    const i = k * 4;
    const l = 0.3 * img.d[i] + 0.59 * img.d[i + 1] + 0.11 * img.d[i + 2];
    const v = Math.max(0, Math.min(255, (l - 70) * 1.35)); // stretch steel range to full contrast
    out.d[i] = out.d[i + 1] = out.d[i + 2] = v;
    out.d[i + 3] = img.d[i + 3];
  }
  return out;
}

// A few evenly spread points on the blade (for particle emitters), relative to (ax, ay)
function samplePoints(layer, ax, ay, n = 8) {
  const pts = [];
  for (let y = 0; y < layer.h; y++) for (let x = 0; x < layer.w; x++)
    if (layer.d[(y * layer.w + x) * 4 + 3] > 100) pts.push([x - ax, y - ay]);
  if (!pts.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(((i + 0.5) / n) * pts.length)]);
  return out;
}

module.exports = {
  N4, N8, readPng, writePng, crop, cloneImg, removeBg, bbox, blit, scaleImg,
  rgb2hsl, hsl2rgb, bladeMaskShape, bladeLayer, samplePoints,
};
