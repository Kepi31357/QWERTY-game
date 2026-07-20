'use strict';

/**
 * Starting-square safety for openings.
 * Run: node server/test-start-square.js
 */

var path = require('path');
var api = require(path.join(__dirname, '..', 'getAllWordsFormed.js'));
var scoreApi = require(path.join(__dirname, '..', 'validateAndScorePlacement.js'));

var getAllWordsFormed = api.getAllWordsFormed;
var getPlayerStartSquare = api.getPlayerStartSquare;
var getPlayerStartIdx = api.getPlayerStartIdx;
var attemptPlace = scoreApi.attemptPlace;

var COLS = 15;
var ROWS = 15;
var PLAYER = { P1: 0, P2: 1 };
var START_P1 = getPlayerStartIdx(0, COLS, ROWS);
var START_P2 = getPlayerStartIdx(1, COLS, ROWS);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function emptyBoard() {
  return new Array(COLS * ROWS).fill(null);
}

assert(getPlayerStartSquare('player1', COLS, ROWS).row === ROWS - 1, 'P1 start bottom-left row');
assert(getPlayerStartSquare('player1', COLS, ROWS).col === 0, 'P1 start bottom-left col');
assert(getPlayerStartSquare('player2', COLS, ROWS).row === 0, 'P2 start top-right row');
assert(getPlayerStartSquare('player2', COLS, ROWS).col === COLS - 1, 'P2 start top-right col');
assert(START_P1 === (ROWS - 1) * COLS, 'P1 start idx');
assert(START_P2 === COLS - 1, 'P2 start idx');

/* Opening off-start rejected */
(function () {
  var board = emptyBoard();
  var formed = getAllWordsFormed(
    (function () {
      var b = emptyBoard();
      b[7 * COLS + 7] = { letter: 'A', owner: PLAYER.P1 };
      b[7 * COLS + 8] = { letter: 'T', owner: PLAYER.P1 };
      return b;
    })(),
    [7 * COLS + 7, 7 * COLS + 8],
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      boardBefore: board,
      debug: true,
    }
  );
  assert(!!formed.error, 'opening off-start returns error');
  assert(
    /starting square/i.test(formed.error),
    'error mentions starting square: ' + formed.error
  );
  assert(formed.words.length === 0, 'no words when start rule fails');
})();

/* Opening on start accepted */
(function () {
  var board = emptyBoard();
  var row = Math.floor(START_P1 / COLS);
  var col = START_P1 % COLS;
  var after = emptyBoard();
  after[START_P1] = { letter: 'A', owner: PLAYER.P1 };
  after[row * COLS + col + 1] = { letter: 'T', owner: PLAYER.P1 };
  var formed = getAllWordsFormed(after, [START_P1, row * COLS + col + 1], {
    player: PLAYER.P1,
    startIdx: START_P1,
    boardBefore: board,
  });
  assert(!formed.error, 'opening on start has no error');
  assert(formed.main && formed.main.word === 'AT', 'forms AT on start');
})();

/* attemptPlace opening off-start */
(function () {
  var result = attemptPlace(
    emptyBoard(),
    [
      { idx: 7 * COLS + 7, letter: 'A' },
      { idx: 7 * COLS + 8, letter: 'T' },
    ],
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      rackTileCount: 8,
      isValidWord: function (w) {
        return w === 'AT';
      },
    }
  );
  assert(!result.success, 'attemptPlace rejects opening off-start');
  assert(/starting square/i.test(result.error || ''), 'attemptPlace error: ' + result.error);
})();

console.log('All start-square tests passed.');
