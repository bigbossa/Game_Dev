// Extract the 10 twin-blade weapons from item.png as inventory icons.
// Output: public/assets/items/w0..w10.png (ธรรมะ, blue) and w0-a..w10-a.png (อธรรม, crimson).
// w0 is the starter "training blades", made from the LV10 art desaturated.
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { writePng, scaleImg } = L;
const { trim, toAdharma, toStarter, panel } = require('./item-art');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'items');
fs.mkdirSync(OUT, { recursive: true });
const src = L.readPng(path.join(ROOT, 'item.png'));
const ICON = 200; // longest side in pixels

const icons = [];
for (let tier = 1; tier <= 10; tier++) {
  let img = trim(panel(src, tier));
  img = scaleImg(img, ICON / Math.max(img.w, img.h));
  icons.push(img);
}

const save = (name, img) => writePng(path.join(OUT, name + '.png'), img.w, img.h, img.d);
icons.forEach((img, i) => {
  save(`w${i + 1}`, img);
  save(`w${i + 1}-a`, toAdharma(img));
});
const starter = scaleImg(toStarter(icons[0]), 0.85);
save('w0', starter);
save('w0-a', starter);
console.log('item icons:', icons.map((i) => `${i.w}x${i.h}`).join(' '));
