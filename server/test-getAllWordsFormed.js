'use strict';

/**
 * Unit tests for getAllWordsFormed — catches reversal / wrong-attachment bugs.
 * Run: node server/test-getAllWordsFormed.js
 */

var path = require('path');
var api = require(path.join(__dirname, '..', 'getAllWordsFormed.js'));
var getAllWordsFormed = api.getAllWordsFormed;
var COLS = 15;

function emptyBoard() {
  return new Array(COLS * 15).fill(null);
}

function setLetter(board, row, col, letter) {
  board[row * COLS + col] = { letter: letter };
}

function idx(row, col) {
  return row * COLS + col;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

function wordsOf(result) {
  return result.words.map(function (w) {
    return w.word;
  }).sort();
}

/* --- SUP: place S-U-P left-to-right; must read SUP not PUS --- */
(function () {
  var board = emptyBoard();
  setLetter(board, 7, 5, 'S');
  setLetter(board, 7, 6, 'U');
  setLetter(board, 7, 7, 'P');
  var placed = [idx(7, 5), idx(7, 6), idx(7, 7)];
  var result = getAllWordsFormed(board, placed);
  assert(result.main && result.main.word === 'SUP', 'SUP main word is SUP (not PUS)');
  assert(result.main.direction === 'horizontal', 'SUP is horizontal');
  assert(
    result.main.positions[0] === idx(7, 5) && result.main.positions[2] === idx(7, 7),
    'SUP positions are LTR'
  );
  assert(wordsOf(result).join(',') === 'SUP', 'SUP forms only SUP');
})();

/* --- Reversal trap: letters physically P-U-S left-to-right must read PUS, never SUP --- */
(function () {
  var board = emptyBoard();
  setLetter(board, 7, 5, 'P');
  setLetter(board, 7, 6, 'U');
  setLetter(board, 7, 7, 'S');
  var result = getAllWordsFormed(board, [idx(7, 5), idx(7, 6), idx(7, 7)]);
  assert(result.main.word === 'PUS', 'LTR board P-U-S reads PUS (no silent reverse to SUP)');
  assert(result.main.word !== 'SUP', 'must not invent SUP from PUS cells');
})();

/* --- VALIN vertical top-to-bottom --- */
(function () {
  var board = emptyBoard();
  var letters = 'VALIN'.split('');
  var placed = [];
  var i;
  for (i = 0; i < letters.length; i++) {
    setLetter(board, 3 + i, 10, letters[i]);
    placed.push(idx(3 + i, 10));
  }
  var result = getAllWordsFormed(board, placed);
  assert(result.main.word === 'VALIN', 'VALIN main word top-to-bottom');
  assert(result.main.direction === 'vertical', 'VALIN is vertical');
  assert(result.main.word !== 'NILAV', 'must not reverse VALIN to NILAV');
})();

/* --- Cross: place A under existing AT → main TA? No: place A left of T on row with E below making...
 * Board has CAT horizontal. Place S below C → cross forms CS? length 2.
 * Simpler: BOARD has HAT. Place S after T → HATS. Also place nothing else.
 */
(function () {
  var board = emptyBoard();
  setLetter(board, 8, 4, 'H');
  setLetter(board, 8, 5, 'A');
  setLetter(board, 8, 6, 'T');
  setLetter(board, 8, 7, 'S'); /* new */
  var result = getAllWordsFormed(board, [idx(8, 7)]);
  assert(result.main.word === 'HATS', 'extend HAT with S → HATS');
  assert(result.main.word !== 'STAH', 'must not reverse HATS');
})();

/* --- Crossing: existing PIE; place A left of I → main AI only (PIE already on board) --- */
(function () {
  var board = emptyBoard();
  setLetter(board, 5, 8, 'P');
  setLetter(board, 6, 8, 'I');
  setLetter(board, 7, 8, 'E');
  setLetter(board, 6, 7, 'A'); /* new, left of I */
  var result = getAllWordsFormed(board, [idx(6, 7)]);
  assert(result.main && result.main.word === 'AI', 'hook left of I → main AI LTR');
  assert(result.main.word !== 'IA', 'must not reverse AI to IA');
  assert(wordsOf(result).join(',') === 'AI', 'only new word AI (PIE was already on board)');
})();

/* --- Extend vertical downward: PIE + S → PIES top-to-bottom, never SEIP --- */
(function () {
  var board = emptyBoard();
  setLetter(board, 5, 8, 'P');
  setLetter(board, 6, 8, 'I');
  setLetter(board, 7, 8, 'E');
  setLetter(board, 8, 8, 'S'); /* new */
  var result = getAllWordsFormed(board, [idx(8, 8)]);
  assert(result.main.word === 'PIES', 'extend PIE with S → PIES');
  assert(result.main.direction === 'vertical', 'PIES is vertical');
  assert(result.main.word !== 'SEIP', 'must not reverse PIES to SEIP');
})();

/* --- Hook under G of DOG: only new word is GS (DOG already existed) --- */
(function () {
  var board = emptyBoard();
  setLetter(board, 10, 2, 'D');
  setLetter(board, 10, 3, 'O');
  setLetter(board, 10, 4, 'G');
  setLetter(board, 11, 4, 'S'); /* new under G */
  var result = getAllWordsFormed(board, [idx(11, 4)]);
  assert(result.main.word === 'GS', 'hook under G → main GS top-to-bottom');
  assert(result.main.direction === 'vertical', 'GS is vertical');
  assert(result.main.word !== 'SG', 'must not reverse GS to SG');
  assert(wordsOf(result).join(',') === 'GS', 'DOG is not re-listed (already on board)');
})();

/* --- True cross: play two new tiles covering a line that hooks two stems --- */
(function () {
  var board = emptyBoard();
  /* Vertical stems: A/T in col 3, B/E in col 5 (rows 5-6) */
  setLetter(board, 5, 3, 'A');
  setLetter(board, 6, 3, 'T');
  setLetter(board, 5, 5, 'B');
  setLetter(board, 6, 5, 'E');
  /* Place I on row 4 above... simpler: place O between A and B on row 5 */
  setLetter(board, 5, 4, 'O');
  var result = getAllWordsFormed(board, [idx(5, 4)]);
  assert(result.main.word === 'AOB', 'bridge A_B with O → AOB');
  assert(result.main.direction === 'horizontal', 'AOB horizontal');
  assert(result.main.word !== 'BOA', 'must not reverse AOB to BOA');
})();

/* --- Multi-tile with a real cross through a NEW tile --- */
(function () {
  var board = emptyBoard();
  /* Existing H above the E we will place */
  setLetter(board, 4, 6, 'H');
  /* Place T E A on row 5 — E under H → cross HE */
  setLetter(board, 5, 5, 'T');
  setLetter(board, 5, 6, 'E');
  setLetter(board, 5, 7, 'A');
  var result = getAllWordsFormed(board, [idx(5, 5), idx(5, 6), idx(5, 7)]);
  var set = {};
  result.words.forEach(function (w) {
    set[w.word] = w;
  });
  assert(result.main.word === 'TEA', 'main TEA LTR');
  assert(result.main.word !== 'AET', 'must not reverse TEA');
  assert(set.HE, 'cross through new E is HE top-to-bottom');
  assert(!set.EH, 'must not reverse HE to EH');
  assert(set.HE.positions[0] === idx(4, 6), 'HE starts at H');
})();

console.log('All getAllWordsFormed tests passed.');
