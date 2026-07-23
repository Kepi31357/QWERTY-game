'use strict';

var fs = require('fs');
var path = require('path');

var failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL', msg);
  } else {
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
assert(landing.indexOf('id="rules"') >= 0, 'rules teaser section');
assert(landing.indexOf('id="about"') >= 0, 'about section');
assert(landing.indexOf('id="tournaments"') >= 0, 'leaderboard teaser section');
assert(landing.indexOf('screenshot-desktop.png') >= 0, 'desktop screenshot asset');
assert(landing.indexOf('site.css') >= 0, 'landing stylesheet');
assert(landing.indexOf('qwerty-header.png') >= 0, 'uses brand logo');
assert(play.indexOf('game-board-column') >= 0, 'play.html is the game shell');
assert(play.indexOf('panel-message-row') >= 0, 'play.html has status bar');
assert(css.indexOf('.hero') >= 0, 'hero styles present');
assert(css.indexOf('--pogo-purple') >= 0, 'brand colors in site.css');
assert(server.indexOf('/play.html') >= 0, 'server serves/redirects play.html');
assert(server.indexOf('Location: \'/play.html\'') >= 0 || server.indexOf('Location: "/play.html"') >= 0 || server.indexOf("Location: '/play.html'") >= 0, 'deep-link redirect to play.html');
assert(game.indexOf('/play.html?guest&code=') >= 0, 'guest join URLs point at play.html');
assert(fs.existsSync(path.join(root, 'public/images/screenshot-desktop.png')), 'screenshot-desktop.png on disk');
assert(fs.existsSync(path.join(root, 'public/images/screenshot-play.png')), 'screenshot-play.png on disk');

console.log('Summary: ' + (17 - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
