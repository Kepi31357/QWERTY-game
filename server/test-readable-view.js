'use strict';

/**
 * Build 223 — guest flip + readable paint for ALOES/BURN.
 * Run: node server/test-readable-view.js
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

if (!boardView.viewerNeedsFlip(1)) {
  console.error('FAIL guest flip must be on');
  process.exit(1);
}
console.log('OK guest flip on');

var st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'ALOESXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3, START_P1 + 4];
var r = engine.applyPlay(
  st,
  cells.map(function (idx, i) {
    return { idx: idx, letter: 'ALOES'.charAt(i), rackIndex: i };
  }),
  PLAYER.P1
);
if (!r.valid) {
  console.error('FAIL ALOES', r);
  process.exit(1);
}

var guest = engine.getClientView(st, 1);
var guestDisp = boardView.buildViewerDisplayBoard(
  guest.board,
  1,
  guest.acceptedRuns || [],
  ROWS,
  COLS
);
var word = boardView.readVisualRun(guestDisp, 1, cells, true, ROWS, COLS, letterAt).text;
if (word !== 'ALOES') {
  console.error('FAIL guest ALOES paint', word);
  process.exit(1);
}
console.log('OK guest ALOES LTR via paint');

st.racks[PLAYER.P2] = 'BURNXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'b' + i };
});
var burn = [START_P2, START_P2 + COLS, START_P2 + 2 * COLS, START_P2 + 3 * COLS];
r = engine.applyPlay(
  st,
  burn.map(function (idx, i) {
    return { idx: idx, letter: 'BURN'.charAt(i), rackIndex: i };
  }),
  PLAYER.P2,
  { intendedWord: 'BURN', wordCells: burn }
);
if (!r.valid || r.word !== 'BURN') {
  console.error('FAIL BURN', r);
  process.exit(1);
}
var host = engine.getClientView(st, 0);
guest = engine.getClientView(st, 1);
var hv = boardView.readLogicalVertical(host.board, COLS - 1, 0, 4, COLS, letterAt);
var gv = boardView.readLogicalVertical(guest.board, COLS - 1, 0, 4, COLS, letterAt);
if (hv !== 'BURN' || gv !== 'BURN') {
  console.error('FAIL BURN shared logical', { hv: hv, gv: gv });
  process.exit(1);
}
guestDisp = boardView.buildViewerDisplayBoard(guest.board, 1, guest.acceptedRuns || [], ROWS, COLS);
var guestBurn = boardView.readVisualRun(guestDisp, 1, burn, false, ROWS, COLS, letterAt).text;
if (guestBurn !== 'BURN') {
  console.error('FAIL guest BURN paint', guestBurn);
  process.exit(1);
}
console.log('OK BURN TTB logical + guest paint');
console.log('All readable-view tests passed.');
