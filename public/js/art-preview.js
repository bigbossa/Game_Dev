(function () {
  const canvas = document.getElementById('scene'), g = canvas.getContext('2d');
  const select = document.getElementById('map'), cards = document.getElementById('creatures');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let moving = !reduce, time = 0, previous = 0, terrain, props, ids, portraits = [];
  const N = 24, H = 12, T = C.T, tile = C.TILE;
  Art.buildProps();
  for (const id of C.MAP_ORDER) {
    const option = document.createElement('option'); option.value = id; option.textContent = C.MAPS[id].name; select.append(option);
  }
  function build() {
    const def = C.MAPS[select.value];
    Art.setMap(def);
    ids = [...(def.mons || ['spirit', 'boar', 'wolf', 'golem']), def.boss || 'boss'];
    document.getElementById('place').textContent = `${def.name} · ${C.levelText(def)}`;
    const tiles = new Uint8Array(N * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < N; x++) {
      const river = 16 + Math.round(Math.sin(y * .45));
      tiles[y * N + x] = x >= river && x < river + 3 ? (y === 6 || y === 7 ? T.BRIDGE : T.WATER)
        : y === 6 || y === 7 ? T.PATH : x > 20 && y < 3 ? T.CLIFF : T.GRASS;
    }
    const map = { w: N, h: H, tiles, solid: new Uint8Array(N * H) };
    terrain = document.createElement('canvas'); terrain.width = N * tile; terrain.height = H * tile;
    const tg = terrain.getContext('2d');
    for (let cy = 0; cy < Math.ceil(H / Art.CHUNK); cy++) for (let cx = 0; cx < Math.ceil(N / Art.CHUNK); cx++)
      tg.drawImage(Art.renderChunk(map, cx, cy), cx * Art.CHUNK * tile, cy * Art.CHUNK * tile);
    const trees = Art.theme().trees || [0, 2, 1];
    const objects = [
      ['tree', trees[0], 80, 165], ['tree', trees[1 % trees.length], 185, 125], ['tree', trees[2 % trees.length], 355, 145],
      ['tree', trees[0], 700, 135], ['tree', trees[1 % trees.length], 1030, 225],
      ['tree', trees[2 % trees.length], 85, 500], ['tree', trees[0], 1060, 490],
      ['bush', 0, 280, 170], ['bush', 0, 620, 215], ['bush', 1, 940, 470],
      ['rock', 0, 460, 160], ['rock', 1, 730, 445], ['mush', 0, 120, 210], ['mush', 1, 305, 465],
      ['house', Art.theme().house || 0, 530, 200],
    ];
    props = objects.map(o => ({ x: o[2], y: o[3], sp: Art.propSprite(o) }));
    cards.replaceChildren();
    portraits = ids.map(id => {
      const def = C.MONSTERS[id], article = document.createElement('article'), c = document.createElement('canvas');
      c.width = 320; c.height = 246;
      const title = document.createElement('strong'); title.textContent = def.name;
      const level = document.createElement('small'); level.textContent = `Lv.${def.lvl}${def.boss ? ' · บอส' : ''}`;
      article.append(c, title, level); cards.append(article);
      return { id, c, g: c.getContext('2d') };
    });
    draw();
  }
  function draw() {
    g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(terrain, 0, 0);
    const actors = ids.map((id, i) => ({ id, x: 160 + i * 135, y: i % 2 ? 428 : 335 }));
    for (const item of [...props, ...actors].sort((a, b) => a.y - b.y)) {
      if (item.sp) g.drawImage(item.sp.img, item.x - item.sp.ax, item.y - item.sp.ay);
      else MonsterArt.draw(g, item.id, item.x, item.y, 1, time, { seed: item.x, moving, atk: 0, flash: 0 });
    }
    for (const { id, c, g: cg } of portraits) {
      cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, c.width, c.height);
      cg.fillStyle = '#eef1e4'; cg.beginPath(); cg.ellipse(160, 210, 74, 16, 0, 0, Math.PI * 2); cg.fill();
      const scale = Math.min(2.65, 170 / MonsterArt.heightOf(id));
      cg.translate(160, 202); cg.scale(scale, scale);
      MonsterArt.draw(cg, id, 0, 0, 1, time, { seed: 1, moving, atk: 0, flash: 0 });
    }
  }
  function buttonLabel() {
    document.getElementById('motion').textContent = moving ? 'หยุดการเคลื่อนไหว' : 'เล่นการเคลื่อนไหว';
    document.getElementById('motion').setAttribute('aria-pressed', String(moving));
  }
  select.addEventListener('change', build);
  document.getElementById('motion').addEventListener('click', () => { moving = !moving; buttonLabel(); draw(); });
  select.value = 'village'; build(); buttonLabel();
  function frame(now) {
    if (moving && !document.hidden) { time += Math.min((now - previous) / 1000, .05); draw(); }
    previous = now; requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
