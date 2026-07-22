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
assert(
  htmlSrc.indexOf('interactive-widget=resizes-visual') >= 0 ||
    htmlSrc.indexOf('resizes-visual') >= 0,
  'viewport resizes-visual (keyboard shrinks visual viewport)'
);
assert(htmlSrc.indexOf('viewport-fit=cover') >= 0, 'viewport-fit=cover');

assert(gameSrc.indexOf('isLayoutFrozen') >= 0, 'layout freeze helper');
assert(gameSrc.indexOf('freezeLayoutBriefly') >= 0, 'freeze on place');
assert(gameSrc.indexOf('_compactLayoutLock') >= 0, 'compact cell-size lock');
/* Board must not reflow on visualViewport scroll; chat keyboard avoidance may listen. */
assert(gameSrc.indexOf('Height-only change on phone') >= 0, 'ignores height-only resize on compact');
assert(gameSrc.indexOf('syncMobileChatToViewport') >= 0, 'chat lifts above soft keyboard');
assert(gameSrc.indexOf('getVisualViewportBottomInset') >= 0, 'keyboard inset from visualViewport');
assert(gameSrc.indexOf('startMobileChatKeyboardWatch') >= 0, 'watches keyboard animation while focused');
assert(gameSrc.indexOf('ctx.scale(pulseScale, pulseScale)') >= 0, 'place pulse uses transform scale');
assert(gameSrc.indexOf('_lastPlacePulseAt') >= 0, 'placement pulse throttled');
assert(gameSrc.indexOf('this.cellSize - 2') >= 0, 'board tileSize matches rack (cellSize - 2)');
assert(/#game-canvas\s*\{[^}]*max-height:\s*none/m.test(cssSrc), 'board canvas not CSS height-shrunk');

assert(htmlSrc.indexOf('id="message"') >= 0 && htmlSrc.indexOf('board-status-bar') >= 0, 'status bar present');
assert(
  /game-board-column[\s\S]*?board-status-bar[\s\S]*?id="message"/.test(htmlSrc),
  'status bar under board in game-board-column'
);
assert(htmlSrc.indexOf('board-status-toast') < 0, 'old floating toast removed');
assert(cssSrc.indexOf('.board-status-bar') >= 0, 'board status bar styles');
assert(cssSrc.indexOf('justify-content: center') >= 0, 'flex centers status bar');
assert(cssSrc.indexOf('text-align: center !important') >= 0, 'text forced center');
assert(cssSrc.indexOf('var(--qwerty-board-px') >= 0, 'max-width matches board');
assert(cssSrc.indexOf('never overlaps') >= 0 || cssSrc.indexOf('no overlap') >= 0 || cssSrc.indexOf('above the rack') >= 0, 'in-flow above rack');
assert(cssSrc.indexOf('--qwerty-status-h') >= 0, 'status bar fixed height token');
assert(cssSrc.indexOf('flex: 0 0 var(--qwerty-status-h)') >= 0, 'status bar fixed flex basis');
assert(cssSrc.indexOf('max-height: var(--qwerty-status-h)') >= 0, 'status bar capped height (no jump)');
assert(cssSrc.indexOf('contain: layout paint') >= 0, 'canvas layout containment');
assert(cssSrc.indexOf('min-height: 42px') >= 0 || cssSrc.indexOf('min-height: 44px') >= 0, 'touch-friendly control height');
assert(gameSrc.indexOf('RACK_SETTLE_MS') >= 0, 'recall settle animation');
assert(gameSrc.indexOf('avoidBanner') >= 0, 'score toast avoids celebrate banner');
assert(
  gameSrc.indexOf('selected — tap Confirm Exchange when ready') >= 0,
  'short exchange status copy'
);

assert(htmlSrc.indexOf('id="btn-mobile-chat"') >= 0, 'mobile chat FAB present');
assert(htmlSrc.indexOf('id="mobile-chat-backdrop"') >= 0, 'mobile chat backdrop present');
assert(htmlSrc.indexOf('id="btn-chat-close"') >= 0, 'mobile chat close button');
assert(htmlSrc.indexOf('id="chat-room-code"') >= 0, 'chat room code in panel');
assert(cssSrc.indexOf('mobile-chat-open') >= 0, 'mobile chat open styles');
assert(
  cssSrc.indexOf('bottom: -110%') >= 0 || cssSrc.indexOf('translate3d(0, 110%, 0)') >= 0,
  'chat sheet starts off-screen'
);
assert(cssSrc.indexOf('-webkit-text-fill-color: #1a1a1a') >= 0, 'chat input typed text forced visible');
assert(gameSrc.indexOf('openMobileChat') >= 0 && gameSrc.indexOf('closeMobileChat') >= 0, 'mobile chat open/close API');
assert(gameSrc.indexOf('bumpMobileChatUnread') >= 0, 'unread badge for closed mobile chat');

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
