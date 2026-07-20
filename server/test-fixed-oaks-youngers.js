'use strict';

/**
 * Build 226 — shared fixed board: OAKS / YOUNGERS / AIDS.
 * Run: node server/test-fixed-oaks-youngers.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var boardView = require('../board-view.js');
var formedApi = require('../getAllWordsFormed.js');

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

var PLAYER = engine.PLAYER;
var COLS = 15;
var ROWS = 15;
var START_P1 = (ROWS - 1) * COLS;
var START_P2 = COLS - 1;
var failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

function empty() {
  return engine.createInitialState(function () {
    return 0.5;
  });
}

function setRack(st, player, letters) {
  st.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + player + '_' + i };
  });
}

function idx(row, col) {
  return row * COLS + col;
}

assert(boardView.viewerNeedsFlip(0) === false, 'host no flip');
assert(boardView.viewerNeedsFlip(1) === false, 'guest no flip');
assert(
  boardView.getVisualPosition(1, { row: 0, col: 14 }, ROWS, COLS).col === 14,
  'guest sees Blake start top-right (shared board)'
);
assert(
  boardView.getVisualPosition(0, { row: 14, col: 0 }, ROWS, COLS).row === 14,
  'You start bottom-left for both seats'
);

/* Host OAKS — LTR exact match, stored LTR (not SKAO). */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'OAKSXXXX');
  var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3];
  var place = cells.map(function (c, i) {
    return { idx: c, letter: 'OAKS'[i], rackIndex: i };
  });
  var r = engine.applyPlay(st, place, PLAYER.P1, {
    intendedWord: 'OAKS',
    wordCells: cells,
  });
  assert(r.valid && r.word === 'OAKS', 'OAKS accepted');
  var spelled = [0, 1, 2, 3]
    .map(function (c) {
      return st.board[START_P1 + c].letter;
    })
    .join('');
  assert(spelled === 'OAKS', 'OAKS stored LTR, got ' + spelled);

  var run = formedApi.extractFullRun(st.board, START_P1, 'horizontal', COLS, ROWS);
  assert(run.word === 'OAKS', 'extractFullRun OAKS');
  assert(run.word !== 'SKAO', 'extract is not SKAO');
})();

/* Reject SKAO when LTR spelling is SKAO (exact match — OAKS reverse not accepted). */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'SKAOXXXX');
  var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3];
  var place = cells.map(function (c, i) {
    return { idx: c, letter: 'SKAO'[i], rackIndex: i };
  });
  var r = engine.validateMove(st, place, PLAYER.P1, {
    intendedWord: 'SKAO',
    wordCells: cells,
  });
  assert(!r.valid, 'SKAO rejected');
  assert(
    r.invalidWords && r.invalidWords.indexOf('SKAO') >= 0,
    'invalidWords lists SKAO: ' + JSON.stringify(r.invalidWords)
  );
})();

