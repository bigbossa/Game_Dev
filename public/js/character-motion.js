// Visual motion only. Movement validation, combat timing and stats remain authoritative.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CharacterMotion = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const ease = (rate, dt) => -Math.expm1(-rate * Math.max(0, dt));
  const DELAY = 75, TELEPORT = 420, STRIDE = 108;
  function reset(e) {
    e.motionSamples = [];
    e.motionX = e.x; e.motionY = e.y;
    e.walkBlend = 0; e.gait = 0; e.animT = 0;
    e.correctX = e.correctY = 0;
  }
  function snapshot(e, x, y, moving, now, direction, face) {
    let samples = e.motionSamples;
    if (!samples || Math.hypot(x - e.x, y - e.y) > TELEPORT) {
      e.x = x; e.y = y; reset(e); samples = e.motionSamples;
    }
    // Replace duplicate timestamps; never divide by a zero-length sample interval.
    const point = { x, y, moving, t: now, direction, face };
    if (samples.length && samples[samples.length - 1].t === now) samples.pop();
    samples.push(point);
    while (samples.length > 8) samples.shift();
    e.tx = x; e.ty = y;
  }
  function remote(e, now) {
    const samples = e.motionSamples;
    if (!samples?.length) return;
    const at = now - DELAY;
    while (samples.length > 2 && samples[1].t <= at) samples.shift();
    const a = samples[0], b = samples[1] || a;
    const p = b.t === a.t ? 1 : Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t)));
    e.x = a.x + (b.x - a.x) * p; e.y = a.y + (b.y - a.y) * p;
    const state = p < 1 ? a : b;
    e.moving = state.moving;
    if (!e.atk && state.direction !== undefined) {
      if (e.kind === 'm') e.dir8 = state.direction; else e.dir = state.direction;
    }
    if (state.face !== undefined) e.face = state.face;
    // Hold the last validated position when packets stop arriving; do not drift through walls.
  }
  function correction(e, x, y) {
    const dx = e.x - x, dy = e.y - y;
    if (!e.dead && !e.leap && Math.hypot(dx, dy) < 96) {
      e.correctX = (e.correctX || 0) + dx; e.correctY = (e.correctY || 0) + dy;
      // Several corrections in a burst must not push the visual body outside the same bound.
      const length = Math.hypot(e.correctX, e.correctY);
      if (length > 96) { e.correctX *= 96 / length; e.correctY *= 96 / length; }
    } else { e.correctX = e.correctY = 0; }
    e.x = x; e.y = y; e.motionX = x; e.motionY = y;
  }
  function update(e, dt) {
    const distance = Math.hypot(e.x - (e.motionX ?? e.x), e.y - (e.motionY ?? e.y));
    e.motionX = e.x; e.motionY = e.y;
    const walking = !e.dead && !e.leap && !e.dash && distance > .001 && distance < TELEPORT;
    e.walkBlend = (e.walkBlend || 0) + ((walking ? 1 : 0) - (e.walkBlend || 0)) * ease(walking ? 18 : 24, dt);
    if (walking) e.gait = ((e.gait || 0) + distance / STRIDE) % 1;
    // Keep legacy effects in sync with the same distance-driven cycle.
    e.animT = (e.gait || 0) * .5;
    const decay = Math.exp(-20 * dt);
    e.correctX = (e.correctX || 0) * decay; e.correctY = (e.correctY || 0) * decay;
    if (Math.abs(e.correctX) < .01) e.correctX = 0;
    if (Math.abs(e.correctY) < .01) e.correctY = 0;
  }
  function walkFrame(e, idle = 1) {
    return (e.walkBlend || 0) > .12 ? [1, 0, 1, 2][Math.floor((e.gait || 0) * 4) % 4] : idle;
  }
  function bodyLift(e, now) {
    // The drawn poses already include a gait. Extra whole-body bobbing makes the
    // feet slip and magnifies the discontinuity when the source pose changes.
    return 0;
  }
  function pixelRatio(native, width, height) {
    // Match the display instead of supersampling the entire moving world.
    const desired = Math.max(1, Math.min(2, native || 1));
    return Math.max(1, Math.min(desired, Math.sqrt(4_000_000 / Math.max(1, width * height))));
  }
  return { ease, reset, snapshot, remote, correction, update, walkFrame, bodyLift, pixelRatio };
});
