'use strict';

/**
 * Mobile board-jump guards (layout lock / resize filters).
 * Run: node server/test-mobile-layout-stable.js
 */

var PASS = 0;
var FAIL = 0;
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('  OK  ' + msg);
  } else {
    FAIL++;
    console.log('  FAIL ' + msg);
  }
}

var gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
var cssSrc = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
var htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert(htmlSrc.indexOf('maximum-scale=1') >= 0, 'viewport maximum-scale=1');
assert(htmlSrc.indexOf('user-scalable=no') >= 0, 'viewport user-scalable=no');
assert(htmlSrc.indexOf('interactive-widget=overlays-content') >= 0, 'viewport overlays-content');
assert(htmlSrc.indexOf('viewport-fit=cover') >= 0, 'viewport-fit=cover');

assert(gameSrc.indexOf('isLayoutFrozen') >= 0, 'layout freeze helper');
assert(gameSrc.indexOf('freezeLayoutBriefly') >= 0, 'freeze on place');
assert(gameSrc.indexOf('_compactLayoutLock') >= 0, 'compact cell-size lock');
assert(gameSrc.indexOf('visualViewport.addEventListener(\'scroll\'') < 0, 'no visualViewport scroll resize');
assert(gameSrc.indexOf('Height-only change on phone') >= 0, 'ignores height-only resize on compact');
assert(gameSrc.indexOf('ctx.scale(pulseScale, pulseScale)') >= 0, 'place pulse uses transform scale');
assert(gameSrc.indexOf('_lastPlacePulseAt') >= 0, 'placement pulse throttled');

assert(htmlSrc.indexOf('id="message"') >= 0 && htmlSrc.indexOf('player-panel') >= 0, 'message element present');
assert(
  /player-panel[\s\S]*?id="message"/.test(htmlSrc),
  'message lives inside player-panel (not covering controls)'
);
assert(cssSrc.indexOf('grid-area: msg') >= 0, 'message grid slot above rack/buttons');
assert(
  cssSrc.indexOf('never covers Confirm Exchange') >= 0 ||
    cssSrc.indexOf('Compact status line above the rack') >= 0,
  'compact in-flow message styles'
);
assert(cssSrc.indexOf('contain: layout paint') >= 0, 'canvas layout containment');
assert(
  gameSrc.indexOf('selected — tap Confirm Exchange when ready') >= 0,
  'short exchange status copy'
);

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