/* P2 YOUNGERS vertical TTB after opening — stored forward, not SREGNUOY. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P2, 'MEXXXXXX');
  var openCells = [START_P2 - 1, START_P2];
  var r = engine.applyPlay(
    st,
    openCells.map(function (c, i) {
      return { idx: c, letter: 'ME'[i], rackIndex: i };
    }),
    PLAYER.P2,
    { intendedWord: 'ME', wordCells: openCells }
  );
  assert(r.valid, 'P2 ME opening');

  /* Hook YOUNGERS under E at (0,14): need contiguous — place YOUNGERS on col 14 rows 0..7
   * would overwrite ME. Place on col 13 using M: M at (0,13).
   * YOUNGERS can't start with M.
   * Place YOUNGERS on col 12, hook with horizontal from M/E later.
   * Simpler: seed YOUNGERS TTB and validate extract + AIDS crosses that are real words.
   */
  var yi;
  for (yi = 0; yi < 8; yi++) {
    st.board[idx(4 + yi, 3)] = { letter: 'YOUNGERS'[yi], owner: PLAYER.P2 };
  }
  st.openingPlayed[PLAYER.P2] = true;
  st.firstMovePlayed = true;

  var yRun = formedApi.extractFullRun(st.board, idx(4, 3), 'vertical', COLS, ROWS);
  assert(yRun.word === 'YOUNGERS', 'YOUNGERS TTB extract, got ' + yRun.word);
  assert(yRun.word !== 'SREGNUOY', 'not SREGNUOY');

  /* IN cross: I left of N (N is index 3 → row 7). */
  setRack(st, PLAYER.P2, 'IXXXXXXX');
  var inPlace = [{ idx: idx(7, 2), letter: 'I', rackIndex: 0 }];
  r = engine.validateMove(st, inPlace, PLAYER.P2, {
    intendedWord: 'IN',
    wordCells: [idx(7, 2), idx(7, 3)],
  });
  assert(r.valid && r.word === 'IN', 'IN cross on YOUNGERS: ' + (r.reason || r.word));

  /* AIDS vertical col 2 rows 7-10 beside N,G,E,R → AN, IG, DE, SR.
   * Formed main AIDS; crosses may fail — must not invent SREGNUOY. */
  setRack(st, PLAYER.P2, 'AIDSXXXX');
  var aidsIdx = [idx(7, 2), idx(8, 2), idx(9, 2), idx(10, 2)];
  var aidsPlace = aidsIdx.map(function (c, i) {
    return { idx: c, letter: 'AIDS'[i], rackIndex: i };
  });
  /* Clear the I we placed for IN so AIDS can use row7 col2. */
  st.board[idx(7, 2)] = null;

  var temp = st.board.slice();
  aidsPlace.forEach(function (p) {
    temp[p.idx] = { letter: p.letter, owner: PLAYER.P2 };
  });
  var formed = formedApi.getAllWordsFormed(temp, aidsIdx, { cols: COLS, rows: ROWS });
  var names = formed.words.map(function (w) {
    return w.word;
  });
  console.log('AIDS formed', names);
  assert(names.indexOf('AIDS') >= 0, 'formed AIDS');
  assert(names.indexOf('SREGNUOY') < 0, 'no SREGNUOY fragment');
  assert(
    names.every(function (w) {
      return w.length >= 2;
    }),
    'runs are length >= 2'
  );

  r = engine.validateMove(st, aidsPlace, PLAYER.P2, {
    intendedWord: 'AIDS',
    wordCells: aidsIdx,
  });
  if (!r.valid) {
    assert(r.invalidWords && r.invalidWords.length, 'lists invalid words');
    assert(
      r.invalidWords.indexOf('SREGNUOY') < 0,
      'error must not be SREGNUOY, got ' + JSON.stringify(r.invalidWords)
    );
    assert(
      r.invalidWords.indexOf('AIDS') < 0,
      'AIDS is valid — reject should be crosses only: ' + JSON.stringify(r.invalidWords)
    );
    console.log('AIDS rejected for crosses (ok):', r.invalidWords);
  } else {
    assert(r.word === 'AIDS', 'AIDS accepted');
  }
})();

/* Multi invalid words listed in reason. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'QXJYXXXX');
  /* QX opening on start — invalid; single word. */
  var cells = [START_P1, START_P1 + 1];
  var r = engine.validateMove(
    st,
    [
      { idx: cells[0], letter: 'Q', rackIndex: 0 },
      { idx: cells[1], letter: 'X', rackIndex: 1 },
    ],
    PLAYER.P1,
    { intendedWord: 'QX', wordCells: cells }
  );
  assert(!r.valid, 'QX rejected');
  assert(
    r.invalidWords && r.invalidWords[0] === 'QX',
    'invalidWords QX: ' + JSON.stringify(r.invalidWords)
  );
})();

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll fixed-board OAKS/YOUNGERS/AIDS checks passed.');
