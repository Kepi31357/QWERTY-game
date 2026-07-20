'use strict';

/**
 * Build 221 — shared fixed board: no flip; LTR/TTB storage; RADIO/QUIRT/WEAN.
 * Run: node server/test-fixed-camera.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var boardView = require('../board-view.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var PLAYER = engine.PLAYER;
var COLS = 15;
var ROWS = 15;
var START_P1 = 14 * COLS;
var START_P2 = COLS - 1;

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

function readVert(state, col, startRow, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var cell = state.board[(startRow + i) * COLS + col];
    out += cell ? cell.letter : '?';
  }
  return out;
}

function readHoriz(state, row, startCol, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var cell = state.board[row * COLS + startCol + i];
    out += cell ? cell.letter : '?';
  }
  return out;
}

assert(boardView.viewerNeedsFlip(0) === false, 'host no flip');
assert(boardView.viewerNeedsFlip(1) === true, 'guest flips');
assert(
  boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS).row === ROWS - 1 &&
    boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS).col === 0,
  'guest sees P2 start at visual bottom-left'
);
assert(
  boardView.getVisualPosition(0, { row: ROWS - 1, col: 0 }, ROWS, COLS).row === ROWS - 1,
  'host sees P1 start at bottom-left'
);

/* P1 WEAN vertical from BL area */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P1, 'WEANXXXX');
  var r = engine.applyPlay(st, [
    { idx: 11 * COLS + 0, letter: 'W', rackIndex: 0 },
    { idx: 12 * COLS + 0, letter: 'E', rackIndex: 1 },
    { idx: 13 * COLS + 0, letter: 'A', rackIndex: 2 },
    { idx: START_P1, letter: 'N', rackIndex: 3 },
  ], PLAYER.P1);
  assert(r.valid && r.word === 'WEAN', 'P1 WEAN accepted: ' + (r.reason || r.word));
  assert(readVert(st, 0, 11, 4) === 'WEAN', 'P1 WEAN stores top-to-bottom');
})();

/* P2 QUIRT placed physically reversed (TRIUQ on board) → store QUIRT TTB */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'QUIRTXXX');
  var r = engine.applyPlay(st, [
    { idx: START_P2, letter: 'T', rackIndex: 0 },
    { idx: 1 * COLS + 14, letter: 'R', rackIndex: 1 },
    { idx: 2 * COLS + 14, letter: 'I', rackIndex: 2 },
    { idx: 3 * COLS + 14, letter: 'U', rackIndex: 3 },
    { idx: 4 * COLS + 14, letter: 'Q', rackIndex: 4 },
  ], PLAYER.P2);
  assert(r.valid && r.word === 'QUIRT', 'P2 QUIRT from reverse placement: ' + (r.reason || r.word));
  assert(readVert(st, 14, 0, 5) === 'QUIRT', 'QUIRT stores TTB not TRIUQ: ' + readVert(st, 14, 0, 5));
  assert(st.board[START_P2].letter === 'Q', 'after remap Q sits on start');
})();

/* P2 OIL reverse physical (LIO) → OIL TTB */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'OILXXXXX');
  var r = engine.applyPlay(st, [
    { idx: START_P2, letter: 'L', rackIndex: 0 },
    { idx: 1 * COLS + 14, letter: 'I', rackIndex: 1 },
    { idx: 2 * COLS + 14, letter: 'O', rackIndex: 2 },
  ], PLAYER.P2);
  assert(r.valid && r.word === 'OIL', 'P2 OIL from reverse: ' + (r.reason || r.word));
  assert(readVert(st, 14, 0, 3) === 'OIL', 'OIL stores TTB not ILO: ' + readVert(st, 14, 0, 3));
})();

/* P2 JOINTED LTR ending on start */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'JOINTEDX');
  var r = engine.applyPlay(st, [
    { idx: 0 * COLS + 8, letter: 'J', rackIndex: 0 },
    { idx: 0 * COLS + 9, letter: 'O', rackIndex: 1 },
    { idx: 0 * COLS + 10, letter: 'I', rackIndex: 2 },
    { idx: 0 * COLS + 11, letter: 'N', rackIndex: 3 },
    { idx: 0 * COLS + 12, letter: 'T', rackIndex: 4 },
    { idx: 0 * COLS + 13, letter: 'E', rackIndex: 5 },
    { idx: START_P2, letter: 'D', rackIndex: 6 },
  ], PLAYER.P2);
  assert(r.valid && r.word === 'JOINTED', 'P2 JOINTED: ' + (r.reason || r.word));
  assert(readHoriz(st, 0, 8, 7) === 'JOINTED', 'JOINTED LTR');
})();

/* P2 RADIO vertical TTB from TR start */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'RADIOXXX');
  var r = engine.applyPlay(st, [
    { idx: START_P2, letter: 'R', rackIndex: 0 },
    { idx: 1 * COLS + 14, letter: 'A', rackIndex: 1 },
    { idx: 2 * COLS + 14, letter: 'D', rackIndex: 2 },
    { idx: 3 * COLS + 14, letter: 'I', rackIndex: 3 },
    { idx: 4 * COLS + 14, letter: 'O', rackIndex: 4 },
  ], PLAYER.P2);
  assert(r.valid && r.word === 'RADIO', 'P2 RADIO opening: ' + (r.reason || r.word));
  assert(readVert(st, 14, 0, 5) === 'RADIO', 'RADIO stores TTB');
})();

/* Invalid SA still rejected */
(function () {
  var st = emptyState();
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[7 * COLS + 7] = { letter: 'A', owner: PLAYER.P1, isBlank: false };
  setRack(st, PLAYER.P1, 'SXXXXXXX');
  var bad = engine.validateMove(st, [
    { idx: 7 * COLS + 6, letter: 'S', rackIndex: 0 },
  ], PLAYER.P1, { intendedWord: 'SA', wordCells: [7 * COLS + 6, 7 * COLS + 7] });
  assert(!bad.valid, 'SA still rejected');
})();

console.log('All fixed-camera tests passed.');
