'use strict';

/**
 * Build 221 — shared fixed camera (no flip); logical board identical for both.
 * Run: node server/test-shared-camera.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var boardView = require('../board-view.js');
var engine = require('../game-engine.js');

var COLS = engine.COLS;
var ROWS = engine.ROWS;
var PLAYER = engine.PLAYER;
var START_P1 = (ROWS - 1) * COLS;
var START_P2 = COLS - 1;

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

function letterAt(board, idx) {
  return board[idx] && board[idx].letter
    ? String(board[idx].letter).toUpperCase()
    : null;
}

function readH(board, row, col0, len) {
  return boardView.readLogicalHorizontal(board, row, col0, len, COLS, letterAt);
}

function readV(board, col, row0, len) {
  return boardView.readLogicalVertical(board, col, row0, len, COLS, letterAt);
}

function assert(cond, msg, detail) {
  if (!cond) {
    console.error('FAIL', msg, detail || '');
    process.exit(1);
  }
}

assert(boardView.viewerNeedsFlip(0) === false, 'host no flip');
assert(boardView.viewerNeedsFlip(1) === true, 'guest flips');
assert(boardView.assertRoundTrip(0, ROWS, COLS).ok, 'host round-trip');
assert(boardView.assertRoundTrip(1, ROWS, COLS).ok, 'guest round-trip');
assert(
  boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS).row === ROWS - 1 &&
    boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS).col === 0,
  'P2 start is visual BL for guest'
);
console.log('OK guest 180° flip — START_P2 → visual bottom-left');

/* Deb TOOTS at BL — logical identical; guest paint restores LTR */
var st = engine.createInitialState(function () {
  return 0.5;
});
st.racks[PLAYER.P1] = 'TOOTSXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var toots = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3, START_P1 + 4];
var r = engine.applyPlay(
  st,
  toots.map(function (idx, i) {
    return { idx: idx, letter: 'TOOTS'.charAt(i), rackIndex: i };
  }),
  PLAYER.P1
);
assert(r.valid && r.word === 'TOOTS', 'TOOTS', r);
assert(readH(st.board, ROWS - 1, 0, 5) === 'TOOTS', 'logical TOOTS LTR');

var host = engine.getClientView(st, 0);
var guest = engine.getClientView(st, 1);
assert(readH(host.board, ROWS - 1, 0, 5) === 'TOOTS', 'host logical TOOTS');
assert(readH(guest.board, ROWS - 1, 0, 5) === 'TOOTS', 'guest logical TOOTS');
assert(
  boardView.readVisualRun(guest.board, 1, toots, true, ROWS, COLS, letterAt).text === 'STOOT',
  'guest raw flip is STOOT'
);
var guestDisp = boardView.buildViewerDisplayBoard(
  guest.board,
  1,
  guest.acceptedRuns || [{ word: 'TOOTS', cells: toots }],
  ROWS,
  COLS
);
assert(
  boardView.readVisualRun(guestDisp, 1, toots, true, ROWS, COLS, letterAt).text === 'TOOTS',
  'guest paint restores TOOTS'
);
console.log('OK logical TOOTS shared; guest paint restores LTR');

/* Blake BURN vertical: first letter on TR start, grow down — LTR storage from 218 */
st.racks[PLAYER.P2] = 'BURNXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'b' + i };
});
var burn = [
  0 * COLS + 14,
  1 * COLS + 14,
  2 * COLS + 14,
  3 * COLS + 14,
];
r = engine.applyPlay(
  st,
  burn.map(function (idx, i) {
    return { idx: idx, letter: 'BURN'.charAt(i), rackIndex: i };
  }),
  PLAYER.P2,
  { intendedWord: 'BURN', wordCells: burn }
);
assert(r.valid && r.word === 'BURN', 'BURN', r);
assert(readV(st.board, 14, 0, 4) === 'BURN', 'BURN stores TTB not NRUB', readV(st.board, 14, 0, 4));
host = engine.getClientView(st, 0);
guest = engine.getClientView(st, 1);
assert(readV(host.board, 14, 0, 4) === 'BURN', 'host BURN');
assert(readV(guest.board, 14, 0, 4) === 'BURN', 'guest logical BURN');
console.log('OK both players share logical BURN top-to-bottom');

/* Opening off-start rejected */
st = engine.createInitialState(function () {
  return 0.5;
});
st.racks[PLAYER.P2] = 'ATXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'c' + i };
});
r = engine.applyPlay(
  st,
  [
    { idx: 5 * COLS + 5, letter: 'A', rackIndex: 0 },
    { idx: 5 * COLS + 6, letter: 'T', rackIndex: 1 },
  ],
  PLAYER.P2
);
assert(!r.valid, 'P2 opening must cover start', r);
console.log('OK P2 opening requires top-right start');

st.racks[PLAYER.P1] = 'ATXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'd' + i };
});
r = engine.applyPlay(
  st,
  [
    { idx: 5 * COLS + 5, letter: 'A', rackIndex: 0 },
    { idx: 5 * COLS + 6, letter: 'T', rackIndex: 1 },
  ],
  PLAYER.P1
);
assert(!r.valid, 'P1 opening must cover start', r);
console.log('OK P1 opening requires bottom-left start');

console.log('All shared-camera / guest-flip tests passed.');
