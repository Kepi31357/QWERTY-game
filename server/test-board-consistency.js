'use strict';

/**
 * Build 214 — host/guest must share identical letter positions (server indices).
 * Guest may flip visual coordinates 180°, but must NEVER reverse letters on the board.
 * Run: node server/test-board-consistency.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');

var COLS = engine.COLS;
var ROWS = engine.ROWS;
var PLAYER = engine.PLAYER;
var START_P1_IDX = (ROWS - 1) * COLS;
var START_P2_IDX = COLS - 1;

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

function letterAt(board, idx) {
  return board[idx] && board[idx].letter
    ? String(board[idx].letter).toUpperCase()
    : null;
}

function readH(board, row, col0, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var ch = letterAt(board, row * COLS + col0 + i);
    if (!ch) return null;
    out += ch;
  }
  return out;
}

function assertSameLetters(boardA, boardB, label) {
  var i, a, b;
  for (i = 0; i < COLS * ROWS; i++) {
    a = letterAt(boardA, i);
    b = letterAt(boardB, i);
    if (a !== b) {
      console.error(
        'FAIL ' + label + ' letter mismatch at idx=' + i +
        ' (' + Math.floor(i / COLS) + ',' + (i % COLS) + '):',
        a, 'vs', b
      );
      process.exit(1);
    }
  }
}

/** Guest visual map only — must not change letter at server index. */
function guestServerIdxFromVisual(vr, vc) {
  return (ROWS - 1 - vr) * COLS + (COLS - 1 - vc);
}

function findWord(board, word) {
  var r, c, h, v;
  for (r = 0; r < ROWS; r++) {
    for (c = 0; c < COLS; c++) {
      if (c + word.length <= COLS) {
        h = readH(board, r, c, word.length);
        if (h === word) return { dir: 'H', row: r, col: c, spelling: h };
      }
      if (r + word.length <= ROWS) {
        v = '';
        var k;
        for (k = 0; k < word.length; k++) {
          var ch = letterAt(board, (r + k) * COLS + c);
          if (!ch) { v = null; break; }
          v += ch;
        }
        if (v === word) return { dir: 'V', row: r, col: c, spelling: v };
      }
    }
  }
  return null;
}

/* --- Full turn: Deb plays GLOW, Blake plays ET crossing --- */
var st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'GLOWXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'p1-' + i };
});
st.racks[PLAYER.P2] = 'ETXXXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'p2-' + i };
});

var r1 = engine.applyPlay(st, [
  { idx: START_P1_IDX, letter: 'G', rackIndex: 0 },
  { idx: START_P1_IDX + 1, letter: 'L', rackIndex: 1 },
  { idx: START_P1_IDX + 2, letter: 'O', rackIndex: 2 },
  { idx: START_P1_IDX + 3, letter: 'W', rackIndex: 3 },
], PLAYER.P1);
if (!r1.valid) {
  console.error('FAIL P1 GLOW opening:', r1);
  process.exit(1);
}
if (readH(st.board, ROWS - 1, 0, 4) !== 'GLOW') {
  console.error('FAIL raw board must store GLOW LTR, got', readH(st.board, ROWS - 1, 0, 4));
  process.exit(1);
}
console.log('[board-consistency] after P1 GLOW', findWord(st.board, 'GLOW'));

var viewHost1 = engine.getClientView(st, 0);
var viewGuest1 = engine.getClientView(st, 1);
assertSameLetters(viewHost1.board, viewGuest1.board, 'after P1 — host vs guest view');
assertSameLetters(st.board, viewGuest1.board, 'after P1 — server vs guest view');
console.log('OK after P1: host and guest share identical letter positions');

