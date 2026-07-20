'use strict';

/**
 * Build 219 — logical board shared; guest flip is display-only.
 * Run: node server/test-guest-display.js
 */

var fs = require('fs');
var vm = require('vm');
var engine = require('../game-engine.js');
var boardView = require('../board-view.js');

var COLS = engine.COLS;
var ROWS = engine.ROWS;
var PLAYER = engine.PLAYER;
var START_P1_IDX = (ROWS - 1) * COLS;
var START_P2_IDX = COLS - 1;

var dictSrc = fs.readFileSync(require('path').join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

function readH(board, row, col0, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    out += board[row * COLS + col0 + i] ? board[row * COLS + col0 + i].letter : '?';
  }
  return out;
}

function readV(board, col, row0, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    out += board[(row0 + i) * COLS + col] ? board[(row0 + i) * COLS + col].letter : '?';
  }
  return out;
}

/* Guest flip: P2 start → visual BL */
if (!boardView.viewerNeedsFlip(1)) {
  console.error('FAIL guest must flip');
  process.exit(1);
}
var p2 = boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS);
if (p2.row !== ROWS - 1 || p2.col !== 0) {
  console.error('FAIL P2 start must be guest visual BL', p2);
  process.exit(1);
}
var p1 = boardView.getVisualPosition(0, { row: ROWS - 1, col: 0 }, ROWS, COLS);
if (p1.row !== ROWS - 1 || p1.col !== 0) {
  console.error('FAIL host P1 start stays bottom-left', p1);
  process.exit(1);
}
console.log('OK guest flip: P2 visual BL; host P1 BL');

/* GROUPS + GETTER identical for host and guest */
var st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'GROUPSXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var r = engine.applyPlay(st, [
  { idx: 14 * COLS + 0, letter: 'G', rackIndex: 0 },
  { idx: 14 * COLS + 1, letter: 'R', rackIndex: 1 },
  { idx: 14 * COLS + 2, letter: 'O', rackIndex: 2 },
  { idx: 14 * COLS + 3, letter: 'U', rackIndex: 3 },
  { idx: 14 * COLS + 4, letter: 'P', rackIndex: 4 },
  { idx: 14 * COLS + 5, letter: 'S', rackIndex: 5 },
], PLAYER.P1);
if (!r.valid) {
  console.error('FAIL GROUPS:', r.reason);
  process.exit(1);
}
st.racks[PLAYER.P1] = 'ETTERXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'b' + i };
});
r = engine.applyPlay(st, [
  { idx: 13 * COLS + 0, letter: 'E', rackIndex: 0 },
  { idx: 12 * COLS + 0, letter: 'T', rackIndex: 1 },
  { idx: 11 * COLS + 0, letter: 'T', rackIndex: 2 },
  { idx: 10 * COLS + 0, letter: 'E', rackIndex: 3 },
  { idx: 9 * COLS + 0, letter: 'R', rackIndex: 4 },
], PLAYER.P1);
if (!r.valid) {
  console.error('FAIL GETTER:', r.reason);
  process.exit(1);
}

var viewP1 = engine.getClientView(st, 0);
var viewP2 = engine.getClientView(st, 1);
if (readH(viewP1.board, 14, 0, 6) !== 'GROUPS' || readH(viewP2.board, 14, 0, 6) !== 'GROUPS') {
  console.error('FAIL both must see GROUPS LTR');
  process.exit(1);
}
if (readV(viewP1.board, 0, 9, 6) !== readV(viewP2.board, 0, 9, 6)) {
  console.error('FAIL host/guest vertical arm mismatch');
  process.exit(1);
}
/* G on BL start + grow up → TTB board spelling is reverse of GETTER; both seats match. */
if (readV(viewP1.board, 0, 9, 6) !== 'RETTEG') {
  console.error('FAIL expected RETTEG TTB from GETTER growing up from G', readV(viewP1.board, 0, 9, 6));
  process.exit(1);
}
var runs = (viewP2.acceptedRuns || []).map(function (run) { return run.word; });
if (runs.indexOf('GROUPS') < 0 || runs.indexOf('GETTER') < 0) {
  console.error('FAIL acceptedRuns', runs);
  process.exit(1);
}
console.log('OK GROUPS+GETTER identical for host and guest (accepted GETTER)');

/* Word-oriented SAT */
st = engine.createInitialState(function () { return 0.5; });
st.boardsLinked = true;
st.openingPlayed = [true, true];
st.firstMovePlayed = true;
st.board[START_P2_IDX] = { letter: 'Q', owner: PLAYER.P2, isBlank: false };
st.board[7 * COLS + 7] = { letter: 'A', owner: PLAYER.P1, isBlank: false };
st.board[7 * COLS + 8] = { letter: 'T', owner: PLAYER.P1, isBlank: false };
st.racks[PLAYER.P2] = 'SXXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 's' + i };
});
r = engine.validateMove(st, [
  { idx: 7 * COLS + 6, letter: 'S', rackIndex: 0 },
], PLAYER.P2, {
  intendedWord: 'SAT',
  wordCells: [7 * COLS + 6, 7 * COLS + 7, 7 * COLS + 8],
});
if (!r.valid || r.word !== 'SAT') {
  console.error('FAIL SAT:', r);
  process.exit(1);
}
console.log('OK word-oriented submit accepts SAT');

/* Reverse intent TAS is remapped to formed LTR SAT on shared camera */
r = engine.validateMove(st, [
  { idx: 7 * COLS + 6, letter: 'S', rackIndex: 0 },
], PLAYER.P2, {
  intendedWord: 'TAS',
  wordCells: [7 * COLS + 8, 7 * COLS + 7, 7 * COLS + 6],
});
if (!r.valid || (r.word !== 'SAT' && r.word !== 'TAS')) {
  console.error('FAIL reverse intent should still form a valid play', r);
  process.exit(1);
}
console.log('OK reverse visual intent still validates via formed LTR/TTB');

/* BURN: first on TR, grow down — both see BURN */
st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P2] = 'BURNXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'n' + i };
});
r = engine.applyPlay(st, [
  { idx: 0 * COLS + 14, letter: 'B', rackIndex: 0 },
  { idx: 1 * COLS + 14, letter: 'U', rackIndex: 1 },
  { idx: 2 * COLS + 14, letter: 'R', rackIndex: 2 },
  { idx: 3 * COLS + 14, letter: 'N', rackIndex: 3 },
], PLAYER.P2, {
  intendedWord: 'BURN',
  wordCells: [0 * COLS + 14, 1 * COLS + 14, 2 * COLS + 14, 3 * COLS + 14],
});
if (!r.valid || r.word !== 'BURN') {
  console.error('FAIL BURN opening:', r);
  process.exit(1);
}
if (readV(st.board, 14, 0, 4) !== 'BURN') {
  console.error('FAIL BURN TTB store expected BURN, got', readV(st.board, 14, 0, 4));
  process.exit(1);
}
viewP1 = engine.getClientView(st, 0);
viewP2 = engine.getClientView(st, 1);
if (readV(viewP1.board, 14, 0, 4) !== 'BURN' || readV(viewP2.board, 14, 0, 4) !== 'BURN') {
  console.error('FAIL both views must show BURN');
  process.exit(1);
}
console.log('OK BURN TTB identical for host and guest');

console.log('All guest-display / logical-board tests passed.');
