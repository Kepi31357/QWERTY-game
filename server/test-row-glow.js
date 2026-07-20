'use strict';

/**
 * ROW / GLOW extension + guest visual-order intendedWord regression.
 * Run: node server/test-row-glow.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var formedApi = require('../getAllWordsFormed.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var COLS = 15;
var PLAYER = engine.PLAYER;
var getAllWordsFormed = formedApi.getAllWordsFormed;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function emptyState() {
  var st = engine.createInitialState(function () {
    return 0.5;
  });
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[(15 - 1) * COLS] = { letter: 'Q', owner: PLAYER.P1 };
  return st;
}

function setRack(st, letters) {
  st.racks[PLAYER.P1] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + i };
  });
  while (st.racks[PLAYER.P1].length < 8) st.racks[PLAYER.P1].push(null);
}

assert(engine.isValidWord('ROW'), 'ROW in dictionary');
assert(engine.isValidWord('GLOW'), 'GLOW in dictionary');
assert(engine.isValidWord('  row  '), 'ROW lookup trims whitespace');
assert(engine.isValidWord('Ow'), 'OW case-insensitive');
assert(!engine.isValidWord('COOZIE'), 'COOZIE not in dictionary (expected reject)');
assert(engine.isValidWord('DARED'), 'DARED in dictionary');

/* --- OW + R → full ROW (not substring OW) --- */
(function () {
  var board = new Array(COLS * 15).fill(null);
  var row = 10;
  board[row * COLS + 5] = { letter: 'O', owner: PLAYER.P2 };
  board[row * COLS + 6] = { letter: 'W', owner: PLAYER.P2 };
  board[row * COLS + 4] = { letter: 'R', owner: PLAYER.P1 };
  var raw = getAllWordsFormed(board, [row * COLS + 4], { debug: true });
  assert(raw.main.word === 'ROW', 'extract ROW not OW');
  assert(raw.playLinePositions.length === 3, 'play line includes R,O,W');
  assert(
    !raw.words.some(function (w) {
      return w.word === 'OW' && w.isMain;
    }),
    'main is not truncated to OW'
  );
})();

/* --- LOW + G → GLOW --- */
(function () {
  var board = new Array(COLS * 15).fill(null);
  var row = 8;
  board[row * COLS + 3] = { letter: 'L', owner: PLAYER.P2 };
  board[row * COLS + 4] = { letter: 'O', owner: PLAYER.P2 };
  board[row * COLS + 5] = { letter: 'W', owner: PLAYER.P2 };
  board[row * COLS + 2] = { letter: 'G', owner: PLAYER.P1 };
  var raw = getAllWordsFormed(board, [row * COLS + 2], { debug: true });
  assert(raw.main.word === 'GLOW', 'extract GLOW not LOW');
})();

/* --- Engine: ROW extend --- */
(function () {
  var st = emptyState();
  st.board[10 * COLS + 5] = { letter: 'O', owner: PLAYER.P2 };
  st.board[10 * COLS + 6] = { letter: 'W', owner: PLAYER.P2 };
  setRack(st, 'RXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: 10 * COLS + 4, letter: 'R', rackIndex: 0 }],
    PLAYER.P1,
    { debugWords: true }
  );
  assert(r.valid && r.word === 'ROW', 'engine accepts ROW: ' + (r.reason || r.word));
  assert(r.bonusConnections === 2, 'ROW connects to O and W');
})();

/* --- Engine: GLOW extend --- */
(function () {
  var st = emptyState();
  st.board[8 * COLS + 3] = { letter: 'L', owner: PLAYER.P2 };
  st.board[8 * COLS + 4] = { letter: 'O', owner: PLAYER.P2 };
  st.board[8 * COLS + 5] = { letter: 'W', owner: PLAYER.P2 };
  setRack(st, 'GXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: 8 * COLS + 2, letter: 'G', rackIndex: 0 }],
    PLAYER.P1,
    { debugWords: true }
  );
  assert(r.valid && r.word === 'GLOW', 'engine accepts GLOW: ' + (r.reason || r.word));
  assert(r.bonusConnections === 3, 'GLOW connects to L,O,W');
})();

/* --- Invalid visual word WOR must NOT silently remap to ROW (XIF/FIX class bug) --- */
(function () {
  var st = emptyState();
  st.board[10 * COLS + 5] = { letter: 'O', owner: PLAYER.P2 };
  st.board[10 * COLS + 6] = { letter: 'W', owner: PLAYER.P2 };
  setRack(st, 'RXXXXXXX');
  var cellsVisual = [10 * COLS + 6, 10 * COLS + 5, 10 * COLS + 4]; /* W,O,R */
  var r = engine.validateMove(
    st,
    [{ idx: 10 * COLS + 4, letter: 'R', rackIndex: 0 }],
    PLAYER.P1,
    {
      debugWords: true,
      intendedWord: 'WOR',
      wordCells: cellsVisual,
    }
  );
  assert(!r.valid, 'invalid WOR intent must reject (not remap to ROW): ' + (r.word || r.reason));
  console.log('OK invalid WOR intent rejected');
})();

/* --- Visual ROW intent with reverse cell order still accepts ROW --- */
(function () {
  var st = emptyState();
  st.board[10 * COLS + 5] = { letter: 'O', owner: PLAYER.P2 };
  st.board[10 * COLS + 6] = { letter: 'W', owner: PLAYER.P2 };
  setRack(st, 'RXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: 10 * COLS + 4, letter: 'R', rackIndex: 0 }],
    PLAYER.P1,
    {
      intendedWord: 'ROW',
      wordCells: [10 * COLS + 6, 10 * COLS + 5, 10 * COLS + 4],
    }
  );
  assert(r.valid && r.word === 'ROW', 'ROW intent with reverse cells accepted');
})();

/* --- DARED full word (sanity) --- */
(function () {
  var st = emptyState();
  st.board[10 * COLS + 3] = { letter: 'D', owner: PLAYER.P2 };
  st.board[10 * COLS + 4] = { letter: 'A', owner: PLAYER.P2 };
  st.board[10 * COLS + 5] = { letter: 'R', owner: PLAYER.P2 };
  st.board[10 * COLS + 6] = { letter: 'E', owner: PLAYER.P2 };
  setRack(st, 'DXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: 10 * COLS + 7, letter: 'D', rackIndex: 0 }],
    PLAYER.P1,
    { debugWords: true }
  );
  assert(r.valid && r.word === 'DARED', 'DARED extension accepted: ' + (r.reason || r.word));
})();

console.log('All ROW/GLOW tests passed.');
