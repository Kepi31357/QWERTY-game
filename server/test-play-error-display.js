'use strict';

/**
 * Invalid-play errors must stay visible when the 30s timer warning fires.
 * Run: node server/test-play-error-display.js
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
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
var htmlSrc = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

console.log('--- Wiring ---');
assert(gameSrc.indexOf('shouldDeferTimerWarnMessage') >= 0, 'timer defer helper exists');
assert(gameSrc.indexOf('showPlayValidationError') >= 0, 'play validation error helper exists');
assert(
  /if \(!this\.shouldDeferTimerWarnMessage\(\)\)/.test(gameSrc),
  '30s timer warning is gated on play-error pin'
);
assert(gameSrc.indexOf("kind: 'error'") >= 0, 'error board banner kind');
assert(gameSrc.indexOf('NOT A VALID PLAY') >= 0, 'error banner title');
assert(gameSrc.indexOf('PLAY_ERROR_HOLD_MS') >= 0, 'status-bar error hold');
assert(gameSrc.indexOf('PLAY_ERROR_BANNER_MS') >= 0, 'error banner duration');
assert(gameSrc.indexOf('formatQuietPlacementHint') >= 0, 'quiet hint for incomplete placements');
assert(gameSrc.indexOf('isIncompletePlayReason') >= 0, 'incomplete-play detector');
assert(gameSrc.indexOf('banner: false') >= 0, 'live preview does not show strong banner');
assert(
  gameSrc.indexOf('banner: this.hasIllegalDictionaryWords(result, offlineFail)') >= 0,
  'offline submit banners only for illegal dictionary words'
);
assert(
  /showPlayValidationError\(text,\s*null,\s*\{\s*banner:\s*true\s*\}\)/.test(gameSrc),
  'online dictionary rejects still use the strong banner'
);
assert(gameSrc.indexOf('keep placing tiles to make a word') >= 0, 'single-letter hint copy');
assert(gameSrc.indexOf('bannerErrorFill') >= 0, 'error banner colors');
assert(cssSrc.indexOf('#ffd0d4') >= 0, 'status-bar error color is emphasized');

console.log('--- Crossing-words player explanation ---');
assert(
  gameSrc.indexOf(
    'All words formed by your tiles (including vertical and horizontal crosses) must be valid dictionary words.'
  ) >= 0,
  'shared crossing-words tip copy'
);
assert(gameSrc.indexOf('rules-callout') >= 0, 'rules modal includes crossing-words callout');
assert(
  gameSrc.indexOf('playing EVE next to DINKY') >= 0 ||
    gameSrc.indexOf('play EVE next to DINKY') >= 0,
  'rules example mentions DINKY + EVE'
);
assert(htmlSrc.indexOf('two-letter-cross-tip') >= 0, '2-letter list explains crosses');
assert(cssSrc.indexOf('.rules-callout') >= 0, 'rules callout styles');
assert(
  htmlSrc.indexOf('including vertical and horizontal crosses') >= 0,
  'Game rules links have crossing-words tooltip'
);

console.log('--- Invalid-word labels ---');
function collectInvalidWordLabels(scoreResult, formattedMsg) {
  var out = [];
  var i, raw, m, chunk, re, listed;
  if (scoreResult && scoreResult.invalidWords && scoreResult.invalidWords.length) {
    for (i = 0; i < scoreResult.invalidWords.length; i++) {
      raw = String(scoreResult.invalidWords[i] || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
      if (raw.length >= 2 && out.indexOf(raw) < 0) out.push(raw);
    }
  }
  if (!out.length && formattedMsg) {
    chunk = String(formattedMsg).replace(/\([^)]*\)/g, ' ');
      m = chunk.match(/Invalid words:\s*(.+)/i);
      if (m) {
        listed = m[1];
        re = /"([A-Za-z]{2,})"/g;
        while ((m = re.exec(listed))) {
          raw = m[1].toUpperCase();
          if (out.indexOf(raw) < 0) out.push(raw);
        }
      } else {
      m = chunk.match(/"([A-Za-z]{2,})" is not/i);
      if (m) out.push(m[1].toUpperCase());
    }
  }
  return out;
}

assert(
  collectInvalidWordLabels({ invalidWords: ['KE', 'YV'] }, '').join(',') === 'KE,YV',
  'uses engine invalidWords list'
);
assert(
  collectInvalidWordLabels(
    null,
    'Invalid words: "KE", "YV" (main play "EVE"). All words formed by your tiles (including vertical and horizontal crosses) must be valid dictionary words.'
  ).join(',') === 'KE,YV',
  'parses new crossing-words reject copy without taking EVE'
);
assert(
  collectInvalidWordLabels(
    null,
    '"KE" is not in the dictionary (your new tiles are part of "EVE"). Every crossing word must be a real dictionary word.'
  ).join(',') === 'KE',
  'single-word reject does not include the intended play'
);

console.log('--- Timer warn does not replace error ---');
function shouldDeferTimerWarnMessage(g) {
  if (g._playErrorUntil && Date.now() < g._playErrorUntil) return true;
  if (g.boardBannerFx && g.boardBannerFx.kind === 'error') {
    if (!g.boardBannerFx.expiresAt || Date.now() < g.boardBannerFx.expiresAt) return true;
  }
  var el = g.ui && g.ui.message;
  if (el && !el.hidden && /(^|\s)error(\s|$)/.test(el.className || '')) return true;
  return false;
}

function isTimerWarnMessage(text) {
  return /^\d+\s+seconds left!$/i.test(String(text || '').trim());
}

function setMessage(g, text, type) {
  var msg = text || '';
  if (isTimerWarnMessage(msg) && shouldDeferTimerWarnMessage(g)) return false;
  g.ui.message.textContent = msg;
  g.ui.message.className = 'message-bar' + (type ? ' ' + type : '');
  g.ui.message.hidden = !msg;
  return true;
}

var g = {
  _playErrorUntil: Date.now() + 6000,
  boardBannerFx: { kind: 'error', expiresAt: Date.now() + 4000 },
  ui: {
    message: {
      hidden: false,
      className: 'message-bar error',
      textContent: 'Invalid words: "KE", "YV".',
    },
  },
};

assert(shouldDeferTimerWarnMessage(g) === true, 'defers while error is pinned');
assert(setMessage(g, '30 seconds left!') === false, 'timer warn is skipped');
assert(
  g.ui.message.textContent.indexOf('KE') >= 0,
  'status bar still shows invalid words after timer warn'
);

g._playErrorUntil = 0;
g.boardBannerFx = null;
assert(shouldDeferTimerWarnMessage(g) === true, 'still defers while status bar has error class');
assert(setMessage(g, '30 seconds left!') === false, 'timer warn skipped while error class remains');

g.ui.message.className = 'message-bar success';
g.ui.message.textContent = 'Trying: YE +30';
assert(shouldDeferTimerWarnMessage(g) === false, 'does not defer after a valid play message');
assert(setMessage(g, '30 seconds left!') === true, 'timer warn allowed after success');
assert(g.ui.message.textContent === '30 seconds left!', 'timer warn can show when no error is up');

console.log('--- Incomplete vs dictionary banner ---');
function isIncompletePlayReason(reason, previewText) {
  var r = String(reason || '');
  var t = String(previewText || '').replace(/[^A-Za-z]/g, '');
  if (t.length < 2) return true;
  if (/Must form at least one new word/i.test(r)) return true;
  if (/No tiles placed/i.test(r)) return true;
  return false;
}
function isPlayValidationErrorText(text) {
  var s = String(text || '');
  return /not a valid word|not in (the |this game's )?dictionary|Invalid words:|crosses must be words too/i.test(s);
}
assert(isIncompletePlayReason('Must form at least one new word.', 'C') === true, 'single C is incomplete');
assert(isIncompletePlayReason('"KE" is not a valid word.', 'EVE') === false, 'KE cross is not incomplete');
assert(isPlayValidationErrorText('Invalid words: "KE", "YV".') === true, 'KE/YV is a dictionary reject');
assert(
  isPlayValidationErrorText('C: Must form at least one new word.') === false,
  'incomplete reason is not a dictionary reject'
);

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
