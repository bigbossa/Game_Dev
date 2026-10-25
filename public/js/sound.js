// Game sound with Web Audio, everything made in code (no sound files to download or license).
// - effects: attacks and skills (each class its own: blades, talismans and thunder, bow, spear, shield, holy bell),
//   hits / crits / getting hit, loot and gold, potions, level up, enhancement, death, teleport, monster windups,
//   buttons. They come from the socket events the game already gets (listeners added here, after main.js's own),
//   panned left / right and quieter with distance; other players' sounds are softer and can be switched off.
// - music: generated as it plays, Chinese pentatonic: a plucked zither (กู่เจิง) melody with slides and tremolo,
//   a soft drone, a bamboo flute in calm places and drums on the battlefield. The mood follows the character:
//   login · camp (safe zone) · hunting map · PvP map · near a boss, with a short crossfade.
// - volumes / switches: SET (settings.js). Browsers only allow sound after the first tap or key press.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const SFX = (window.SFX = { play() {}, test() {}, mood: '' });
  if (!AC) return;

  let ctx = null, master, bus, revIn, noiseBuf, meter;
  const vol = (k) => Math.pow((SET.get(k) || 0) / 100, 2);           // slider % → gain (ears hear ratios)
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(SET.get('sound') ? vol('master') : 0, t, 0.05);
    for (const k of ['music', 'sfx', 'ui']) bus[k].gain.setTargetAtTime(vol(k), t, 0.05);
  }
  SET.on(applyVolumes);

  // ------------------------------------------------------------ audio graph (made on the first tap / key)
  // buses → master → limiter → speakers, plus a hall reverb fed from the music (a lot) and the effects (a little)
  function init() {
    if (ctx) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    master = ctx.createGain();
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 8; lim.ratio.value = 10; lim.attack.value = 0.003; lim.release.value = 0.2;
    master.connect(lim).connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 2048; lim.connect(meter);
    bus = { music: ctx.createGain(), sfx: ctx.createGain(), ui: ctx.createGain() };
    for (const b of Object.values(bus)) b.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const rev = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    rev.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 0.5;
    revIn.connect(rev).connect(master);
    const send = (from, amount) => { const g = ctx.createGain(); g.gain.value = amount; from.connect(g).connect(revIn); };
    send(bus.music, 0.55); send(bus.sfx, 0.12); send(bus.ui, 0.15);
    applyVolumes();
  }
  const running = () => ctx && ctx.state === 'running';
  function wake() {
    init();
    if (ctx && ctx.state !== 'running' && !(document.hidden && SET.get('bgMute'))) ctx.resume().catch(() => {});
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, wake, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden && SET.get('bgMute')) ctx.suspend().catch(() => {});
    else if (!document.hidden) ctx.resume().catch(() => {});
  });

  // ------------------------------------------------------------ building blocks
  // tone: one oscillator with a quick attack and an exponential fade (f1 = slide to, lp = low-pass filter)
  function tone(o, t, { type = 'sine', f, f1, dur, peak = 0.3, a = 0.005, lp, q = 0.7, detune = 0, glide }) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.detune.value = detune;
    if (glide) { osc.frequency.setValueAtTime(glide, t); osc.frequency.linearRampToValueAtTime(f, t + 0.08); }
    else osc.frequency.setValueAtTime(f, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src = osc;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; osc.connect(fl); src = fl; }
    src.connect(g).connect(o);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // hiss: filtered noise (swooshes, impacts, crackle); f → f1 sweeps the filter
  function hiss(o, t, { dur, peak = 0.3, a = 0.005, type = 'bandpass', f = 1000, f1, q = 1 }) {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(o);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  // bell / gong / metal: inharmonic partials, the high ones fade first
  function bell(o, t, f, dur, peak, ratios = [1, 2, 2.76, 5.4], amps = [1, 0.55, 0.35, 0.18]) {
    ratios.forEach((r, i) => tone(o, t, { f: f * r, dur: dur / (1 + i * 0.6), peak: peak * amps[i % amps.length], a: 0.003 }));
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
  function sparkle(o, t, from, n, peak = 0.1, step = 0.05) {
    for (let i = 0; i < n; i++) {
      const f = PENTA[Math.min(PENTA.length - 1, from + i)];
      tone(o, t + i * step, { f, dur: 0.5, peak }); tone(o, t + i * step, { f: f * 2, dur: 0.3, peak: peak * 0.3 });
    }
  }

  // ------------------------------------------------------------ the sounds  (o = output node, t = start time, x = extra)
  const R = {
    slash(o, t) { hiss(o, t, { dur: 0.16, peak: 0.75, f: 3800, f1: 700, q: 1.4 }); tone(o, t + 0.01, { f: 2350, dur: 0.22, peak: 0.03 }); tone(o, t + 0.01, { f: 3170, dur: 0.18, peak: 0.02 }); },
    slashHeavy(o, t) { hiss(o, t, { dur: 0.24, peak: 0.5, f: 2600, f1: 300, q: 1.1 }); tone(o, t + 0.02, { f: 150, f1: 60, dur: 0.18, peak: 0.25 }); tone(o, t + 0.02, { f: 1900, dur: 0.3, peak: 0.03 }); },
    swing(o, t) { hiss(o, t, { dur: 0.3, peak: 2, f: 500, f1: 2200, q: 0.7, a: 0.06 }); },
    spin(o, t) { for (let i = 0; i < 3; i++) hiss(o, t + i * 0.09, { dur: 0.2, peak: 1.1, f: 900 + i * 500, f1: 2800 + i * 400, q: 1.2, a: 0.03 }); },
    multi(o, t) { for (let i = 0; i < 4; i++) hiss(o, t + i * 0.075, { dur: 0.12, peak: 0.42 - i * 0.04, f: 4200 - i * 300, f1: 800, q: 1.4 }); },
    dash(o, t) { hiss(o, t, { dur: 0.28, peak: 1, f: 700, f1: 3200, q: 0.6, a: 0.05 }); },
    thrust(o, t) { hiss(o, t, { dur: 0.13, peak: 1, f: 2200, f1: 500, q: 1 }); tone(o, t, { f: 140, f1: 55, dur: 0.16, peak: 0.6 }); },
    smash(o, t) {
      tone(o, t, { f: 110, f1: 32, dur: 0.6, peak: 0.85 });
      hiss(o, t, { dur: 0.5, peak: 0.6, type: 'lowpass', f: 1500, f1: 110 });
      hiss(o, t + 0.02, { dur: 0.32, peak: 0.25, f: 320, q: 0.8 });
    },
    twang(o, t) {
      tone(o, t, { type: 'triangle', f: 330, f1: 290, dur: 0.32, peak: 0.2 }); tone(o, t, { type: 'sawtooth', f: 165, dur: 0.12, peak: 0.04, lp: 2200 });
      hiss(o, t, { dur: 0.03, peak: 0.16, type: 'highpass', f: 4000 }); tone(o, t + 0.03, { f: 2100, f1: 800, dur: 0.22, peak: 0.045 });
    },
    twangHeavy(o, t) { R.twang(o, t); tone(o, t, { type: 'triangle', f: 196, f1: 170, dur: 0.45, peak: 0.3 }); hiss(o, t + 0.04, { dur: 0.4, peak: 0.2, f: 900, f1: 2600, q: 2 }); },
    volley(o, t) { R.twang(o, t); for (let i = 1; i < 5; i++) tone(o, t + i * 0.05, { f: 1800 + Math.random() * 900, f1: 700, dur: 0.2, peak: 0.035 }); },
    magic(o, t) { hiss(o, t, { dur: 0.3, peak: 0.12, f: 5200, q: 2, a: 0.04 }); sparkle(o, t, 4, 3, 0.09, 0.04); },
    thunder(o, t) {
      hiss(o, t, { dur: 0.07, peak: 0.85, type: 'highpass', f: 2200 });
      hiss(o, t + 0.03, { dur: 1.3, peak: 0.7, type: 'lowpass', f: 900, f1: 60, a: 0.02 });
      tone(o, t + 0.03, { f: 70, f1: 34, dur: 0.9, peak: 0.55 });
    },
    fire(o, t) {
      hiss(o, t, { dur: 0.55, peak: 0.45, type: 'lowpass', f: 400, f1: 1800, a: 0.15 });
      hiss(o, t + 0.45, { dur: 0.7, peak: 0.4, type: 'lowpass', f: 1600, f1: 160 });
      tone(o, t + 0.4, { f: 95, f1: 38, dur: 0.6, peak: 0.55 });
    },
    heal(o, t) { [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(o, t + i * 0.07, { f, dur: 0.75, peak: 0.13, a: 0.02 })); hiss(o, t, { dur: 0.6, peak: 0.04, type: 'highpass', f: 6000, a: 0.2 }); },
    buff(o, t) {
      tone(o, t, { type: 'triangle', f: 330, f1: 660, dur: 0.6, peak: 0.22, a: 0.2 }); tone(o, t, { type: 'triangle', f: 333, f1: 666, dur: 0.6, peak: 0.17, a: 0.2, detune: 9 });
      sparkle(o, t + 0.32, 5, 3, 0.07, 0.05);
    },
    clang(o, t) { bell(o, t, 520, 0.7, 0.17, [1, 2.32, 3.86, 5.1, 6.7], [1, 0.7, 0.5, 0.35, 0.2]); hiss(o, t, { dur: 0.04, peak: 0.45, f: 3000, q: 0.8 }); tone(o, t, { f: 160, f1: 70, dur: 0.15, peak: 0.35 }); },
    bell(o, t) { bell(o, t, 660, 1.8, 0.2); },
    bellSmall(o, t) { bell(o, t, 1320, 0.9, 0.09); },
    roar(o, t) {
      tone(o, t, { type: 'sawtooth', f: 110, f1: 72, dur: 0.75, peak: 0.28, a: 0.08, lp: 650, q: 3 });
      tone(o, t, { type: 'sawtooth', f: 113, f1: 74, dur: 0.75, peak: 0.2, a: 0.08, lp: 900 });
      hiss(o, t, { dur: 0.65, peak: 0.22, type: 'lowpass', f: 800, a: 0.1 });
    },
    impact(o, t) { hiss(o, t, { dur: 0.07, peak: 0.55, type: 'lowpass', f: 2000, f1: 400 }); tone(o, t, { f: 170, f1: 60, dur: 0.12, peak: 0.42 }); },
    crit(o, t) { R.impact(o, t); hiss(o, t, { dur: 0.06, peak: 0.42, f: 5200, q: 1.2 }); tone(o, t, { f: 1760, dur: 0.3, peak: 0.07 }); tone(o, t + 0.04, { f: 2637, dur: 0.25, peak: 0.05 }); },
    hurt(o, t) { tone(o, t, { f: 95, f1: 45, dur: 0.22, peak: 0.55 }); hiss(o, t, { dur: 0.1, peak: 0.35, type: 'lowpass', f: 650 }); },
    claw(o, t) { hiss(o, t, { dur: 0.16, peak: 0.6, f: 1500, f1: 400, q: 0.8 }); tone(o, t + 0.05, { f: 120, f1: 60, dur: 0.1, peak: 0.15 }); },
    evade(o, t) { hiss(o, t, { dur: 0.2, peak: 0.25, f: 1200, f1: 3500, q: 1, a: 0.03 }); },
    poof(o, t) { hiss(o, t, { dur: 0.32, peak: 0.32, f: 900, f1: 180, q: 0.7 }); tone(o, t, { f: 240, f1: 110, dur: 0.22, peak: 0.1 }); },
    bossDie(o, t) { R.smash(o, t); R.smash(o, t + 0.25); bell(o, t + 0.1, 196, 3, 0.25, [1, 1.48, 2.02, 2.7], [1, 0.5, 0.4, 0.2]); },
    coin(o, t) { tone(o, t, { f: 2093, dur: 0.18, peak: 0.12 }); tone(o, t + 0.06, { f: 2637, dur: 0.3, peak: 0.11 }); hiss(o, t, { dur: 0.03, peak: 0.12, type: 'highpass', f: 6000 }); },
    drop(o, t, g = 0) {
      sparkle(o, t, Math.min(4, g), 2 + g, 0.08 + g * 0.012, 0.06);
      if (g >= 3) bell(o, t + 0.1, 880, 1.6, 0.12);
      if (g >= 5) { bell(o, t + 0.3, 1318.5, 2.2, 0.12); hiss(o, t, { dur: 1.2, peak: 0.06, type: 'highpass', f: 5000, a: 0.4 }); }
    },
    potion(o, t) { for (let i = 0; i < 3; i++) tone(o, t + i * 0.06, { f: 380 + i * 90, f1: 900 + i * 120, dur: 0.07, peak: 0.12 }); R.heal(o, t + 0.15); },
    levelUp(o, t) {
      [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.51].forEach((f, i) => tone(o, t + i * 0.065, { type: 'triangle', f, dur: 1, peak: 0.13 }));
      bell(o, t + 0.45, 1046.5, 2.4, 0.14); hiss(o, t + 0.3, { dur: 1.4, peak: 0.05, type: 'highpass', f: 5500, a: 0.5 });
      tone(o, t, { f: 130.8, dur: 1.4, peak: 0.25, a: 0.02 });
    },
    lvlOther(o, t) { sparkle(o, t, 3, 4, 0.06, 0.06); },
    equip(o, t) { hiss(o, t, { dur: 0.045, peak: 0.6, f: 2600, q: 1.5 }); hiss(o, t + 0.02, { dur: 0.16, peak: 0.35, f: 700, f1: 300 }); tone(o, t + 0.03, { f: 1400, dur: 0.15, peak: 0.08 }); },
    enhOk(o, t) { R.clang(o, t); bell(o, t + 0.2, 880, 1.6, 0.22); sparkle(o, t + 0.25, 4, 5, 0.07, 0.05); },
    enhFail(o, t) { R.clang(o, t); tone(o, t + 0.2, { type: 'triangle', f: 330, f1: 150, dur: 0.6, peak: 0.16 }); },
    enhBroke(o, t) { R.clang(o, t); hiss(o, t + 0.12, { dur: 0.3, peak: 0.55, type: 'highpass', f: 2600 }); tone(o, t + 0.12, { f: 600, f1: 90, dur: 0.5, peak: 0.15 }); },
    death(o, t) { bell(o, t, 110, 3.2, 0.32, [1, 2.02, 2.95, 4.1], [1, 0.5, 0.3, 0.15]); tone(o, t + 0.2, { type: 'triangle', f: 220, f1: 110, dur: 1.6, peak: 0.1, a: 0.3 }); },
    portal(o, t) { hiss(o, t, { dur: 0.7, peak: 0.45, f: 300, f1: 3200, q: 1.5, a: 0.25 }); sparkle(o, t + 0.35, 2, 5, 0.06, 0.06); },
    warn(o, t) { tone(o, t, { type: 'sawtooth', f: 70, f1: 92, dur: 0.75, peak: 0.12, a: 0.25, lp: 380, q: 4 }); },
    tick(o, t) { tone(o, t, { f: 1350, dur: 0.035, peak: 0.08 }); hiss(o, t, { dur: 0.015, peak: 0.04, type: 'highpass', f: 4000 }); },
    notify(o, t) { tone(o, t, { f: 880, dur: 0.25, peak: 0.12 }); tone(o, t + 0.11, { f: 1318.5, dur: 0.4, peak: 0.12 }); },
    announce(o, t) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(o, t + i * 0.09, { type: 'triangle', f, dur: 0.9, peak: 0.15, a: 0.02 }));
    },
    ritualStart(o, t, dur = 2.8) {
      tone(o, t, { type: 'sawtooth', f: 55, f1: 110, dur, peak: 0.16, a: dur * 0.6, lp: 500, q: 2 });
      tone(o, t, { f: 220, f1: 440, dur, peak: 0.06, a: dur * 0.7 });
      hiss(o, t, { dur, peak: 0.14, f: 200, f1: 2400, q: 1.5, a: dur * 0.8 });
    },
    ritualRelease(o, t) { R.smash(o, t); R.thunder(o, t + 0.05); bell(o, t + 0.1, 523.25, 2.5, 0.14); },
  };

  // each skill: recipe names, "@ms" = later (lands with the animation)
  const VOICE = {
    fang: 'slash', lotus: 'spin', shadowstep: 'dash slash@120', rend: 'slashHeavy', tempest: 'multi multi@320', crescent: 'slashHeavy',
    skyfall: 'dash smash@440', thousand: 'multi multi@300', twindragon: 'dash slashHeavy@200',
    jade: 'magic', skybolt: 'thunder', mercy: 'heal', aegis: 'buff', heavens: 'thunder thunder@350', spiritsword: 'magic slash@150',
    might: 'buff', meteor: 'fire', nirvana: 'heal buff@250',
    hawkshot: 'twang', scatter: 'volley', hawkeye: 'buff', gale: 'dash buff@120', skyrain: 'volley volley@260', deadeye: 'twangHeavy',
    rollshot: 'dash twang@220', blast: 'twang fire@150', stormphoenix: 'twangHeavy fire@220',
    spearThrust: 'swing', spearCrush: 'swing', spearChain: 'swing', spearBreak: 'swing', spearExecution: 'dash',
    spearHeart: 'swing', spearPin: 'swing', spearBoss: 'swing', spearHeaven: 'dash',
    guardSlash: 'slashHeavy', shieldBash: 'clang', ironGuard: 'clang buff@80', shieldSweep: 'slashHeavy clang@100', battleCry: 'roar',
    sunderStrike: 'swing smash@300', rallyGuard: 'buff bell@100', earthShatter: 'smash smash@260', lastBastion: 'clang buff@100',
    guardianOath: 'bell buff@100', citadelStrike: 'swing smash@300',
    oathBasic: 'slash bellSmall@40', oathSlash: 'slashHeavy bellSmall@40', oathResonance: 'bell', arcblade: 'slash magic@100',
    astralBlades: 'magic bellSmall@60', oathAegis: 'buff bell@80', bladeOrbit: 'spin bellSmall@60', ascendantForm: 'buff bell@150 roar@150',
    finalVerdict: 'bell',
  };
  const CLASS_VOICE = { dualblade: 'slash', taoist: 'magic', archer: 'twang', spearman: 'swing', warrior: 'slashHeavy', arbiter: 'slash bellSmall@40' };

  // ------------------------------------------------------------ playing
  const last = {};
  let burst = 0, burstT = 0;
  // where a sound comes from: quieter with distance, panned left / right of my character
  function place(x, y, mine) {
    const me = window.G && G.me;
    if (mine || !me) return { g: 1, pan: 0 };
    if (x === undefined) return { g: 0.4, pan: 0 };
    const d = Math.hypot(x - me.x, y - me.y);
    const g = d < 260 ? 1 : Math.max(0, 1 - (d - 260) / 900);
    return { g: g * g, pan: Math.max(-0.75, Math.min(0.75, (x - me.x) / 700)) };
  }
  // name: R recipe · opts: x, y (world) · mine (my own: full volume, never culled) · v (volume) · bus · gap (ms
  // between two of the same) · arg (passed to the recipe) · delay (ms)
  SFX.play = function (name, opts = {}) {
    if (!running() || !SET.get('sound') || !R[name]) return;
    const busName = opts.bus || 'sfx';
    if (!SET.get(busName)) return;
    if (!opts.mine && opts.other && !SET.get('others')) return;
    const now = performance.now(), key = name + (opts.mine ? '!' : '');
    if (opts.gap && now - (last[key] || 0) < opts.gap) return;
    if (now - burstT > 100) { burst = 0; burstT = now; }
    if (!opts.mine && ++burst > 10) return;                     // a crowded fight: keep it from turning into noise
    last[key] = now;
    const p = place(opts.x, opts.y, opts.mine), v = (opts.v ?? 1) * p.g * (opts.mine ? 1 : 0.55);
    if (v < 0.02) return;
    const out = ctx.createGain();
    out.gain.value = v;
    if (p.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = p.pan; out.connect(pn).connect(bus[busName]); }
    else out.connect(bus[busName]);
    R[name](out, ctx.currentTime + 0.01 + (opts.delay || 0) / 1000, opts.arg);
  };
  function voice(spec, opts) {
    for (const part of spec.split(' ')) { const [n, ms] = part.split('@'); SFX.play(n, { ...opts, delay: +ms || 0 }); }
  }
  SFX.skill = function (id, opts) {
    const sk = C.ALL_SKILLS[id];
    const spec = VOICE[id] || (sk && CLASS_VOICE[sk.cls]);
    if (spec) voice(spec, opts);
  };
  // for check scripts: the loudest sample at the speakers right now (0..1) and the audio state
  SFX.meter = function () {
    if (!meter) return 0;
    const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a);
    let p = 0; for (const v of a) p = Math.max(p, Math.abs(v));
    return p;
  };
  SFX.state = () => (ctx ? ctx.state : 'none');
  SFX.recipes = () => Object.keys(R);
  SFX.test = function () {
    wake();
    setTimeout(() => {
      SFX.play('slash', { mine: true }); SFX.play('crit', { mine: true, delay: 140 });
      SFX.play('levelUp', { mine: true, delay: 500 }); SFX.play('tick', { mine: true, bus: 'ui', delay: 1700 });
    }, 60);
  };

  // ------------------------------------------------------------ game events (main.js handles the picture first)
  const ent = (id) => window.G && G.ents.get(id);
  const isMe = (id) => window.G && id === G.myId;
  function hook() {
    const s = G.socket;
    s.on('hit', (d) => {
      const e = ent(d.id);
      if (!e) return;
      if (isMe(d.id)) { if (d.k !== 1) SFX.play('hurt', { mine: true, gap: 110 }); return; }
      if (d.k === 1) return;                                          // damage over time ticks: silent
      const mine = isMe(d.s);
      SFX.play(d.c ? 'crit' : 'impact', { x: e.x, y: e.y, mine, other: !mine, v: mine ? 0.9 : 0.6, gap: mine ? 35 : 70 });
    });
    s.on('evade', (d) => { if (isMe(d.id)) SFX.play('evade', { mine: true }); });
    s.on('matk', (d) => { if (isMe(d.tid)) SFX.play('claw', { mine: true, gap: 120 }); });
    s.on('die', (d) => {
      const e = ent(d.id);
      if (!e || e.kind !== 'm') return;
      SFX.play(e.boss ? 'bossDie' : 'poof', { x: e.x, y: e.y, mine: e.boss, gap: 40 });
    });
    s.on('dead', () => SFX.play('death', { mine: true }));
    s.on('respawned', () => SFX.play('portal', { mine: true }));
    s.on('loot', (d) => {
      if (d.item) SFX.play('drop', { mine: true, arg: (C.ITEMS[d.item] || {}).grade || 0 });
      else if (d.gold || d.sold) SFX.play('coin', { mine: true, gap: 60 });
    });
    s.on('partyInvite', () => SFX.play('notify', { mine: true, bus: 'ui' }));
    s.on('partyRequest', () => SFX.play('notify', { mine: true, bus: 'ui' }));
    s.on('fx', (d) => {
      const e = ent(d.id), mine = isMe(d.id), at = { x: e ? e.x : d.x, y: e ? e.y : d.y, mine, other: !mine };
      if (d.t === 'arbiter') {
        if (d.mapId && d.mapId !== G.mapId) return;
        if (['windup', 'ward', 'form', 'blades', 'resonance'].includes(d.phase)) SFX.skill(d.skill, at);
        else if (d.phase === 'release') SFX.play(d.skill === 'finalVerdict' ? 'smash' : 'impact', { ...at, x: d.x, y: d.y });
        return;
      }
      if (d.t === 'ritualStart') return SFX.play('ritualStart', { ...at, arg: (d.cast || 2800) / 1000 });
      if (d.t === 'ritualRelease') return SFX.play('ritualRelease', { ...at, x: d.x, y: d.y });
      if (d.t === 'spearBeat') return SFX.play(d.final && d.area ? 'smash' : 'thrust', { ...at, x: d.x, y: d.y, v: d.final ? 1 : 0.8 });
      if (d.t === 'monsterWindup') return SFX.play('warn', { x: d.x, y: d.y, gap: 200 });
      if (d.t === 'monsterRelease') return SFX.play('smash', { x: d.x, y: d.y, v: 0.6, gap: 120 });
      if (C.ALL_SKILLS[d.t]) return SFX.skill(d.t, at);
      switch (d.t) {
        case 'heal': SFX.play('potion', at); break;
        case 'equip': if (mine) SFX.play('equip', at); break;
        case 'enh': if (mine) SFX.play(d.broke ? 'enhBroke' : d.ok ? 'enhOk' : 'enhFail', at); break;
        case 'lvl': SFX.play(mine ? 'levelUp' : 'lvlOther', at); break;
        case 'spawn': case 'tele': SFX.play('portal', { ...at, x: d.x ?? at.x, y: d.y ?? at.y, gap: 150 }); break;
        case 'slam': SFX.play('smash', { x: d.x, y: d.y, v: 0.8 }); break;
        case 'bolt': SFX.play('thunder', { x: d.x, y: d.y, v: 0.5, gap: 150 }); break;
      }
    });
  }
  if (window.G && G.socket) hook();

  // buttons, tabs, bag slots: a soft tick (skill buttons are heard through their skill instead)
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, select, .bag-slot, .eq-slot, .wm-row, .warp-row, .who-row, label')) SFX.play('tick', { mine: true, bus: 'ui', gap: 40 });
  }, true);

  // ------------------------------------------------------------ music
  const SCALE = { gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], yu: [0, 3, 5, 7, 10] };
  const MOODS = {
    title: { bpm: 62, scale: 'gong', root: 50, drums: 0, density: 0.42, flute: 0.35, chords: [0, 0, 3, 2] },
    calm: { bpm: 70, scale: 'gong', root: 48, drums: 0, density: 0.48, flute: 0.25, chords: [0, 3, 0, 4] },
    field: { bpm: 84, scale: 'shang', root: 45, drums: 1, density: 0.55, flute: 0.1, chords: [0, 0, 3, 4] },
    battle: { bpm: 100, scale: 'yu', root: 45, drums: 2, density: 0.62, flute: 0, chords: [0, 2, 3, 4] },
    boss: { bpm: 110, scale: 'yu', root: 40, drums: 3, density: 0.5, flute: 0, chords: [0, 0, 1, 4] },
  };
  const MUSIC_GAIN = 3;                                             // the voices below are written quiet
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let mood = null, moodOut = null, nextT = 0, step = 0, phrase = 0, rest = 0, deg = 7, fluteBar = false;
  const noteOf = (m, d) => { const sc = SCALE[m.scale], o = Math.floor(d / 5); return m.root + 12 * o + sc[((d % 5) + 5) % 5]; };

  // plucked zither: bright attack that darkens, optional slide up from below (滑音)
  function pluck(o, t, m, d, v, slide) {
    const f = hz(noteOf(m, d));
    const osc = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'triangle'; o2.type = 'sine';
    if (slide) { osc.frequency.setValueAtTime(hz(noteOf(m, d - 1)), t); osc.frequency.linearRampToValueAtTime(f, t + 0.09); }
    else osc.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 2, t);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(Math.min(9000, f * 9), t); fl.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    osc.connect(fl); o2.connect(g2).connect(fl); fl.connect(g).connect(o);
    osc.start(t); o2.start(t); osc.stop(t + 1.8); o2.stop(t + 1.8);
    hiss(o, t, { dur: 0.02, peak: v * 0.12, type: 'highpass', f: 3500 });
  }
  // bamboo flute: breathy long note with a vibrato that comes in late
  function flute(o, t, m, d, len) {
    const f = hz(noteOf(m, d)), osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + len * 0.5);
    lfo.connect(lg).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.15);
    g.gain.setValueAtTime(0.07, t + len - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.2);
    osc.connect(g).connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + len + 0.3); lfo.stop(t + len + 0.3);
    hiss(o, t, { dur: len, peak: 0.012, f: f * 2, q: 3, a: 0.1 });
  }
  function pad(o, t, m, d, len) {
    for (const dd of [d - 10, d - 8]) for (const det of [-7, 7]) {
      tone(o, t, { type: 'sawtooth', f: hz(noteOf(m, dd)), dur: len, peak: 0.022, a: 1.2, lp: 650, detune: det });
    }
  }
  const drum = (o, t, v) => { tone(o, t, { f: 96, f1: 46, dur: 0.38, peak: 0.5 * v }); hiss(o, t, { dur: 0.08, peak: 0.18 * v, type: 'lowpass', f: 320 }); };
  const block = (o, t, v) => { hiss(o, t, { dur: 0.05, peak: 0.26 * v, f: 1900, q: 9 }); tone(o, t, { f: 950, dur: 0.04, peak: 0.07 * v }); };

  function schedule(t) {
    const m = mood, o = moodOut, sb = 60 / m.bpm / 2, inBar = step % 8, bar = Math.floor(step / 8);
    if (inBar === 0) {
      if (phrase > 0) phrase--; else if (rest > 0) rest--;
      if (phrase === 0 && rest === 0) { phrase = 2 + Math.floor(Math.random() * 3); rest = 1 + Math.floor(Math.random() * 2); }
      fluteBar = phrase > 0 && Math.random() < m.flute;
      const chord = m.chords[Math.floor(bar / 2) % m.chords.length];
      if (bar % 2 === 0) pad(o, t, m, chord + 5, sb * 16 + 1);
      pluck(o, t, m, chord - 5, 0.16, false);                       // low string on the bar
      if (fluteBar) { let tt = t; for (const beats of pick([[4, 4], [6, 2], [8]])) { flute(o, tt, m, deg = Math.max(4, Math.min(11, deg + pick([-1, 1, 2, -2]))), beats * sb - 0.05); tt += beats * sb; } }
    }
    if (phrase > 0 && !fluteBar && Math.random() < m.density * (inBar % 2 === 0 ? 1.15 : 0.65)) {
      deg = Math.max(3, Math.min(12, deg + pick([-2, -1, -1, 0, 1, 1, 2])));
      const v = 0.14 + Math.random() * 0.06;
      if (inBar === 6 && phrase === 1 && Math.random() < 0.35) {    // phrase end: tremolo on one string (摇指)
        for (let i = 0; i < 6; i++) pluck(o, t + i * sb / 3, m, deg, v * (1 - i * 0.12), false);
      } else pluck(o, t, m, deg, v, Math.random() < 0.2);
    }
    if (m.drums === 1) { if (inBar === 0 && bar % 2 === 0) drum(o, t, 0.6); if (inBar === 4) block(o, t, 0.6); }
    if (m.drums >= 2) {
      if (inBar === 0) drum(o, t, 1); if (inBar === 3 || inBar === 4) drum(o, t, 0.6);
      if (inBar === 2 || inBar === 6) block(o, t, 0.8);
      if (m.drums === 3 && (inBar === 6 || inBar === 7)) drum(o, t, 0.45);
      if (inBar === 0 && bar % 4 === 0) {
        if (m.drums === 3) bell(o, t, 98, 4, 0.16, [1, 1.48, 2.02, 2.7], [1, 0.5, 0.35, 0.2]);
        else hiss(o, t, { dur: 1.2, peak: 0.05, type: 'highpass', f: 6000, a: 0.01 });
      }
    }
    step++;
    return sb;
  }
  const musicOn = () => running() && SET.get('sound') && SET.get('music') > 0 && SET.get('master') > 0;
  setInterval(() => {
    if (!mood || !musicOn()) { if (ctx) nextT = ctx.currentTime + 0.1; return; }
    const ahead = document.hidden ? 1.5 : 0.3;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + ahead) nextT += schedule(nextT);
  }, 60);

  // the mood: login → title · PvP map → battle · a boss close by → boss · camp → calm · elsewhere → field;
  // a change has to hold for 2.5 s (walking along the camp edge does not flip the music back and forth)
  function moodNow() {
    const me = window.G && G.me, def = window.G && G.mapDef;
    if (!me || !def) return 'title';
    if (def.pvp) return 'battle';
    for (const e of G.ents.values()) if (e.boss && !e.dying && Math.hypot(e.x - me.x, e.y - me.y) < 900) return 'boss';
    return C.safeAt(def, me.x, me.y) ? 'calm' : 'field';
  }
  let want = '', wantSince = 0;
  function switchMood(name) {
    const old = moodOut, t = ctx.currentTime;
    if (old) { old.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => old.disconnect(), 4000); }
    moodOut = ctx.createGain();
    moodOut.gain.setValueAtTime(0, t); moodOut.gain.linearRampToValueAtTime(MUSIC_GAIN, t + (old ? 2 : 3));
    moodOut.connect(bus.music);
    mood = MOODS[name]; SFX.mood = name;
    step = 0; phrase = 0; rest = old ? 1 : 0; deg = 7;
  }
  setInterval(() => {
    if (!running()) return;
    const w = moodNow(), now = performance.now();
    if (w !== want) { want = w; wantSince = now; }
    if (w !== SFX.mood && (!mood || now - wantSince > 2500)) switchMood(w);
  }, 500);
})();