/* Blake opens with BURN: first letter on START_P2, grow down. */
st.racks[PLAYER.P2] = 'BURNXXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'p2b-' + i };
});
var r2 = engine.applyPlay(st, [
  { idx: 0 * COLS + 14, letter: 'B', rackIndex: 0 },
  { idx: 1 * COLS + 14, letter: 'U', rackIndex: 1 },
  { idx: 2 * COLS + 14, letter: 'R', rackIndex: 2 },
  { idx: 3 * COLS + 14, letter: 'N', rackIndex: 3 },
], PLAYER.P2, {
  intendedWord: 'BURN',
  wordCells: [0 * COLS + 14, 1 * COLS + 14, 2 * COLS + 14, 3 * COLS + 14],
});
if (!r2.valid) {
  console.error('FAIL P2 BURN opening:', r2);
  process.exit(1);
}

var viewHost2 = engine.getClientView(st, 0);
var viewGuest2 = engine.getClientView(st, 1);
assertSameLetters(viewHost2.board, viewGuest2.board, 'after P2 — host vs guest view');
assertSameLetters(st.board, viewGuest2.board, 'after P2 — server vs guest view');
console.log('OK after P2: host and guest share identical letter positions');

/* Display layer must be cell-faithful: letter at server idx never remapped for guest. */
function simulateDisplayLetter(board, serverIdx) {
  return letterAt(board, serverIdx);
}

var occupied = 0;
var i;
for (i = 0; i < COLS * ROWS; i++) {
  if (!letterAt(st.board, i)) continue;
  occupied++;
  var hostLetter = simulateDisplayLetter(viewHost2.board, i);
  var guestLetter = simulateDisplayLetter(viewGuest2.board, i);
  if (hostLetter !== guestLetter || hostLetter !== letterAt(st.board, i)) {
    console.error('FAIL display letter remapped at', i, {
      hostLetter: hostLetter,
      guestLetter: guestLetter,
      server: letterAt(st.board, i),
    });
    process.exit(1);
  }
}
if (occupied < 8) {
  console.error('FAIL expected occupied tiles after two openings, got', occupied);
  process.exit(1);
}
console.log('OK display layer cell-faithful for', occupied, 'tiles (no letter remapping)');

/* Shared camera: visual === logical — G of GLOW at START_P1 for both. */
var glowG = START_P1_IDX;
if (letterAt(viewGuest2.board, glowG) !== 'G' || letterAt(viewHost2.board, glowG) !== 'G') {
  console.error('FAIL both must see G at GLOW start');
  process.exit(1);
}
console.log('OK shared camera: both see G of GLOW at bottom-left start');

/* ALOES-style horizontal: ensure raw LTR scan, not reverse. */
st = engine.createInitialState(function () { return 0.5; });
st.racks[PLAYER.P1] = 'ALOESXXX'.split('').map(function (ch, i) {
  return { letter: ch, id: 'aloes-' + i };
});
var rA = engine.applyPlay(st, [
  { idx: START_P1_IDX, letter: 'A', rackIndex: 0 },
  { idx: START_P1_IDX + 1, letter: 'L', rackIndex: 1 },
  { idx: START_P1_IDX + 2, letter: 'O', rackIndex: 2 },
  { idx: START_P1_IDX + 3, letter: 'E', rackIndex: 3 },
  { idx: START_P1_IDX + 4, letter: 'S', rackIndex: 4 },
], PLAYER.P1);
if (!rA.valid) {
  console.error('FAIL ALOES opening:', rA);
  process.exit(1);
}
var aloes = readH(st.board, ROWS - 1, 0, 5);
if (aloes !== 'ALOES') {
  console.error('FAIL raw board ALOES expected, got', aloes, '(would be reversal bug if SEOLA)');
  process.exit(1);
}
var viewH = engine.getClientView(st, 0);
var viewG = engine.getClientView(st, 1);
assertSameLetters(viewH.board, viewG.board, 'ALOES host vs guest');
if (readH(viewG.board, ROWS - 1, 0, 5) !== 'ALOES') {
  console.error('FAIL guest view must read ALOES on raw board, got', readH(viewG.board, ROWS - 1, 0, 5));
  process.exit(1);
}
console.log('[board-consistency] ALOES', findWord(st.board, 'ALOES'));
console.log('OK ALOES identical on host and guest raw boards');

console.log('All board-consistency checks passed.');
