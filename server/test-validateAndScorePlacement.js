'use strict';

/**
 * Integration tests for validateAndScorePlacement / attemptPlace.
 * Run: node server/test-validateAndScorePlacement.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var api = require(path.join(__dirname, '..', 'validateAndScorePlacement.js'));
var attemptPlace = api.attemptPlace;
var TILE_POINTS = api.TILE_POINTS;
var CONNECTION_BONUS = api.CONNECTION_BONUS;
var BINGO_BONUS = api.BINGO_BONUS;

var COLS = 15;
var ROWS = 15;
var START_P1 = (ROWS - 1) * COLS; /* bottom-left */
var PLAYER = { P1: 0, P2: 1 };

var DICT = {};

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  var list = sandbox.window.QWERTY_WORD_LIST || [];
  var i;
  for (i = 0; i < list.length; i++) {
    DICT[String(list[i]).toLowerCase()] = true;
  }
  /* Screenshot / Phase 2.5 fixture word (not in base list). */
  DICT.valin = true;
}

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  return !!DICT[String(word).toLowerCase()];
}

function emptyBoard() {
  return new Array(COLS * ROWS).fill(null);
}

function idx(row, col) {
  return row * COLS + col;
}

function setOwned(board, row, col, letter, owner) {
  board[idx(row, col)] = { letter: letter, owner: owner };
}

function placementsFrom(specs) {
  return specs.map(function (s) {
    return { idx: idx(s.row, s.col), letter: s.letter };
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function wordsList(result) {
  return result.wordsFormed
    .map(function (w) {
      return w.word;
    })
    .sort();
}

loadDictionary();

/* --- 1. SUP (mobile screenshot): 3 tiles on start, no bingo, no connection --- */
(function () {
  var board = emptyBoard();
  var row = Math.floor(START_P1 / COLS);
  var col = START_P1 % COLS;
  var result = attemptPlace(
    board,
    placementsFrom([
      { row: row, col: col, letter: 'S' },
      { row: row, col: col + 1, letter: 'U' },
      { row: row, col: col + 2, letter: 'P' },
    ]),
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      isValidWord: isValidWord,
      rackTileCount: 8,
    }
  );
  assert(result.success, 'SUP placement succeeds');
  assert(result.wordsFormed.some(function (w) { return w.word === 'SUP'; }), 'forms SUP LTR');
  assert(!result.wordsFormed.some(function (w) { return w.word === 'PUS'; }), 'does not reverse to PUS');
  assert(result.score === TILE_POINTS * 3, 'SUP score is 10*3=30');
  assert(result.bonusConnections === 0, 'SUP has no connection bonus');
  assert(result.bingo === false, 'SUP is not bingo (rack not emptied)');
  assert(result.newBoard[START_P1].letter === 'S', 'newBoard has S on start');
})();

/* --- 2. Vertical VALIN with cross AT --- */
(function () {
  var board = emptyBoard();
  /* Player already opened on start; mid-game extension */
  setOwned(board, 14, 0, 'Q', PLAYER.P1);
  /* Existing opponent T to the right of where A will land */
  setOwned(board, 4, 7, 'T', PLAYER.P2);
  /* VALIN in col 6, rows 3–7; A at (4,6) → cross AT */
  var result = attemptPlace(
    board,
    placementsFrom([
      { row: 3, col: 6, letter: 'V' },
      { row: 4, col: 6, letter: 'A' },
      { row: 5, col: 6, letter: 'L' },
      { row: 6, col: 6, letter: 'I' },
      { row: 7, col: 6, letter: 'N' },
    ]),
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      isValidWord: isValidWord,
      rackTileCount: 8,
    }
  );
  /* Connects via adjacency to T — not on start */
  assert(result.success, 'VALIN+AT placement succeeds');
  assert(result.wordsFormed.some(function (w) { return w.word === 'VALIN'; }), 'main VALIN top-to-bottom');
  assert(!result.wordsFormed.some(function (w) { return w.word === 'NILAV'; }), 'must not reverse VALIN');
  assert(result.wordsFormed.some(function (w) { return w.word === 'AT'; }), 'cross AT LTR');
  assert(!result.wordsFormed.some(function (w) { return w.word === 'TA'; }), 'must not reverse AT');
  assert(
    result.score === TILE_POINTS * 5 + TILE_POINTS * 2 + CONNECTION_BONUS,
    'VALIN score = 50 + 20 (AT) + 75 = 145'
  );
  assert(result.letterScore === 70, 'VALIN letterScore 70');
  assert(result.bonusConnections === 1, 'VALIN connects to one opponent tile');
  assert(result.linkBonus === CONNECTION_BONUS, 'linkBonus 75 once');
  assert(result.bingo === false, 'VALIN is not bingo');
})();

/* --- 3. Connection bonus only (+75): hook E under opponent H --- */
(function () {
  var board = emptyBoard();
  setOwned(board, 14, 0, 'Q', PLAYER.P1);
  setOwned(board, 10, 4, 'H', PLAYER.P2);
  var result = attemptPlace(
    board,
    placementsFrom([{ row: 11, col: 4, letter: 'E' }]),
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      isValidWord: isValidWord,
      rackTileCount: 5,
    }
  );
  assert(result.success, 'HE hook succeeds');
  assert(wordsList(result).join(',') === 'HE', 'only forms HE');
  assert(result.bonusConnections === 1, 'newly connected to distinct H only');
  assert(
    result.score === TILE_POINTS * 2 + CONNECTION_BONUS,
    'score = 20 (HE full length) + 75 connection'
  );
  assert(result.letterScore === 20, 'HE letterScore 20');
  assert(result.linkBonus === CONNECTION_BONUS, 'connect once');
  assert(result.bingo === false, 'single tile is not bingo');
})();

/* --- 4. Bingo: place all 7 remaining rack tiles → +100 --- */
(function () {
  var board = emptyBoard();
  var row = Math.floor(START_P1 / COLS);
  var col = START_P1 % COLS;
  var letters = 'LETTERS'.split('');
  var specs = letters.map(function (ch, i) {
    return { row: row, col: col + i, letter: ch };
  });
  var result = attemptPlace(board, placementsFrom(specs), {
    player: PLAYER.P1,
    startIdx: START_P1,
    isValidWord: isValidWord,
    rackTileCount: 7,
  });
  assert(result.success, 'LETTERS bingo placement succeeds');
  assert(result.wordsFormed.some(function (w) { return w.word === 'LETTERS'; }), 'forms LETTERS');
  assert(result.bingo === true, 'bingo flag true when rack emptied');
  assert(result.bonusConnections === 0, 'bingo opening has no opponent links');
  assert(
    result.score === TILE_POINTS * 7 + BINGO_BONUS,
    'bingo score = 70 + 100'
  );
})();

/* --- Rejection: reversed reading must not be invented; invalid word fails --- */
(function () {
  var board = emptyBoard();
  var row = Math.floor(START_P1 / COLS);
  var col = START_P1 % COLS;
  var result = attemptPlace(
    board,
    placementsFrom([
      { row: row, col: col, letter: 'X' },
      { row: row, col: col + 1, letter: 'Q' },
      { row: row, col: col + 2, letter: 'Z' },
    ]),
    {
      player: PLAYER.P1,
      startIdx: START_P1,
      isValidWord: isValidWord,
      rackTileCount: 8,
    }
  );
  assert(!result.success, 'XQZ rejected as invalid word');
  assert(!!result.error, 'error message present');
})();

console.log('All validateAndScorePlacement integration tests passed.');
