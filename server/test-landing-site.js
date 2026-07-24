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
assert(landing.indexOf('hero-board.jpg') >= 0, 'compressed hero jpeg');
assert(landing.indexOf('shot-board.jpg') >= 0, 'gallery uses jpeg');
assert(landing.indexOf('id="features"') >= 0, 'features / how to play section');
assert(landing.indexOf('id="screens"') >= 0, 'screenshots section');
assert(landing.indexOf('id="about"') >= 0, 'about section');
assert(landing.indexOf('id="tournaments"') >= 0, 'tournaments teaser');
assert(landing.indexOf('id="download"') >= 0, 'download / store badges anchor');
assert(landing.indexOf('App Store') >= 0 && landing.indexOf('Google Play') >= 0, 'store download buttons');
assert(landing.indexOf('site-footer') >= 0, 'footer');
assert(/site\.css\?v=\d+/.test(landing), 'cache-busted stylesheet');
assert(landing.indexOf('preload') >= 0, 'image preload for fast load');
assert(landing.indexOf('mobile-play-bar') >= 0, 'mobile sticky Play Now');
assert(css.indexOf('.hero-preview') >= 0, 'hero preview styles');
assert(css.indexOf('max-width: 480px') >= 0 || css.indexOf('width: min(100%, 480px)') >= 0, 'board preview size capped');
assert(css.indexOf('.btn-play-lg') >= 0, 'large play button styles');
assert(css.indexOf('.store-badge') >= 0, 'store badge styles');
assert(css.indexOf('--pogo-purple') >= 0, 'brand colors');
assert(play.indexOf('game-board-column') >= 0, 'play.html is the game');
assert(server.indexOf('/play.html') >= 0, 'server knows play.html');
assert(game.indexOf('/play.html?guest&code=') >= 0, 'join URLs use play.html');
assert(fs.existsSync(path.join(root, 'public/images/hero-board.jpg')), 'hero-board.jpg on disk');
assert(fs.existsSync(path.join(root, 'public/images/shot-board.jpg')), 'shot-board.jpg on disk');

console.log('Summary: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
