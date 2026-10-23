const assert = require('node:assert/strict');
const M = require('../public/js/character-motion');
const close = (a, b, tolerance = 1e-7) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const entity = () => ({ kind: 'p', x: 0, y: 0, dir: 0, moving: true });

// Camera settling and gait must be consistent across display refresh rates.
const runs = [30, 60, 144].map(fps => {
  let camera = 0; const e = entity(); M.reset(e);
  for (let i = 0; i < fps; i++) {
    e.x += 215 / fps; M.update(e, 1 / fps);
    camera += (200 - camera) * M.ease(12, 1 / fps);
  }
  return { camera, gait: e.gait, blend: e.walkBlend };
});
for (const result of runs.slice(1)) for (const key of Object.keys(result)) close(result[key], runs[0][key]);

// A stationary character (including one pressing against a wall) does not walk in place.
const stationary = entity(); M.reset(stationary);
for (let i = 0; i < 60; i++) M.update(stationary, 1 / 60);
assert.equal(M.walkFrame(stationary), 1); assert.equal(stationary.gait, 0);
assert.equal(M.walkFrame(stationary, 3), 3); // Taoist standing pose

// 20 Hz network updates produce evenly spaced render positions at 60 Hz.
const remote = entity(); const positions = [];
for (let frame = 0; frame <= 60; frame++) {
  const now = frame * 1000 / 60;
  if (frame % 3 === 0) M.snapshot(remote, now * .2, 0, true, now, 2);
  M.remote(remote, now);
  if (now >= 100) positions.push(remote.x);
}
for (let i = 1; i < positions.length; i++) close(positions[i] - positions[i - 1], 200 / 60);
M.remote(remote, 5000); close(remote.x, 200); // no extrapolation after a disconnect

// Jitter, stop packets, identical timestamps and teleports stay finite and bounded.
const jitter = entity();
for (const t of [0, 48, 107, 107, 151, 208, 253]) {
  M.snapshot(jitter, Math.min(40, t * .2), 0, t < 208, t, 2);
  M.remote(jitter, t);
  assert(Number.isFinite(jitter.x) && jitter.x >= 0 && jitter.x <= 40);
}
M.remote(jitter, 500); assert.equal(jitter.moving, false); close(jitter.x, 40);
M.snapshot(jitter, 1500, 700, false, 600, 6); M.remote(jitter, 600);
close(jitter.x, 1500); close(jitter.y, 700); assert.equal(jitter.motionSamples.length, 1);

// Collision corrections immediately change gameplay position but ease the visual offset.
const corrected = entity(); corrected.x = 50; M.reset(corrected);
M.correction(corrected, 30, 0); close(corrected.x, 30); close(corrected.x + corrected.correctX, 50);
for (let i = 0; i < 60; i++) M.update(corrected, 1 / 60);
close(corrected.correctX, 0); close(corrected.gait, 0);
M.correction(corrected, 800, 500); close(corrected.correctX, 0); close(corrected.correctY, 0);
corrected.leap = {}; corrected.x += 30; M.update(corrected, 1 / 60); close(corrected.gait, 0);

// Rendering budget retains detail without making a large display exceed the pixel cap.
assert.equal(M.pixelRatio(1, 1280, 720), 1);
assert.equal(M.pixelRatio(3, 390, 844), 2);
assert.equal(M.bodyLift({gait:.25,walkBlend:1},1234),0);
assert(M.pixelRatio(2, 3840, 2160) <= 1.01);
console.log('PASS: refresh-rate independence, distance-based gait, snapshot interpolation, stops, jitter, teleports, corrections, pixel budget');
