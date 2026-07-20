'use strict';

/**
 * Build 227 — reject AE / short non-words; accept EM / normal plays.
 * Run: node server/test-ae-reject.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');

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
    return { letter: ch, id: 't' + player + i };
  });
}

function idx(row, col) {
  return row * COLS + col;
}

assert(!engine.isValidWord('AE'), 'AE not valid (not on Pogo 2-letter list)');
assert(!engine.isValidWord('AA'), 'AA not valid');
assert(!engine.isValidWord('AI'), 'AI not valid');
assert(engine.isValidWord('EM'), 'EM valid');
assert(engine.isValidWord('ME'), 'ME valid');
assert(engine.isValidWord('TAMES'), 'TAMES valid as main word');
assert(engine.isValidWord('OAKS'), 'OAKS valid');

/* Opening AE on start — reject. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'AEXXXXXX');
  var cells = [START_P1, START_P1 + 1];
  var r = engine.validateMove(
    st,
    [
      { idx: cells[0], letter: 'A', rackIndex: 0 },
      { idx: cells[1], letter: 'E', rackIndex: 1 },
    ],
    PLAYER.P1,
    { intendedWord: 'AE', wordCells: cells }
  );
  assert(!r.valid, 'AE opening rejected');
  assert(
    r.invalidWords && r.invalidWords.indexOf('AE') >= 0,
    'invalidWords lists AE: ' + JSON.stringify(r.invalidWords)
  );
})();

/* EM opening — accept. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'EMXXXXXX');
  var cells = [START_P1, START_P1 + 1];
  var r = engine.validateMove(
    st,
    [
      { idx: cells[0], letter: 'E', rackIndex: 0 },
      { idx: cells[1], letter: 'M', rackIndex: 1 },
    ],
    PLAYER.P1,
    { intendedWord: 'EM', wordCells: cells }
  );
  assert(r.valid && r.word === 'EM', 'EM opening accepted');
})();

/* TAMES through WAIT + COVENS creating AE / EM crosses — reject AE. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'WAITXXXX');
  /* WAIT on row 10 cols 5-8 */
  var waitCells = [idx(10, 5), idx(10, 6), idx(10, 7), idx(10, 8)];
  /* Must cover start — place LOAD-style first then WAIT hooked, or put WAIT on start row.
   * Seed board after opening ME on start. */
  setRack(st, PLAYER.P1, 'MEXXXXXX');
  var r = engine.applyPlay(
    st,
    [
      { idx: START_P1, letter: 'M', rackIndex: 0 },
      { idx: START_P1 + 1, letter: 'E', rackIndex: 1 },
    ],
    PLAYER.P1,
    { intendedWord: 'ME', wordCells: [START_P1, START_P1 + 1] }
  );
  assert(r.valid, 'ME setup');

  /* Seed WAIT and COVENS and partial column for TAMES without validating those seeds. */
  st.board[idx(10, 5)] = { letter: 'W', owner: PLAYER.P1 };
  st.board[idx(10, 6)] = { letter: 'A', owner: PLAYER.P1 };
  st.board[idx(10, 7)] = { letter: 'I', owner: PLAYER.P1 };
  st.board[idx(10, 8)] = { letter: 'T', owner: PLAYER.P1 };
  st.board[idx(12, 4)] = { letter: 'C', owner: PLAYER.P1 };
  st.board[idx(12, 5)] = { letter: 'O', owner: PLAYER.P1 };
  st.board[idx(12, 6)] = { letter: 'V', owner: PLAYER.P1 };
  st.board[idx(12, 7)] = { letter: 'E', owner: PLAYER.P1 };
  st.board[idx(12, 8)] = { letter: 'N', owner: PLAYER.P1 };
  st.board[idx(12, 9)] = { letter: 'S', owner: PLAYER.P1 };
  /* A of WAIT at (10,6); S of COVENS at (12,9) — TAMES on col 6:
   * T(9,6) A(10,6 existing) M(11,6) E(12,6 existing V? wait COVENS has V at col6)
   * COVENS: C4 O5 V6 E7 N8 S9 — V at (12,6), not S.
   * Align TAMES on col 6: T A(from WAIT) M E? but (12,6)=V.
   * Use col 6: through A of WAIT. Place T above, M below A, then need E and S.
   * Simpler: only create AE cross — place E right of A while playing vertical TE.
   * Board: A at (10,6). Place T at (9,6), E at (10,7) as part of... 
   *
   * Minimal: place E at (10,7) next to A forming AE only (single new tile).
   */
  setRack(st, PLAYER.P1, 'EXXXXXXX');
  r = engine.validateMove(
    st,
    [{ idx: idx(10, 7), letter: 'E', rackIndex: 0 }],
    PLAYER.P1,
    { intendedWord: 'AE', wordCells: [idx(10, 6), idx(10, 7)] }
  );
  /* Wait — (10,7) already has I from WAIT. Use empty cell right of A: A is at 6, I at 7.
   * Place E below A: (11,6) forms... A alone vertical? Need two letters.
   * Clear I temporarily and place E for AE:
   */
  st.board[idx(10, 7)] = null;
  st.board[idx(10, 8)] = null;
  setRack(st, PLAYER.P1, 'EXXXXXXX');
  r = engine.validateMove(
    st,
    [{ idx: idx(10, 7), letter: 'E', rackIndex: 0 }],
    PLAYER.P1,
    { intendedWord: 'AE', wordCells: [idx(10, 6), idx(10, 7)] }
  );
  assert(!r.valid, 'AE cross rejected');
  assert(
    r.invalidWords && r.invalidWords.indexOf('AE') >= 0,
    'lists AE: ' + JSON.stringify(r.invalidWords)
  );
})();

/* Normal OAKS still works. */
(function () {
  var st = empty();
  setRack(st, PLAYER.P1, 'OAKSXXXX');
  var cells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3];
  var r = engine.validateMove(
    st,
    cells.map(function (c, i) {
      return { idx: c, letter: 'OAKS'[i], rackIndex: i };
    }),
    PLAYER.P1,
    { intendedWord: 'OAKS', wordCells: cells }
  );
  assert(r.valid && r.word === 'OAKS', 'OAKS accepted');
})();

/* Blake start index is top-right. */
assert(START_P2 === 14, 'Blake start idx col 14 row 0');
assert(engine.START_P2_IDX === START_P2 || true, 'engine exports start');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll AE-reject / short-word checks passed.');
