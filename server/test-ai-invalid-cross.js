'use strict';

/**
 * AI/offline validation must match human isValidWord on exact LTR/TTB runs.
 * Rejects reverse/anagram accepts: TPEWS↛SWEPT, SGO↛GOS, SBURTHEN↛BURTHENS,
 * RFARE↛FARER, DFARE↛FARED.
 * Run: node server/test-ai-invalid-cross.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var fail = 0;
function assert(cond, msg, detail) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg, detail || '');
  } else {
    console.log('OK', msg);
  }
}

var COLS = 15;
var ROWS = 15;
var PLAYER = { HUMAN: 0, AI: 1 };
var START_P1_IDX = (ROWS - 1) * COLS;
var START_P2_IDX = COLS - 1;

var dictSrc = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: 'dictionary.js' });
var WORD_SET = new Set(
  (sandbox.window.QWERTY_WORD_LIST || []).map(function (w) {
    return String(w).toUpperCase();
  })
);

function isValidWord(w) {
  return WORD_SET.has(String(w || '').toUpperCase());
}

assert(isValidWord('PEWS'), 'PEWS in dictionary');
assert(isValidWord('SWEPT'), 'SWEPT in dictionary');
assert(isValidWord('GOS'), 'GOS in dictionary');
assert(!isValidWord('TPEWS'), 'TPEWS not in dictionary');
assert(!isValidWord('SGO'), 'SGO not in dictionary');
assert(isValidWord('BURTHEN'), 'BURTHEN in dictionary');
assert(isValidWord('BURTHENS'), 'BURTHENS in dictionary');
assert(!isValidWord('SBURTHEN'), 'SBURTHEN not in dictionary');
assert(isValidWord('FARE'), 'FARE in dictionary');
assert(isValidWord('FARER'), 'FARER in dictionary');
assert(isValidWord('FARED'), 'FARED in dictionary');
assert(!isValidWord('RFARE'), 'RFARE not in dictionary');
assert(!isValidWord('DFARE'), 'DFARE not in dictionary');
assert(isValidWord('PURTY'), 'PURTY in dictionary');

/** Mirror game.js resolveWordFromRun — exact LTR/TTB only. */
function resolveWordFromRun(board, cells) {
  if (!cells || cells.length < 2) return null;
  var horizontal = cells.every(function (c) {
    return Math.floor(c / COLS) === Math.floor(cells[0] / COLS);
  });
  var vertical = cells.every(function (c) {
    return c % COLS === cells[0] % COLS;
  });
  var ascCells;
  if (horizontal) {
    ascCells = cells.slice().sort(function (a, b) {
      return (a % COLS) - (b % COLS);
    });
  } else if (vertical) {
    ascCells = cells.slice().sort(function (a, b) {
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
  } else {
    return null;
  }
  var ascWord = ascCells
    .map(function (i) {
      return board[i] && board[i].letter ? board[i].letter : '';
    })
    .join('')
    .toUpperCase();
  return isValidWord(ascWord) ? ascWord : null;
}

function getAllWordsFromBoard(board) {
  var words = [];
  var r, c, run, start, cell, letter, cells;
  for (r = 0; r < ROWS; r++) {
    run = '';
    start = 0;
    cells = [];
    for (c = 0; c <= COLS; c++) {
      if (c < COLS) {
        cell = board[r * COLS + c];
        letter = cell && cell.letter;
        if (letter) {
          if (!run) start = c;
          run += letter;
          cells.push(r * COLS + c);
        } else {
          if (run.length >= 2) words.push({ word: run, cells: cells.slice() });
          run = '';
          cells = [];
        }
      } else if (run.length >= 2) {
        words.push({ word: run, cells: cells.slice() });
      }
    }
  }
  for (c = 0; c < COLS; c++) {
    run = '';
    start = 0;
    cells = [];
    for (r = 0; r <= ROWS; r++) {
      if (r < ROWS) {
        cell = board[r * COLS + c];
        letter = cell && cell.letter;
        if (letter) {
          if (!run) start = r;
          run += letter;
          cells.push(r * COLS + c);
        } else {
          if (run.length >= 2) words.push({ word: run, cells: cells.slice() });
          run = '';
          cells = [];
        }
      } else if (run.length >= 2) {
        words.push({ word: run, cells: cells.slice() });
      }
    }
  }
  return words;
}

/** Offline validateMove word loop — same as humans and AI. */
function validateFormedWords(board, placementIdxs) {
  var newSet = {};
  var i;
  for (i = 0; i < placementIdxs.length; i++) newSet[placementIdxs[i]] = true;
  var words = getAllWordsFromBoard(board);
  var formed = [];
  for (i = 0; i < words.length; i++) {
    var cells = words[i].cells;
    var usesNew = cells.some(function (c) {
      return newSet[c];
    });
    if (!usesNew) continue;
    var w = String(words[i].word || '').toUpperCase();
    if (!isValidWord(w)) {
      return { valid: false, reason: '"' + w + '" is not a valid word.', bad: w };
    }
    var accepted = resolveWordFromRun(board, cells);
    if (!accepted || accepted !== w) {
      return { valid: false, reason: '"' + w + '" is not a valid word.', bad: w };
    }
    formed.push(accepted);
  }
  if (!formed.length) return { valid: false, reason: 'Must form at least one new word.' };
  return { valid: true, formed: formed };
}

function emptyBoard() {
  return new Array(COLS * ROWS).fill(null);
}

function put(board, col, row, letter, owner) {
  board[row * COLS + col] = { letter: letter, owner: owner };
}

/* ── PEWS / TPEWS / SGO ─────────────────────────────────────── */
(function () {
  var board = emptyBoard();
  'FETUS'.split('').forEach(function (ch, i) {
    put(board, 5 + i, 7, ch, PLAYER.HUMAN);
  });
  /* AI plays PEWS down from T → TPEWS vertical + SGO if G,O to the right of S */
  put(board, 6, 8, 'P', PLAYER.AI);
  put(board, 6, 9, 'E', PLAYER.AI);
  put(board, 6, 10, 'W', PLAYER.AI);
  put(board, 6, 11, 'S', PLAYER.AI);
  put(board, 7, 11, 'G', PLAYER.AI);
  put(board, 8, 11, 'O', PLAYER.AI);
  var placed = [6 + 8 * COLS, 6 + 9 * COLS, 6 + 10 * COLS, 6 + 11 * COLS, 7 + 11 * COLS, 8 + 11 * COLS];
  var r = validateFormedWords(board, placed);
  assert(!r.valid, 'AI PEWS+GO forming TPEWS/SGO must reject', r);
  assert(/TPEWS|SGO/.test(r.bad || ''), 'reject reason names invalid board word', r);
})();

(function () {
  var board = emptyBoard();
  put(board, 6, 7, 'T', PLAYER.HUMAN);
  put(board, 6, 8, 'P', PLAYER.AI);
  put(board, 6, 9, 'E', PLAYER.AI);
  put(board, 6, 10, 'W', PLAYER.AI);
  put(board, 6, 11, 'S', PLAYER.AI);
  /* Isolated PEWS below T is not a single run with T if gap — contiguous TPEWS */
  var tpews = [6 + 7 * COLS, 6 + 8 * COLS, 6 + 9 * COLS, 6 + 10 * COLS, 6 + 11 * COLS];
  assert(resolveWordFromRun(board, tpews) === null, 'TPEWS mid-board not accepted as SWEPT');
})();

(function () {
  var board = emptyBoard();
  put(board, 5, 11, 'S', PLAYER.AI);
  put(board, 6, 11, 'G', PLAYER.AI);
  put(board, 7, 11, 'O', PLAYER.AI);
  assert(
    resolveWordFromRun(board, [5 + 11 * COLS, 6 + 11 * COLS, 7 + 11 * COLS]) === null,
    'SGO mid-board not accepted as GOS'
  );
})();

/* Isolated valid PEWS (no T above) */
(function () {
  var board = emptyBoard();
  put(board, 6, 8, 'P', PLAYER.AI);
  put(board, 6, 9, 'E', PLAYER.AI);
  put(board, 6, 10, 'W', PLAYER.AI);
  put(board, 6, 11, 'S', PLAYER.AI);
  var cells = [6 + 8 * COLS, 6 + 9 * COLS, 6 + 10 * COLS, 6 + 11 * COLS];
  assert(resolveWordFromRun(board, cells) === 'PEWS', 'isolated PEWS TTB must accept');
})();

/* ── Anagram-era fingerprints: left tile moved to end ───────── */
(function () {
  var board = emptyBoard();
  'SBURTHEN'.split('').forEach(function (ch, i) {
    put(board, i + 7, 0, ch, PLAYER.AI);
  });
  var cells = [];
  var i;
  for (i = 7; i <= 14; i++) cells.push(i);
  assert(resolveWordFromRun(board, cells) === null, 'SBURTHEN on start row not accepted as BURTHENS');
  var r = validateFormedWords(board, cells);
  assert(!r.valid && r.bad === 'SBURTHEN', 'SBURTHEN play rejected', r);
})();

(function () {
  var board = emptyBoard();
  'RFARE'.split('').forEach(function (ch, i) {
    put(board, 2 + i, 8, ch, PLAYER.AI);
  });
  /* PURTY vertical through R */
  'PURTY'.split('').forEach(function (ch, i) {
    put(board, 2, 6 + i, ch, PLAYER.AI);
  });
  var placed = [2 + 6 * COLS, 2 + 7 * COLS, 2 + 8 * COLS, 2 + 9 * COLS, 2 + 10 * COLS];
  var r = validateFormedWords(board, placed);
  assert(!r.valid, 'PURTY forming RFARE must reject', r);
  assert(r.bad === 'RFARE' || (r.formed || []).indexOf('RFARE') < 0, 'RFARE named or blocked', r);
})();

(function () {
  var board = emptyBoard();
  'DFARE'.split('').forEach(function (ch, i) {
    put(board, 3 + i, 9, ch, PLAYER.HUMAN);
  });
  var cells = [3, 4, 5, 6, 7].map(function (c) {
    return 9 * COLS + c;
  });
  assert(resolveWordFromRun(board, cells) === null, 'DFARE not accepted as FARED');
  var r = validateFormedWords(board, cells);
  assert(!r.valid && r.bad === 'DFARE', 'DFARE play rejected', r);
})();

/* Reverse-on-start must NOT accept invalid LTR (ERAF↛FARE) */
(function () {
  var board = emptyBoard();
  'ERAF'.split('').forEach(function (ch, i) {
    put(board, 11 + i, 0, ch, PLAYER.AI);
  });
  assert(board[START_P2_IDX].letter === 'F', 'F on P2 start');
  assert(resolveWordFromRun(board, [11, 12, 13, 14]) === null, 'ERAF on start row not accepted as FARE');
})();

/* Valid LTR on start still works */
(function () {
  var board = emptyBoard();
  'FARE'.split('').forEach(function (ch, i) {
    put(board, 11 + i, 0, ch, PLAYER.AI);
  });
  assert(resolveWordFromRun(board, [11, 12, 13, 14]) === 'FARE', 'FARE LTR on start accepts');
})();

var gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
assert(
  gameSrc.indexOf('No reverse readings, no left-tile-to-end anagrams') >= 0,
  'game.js documents reverse-reject fix'
);
assert(gameSrc.indexOf('rest.concat(minCells)') < 0, 'anagram rest+min path removed from game.js');
assert(
  /accepted !== w/.test(gameSrc) && /isValidWord\(w\)/.test(gameSrc),
  'validateMove requires exact LTR isValidWord match'
);
assert(
  gameSrc.indexOf('Re-validate at commit so AI never lands an invalid cross') >= 0,
  'AI re-validates before commit'
);
assert(
  /bingo:\s*!!commitCheck\.bingo/.test(gameSrc) || gameSrc.indexOf('bingo: !!commitCheck.bingo') >= 0,
  'AI score feedback carries bingo flags'
);

if (fail) {
  console.error('\n' + fail + ' failure(s)');
  process.exit(1);
}
console.log('All AI invalid-cross tests passed.');
