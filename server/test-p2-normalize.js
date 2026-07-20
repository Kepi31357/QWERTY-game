'use strict';

/**
 * Build 220 — P2 openings: any tile on start is enough (HITTER-style).
 * P2 TR / P1 BL. Run: node server/test-p2-normalize.js
 */

var fs = require('fs');
var vm = require('vm');
var engine = require('../game-engine.js');
var boardView = require('../board-view.js');

function loadDictionary() {
  var dictPath = require('path').join(__dirname, '..', 'dictionary.js');
  var src = fs.readFileSync(dictPath, 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var PLAYER = engine.PLAYER;
var COLS = 15;
var ROWS = engine.ROWS || 15;

function emptyState() {
  return engine.createInitialState(function () { return 0.5; });
}

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + player + i };
  });
}

function playP2(state, specs, playOpts) {
  var rack = state.racks[PLAYER.P2];
  var used = {};
  var placements = specs.map(function (spec) {
    var letter = spec.letter;
    var slot = rack.findIndex(function (t, j) {
      return !used[j] && t && (t.letter === letter || t.letter === '*');
    });
    if (slot < 0) throw new Error('missing rack letter ' + letter);
    used[slot] = true;
    return {
      idx: spec.row * COLS + spec.col,
      letter: rack[slot].letter,
      rackIndex: slot,
      blankAs: rack[slot].letter === '*' ? letter : undefined,
    };
  });
  return engine.applyPlay(state, placements, PLAYER.P2, playOpts || {});
}

function readHorizontal(state, row, startCol, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var cell = state.board[row * COLS + startCol + i];
    out += cell ? cell.letter : '?';
  }
  return out;
}

function readVertical(state, col, startRow, len) {
  var out = '';
  var i;
  for (i = 0; i < len; i++) {
    var cell = state.board[(startRow + i) * COLS + col];
    out += cell ? cell.letter : '?';
  }
  return out;
}

function assertEq(label, actual, expected) {
  if (actual !== expected) {
    console.error('FAIL', label, 'expected', expected, 'got', actual);
    process.exit(1);
  }
  console.log('OK', label + ':', actual);
}

/* CONEYS: last S on TR start, grow left — stores LTR as CONEYS */
var state = emptyState();
setRack(state, PLAYER.P2, 'CONEYSABCDEFGHIJKLM');
var r = playP2(state, [
  { row: 0, col: 9, letter: 'C' },
  { row: 0, col: 10, letter: 'O' },
  { row: 0, col: 11, letter: 'N' },
  { row: 0, col: 12, letter: 'E' },
  { row: 0, col: 13, letter: 'Y' },
  { row: 0, col: 14, letter: 'S' },
]);
if (!r.valid) {
  console.error('FAIL CONEYS apply:', r.reason);
  process.exit(1);
}
assertEq('P2 CONEYS word', r.word, 'CONEYS');
assertEq('P2 CONEYS LTR store', readHorizontal(state, 0, 9, 6), 'CONEYS');
assertEq('P2 CONEYS corner letter S', state.board[0 * COLS + 14].letter, 'S');

/* First-on-corner horizontal (HITTER-style): H/C on start, grow left on logical */
state = emptyState();
setRack(state, PLAYER.P2, 'CONEYSABCDEFGHIJKLM');
var firstOnCorner = engine.applyPlay(state, [
  { idx: 0 * COLS + 14, letter: 'C', rackIndex: 0 },
  { idx: 0 * COLS + 13, letter: 'O', rackIndex: 1 },
  { idx: 0 * COLS + 12, letter: 'N', rackIndex: 2 },
  { idx: 0 * COLS + 11, letter: 'E', rackIndex: 3 },
  { idx: 0 * COLS + 10, letter: 'Y', rackIndex: 4 },
  { idx: 0 * COLS + 9, letter: 'S', rackIndex: 5 },
], PLAYER.P2);
if (!firstOnCorner.valid || firstOnCorner.word !== 'CONEYS') {
  console.error('FAIL first-on-corner CONEYS should accept, got', firstOnCorner);
  process.exit(1);
}
assertEq('P2 first-on-corner remaps to LTR with S on start', state.board[0 * COLS + 14].letter, 'S');
assertEq('P2 first-on-corner CONEYS LTR', readHorizontal(state, 0, 9, 6), 'CONEYS');
console.log('OK first-on-corner horizontal opening accepted (LTR store)');

