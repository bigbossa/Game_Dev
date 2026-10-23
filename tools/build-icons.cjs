// Home-screen icons from public/icons/icon.svg → icon-180.png (iOS apple-touch-icon), icon-192.png, icon-512.png
// (manifest.webmanifest). Renders with headless Edge, the browser the other tools/ scripts already use.
// Usage: node tools/build-icons.cjs [path-to-msedge.exe]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');

const dir = path.join(__dirname, '../public/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const edge = process.argv[2] || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));

for (const size of [180, 192, 512]) {
  const html = path.join(tmp, `icon-${size}.html`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#000;overflow:hidden">` +
    svg.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `) + `</body></html>`);
  const out = path.join(dir, `icon-${size}.png`);
  execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${path.join(tmp, 'profile')}`, `--window-size=${size},${size}`, `--screenshot=${out}`,
    'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  const png = PNG.sync.read(fs.readFileSync(out));
  if (png.width !== size || png.height !== size) throw new Error(`icon-${size}.png is ${png.width}x${png.height}`);
  console.log(`icon-${size}.png ${size}x${size}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
