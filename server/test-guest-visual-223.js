'use strict';

/**
 * Build 226 — shared fixed board (no guest flip).
 * Run: node server/test-guest-visual-223.js
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

function assert(cond, msg, detail) {
  if (!cond) {
    console.error('FAIL', msg, detail || '');
    process.exit(1);
  }
  console.log('OK', msg);
}

assert(boardView.viewerNeedsFlip(0) === false, 'host no flip');
assert(boardView.viewerNeedsFlip(1) === false, 'guest no flip');

var p2v = boardView.getVisualPosition(1, { row: 0, col: COLS - 1 }, ROWS, COLS);
assert(p2v.row === 0 && p2v.col === COLS - 1, 'guest sees P2 start top-right', p2v);

var p1v = boardView.getVisualPosition(0, { row: ROWS - 1, col: 0 }, ROWS, COLS);
assert(p1v.row === ROWS - 1 && p1v.col === 0, 'host P1 bottom-left', p1v);

var click = boardView.logicalIdxFromVisualRowCol(1, ROWS - 1, 0, ROWS, COLS);
assert(click === START_P1, 'guest click BL → P1 start (shared board)');

var st = engine.createInitialState(function () {
  return 0.5;
});
st.racks[PLAYER.P1] = 'ALOESXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var aloes = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3, START_P1 + 4];
var r = engine.applyPlay(
  st,
  aloes.map(function (idx, i) {
    return { idx: idx, letter: 'ALOES'.charAt(i), rackIndex: i };
  }),
  PLAYER.P1
);
assert(r.valid && r.word === 'ALOES', 'ALOES play');

var logical = boardView.readLogicalHorizontal(st.board, ROWS - 1, 0, 5, COLS, letterAt);
assert(logical === 'ALOES', 'logical ALOES');

var guestRaw = boardView.readVisualRun(st.board, 1, aloes, true, ROWS, COLS, letterAt).text;
assert(guestRaw === 'ALOES', 'guest same view ALOES (no flip)', guestRaw);

var guestDisp = boardView.buildViewerDisplayBoard(
  st.board,
  1,
  st.acceptedRuns || [{ word: 'ALOES', cells: aloes }],
  ROWS,
  COLS
);
var guestPaint = boardView.readVisualRun(guestDisp, 1, aloes, true, ROWS, COLS, letterAt).text;
assert(guestPaint === 'ALOES', 'guest display ALOES', guestPaint);

st.racks[PLAYER.P2] = 'RADIOXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'b' + i };
});
var radio = [
  START_P2,
  START_P2 + COLS,
  START_P2 + 2 * COLS,
  START_P2 + 3 * COLS,
  START_P2 + 4 * COLS,
];
r = engine.applyPlay(
  st,
  radio.map(function (idx, i) {
    return { idx: idx, letter: 'RADIO'.charAt(i), rackIndex: i };
  }),
  PLAYER.P2
);
assert(r.valid && r.word === 'RADIO', 'RADIO play: ' + (r.reason || r.word));

var logicalV = boardView.readLogicalVertical(st.board, COLS - 1, 0, 5, COLS, letterAt);
assert(logicalV === 'RADIO', 'logical RADIO TTB');

guestDisp = boardView.buildViewerDisplayBoard(st.board, 1, st.acceptedRuns || [], ROWS, COLS);
guestPaint = boardView.readVisualRun(guestDisp, 1, radio, false, ROWS, COLS, letterAt).text;
assert(guestPaint === 'RADIO', 'guest sees RADIO (shared)', guestPaint);

assert(boardView.assertRoundTrip(1, ROWS, COLS).ok, 'guest round-trip');

console.log('All shared fixed-board visual tests passed.');
