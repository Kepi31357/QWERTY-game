'use strict';

/**
 * Build 219 — reject invalid words like XIF (do not accept reverse FIX).
 * Run: node server/test-xif-reject.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var wordsFormed = require('../getAllWordsFormed.js');

var COLS = engine.COLS;
var ROWS = engine.ROWS;
var PLAYER = engine.PLAYER;

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

function assert(cond, msg, detail) {
  if (!cond) {
    console.error('FAIL', msg, detail || '');
    process.exit(1);
  }
}

assert(!engine.isValidWord('XIF'), 'XIF not in dictionary');
assert(!engine.isValidWord('xif'), 'xif case-insensitive reject');
assert(engine.isValidWord('FIX'), 'FIX is valid');
assert(engine.isValidWord('fix'), 'fix case-insensitive');
console.log('OK dictionary: XIF invalid, FIX valid');

function midBoardState() {
  var st = engine.createInitialState(function () { return 0.5; });
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.firstMovePlayed = true;
  st.board[(ROWS - 1) * COLS] = { letter: 'Q', owner: PLAYER.P1, isBlank: false };
  st.board[COLS - 1] = { letter: 'Z', owner: PLAYER.P2, isBlank: false };
  return st;
}

/* Mid-board: place X above I,F → tiles spell XIF top-to-bottom — must reject. */
var st = midBoardState();
st.board[5 * COLS + 5] = { letter: 'I', owner: PLAYER.P1, isBlank: false };
st.board[6 * COLS + 5] = { letter: 'F', owner: PLAYER.P1, isBlank: false };
st.racks[PLAYER.P1] = 'XXXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'x' + i };
});

var xifCells = [4 * COLS + 5, 5 * COLS + 5, 6 * COLS + 5];
var r = engine.validateMove(
  st,
  [{ idx: 4 * COLS + 5, letter: 'X', rackIndex: 0 }],
  PLAYER.P1,
  {
    preview: true,
    intendedWord: 'XIF',
    wordCells: xifCells,
  }
);
assert(!r.valid, 'XIF intended must reject', r);
assert(
  String(r.reason || '').toLowerCase().indexOf('xif') >= 0 ||
    String(r.reason || '').toLowerCase().indexOf('valid') >= 0,
  'reason mentions invalid',
  r.reason
);
console.log('OK XIF intended word rejected:', r.reason);

/* Same tiles without invalid intent: formed LTR/TTB is XIF → still reject */
r = engine.validateMove(
  st,
  [{ idx: 4 * COLS + 5, letter: 'X', rackIndex: 0 }],
  PLAYER.P1,
  { preview: true }
);
assert(!r.valid, 'XIF formed TTB must reject without intent remap to FIX', r);
console.log('OK XIF TTB formation rejected:', r.reason);

/* getAllWordsFormed reports XIF; engine must not treat reverse FIX as formed word */
var boardWithXif = st.board.slice();
boardWithXif[4 * COLS + 5] = { letter: 'X', owner: PLAYER.P1, isBlank: false };
var formed = wordsFormed.getAllWordsFormed(boardWithXif, [4 * COLS + 5], {
  cols: COLS,
  rows: ROWS,
  playerId: PLAYER.P1,
  boardBefore: st.board,
});
var formedWords = (formed.words || []).map(function (w) { return w.word; });
assert(formedWords.indexOf('XIF') >= 0, 'getAllWordsFormed finds XIF', formedWords);
assert(formedWords.indexOf('FIX') < 0, 'getAllWordsFormed does not invent FIX', formedWords);
console.log('OK getAllWordsFormed reports XIF not FIX');

r = engine.applyPlay(
  st,
  [{ idx: 4 * COLS + 5, letter: 'X', rackIndex: 0 }],
  PLAYER.P1,
  { intendedWord: 'XIF', wordCells: xifCells }
);
assert(!r.valid, 'engine applyPlay rejects XIF mid-board', r);
console.log('OK applyPlay rejects XIF mid-board');

/* FIX placed LTR/TTB must accept */
st = midBoardState();
st.board[5 * COLS + 5] = { letter: 'I', owner: PLAYER.P1, isBlank: false };
st.board[6 * COLS + 5] = { letter: 'X', owner: PLAYER.P1, isBlank: false };
st.racks[PLAYER.P1] = 'FXXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'f' + i };
});
r = engine.validateMove(
  st,
  [{ idx: 4 * COLS + 5, letter: 'F', rackIndex: 0 }],
  PLAYER.P1,
  {
    preview: true,
    intendedWord: 'FIX',
    wordCells: [4 * COLS + 5, 5 * COLS + 5, 6 * COLS + 5],
  }
);
assert(r.valid && r.word === 'FIX', 'FIX must accept', r);
console.log('OK FIX accepted:', r.word);

console.log('All XIF-reject tests passed.');
