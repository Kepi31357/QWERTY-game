'use strict';

/**
 * Build 226 — LIMP / EMIT on shared fixed board + short crosses.
 * Run: node server/test-limp-emit.js
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
var START_P2 = COLS - 1;
var START_P1 = (ROWS - 1) * COLS;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function emptyState() {
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

assert(engine.isValidWord('limp'), 'LIMP in dictionary');
assert(engine.isValidWord('EMIT'), 'EMIT in dictionary');
assert(engine.isValidWord('ab'), 'AB in dictionary');
assert(!engine.isValidWord('TIML'), 'TIML not in dictionary');
assert(!engine.isValidWord('PMIE'), 'PMIE not in dictionary');

/* TIME off LONGE (E at end) — LTR exact match on shared board. */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P2, 'LONGEXXX');
  var longe = engine.applyPlay(
    st,
    [
      { idx: START_P2, letter: 'L', rackIndex: 0 },
      { idx: START_P2 + COLS, letter: 'O', rackIndex: 1 },
      { idx: START_P2 + 2 * COLS, letter: 'N', rackIndex: 2 },
      { idx: START_P2 + 3 * COLS, letter: 'G', rackIndex: 3 },
      { idx: START_P2 + 4 * COLS, letter: 'E', rackIndex: 4 },
    ],
    PLAYER.P2
  );
  assert(longe.valid && longe.word === 'LONGE', 'LONGE setup');

  var eIdx = START_P2 + 4 * COLS;
  var tIdx = idx(4, 11);
  var iIdx = idx(4, 12);
  var mIdx = idx(4, 13);
  setRack(st, PLAYER.P2, 'TIMXXXXX');

  var r = engine.validateMove(
    st,
    [
      { idx: tIdx, letter: 'T', rackIndex: 0 },
      { idx: iIdx, letter: 'I', rackIndex: 1 },
      { idx: mIdx, letter: 'M', rackIndex: 2 },
    ],
    PLAYER.P2,
    { intendedWord: 'TIME', wordCells: [tIdx, iIdx, mIdx, eIdx] }
  );
  assert(r.valid && r.word === 'TIME', 'TIME accepted: ' + (r.reason || r.word));

  r = engine.validateMove(
    st,
    [
      { idx: tIdx, letter: 'T', rackIndex: 0 },
      { idx: iIdx, letter: 'I', rackIndex: 1 },
      { idx: mIdx, letter: 'M', rackIndex: 2 },
    ],
    PLAYER.P2,
    { intendedWord: 'TIML', wordCells: [tIdx, iIdx, mIdx, eIdx] }
  );
  assert(
    r.valid && r.word === 'TIME',
    'TIML label recovered via cell spelling TIME: ' + (r.reason || r.word)
  );
})();

/* LIMP from L on start — grow left so LTR is LIMP after align, or place LIMP with L leftmost on P1. */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P1, 'LIMPXXXX');
  var limpCells = [START_P1, START_P1 + 1, START_P1 + 2, START_P1 + 3];
  var r = engine.validateMove(
    st,
    limpCells.map(function (c, i) {
      return { idx: c, letter: 'LIMP'[i], rackIndex: i };
    }),
    PLAYER.P1,
    { intendedWord: 'LIMP', wordCells: limpCells }
  );
  assert(r.valid && r.word === 'LIMP', 'LIMP accepted: ' + (r.reason || r.word));
})();

/* P1 ALINE + URBANE short crosses */
(function () {
  var st = emptyState();
  setRack(st, PLAYER.P1, 'ALINEXXX');
  var r = engine.applyPlay(
    st,
    [
      { idx: 10 * COLS + 0, letter: 'A', rackIndex: 0 },
      { idx: 11 * COLS + 0, letter: 'L', rackIndex: 1 },
      { idx: 12 * COLS + 0, letter: 'I', rackIndex: 2 },
      { idx: 13 * COLS + 0, letter: 'N', rackIndex: 3 },
      { idx: START_P1, letter: 'E', rackIndex: 4 },
    ],
    PLAYER.P1
  );
  assert(r.valid && r.word === 'ALINE', 'ALINE: ' + (r.reason || r.word));

  setRack(st, PLAYER.P1, 'URBANEX');
  r = engine.applyPlay(
    st,
    [
      { idx: 8 * COLS + 1, letter: 'U', rackIndex: 0 },
      { idx: 9 * COLS + 1, letter: 'R', rackIndex: 1 },
      { idx: 10 * COLS + 1, letter: 'B', rackIndex: 2 },
      { idx: 11 * COLS + 1, letter: 'A', rackIndex: 3 },
      { idx: 12 * COLS + 1, letter: 'N', rackIndex: 4 },
      { idx: 13 * COLS + 1, letter: 'E', rackIndex: 5 },
    ],
    PLAYER.P1
  );
  assert(r.valid, 'URBANE with crosses: ' + (r.reason || r.word));
  var words = (r.formedWords || [])
    .map(function (f) {
      return f.word;
    })
    .sort();
  assert(r.word === 'URBANE' || words.indexOf('URBANE') >= 0, 'includes URBANE');
  ['AB', 'LA', 'IN', 'NE'].forEach(function (cw) {
    assert(words.indexOf(cw) >= 0, 'cross ' + cw + ' formed: ' + words.join(','));
  });
})();

/* XIF still rejected */
(function () {
  var st = emptyState();
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[7 * COLS + 7] = { letter: 'I', owner: PLAYER.P1, isBlank: false };
  st.board[8 * COLS + 7] = { letter: 'F', owner: PLAYER.P1, isBlank: false };
  setRack(st, PLAYER.P1, 'XXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: 6 * COLS + 7, letter: 'X', rackIndex: 0 }],
    PLAYER.P1,
    { intendedWord: 'XIF', wordCells: [6 * COLS + 7, 7 * COLS + 7, 8 * COLS + 7] }
  );
  assert(!r.valid, 'XIF still rejected: ' + (r.reason || ''));
  assert(r.invalidWords && r.invalidWords[0] === 'XIF', 'invalidWords lists XIF');
})();

console.log('All LIMP/EMIT/cross tests passed.');
