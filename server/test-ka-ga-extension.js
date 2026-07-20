'use strict';

/**
 * GA + KA extension / connection-bonus regression.
 * Run: node server/test-ka-ga-extension.js
 *
 * Scenario (screenshot-style):
 * - Opponent has GA on the board
 * - Player places K (or K+A) extending the line to the full word
 * - Full run must be extracted; connection bonus counts every opponent
 *   tile inside formed words (not only edge-adjacent).
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var formedApi = require('../getAllWordsFormed.js');
var scoreApi = require('../validateAndScorePlacement.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var COLS = 15;
var PLAYER = engine.PLAYER;
var getAllWordsFormed = formedApi.getAllWordsFormed;
var attemptPlace = scoreApi.attemptPlace;
var START_P1 = (15 - 1) * COLS;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function idx(row, col) {
  return row * COLS + col;
}

function emptyBoard() {
  return new Array(COLS * 15).fill(null);
}

function emptyState() {
  return engine.createInitialState(function () {
    return 0.5;
  });
}

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + i };
  });
  while (state.racks[player].length < 8) state.racks[player].push(null);
}

/* --- Extraction: existing GA, place K before G → full KGA --- */
(function () {
  var board = emptyBoard();
  var row = 8;
  board[idx(row, 5)] = { letter: 'G', owner: PLAYER.P2 };
  board[idx(row, 6)] = { letter: 'A', owner: PLAYER.P2 };
  board[idx(row, 4)] = { letter: 'K', owner: PLAYER.P1 };
  var placed = [idx(row, 4)];

  console.log('--- KA/GA debug: place K extending GA ---');
  var raw = getAllWordsFormed(board, placed, { debug: true });

  assert(raw.main && raw.main.word === 'KGA', 'full word KGA extracted (not just KA or GA)');
  assert(
    raw.main.positions.length === 3 &&
      raw.main.positions[0] === idx(row, 4) &&
      raw.main.positions[2] === idx(row, 6),
    'KGA positions cover K,G,A LTR'
  );
})();

/* --- Extraction: existing GA, place K and A after → GAKA --- */
(function () {
  var board = emptyBoard();
  var row = 9;
  board[idx(row, 5)] = { letter: 'G', owner: PLAYER.P2 };
  board[idx(row, 6)] = { letter: 'A', owner: PLAYER.P2 };
  board[idx(row, 7)] = { letter: 'K', owner: PLAYER.P1 };
  board[idx(row, 8)] = { letter: 'A', owner: PLAYER.P1 };
  var placed = [idx(row, 8), idx(row, 7)]; /* unsorted on purpose */

  console.log('--- KA/GA debug: place KA extending GA ---');
  var raw = getAllWordsFormed(board, placed, { debug: true });

  assert(raw.main && raw.main.word === 'GAKA', 'full word GAKA extracted from GA+KA');
  assert(
    !raw.words.some(function (w) {
      return w.word === 'KA' && w.isMain;
    }),
    'main must be full GAKA, not just KA'
  );
})();

/* --- Scoring: opponent tiles in formed word all count --- */
(function () {
  var board = emptyBoard();
  var row = 8;
  board[START_P1] = { letter: 'Q', owner: PLAYER.P1 };
  board[idx(row, 5)] = { letter: 'G', owner: PLAYER.P2 };
  board[idx(row, 6)] = { letter: 'A', owner: PLAYER.P2 };
  var result = attemptPlace(
    board,
    [{ idx: idx(row, 4), letter: 'K' }],
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      rackTileCount: 5,
      isValidWord: function (w) {
        return w === 'KGA' || w === 'KA' || w === 'GA';
      },
    }
  );
  console.log('--- KA/GA score result ---', {
    success: result.success,
    wordsFormed: (result.wordsFormed || []).map(function (w) {
      return w.word;
    }),
    bonusConnections: result.bonusConnections,
    score: result.score,
    error: result.error,
  });
  assert(result.success, 'KGA placement succeeds with test dictionary');
  assert(result.wordsFormed[0].word === 'KGA', 'scored word is full KGA');
  assert(
    result.bonusConnections === 2,
    'connection bonus counts G and A (2), not only edge-adjacent G'
  );
  assert(result.score === 10 + 75 * 2, 'score = 10 + 75*2');
})();

/* --- Engine live path: LO + G → LOG, bonus 2 --- */
(function () {
  var st = emptyState();
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[START_P1] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[idx(7, 4)] = { letter: 'L', owner: PLAYER.P2 };
  st.board[idx(7, 5)] = { letter: 'O', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'GXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: idx(7, 6), letter: 'G', rackIndex: 0 }],
    PLAYER.P1,
    { debugWords: true }
  );
  assert(r.valid && r.word === 'LOG', 'engine LOG extension valid');
  assert(r.bonusConnections === 2, 'engine LOG bonusConnections=2 (L and O)');
  assert(r.linkBonus === 150, 'engine LOG linkBonus 150');
  assert(r.letterScore === 10, 'engine LOG base 10');
  assert(r.score === 160, 'engine LOG total 160');
})();

console.log('All KA/GA extension tests passed.');
