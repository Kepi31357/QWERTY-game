'use strict';

/**
 * Fixed-board STOWER / TROUT / SINE (no guest flip mapping).
 * Run: node server/test-stower-sine.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
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

function setRack(st, letters) {
  st.racks[PLAYER.P1] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + i };
  });
}

function empty() {
  return engine.createInitialState(function () {
    return 0.5;
  });
}

function idx(row, col) {
  return row * COLS + col;
}

/* STOWER not in dictionary — reject with STOWER in invalidWords. */
(function () {
  var st = empty();
  setRack(st, 'STOWERXX');
  var cells = [];
  var i;
  for (i = 0; i < 6; i++) cells.push(START_P1 + i);
  var placements = cells.map(function (c, j) {
    return { idx: c, letter: 'STOWER'[j], rackIndex: j };
  });
  var r = engine.validateMove(st, placements, PLAYER.P1, {
    intendedWord: 'STOWER',
    wordCells: cells,
  });
  assert(!r.valid, 'STOWER rejected');
  assert(
    r.invalidWords && r.invalidWords.indexOf('STOWER') >= 0,
    'invalidWords lists STOWER'
  );
})();

/* TROUT on P1 start. */
(function () {
  var st = empty();
  setRack(st, 'TROUTXXX');
  var cells = [];
  var i;
  for (i = 0; i < 5; i++) cells.push(START_P1 + i);
  var placements = cells.map(function (c, j) {
    return { idx: c, letter: 'TROUT'[j], rackIndex: j };
  });
  var r = engine.validateMove(st, placements, PLAYER.P1, {
    intendedWord: 'TROUT',
    wordCells: cells,
  });
  assert(r.valid && r.word === 'TROUT', 'TROUT accepted');
})();

/* TOWER vertical then SINE beside — TI/ON/WE crosses. */
(function () {
  var st = empty();
  setRack(st, 'TOWERXXX');
  var towerCells = [];
  var ti;
  for (ti = 0; ti < 5; ti++) towerCells.push(idx(10 + ti, 0));
  /* Opening must cover start: put R of TOWER on START_P1 → TOWER upward.
   * Rows: T at 10 ... R at 14 = START_P1. Letters TOWER top-to-bottom.
   */
  var towerPlace = towerCells.map(function (c, j) {
    return { idx: c, letter: 'TOWER'[j], rackIndex: j };
  });
  var r = engine.applyPlay(st, towerPlace, PLAYER.P1, {
    intendedWord: 'TOWER',
    wordCells: towerCells,
  });
  assert(r.valid && r.word === 'TOWER', 'TOWER apply: ' + (r.reason || r.word));
  var col0 = [10, 11, 12, 13, 14]
    .map(function (row) {
      return st.board[idx(row, 0)].letter;
    })
    .join('');
  assert(col0 === 'TOWER', 'TOWER stored TTB, got ' + col0);

  st.racks[PLAYER.P1] = 'SINEXXXX'.split('').map(function (ch, i) {
    return { letter: ch, id: 's' + i };
  });
  /* SINE: S above T's row beside empty, I beside T, N beside O, E beside W */
  var sineCells = [idx(9, 1), idx(10, 1), idx(11, 1), idx(12, 1)];
  var sinePlace = sineCells.map(function (c, j) {
    return { idx: c, letter: 'SINE'[j], rackIndex: j };
  });
  var temp = st.board.slice();
  sinePlace.forEach(function (p) {
    temp[p.idx] = { letter: p.letter, owner: PLAYER.P1 };
  });
  var formed = formedApi.getAllWordsFormed(temp, sineCells, { cols: COLS, rows: ROWS });
  console.log(
    'SINE formed',
    formed.words.map(function (w) {
      return w.word;
    })
  );
  r = engine.validateMove(st, sinePlace, PLAYER.P1, {
    intendedWord: 'SINE',
    wordCells: sineCells,
  });
  assert(r.valid && r.word === 'SINE', 'SINE accepted: ' + (r.reason || r.word));
})();

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll STOWER/SINE/TROUT fixed-board checks passed.');
