'use strict';

/**
 * Build 223 — guest 180° flip + readable display paint.
 * Run: node server/test-guest-flip-bl.js
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
}

assert(boardView.viewerNeedsFlip(0) === false, 'host no flip');
assert(boardView.viewerNeedsFlip(1) === true, 'guest flips');
assert(boardView.assertRoundTrip(1, ROWS, COLS).ok, 'guest round-trip');

var p2 = boardView.rowColFromIdx(START_P2, COLS);
var p2v = boardView.getVisualPosition(1, p2, ROWS, COLS);
assert(p2v.row === ROWS - 1 && p2v.col === 0, 'guest maps START_P2 to visual bottom-left', p2v);
console.log('OK guest visual maps START_P2 to bottom-left');

var st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'ALOESXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var r = engine.applyPlay(st, [
  { idx: START_P1, letter: 'A', rackIndex: 0 },
  { idx: START_P1 + 1, letter: 'L', rackIndex: 1 },
  { idx: START_P1 + 2, letter: 'O', rackIndex: 2 },
  { idx: START_P1 + 3, letter: 'E', rackIndex: 3 },
  { idx: START_P1 + 4, letter: 'S', rackIndex: 4 },
], PLAYER.P1);
assert(r.valid && r.word === 'ALOES', 'ALOES play');

var guestDisp = boardView.buildViewerDisplayBoard(st.board, 1, st.acceptedRuns || [], ROWS, COLS);
var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3, START_P1 + 4];
var guestWord = boardView.readVisualRun(guestDisp, 1, cells, true, ROWS, COLS, letterAt).text;
var hostWord = boardView.readLogicalHorizontal(st.board, ROWS - 1, 0, 5, COLS, letterAt);
assert(hostWord === 'ALOES' && guestWord === 'ALOES', 'guest paint ALOES; host logical ALOES', {
  hostWord: hostWord,
  guestWord: guestWord,
});
console.log('OK guest paint reads ALOES (not SEOLA); host logical ALOES');
console.log('All guest-flip-bl tests passed.');