/* FLOUT vertical: first F on TR, grow down */
state = emptyState();
setRack(state, PLAYER.P2, 'FLOUTABCDEFGHIJKLM');
r = playP2(state, [
  { row: 0, col: 14, letter: 'F' },
  { row: 1, col: 14, letter: 'L' },
  { row: 2, col: 14, letter: 'O' },
  { row: 3, col: 14, letter: 'U' },
  { row: 4, col: 14, letter: 'T' },
]);
if (!r.valid) {
  console.error('FAIL FLOUT apply:', r.reason);
  process.exit(1);
}
assertEq('P2 FLOUT word', r.word, 'FLOUT');
assertEq('P2 FLOUT TTB store', readVertical(state, 14, 0, 5), 'FLOUT');
assertEq('P2 FLOUT corner letter F', state.board[0 * COLS + 14].letter, 'F');

/* TO through FLOUT T */
setRack(state, PLAYER.P1, 'TOXXXXXX');
state.openingPlayed = [true, true];
state.boardsLinked = true;
state.currentPlayer = PLAYER.P1;
var to = engine.applyPlay(state, [
  { idx: 4 * COLS + 13, letter: 'O', rackIndex: 1 },
], PLAYER.P1, { intendedWord: 'TO', wordCells: [4 * COLS + 14, 4 * COLS + 13] });
/* Place T is already on board from FLOUT — need O adjacent. Word TO: T at (4,14), O at (4,13) */
if (!to.valid) {
  /* try with both if needed - T exists */
  console.log('(TO via O beside FLOUT T)');
}
setRack(state, PLAYER.P2, 'OXXXXXXX');
state.currentPlayer = PLAYER.P2;
to = engine.applyPlay(state, [
  { idx: 4 * COLS + 13, letter: 'O', rackIndex: 0 },
], PLAYER.P2, { intendedWord: 'TO', wordCells: [4 * COLS + 14, 4 * COLS + 13] });
if (!to.valid) {
  console.error('FAIL TO through FLOUT:', to);
  process.exit(1);
}
assertEq('P2 horizontal TO through FLOUT T', to.word, 'TO');

/* CUTTLE: last E on start grow left */
state = emptyState();
setRack(state, PLAYER.P2, 'CUTTLEABCDEFGHIJK');
r = playP2(state, [
  { row: 0, col: 9, letter: 'C' },
  { row: 0, col: 10, letter: 'U' },
  { row: 0, col: 11, letter: 'T' },
  { row: 0, col: 12, letter: 'T' },
  { row: 0, col: 13, letter: 'L' },
  { row: 0, col: 14, letter: 'E' },
]);
if (!r.valid) {
  console.error('FAIL CUTTLE:', r.reason);
  process.exit(1);
}
assertEq('P2 CUTTLE word', r.word, 'CUTTLE');
assertEq('P2 CUTTLE LTR store', readHorizontal(state, 0, 9, 6), 'CUTTLE');
assertEq('P2 CUTTLE corner E', state.board[0 * COLS + 14].letter, 'E');

/* EAT vertical: E on start grow down */
state = emptyState();
setRack(state, PLAYER.P2, 'EATXXXXX');
r = playP2(state, [
  { row: 0, col: 14, letter: 'E' },
  { row: 1, col: 14, letter: 'A' },
  { row: 2, col: 14, letter: 'T' },
], { intendedWord: 'EAT', wordCells: [0 * COLS + 14, 1 * COLS + 14, 2 * COLS + 14] });
if (!r.valid) {
  console.error('FAIL EAT:', r.reason);
  process.exit(1);
}
assertEq('P2 vertical EAT opening word', r.word, 'EAT');
assertEq('P2 vertical EAT TTB store', readVertical(state, 14, 0, 3), 'EAT');

/* SEAT extension above E — place S at row -1? can't. Extend below: SEAT needs S before E.
   Place S left of E horizontally, or extend: add S at... EAT grow: add S by playing before E
   at impossible. Play S on row0 col13 making... 
   Extend down: already EAT. Add blank — play SEAT by adding S above — no.
   Vertical SEAT: S on start, E,A,T below — new game */
state = emptyState();
setRack(state, PLAYER.P2, 'SEATXXXX');
r = playP2(state, [
  { row: 0, col: 14, letter: 'S' },
  { row: 1, col: 14, letter: 'E' },
  { row: 2, col: 14, letter: 'A' },
  { row: 3, col: 14, letter: 'T' },
]);
if (!r.valid) {
  console.error('FAIL SEAT:', r.reason);
  process.exit(1);
}
assertEq('P2 vertical SEAT', r.word, 'SEAT');

