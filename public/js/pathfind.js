// Click-to-move pathfinding: A* over the tile grid (8 directions, no corner cutting),
// then string-pulled so the character walks straight wherever the way is clear.
(function () {
  const PF = {};
  window.PF = PF;
  const T = C.TILE;
  const SQ2 = Math.SQRT2;
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

  const walkable = (map, tx, ty) => tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && !map.solid[ty * map.w + tx];

  // straight line is walkable for the player's feet box
  PF.clear = function (map, x0, y0, x1, y1) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 10));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!C.canStand(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  };

  // nearest walkable tile to (tx, ty) within r tiles
  function nearestWalkable(map, tx, ty, r = 4) {
    if (walkable(map, tx, ty)) return [tx, ty];
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (d < bd && walkable(map, tx + dx, ty + dy)) { bd = d; best = [tx + dx, ty + dy]; }
    }
    return best;
  }

  // binary min-heap of [f, idx]
  function Heap() { this.a = []; }
  Heap.prototype.push = function (f, i) {
    const a = this.a; a.push([f, i]);
    let k = a.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; }
  };
  Heap.prototype.pop = function () {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]]; k = m;
      }
    }
    return top;
  };

  // returns waypoints [[x,y],...] (excluding the start) or null when unreachable
  PF.find = function (map, sx, sy, gx, gy, maxNodes = 16000) {
    if (PF.clear(map, sx, sy, gx, gy)) return [[gx, gy]];
    const s = nearestWalkable(map, Math.floor(sx / T), Math.floor(sy / T), 1);
    const g = nearestWalkable(map, Math.floor(gx / T), Math.floor(gy / T));
    if (!s || !g) return null;
    const W = map.w, N = map.w * map.h;
    const start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const h = (i) => {
      const dx = Math.abs((i % W) - g[0]), dy = Math.abs(((i / W) | 0) - g[1]);
      return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
    };
    const open = new Heap();
    gScore[start] = 0;
    open.push(h(start), start);
    let found = false, visited = 0;
    while (open.a.length && visited < maxNodes) {
      const [, cur] = open.pop();
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1; visited++;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!walkable(map, nx, ny)) continue;
        if (dx && dy && (!walkable(map, cx + dx, cy) || !walkable(map, cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const ng = gScore[cur] + cost;
        if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; open.push(ng + h(ni), ni); }
      }
    }
    if (!found) return null;
    const tiles = [];
    for (let i = goal; i !== -1 && i !== start; i = came[i]) tiles.push(i);
    tiles.reverse();
    const pts = tiles.map((i) => [(i % W) * T + T / 2, ((i / W) | 0) * T + T / 2]);
    if (C.canStand(map, gx, gy) && Math.floor(gx / T) === g[0] && Math.floor(gy / T) === g[1]) pts[pts.length - 1] = [gx, gy];
    if (!pts.length) pts.push([g[0] * T + T / 2, g[1] * T + T / 2]);
    // string pulling
    const out = [];
    let cx = sx, cy = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !PF.clear(map, cx, cy, pts[j][0], pts[j][1])) j--;
      out.push(pts[j]);
      [cx, cy] = pts[j];
      i = j + 1;
    }
    return out;
  };
})();
