'use strict';

/**
 * Mobile / compact layout invariants.
 * Run: node server/test-mobile-layout-stable.js
 */

var fs = require('fs');
var path = require('path');

var PASS = 0;
var FAIL = 0;

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('  OK  ' + msg);
  } else {
    FAIL++;
    console.log('  FAIL ' + msg);
  }
}

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

assert(htmlSrc.indexOf('viewport') >= 0 && htmlSrc.indexOf('maximum-scale=1') >= 0, 'viewport maximum-scale=1');
assert(htmlSrc.indexOf('user-scalable=no') >= 0, 'viewport user-scalable=no');
assert(htmlSrc.indexOf('interactive-widget=overlays-content') >= 0 || htmlSrc.indexOf('overlays-content') >= 0, 'viewport overlays-content');
assert(htmlSrc.indexOf('viewport-fit=cover') >= 0, 'viewport-fit=cover');

assert(gameSrc.indexOf('isLayoutFrozen') >= 0, 'layout freeze helper');
assert(gameSrc.indexOf('freezeLayoutBriefly') >= 0, 'freeze on place');
assert(gameSrc.indexOf('_compactLayoutLock') >= 0, 'compact cell-size lock');
assert(gameSrc.indexOf("visualViewport.addEventListener('scroll'") < 0, 'no visualViewport scroll resize');
assert(gameSrc.indexOf('Height-only change on phone') >= 0, 'ignores height-only resize on compact');
assert(gameSrc.indexOf('ctx.scale(pulseScale, pulseScale)') >= 0, 'place pulse uses transform scale');
assert(gameSrc.indexOf('_lastPlacePulseAt') >= 0, 'placement pulse throttled');

assert(htmlSrc.indexOf('id="message"') >= 0 && htmlSrc.indexOf('board-status-toast') >= 0, 'message toast present');
assert(
  /board-center[\s\S]*?board-status-toast[\s\S]*?id="message"/.test(htmlSrc),
  'status toast lives inside board-center'
);
assert(cssSrc.indexOf('.board-status-toast') >= 0, 'board status toast styles');
assert(cssSrc.indexOf('transform: translateX(-50%)') >= 0, 'toast horizontally centered on board');
assert(cssSrc.indexOf('border-radius: 999px') >= 0, 'toast pill shape');
assert(cssSrc.indexOf('pointer-events: none') >= 0, 'toast does not block board taps');
assert(cssSrc.indexOf('contain: layout paint') >= 0, 'canvas layout containment');
assert(
  gameSrc.indexOf('selected — tap Confirm Exchange when ready') >= 0,
  'short exchange status copy'
);

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
