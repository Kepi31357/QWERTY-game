'use strict';

/**
 * Build 220 — opening start rule: ≥1 tile on start (not first/last only).
 * HITTER with H on P2 start, horizontal and vertical. P1 BRAVE on BL.
 * Run: node server/test-hitter-start.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var PLAYER = engine.PLAYER;
var COLS = 15;
var START_P1_IDX = 14 * COLS + 0;
var START_P2_IDX = COLS - 1;

function emptyState() {
  return engine.createInitialState(function () {
    return 0.5;
  });
}

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + player + i };
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

/* --- P2 HITTER horizontal: H on top-right start, extend left --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'HITTERXX');
  var cells = [
    START_P2_IDX,
    0 * COLS + 13,
    0 * COLS + 12,
    0 * COLS + 11,
    0 * COLS + 10,
    0 * COLS + 9,
  ];
  var r = engine.applyPlay(
    st,
    [
      { idx: cells[0], letter: 'H', rackIndex: 0 },
      { idx: cells[1], letter: 'I', rackIndex: 1 },
      { idx: cells[2], letter: 'T', rackIndex: 2 },
      { idx: cells[3], letter: 'T', rackIndex: 3 },
      { idx: cells[4], letter: 'E', rackIndex: 4 },
      { idx: cells[5], letter: 'R', rackIndex: 5 },
    ],
    PLAYER.P2,
    { intendedWord: 'HITTER', wordCells: cells }
  );
  assert(r.valid && r.word === 'HITTER', 'P2 HITTER H-on-start horizontal: ' + (r.reason || r.word));
  /* Fixed camera remaps reverse placement → LTR HITTER (R on start). */
  assert(st.board[START_P2_IDX].letter === 'R', 'P2 HITTER remaps to LTR with R on start');
  var row = '';
  for (var c = 9; c <= 14; c++) row += st.board[0 * COLS + c].letter;
  assert(row === 'HITTER', 'P2 HITTER stores LTR: ' + row);
})();

/* --- P2 HITTER vertical: H on top-right start, grow down --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'HITTERXX');
  var cells = [
    START_P2_IDX,
    1 * COLS + 14,
    2 * COLS + 14,
    3 * COLS + 14,
    4 * COLS + 14,
    5 * COLS + 14,
  ];
  var r = engine.applyPlay(
    st,
    [
      { idx: cells[0], letter: 'H', rackIndex: 0 },
      { idx: cells[1], letter: 'I', rackIndex: 1 },
      { idx: cells[2], letter: 'T', rackIndex: 2 },
      { idx: cells[3], letter: 'T', rackIndex: 3 },
      { idx: cells[4], letter: 'E', rackIndex: 4 },
      { idx: cells[5], letter: 'R', rackIndex: 5 },
    ],
    PLAYER.P2,
    { intendedWord: 'HITTER', wordCells: cells }
  );
  assert(r.valid && r.word === 'HITTER', 'P2 HITTER H-on-start vertical: ' + (r.reason || r.word));
  assert(st.board[START_P2_IDX].letter === 'H', 'P2 vertical HITTER keeps H on start');
})();

/* --- P2 HITTER vertical with last letter R on start (grow toward corner) --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'HITTERXX');
  var cells = [
    5 * COLS + 14,
    4 * COLS + 14,
    3 * COLS + 14,
    2 * COLS + 14,
    1 * COLS + 14,
    START_P2_IDX,
  ];
  var r = engine.applyPlay(
    st,
    [
      { idx: 5 * COLS + 14, letter: 'H', rackIndex: 0 },
      { idx: 4 * COLS + 14, letter: 'I', rackIndex: 1 },
      { idx: 3 * COLS + 14, letter: 'T', rackIndex: 2 },
      { idx: 2 * COLS + 14, letter: 'T', rackIndex: 3 },
      { idx: 1 * COLS + 14, letter: 'E', rackIndex: 4 },
      { idx: START_P2_IDX, letter: 'R', rackIndex: 5 },
    ],
    PLAYER.P2,
    { intendedWord: 'HITTER', wordCells: cells }
  );
  assert(r.valid && r.word === 'HITTER', 'P2 HITTER R-on-start vertical: ' + (r.reason || r.word));
  assert(st.board[START_P2_IDX].letter === 'H', 'P2 R-on-start remaps to HITTER TTB (H on start)');
  assert(readVertFix(st, 14, 0, 6) === 'HITTER', 'HITTER TTB after remap');
})();

function readVertFix(st, col, startRow, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var cell = st.board[(startRow + i) * 15 + col];
    out += cell ? cell.letter : '?';
  }
  return out;
}

/* --- P1 BRAVE horizontal: B on bottom-left start --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P1, 'BRAVEXXX');
  var r = engine.applyPlay(
    st,
    [
      { idx: START_P1_IDX, letter: 'B', rackIndex: 0 },
      { idx: 14 * COLS + 1, letter: 'R', rackIndex: 1 },
      { idx: 14 * COLS + 2, letter: 'A', rackIndex: 2 },
      { idx: 14 * COLS + 3, letter: 'V', rackIndex: 3 },
      { idx: 14 * COLS + 4, letter: 'E', rackIndex: 4 },
    ],
    PLAYER.P1
  );
  assert(r.valid && r.word === 'BRAVE', 'P1 BRAVE B-on-start: ' + (r.reason || r.word));
  assert(st.board[START_P1_IDX].letter === 'B', 'P1 keeps B on start');
})();

/* --- P1 opening must still cover start --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P1, 'BRAVEXXX');
  var r = engine.validateMove(
    st,
    [
      { idx: 14 * COLS + 1, letter: 'B', rackIndex: 0 },
      { idx: 14 * COLS + 2, letter: 'R', rackIndex: 1 },
      { idx: 14 * COLS + 3, letter: 'A', rackIndex: 2 },
      { idx: 14 * COLS + 4, letter: 'V', rackIndex: 3 },
      { idx: 14 * COLS + 5, letter: 'E', rackIndex: 4 },
    ],
    PLAYER.P1
  );
  assert(!r.valid, 'P1 opening off-start rejected: ' + (r.reason || ''));
})();

/* --- P2 opening must still cover start --- */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'HITTERXX');
  var r = engine.validateMove(
    st,
    [
      { idx: 0 * COLS + 12, letter: 'H', rackIndex: 0 },
      { idx: 0 * COLS + 11, letter: 'I', rackIndex: 1 },
      { idx: 0 * COLS + 10, letter: 'T', rackIndex: 2 },
      { idx: 0 * COLS + 9, letter: 'T', rackIndex: 3 },
      { idx: 0 * COLS + 8, letter: 'E', rackIndex: 4 },
      { idx: 0 * COLS + 7, letter: 'R', rackIndex: 5 },
    ],
    PLAYER.P2
  );
  assert(!r.valid, 'P2 opening off-start rejected: ' + (r.reason || ''));
})();

console.log('All HITTER / start-square tests passed.');
