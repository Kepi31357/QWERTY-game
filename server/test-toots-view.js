'use strict';

/**
 * Build 223 — TOOTS readable after guest paint (not STOOT).
 * Run: node server/test-toots-view.js
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

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

function letterAt(board, idx) {
  return board[idx] && board[idx].letter
    ? String(board[idx].letter).toUpperCase()
    : null;
}

var st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'TOOTSXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'a' + i };
});
var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3, START_P1 + 4];
var r = engine.applyPlay(
  st,
  cells.map(function (idx, i) {
    return { idx: idx, letter: 'TOOTS'.charAt(i), rackIndex: i };
  }),
  PLAYER.P1
);
if (!r.valid || r.word !== 'TOOTS') {
  console.error('FAIL TOOTS', r);
  process.exit(1);
}

var host = engine.getClientView(st, 0);
var guest = engine.getClientView(st, 1);
var hostRead = boardView.readVisualRun(host.board, 0, cells, true, ROWS, COLS, letterAt).text;
var guestRaw = boardView.readVisualRun(guest.board, 1, cells, true, ROWS, COLS, letterAt).text;
var guestDisp = boardView.buildViewerDisplayBoard(
  guest.board,
  1,
  guest.acceptedRuns || [{ word: 'TOOTS', cells: cells }],
  ROWS,
  COLS
);
var guestRead = boardView.readVisualRun(guestDisp, 1, cells, true, ROWS, COLS, letterAt).text;
if (hostRead !== 'TOOTS' || guestRead !== 'TOOTS') {
  console.error('FAIL TOOTS host/paint', { hostRead: hostRead, guestRaw: guestRaw, guestRead: guestRead });
  process.exit(1);
}
if (guestRaw !== 'STOOT') {
  console.error('FAIL expected guest raw STOOT before paint', guestRaw);
  process.exit(1);
}
console.log('OK TOOTS LTR for host; guest paint fixes STOOT→TOOTS');

if (!boardView.viewerNeedsFlip(1)) {
  console.error('FAIL flip must be enabled for guest');
  process.exit(1);
}
console.log('OK guest flip enabled');
console.log('All TOOTS view tests passed.');
