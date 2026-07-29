'use strict';

var fs = require('fs');
var path = require('path');

var failed = 0;
var passed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL', msg);
  } else {
    passed++;
    console.log('  OK ', msg);
  }
}

var root = path.join(__dirname, '..');
var landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var play = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
var css = fs.readFileSync(path.join(root, 'site.css'), 'utf8');
var server = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
var game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

assert(landing.indexOf('Play Now') >= 0, 'landing has Play Now CTA');
assert(landing.indexOf('href="play.html"') >= 0, 'Play Now links to play.html');
assert(landing.indexOf('btn-play-lg') >= 0, 'large Play Now button');
assert(landing.indexOf('hero-preview') >= 0, 'smaller hero board preview');
assert(
  landing.indexOf('hero-board-live.jpg') >= 0 || landing.indexOf('hero-board.jpg') >= 0,
  'compressed hero jpeg'
);
assert(landing.indexOf('See QWERTY in Action') >= 0, 'screenshots section title');
assert(landing.indexOf('ss-live-board.png') >= 0, 'live board screenshot');
assert(landing.indexOf('ss-connection.png') >= 0, 'connection bonus screenshot');
assert(landing.indexOf('ss-victory.png') >= 0, 'victory screen screenshot');
assert(landing.indexOf('ss-start-menu.png') >= 0, 'start menu screenshot');
assert(landing.indexOf('ss-timer.png') >= 0, 'turn timer screenshot');
assert(landing.indexOf('shot-stack') >= 0, 'vertical screenshot stack');
assert(fs.existsSync(path.join(root, 'public/images/ss-live-board.png')), 'ss-live-board.png on disk');
assert(landing.indexOf('id="features"') >= 0, 'features / how to play section');
assert(landing.indexOf('id="screens"') >= 0, 'screenshots section');
assert(landing.indexOf('id="about"') >= 0, 'about section');
assert(landing.indexOf('id="tournaments"') >= 0, 'tournaments teaser');
assert(landing.indexOf('id="download"') >= 0, 'download / store badges anchor');
assert(landing.indexOf('App Store') >= 0 && landing.indexOf('Google Play') >= 0, 'store download buttons');
assert(landing.indexOf('site-footer') >= 0, 'footer');
assert(/site\.css\?v=\d+/.test(landing), 'cache-busted stylesheet');
assert(landing.indexOf('preload') >= 0, 'image preload for fast load');
assert(landing.indexOf('mobile-play-bar') < 0, 'no sticky mobile Play Now bar');
assert(css.indexOf('.site-nav') >= 0 && /@media \(max-width: 779px\)[\s\S]*\.site-nav\s*\{\s*display:\s*none/.test(css), 'hide top nav on mobile');
assert(css.indexOf('.store-badge-text strong') >= 0 && css.indexOf('var(--font-body)') >= 0, 'store badge uses readable body font');
assert(css.indexOf('.hero-preview') >= 0, 'hero preview styles');
assert(
  css.indexOf('hero-preview') >= 0 &&
    (css.indexOf('1120px') >= 0 || css.indexOf('100dvh') >= 0),
  'board preview scales with viewport'
);
assert(css.indexOf('.btn-play-lg') >= 0, 'large play button styles');
assert(css.indexOf('.store-badge') >= 0, 'store badge styles');
assert(css.indexOf('--pogo-purple') >= 0, 'brand colors');
assert(css.indexOf('.shot-stack') >= 0, 'shot stack styles');
assert(play.indexOf('game-board-column') >= 0, 'play.html is the game');
assert(server.indexOf('/play.html') >= 0, 'server knows play.html');
assert(game.indexOf('/play.html?guest&code=') >= 0, 'join URLs use play.html');
assert(fs.existsSync(path.join(root, 'public/images/hero-board.jpg')), 'hero-board.jpg on disk');
assert(fs.existsSync(path.join(root, 'public/images/ss-timer.png')), 'ss-timer.png on disk');

console.log('Summary: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
