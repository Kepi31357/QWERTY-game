/**
 * Capture a fresh desktop screenshot of the live game layout for the landing page.
 * Usage: node scripts/capture-hero-board.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT_PNG = path.join(ROOT, 'public', 'images', 'hero-board-capture.png');
const OUT_HERO = path.join(ROOT, 'public', 'images', 'hero-board.jpg');
const OUT_HERO_LIVE = path.join(ROOT, 'public', 'images', 'hero-board-live.jpg');
const OUT_SHOT = path.join(ROOT, 'public', 'images', 'shot-board.jpg');
const OUT_HERO_PNG = path.join(ROOT, 'public', 'images', 'hero-board.png');
const OUT_SHOT_PNG = path.join(ROOT, 'public', 'images', 'shot-board.png');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      try {
        var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        var filePath = path.join(ROOT, urlPath.replace(/^\//, '').replace(/\//g, path.sep));
        if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        var ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err && err.message ? err.message : err));
      }
    });
    server.listen(0, '127.0.0.1', function () {
      var port = server.address().port;
      resolve({ server: server, port: port, base: 'http://127.0.0.1:' + port });
    });
    server.on('error', reject);
  });
}

async function main() {
  var playwright;
  try {
    playwright = require('playwright');
  } catch (_) {
    // Install into a temp local folder under scripts if missing
    console.log('Installing playwright...');
    require('child_process').execSync('npm install playwright@1.62.0 --no-save', {
      cwd: ROOT,
      stdio: 'inherit',
    });
    playwright = require('playwright');
  }

  var srv = await startServer();
  console.log('Serving', srv.base);

  var browser = await playwright.chromium.launch({ headless: true });
  var page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });

  await page.goto(srv.base + '/play.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#btn-start-game', { timeout: 30000 });

  // Prefer a named player + avatar for a polished marketing shot
  var nick = page.locator('#online-nickname');
  if (await nick.count()) {
    await nick.fill('Alex');
  }
  var avatarOpt = page.locator('.avatar-picker-option').nth(2);
  if (await avatarOpt.count()) {
    await avatarOpt.click();
  }

  await page.click('#btn-start-game');
  await page.waitForFunction(function () {
    return !document.body.classList.contains('menu-visible');
  }, null, { timeout: 20000 });
  await page.waitForSelector('#game-canvas', { state: 'visible', timeout: 20000 });

  // Let layout/resize settle; tidy ephemeral UI for a clean marketing frame
  await page.waitForTimeout(1200);
  await page.evaluate(function () {
    var status = document.getElementById('panel-message-row');
    if (status) status.hidden = true;
    var msg = document.getElementById('message');
    if (msg) {
      msg.hidden = true;
      msg.textContent = '';
    }
    document.body.classList.remove('mobile-chat-open', 'chat-keyboard-open');
  });
  await page.waitForTimeout(400);

  // Capture the full play chrome (logo + dark board + scores/chat)
  var target = page.locator('.board-play-row');
  if (!(await target.count())) {
    target = page.locator('.app');
  }

  await target.screenshot({ path: OUT_PNG, type: 'png' });
  await target.screenshot({ path: OUT_HERO, type: 'jpeg', quality: 92 });
  fs.copyFileSync(OUT_HERO, OUT_HERO_LIVE);
  fs.copyFileSync(OUT_HERO, OUT_SHOT);
  fs.copyFileSync(OUT_PNG, OUT_HERO_PNG);
  fs.copyFileSync(OUT_PNG, OUT_SHOT_PNG);

  console.log('Wrote', OUT_HERO);
  console.log('Wrote', OUT_HERO_LIVE);
  console.log('Wrote', OUT_SHOT);
  console.log('Wrote', OUT_PNG);

  await browser.close();
  srv.server.close();
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
