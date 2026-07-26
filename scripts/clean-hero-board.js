/**
 * Normalize navy board chrome in the landing preview PNG/JPG:
 * - snap near-navy pixels to exact #1a2744
 * - remove faint seam / fringe artifacts in dark regions
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'images', 'hero-board.png');
const OUTS = [
  path.join(ROOT, 'public', 'images', 'hero-board.png'),
  path.join(ROOT, 'public', 'images', 'shot-board.png'),
];

const NAVY = { r: 0x1a, g: 0x27, b: 0x44 }; // #1a2744

function dist(r, g, b, t) {
  return Math.abs(r - t.r) + Math.abs(g - t.g) + Math.abs(b - t.b);
}

function isNearNavy(r, g, b) {
  // Catch gradient remnants / anti-aliased seams without eating avatar blues
  if (r > 70 || g > 90) return false;
  if (b < 50 || b > 110) return false;
  return dist(r, g, b, NAVY) <= 55;
}

function cleanPng(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  let fixed = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    if (isNearNavy(r, g, b) && dist(r, g, b, NAVY) > 0) {
      png.data[i] = NAVY.r;
      png.data[i + 1] = NAVY.g;
      png.data[i + 2] = NAVY.b;
      fixed++;
    }
  }
  const out = PNG.sync.write(png);
  fs.writeFileSync(filePath, out);
  return { w: png.width, h: png.height, fixed: fixed };
}

async function pngToJpeg(pngPath, jpgPath, quality) {
  const playwright = require('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  await page.setViewportSize({ width: png.width, height: png.height });
  await page.setContent(
    '<!doctype html><html><body style="margin:0;background:#1a2744">' +
      '<img id="i" src="data:image/png;base64,' +
      b64 +
      '" style="display:block;width:100%;height:100%">' +
      '</body></html>'
  );
  await page.waitForSelector('#i');
  await page.locator('#i').screenshot({ path: jpgPath, type: 'jpeg', quality: quality || 92 });
  await browser.close();
}

async function main() {
  const result = cleanPng(SRC);
  console.log('cleaned', SRC, result);
  for (const p of OUTS) {
    if (p !== SRC) fs.copyFileSync(SRC, p);
  }
  const jpgs = [
    path.join(ROOT, 'public', 'images', 'hero-board.jpg'),
    path.join(ROOT, 'public', 'images', 'hero-board-live.jpg'),
    path.join(ROOT, 'public', 'images', 'shot-board.jpg'),
  ];
  await pngToJpeg(SRC, jpgs[0], 93);
  for (let i = 1; i < jpgs.length; i++) fs.copyFileSync(jpgs[0], jpgs[i]);
  console.log('wrote jpgs', jpgs.map((p) => path.basename(p)).join(', '));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