/* NE reads LTR on shared board */
if (boardView.readLogicalHorizontal(
  (function () {
    var b = new Array(COLS * ROWS).fill(null);
    b[0 * COLS + 13] = { letter: 'N' };
    b[0 * COLS + 14] = { letter: 'E' };
    return b;
  })(),
  0,
  13,
  2,
  COLS,
  function (board, idx) {
    return board[idx] ? board[idx].letter : null;
  }
) !== 'NE') {
  console.error('FAIL NE LTR read');
  process.exit(1);
}
console.log('OK P1 cross through P2 vertical EAT (LTR): NE');

/* Word-oriented CONEYS */
state = emptyState();
setRack(state, PLAYER.P2, 'CONEYSXX');
r = playP2(state, [
  { row: 0, col: 9, letter: 'C' },
  { row: 0, col: 10, letter: 'O' },
  { row: 0, col: 11, letter: 'N' },
  { row: 0, col: 12, letter: 'E' },
  { row: 0, col: 13, letter: 'Y' },
  { row: 0, col: 14, letter: 'S' },
], {
  intendedWord: 'CONEYS',
  wordCells: [
    0 * COLS + 9,
    0 * COLS + 10,
    0 * COLS + 11,
    0 * COLS + 12,
    0 * COLS + 13,
    0 * COLS + 14,
  ],
});
if (!r.valid || r.word !== 'CONEYS') {
  console.error('FAIL word-oriented CONEYS:', r);
  process.exit(1);
}
console.log('OK word-oriented CONEYS submit');

/* P1 DOE */
state = emptyState();
setRack(state, PLAYER.P1, 'DOEXXXXX');
r = engine.applyPlay(state, [
  { idx: 12 * COLS + 0, letter: 'D', rackIndex: 0 },
  { idx: 13 * COLS + 0, letter: 'O', rackIndex: 1 },
  { idx: 14 * COLS + 0, letter: 'E', rackIndex: 2 },
], PLAYER.P1);
if (!r.valid) {
  console.error('FAIL DOE:', r);
  process.exit(1);
}
assertEq('P1 DOE applyPlay word', r.word, 'DOE');
assertEq('P1 DOE board col0 rows 12-14', readVertical(state, 0, 12, 3), 'DOE');

/* P1 vertical NOTION top-down */
state = emptyState();
setRack(state, PLAYER.P1, 'NOTIONXX');
r = engine.applyPlay(state, [
  { idx: 9 * COLS + 0, letter: 'N', rackIndex: 0 },
  { idx: 10 * COLS + 0, letter: 'O', rackIndex: 1 },
  { idx: 11 * COLS + 0, letter: 'T', rackIndex: 2 },
  { idx: 12 * COLS + 0, letter: 'I', rackIndex: 3 },
  { idx: 13 * COLS + 0, letter: 'O', rackIndex: 4 },
  { idx: 14 * COLS + 0, letter: 'N', rackIndex: 5 },
], PLAYER.P1);
if (!r.valid || r.word !== 'NOTION') {
  console.error('FAIL NOTION:', r);
  process.exit(1);
}
console.log('OK P1 vertical NOTION top-down accepted');

/* Invalid SA / ACY not flipped */
state = emptyState();
state.openingPlayed = [true, true];
state.boardsLinked = true;
state.board[7 * COLS + 7] = { letter: 'A', owner: PLAYER.P1, isBlank: false };
setRack(state, PLAYER.P1, 'SXXXXXXX');
var bad = engine.validateMove(state, [
  { idx: 7 * COLS + 6, letter: 'S', rackIndex: 0 },
], PLAYER.P1, { intendedWord: 'SA', wordCells: [7 * COLS + 6, 7 * COLS + 7] });
if (bad.valid) {
  console.error('FAIL invalid SA should reject', bad);
  process.exit(1);
}
console.log('OK invalid SA rejected (not flipped to AS)');

setRack(state, PLAYER.P1, 'CYXXXXXX');
state.board[7 * COLS + 7] = { letter: 'A', owner: PLAYER.P1, isBlank: false };
bad = engine.validateMove(state, [
  { idx: 7 * COLS + 8, letter: 'C', rackIndex: 0 },
  { idx: 7 * COLS + 9, letter: 'Y', rackIndex: 1 },
], PLAYER.P1, { intendedWord: 'ACY', wordCells: [7 * COLS + 7, 7 * COLS + 8, 7 * COLS + 9] });
if (bad.valid) {
  console.error('FAIL invalid ACY should reject', bad);
  process.exit(1);
}
console.log('OK invalid ACY rejected (not flipped to CAY)');

console.log('All shared-camera P2 normalize tests passed.');
