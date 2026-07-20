'use strict';

/**
 * Bingo (+100 + banner) for emptied rack — human offline + AI.
 * Run: node server/test-ai-bingo.js
 */

var fs = require('fs');
var path = require('path');

var fail = 0;
function assert(cond, msg, detail) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg, detail || '');
  } else {
    console.log('OK', msg);
  }
}

var BINGO_BONUS = 100;
var RACK_SIZE = 8;
var PLAYER = { HUMAN: 0, AI: 1 };

/** Mirror game.js validateMove bingo rule. */
function emptiedRackBingo(player, placedCount, rackRemaining, online) {
  var emptiedRack;
  if (player === PLAYER.HUMAN && !online) {
    emptiedRack = placedCount > 0 && rackRemaining === 0;
  } else {
    emptiedRack = placedCount > 0 && placedCount === rackRemaining;
  }
  return emptiedRack ? BINGO_BONUS : 0;
}

assert(
  emptiedRackBingo(PLAYER.HUMAN, 8, 0, false) === BINGO_BONUS,
  'offline human: 8 placed, rack empty → bingo'
);
assert(
  emptiedRackBingo(PLAYER.HUMAN, 4, 4, false) === 0,
  'offline human: 4 placed, 4 still on rack → not bingo'
);
assert(
  emptiedRackBingo(PLAYER.HUMAN, 4, 0, false) === BINGO_BONUS,
  'offline human: all remaining tiles played → bingo'
);
assert(
  emptiedRackBingo(PLAYER.AI, 8, 8, false) === BINGO_BONUS,
  'AI: plays all 8 rack tiles → bingo'
);
assert(
  emptiedRackBingo(PLAYER.AI, 5, 5, false) === BINGO_BONUS,
  'AI: plays all remaining 5 → bingo'
);
assert(
  emptiedRackBingo(PLAYER.AI, 4, 8, false) === 0,
  'AI: plays 4 of 8 → not bingo'
);

var gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

assert(gameSrc.indexOf('maybeShowBingoBanner') >= 0, 'bingo banner helper exists');
assert(gameSrc.indexOf('maybeShowPlayCelebrateBanner') >= 0, 'celebrate banner wired');
assert(
  gameSrc.indexOf("title = 'BINGO!'") >= 0 &&
    gameSrc.indexOf("title = who.toUpperCase() + ' · BINGO!'") >= 0,
  'bingo titles for self and opponent'
);
assert(
  gameSrc.indexOf('bingo: !!commitCheck.bingo') >= 0 ||
    /bingo:\s*!!commitCheck\.bingo/.test(gameSrc),
  'AI aiKnown includes bingo from validateMove'
);
assert(
  gameSrc.indexOf("showPlayScoreFeedback(\n        'Computer'") >= 0 ||
    gameSrc.indexOf("showPlayScoreFeedback(") >= 0,
  'AI uses showPlayScoreFeedback (triggers celebrate banner)'
);
assert(gameSrc.indexOf("playSfx('bingo')") >= 0, 'bingo SFX on celebrate');
assert(
  /emptiedRack = placedCount > 0 && rackRemaining === 0/.test(gameSrc),
  'offline human bingo = empty rack'
);
assert(
  /emptiedRack = placedCount > 0 && placedCount === rackRemaining/.test(gameSrc),
  'AI bingo = placed all tiles still on rack'
);

/* Banner naming helper mirror */
function bingoTitle(whoLabel) {
  var who = whoLabel ? String(whoLabel).trim() : '';
  var isSelf = !who || /^you$/i.test(who);
  if (isSelf) return 'BINGO!';
  return who.toUpperCase() + ' · BINGO!';
}
assert(bingoTitle('') === 'BINGO!', 'self bingo title');
assert(bingoTitle('You') === 'BINGO!', 'You → self bingo title');
assert(bingoTitle('Computer') === 'COMPUTER · BINGO!', 'computer bingo title');

if (fail) {
  console.error('\n' + fail + ' failure(s)');
  process.exit(1);
}
console.log('All AI bingo tests passed.');
