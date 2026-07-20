'use strict';

/**
 * Bingo only when the rack is emptied — not when placed count equals remaining
 * after offline pending removal.
 * Run: node server/test-bingo-rack-empty.js
 */

var fail = 0;
function assert(cond, msg) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg);
  } else {
    console.log('OK', msg);
  }
}

var RACK_SIZE = 8;
var BINGO_BONUS = 100;
var STAR_BONUS = 50;
var LINK_BONUS = 75;

/** Mirror game.js offline/online emptied-rack rule. */
function emptiedRack(placedCount, rackRemaining, opts) {
  opts = opts || {};
  var humanOffline = opts.humanOffline === true;
  if (humanOffline) {
    return placedCount > 0 && rackRemaining === 0;
  }
  return placedCount > 0 && placedCount === rackRemaining;
}

assert(
  emptiedRack(4, 4, { humanOffline: true }) === false,
  'offline: 4 placed with 4 left is NOT bingo'
);
assert(
  emptiedRack(4, 0, { humanOffline: true }) === true,
  'offline: 4 placed with 0 left IS bingo'
);
assert(
  emptiedRack(8, 8, { humanOffline: false }) === true,
  'online: 8 placed of 8 on rack IS bingo'
);
assert(
  emptiedRack(4, 8, { humanOffline: false }) === false,
  'online: 4 placed of 8 on rack is NOT bingo'
);
assert(
  emptiedRack(5, 5, { humanOffline: false }) === true,
  'online/AI: playing all remaining 5 IS bingo'
);

/** Mirror tightened observed-bonus inference (no rem===100 alone). */
function inferBingo(word, score, placedLen, letterScore) {
  var main = String(word || '').toUpperCase();
  var total = Number(score) || 0;
  var rem = Math.max(0, total - (letterScore != null ? letterScore : main.length * 10));
  if (rem < BINGO_BONUS) return 0;
  var afterBingo = rem - BINGO_BONUS;
  var bingoShaped =
    afterBingo === 0 ||
    afterBingo === LINK_BONUS ||
    afterBingo % STAR_BONUS === 0 ||
    (afterBingo > LINK_BONUS && (afterBingo - LINK_BONUS) % STAR_BONUS === 0);
  var likelyBingo =
    placedLen >= RACK_SIZE ||
    (main && main.length >= RACK_SIZE) ||
    (placedLen === 0 && main && main.length >= RACK_SIZE);
  return bingoShaped && likelyBingo ? BINGO_BONUS : 0;
}

assert(
  inferBingo('BAKE', 100, 4, 100) === 0,
  'BAKE+BOMBER letter total 100 is not bingo'
);
assert(
  inferBingo('BAKE', 150, 4, 50) === 0,
  'rem 100 from two stars is not bingo without rack evidence'
);
assert(
  inferBingo('MEDICINE', 180, 0, 80) === 100,
  '8-letter MEDICINE +180 still infers bingo'
);
assert(
  inferBingo('MEDICINE', 180, 8, 80) === 100,
  '8 placed + MEDICINE +180 is bingo'
);

var src = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'game.js'),
  'utf8'
);
assert(
  src.indexOf('human pending tiles are already removed from the rack') >= 0 ||
    src.indexOf('Pending tiles are already removed from the rack') >= 0 ||
    src.indexOf('pending tiles are already removed from the rack') >= 0,
  'game.js documents offline bingo rack rule'
);
assert(
  src.indexOf('rackRemaining === 0') >= 0,
  'game.js uses empty-rack check for offline human bingo'
);

if (fail) process.exit(1);
console.log('All bingo rack-empty tests passed.');
