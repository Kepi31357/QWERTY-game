/**
 * Pure placement validation + scoring (Phase 2.5).
 *
 * Uses getAllWordsFormed for canonical LTR / top-to-bottom words.
 * Does not mutate the input board. No UI / rack draw / multiplayer sync.
 */
'use strict';

var wordsApi =
  typeof require !== 'undefined'
    ? require('./getAllWordsFormed.js')
    : typeof globalThis !== 'undefined'
      ? globalThis.QWERTYWordsFormed
      : null;

var getAllWordsFormed = wordsApi && wordsApi.getAllWordsFormed;
var letterAt = wordsApi && wordsApi.letterAt;

var TILE_POINTS = 10;
var CONNECTION_BONUS = 75;
var BINGO_BONUS = 100;
var DEFAULT_COLS = 15;
var DEFAULT_ROWS = 15;

function fail(error) {
  return {
    success: false,
    score: 0,
    wordsFormed: [],
    newBoard: null,
    bonusConnections: 0,
    bingo: false,
    error: error,
  };
}

function cloneBoard(board) {
  return (board || []).map(function (cell) {
    if (cell == null) return null;
    if (typeof cell === 'string') {
      var s = String(cell).trim();
      return s ? { letter: s.toUpperCase(), owner: null } : null;
    }
    return {
      letter: cell.letter != null ? String(cell.letter).toUpperCase() : '',
      owner: cell.owner != null ? Number(cell.owner) : null,
      isBlank: !!cell.isBlank,
    };
  });
}

function normalizePlacements(placements) {
  return (placements || []).map(function (p) {
    return {
      idx: Number(p.idx),
      letter: String(p.blankAs != null ? p.blankAs : p.letter).toUpperCase(),
      isBlank: p.letter === '*' || !!p.isBlank,
    };
  });
}

function placementsAreStraight(placed, cols) {
  if (placed.length <= 1) return { ok: true, horizontal: true };
  var row0 = Math.floor(placed[0].idx / cols);
  var col0 = placed[0].idx % cols;
  var sameRow = placed.every(function (p) {
    return Math.floor(p.idx / cols) === row0;
  });
  var sameCol = placed.every(function (p) {
    return p.idx % cols === col0;
  });
  if (sameRow) return { ok: true, horizontal: true };
  if (sameCol) return { ok: true, horizontal: false };
  return { ok: false };
}

function hasGapOnLine(board, placed, horizontal, cols) {
  var indices = placed.map(function (p) {
    return p.idx;
  });
  var placedSet = {};
  var i;
  for (i = 0; i < indices.length; i++) placedSet[indices[i]] = true;

  if (horizontal) {
    var row = Math.floor(indices[0] / cols);
    var colsOnly = indices.map(function (idx) {
      return idx % cols;
    });
    var minC = Math.min.apply(null, colsOnly);
    var maxC = Math.max.apply(null, colsOnly);
    var c;
    for (c = minC; c <= maxC; c++) {
      var idxH = row * cols + c;
      if (!placedSet[idxH] && !letterAt(board, idxH)) return true;
    }
  } else {
    var col = indices[0] % cols;
    var rowsOnly = indices.map(function (idx) {
      return Math.floor(idx / cols);
    });
    var minR = Math.min.apply(null, rowsOnly);
    var maxR = Math.max.apply(null, rowsOnly);
    var r;
    for (r = minR; r <= maxR; r++) {
      var idxV = r * cols + col;
      if (!placedSet[idxV] && !letterAt(board, idxV)) return true;
    }
  }
  return false;
}

function neighborIndices(idx, cols, rows) {
  var row = Math.floor(idx / cols);
  var col = idx % cols;
  var out = [];
  if (col > 0) out.push(idx - 1);
  if (col < cols - 1) out.push(idx + 1);
  if (row > 0) out.push(idx - cols);
  if (row < rows - 1) out.push(idx + cols);
  return out;
}

function coversStart(placed, startIdx) {
  if (startIdx == null) return false;
  var i;
  for (i = 0; i < placed.length; i++) {
    if (Number(placed[i].idx) === Number(startIdx)) return true;
  }
  return false;
}

function touchesExisting(board, placed, cols, rows) {
  var placedSet = {};
  var i;
  for (i = 0; i < placed.length; i++) placedSet[placed[i].idx] = true;
  for (i = 0; i < placed.length; i++) {
    var nbs = neighborIndices(placed[i].idx, cols, rows);
    var j;
    for (j = 0; j < nbs.length; j++) {
      if (placedSet[nbs[j]]) continue;
      if (letterAt(board, nbs[j])) return true;
    }
  }
  return false;
}

/**
 * Distinct opponent-owned tiles that appear in any newly formed word
 * (excluding tiles placed this turn). Uses the board BEFORE placement.
 */
function countBonusConnections(board, placed, player, formedWords) {
  var placedSet = {};
  var i;
  for (i = 0; i < placed.length; i++) {
    placedSet[placed[i].idx] = true;
  }
  var seen = {};
  var count = 0;
  var wi, pi, pos, cell;
  for (wi = 0; wi < (formedWords || []).length; wi++) {
    var positions = formedWords[wi].positions || formedWords[wi].cells || [];
    for (pi = 0; pi < positions.length; pi++) {
      pos = Number(positions[pi]);
      if (seen[pos] || placedSet[pos]) continue;
      if (!letterAt(board, pos)) continue;
      cell = board[pos];
      if (!cell || typeof cell === 'string') continue;
      if (cell.owner == null) continue;
      if (Number(cell.owner) === Number(player)) continue;
      seen[pos] = true;
      count++;
    }
  }
  return count;
}

function applyPlacements(board, placed, player) {
  var next = cloneBoard(board);
  var i;
  for (i = 0; i < placed.length; i++) {
    var p = placed[i];
    next[p.idx] = {
      letter: p.letter,
      owner: player,
      isBlank: !!p.isBlank,
    };
  }
  return next;
}

/**
 * @param {Array} board - board BEFORE this turn's tiles
 * @param {Array<{idx:number, letter:string, blankAs?:string}>} placements
 * @param {{
 *   player: number,
 *   startIdx: number,
 *   isValidWord: (word: string) => boolean,
 *   rackTileCount: number,
 *   boardsLinked?: boolean,
 *   cols?: number,
 *   rows?: number,
 * }} ctx
 * @returns {{
 *   success: boolean,
 *   score: number,
 *   wordsFormed: Array,
 *   newBoard: Array|null,
 *   bonusConnections: number,
 *   bingo: boolean,
 *   error?: string,
 * }}
 */
function validateAndScorePlacement(board, placements, ctx) {
  if (!getAllWordsFormed || !letterAt) {
    return fail('getAllWordsFormed is not available.');
  }
  ctx = ctx || {};
  var cols = ctx.cols != null ? ctx.cols : DEFAULT_COLS;
  var rows = ctx.rows != null ? ctx.rows : DEFAULT_ROWS;
  var player = ctx.player;
  var startIdx = ctx.startIdx;
  var isValidWord = ctx.isValidWord;
  var rackTileCount = ctx.rackTileCount != null ? Number(ctx.rackTileCount) : 0;

  if (typeof isValidWord !== 'function') {
    return fail('isValidWord is required.');
  }
  if (player == null) {
    return fail('player is required.');
  }

  var placed = normalizePlacements(placements);
  if (!placed.length) {
    return fail('No tiles placed.');
  }

  var seenIdx = {};
  var i;
  for (i = 0; i < placed.length; i++) {
    var idx = placed[i].idx;
    if (idx < 0 || idx >= cols * rows) {
      return fail('Placement out of bounds.');
    }
    if (seenIdx[idx]) {
      return fail('Duplicate placement on the same cell.');
    }
    seenIdx[idx] = true;
    if (letterAt(board, idx)) {
      return fail('Cannot place on an occupied cell.');
    }
    if (!placed[i].letter || !/^[A-Z]$/.test(placed[i].letter)) {
      return fail('Each placement needs a letter A–Z.');
    }
  }

  var line = placementsAreStraight(placed, cols);
  if (!line.ok) {
    return fail('Tiles must be in a straight line (one row or one column).');
  }
  if (hasGapOnLine(board, placed, line.horizontal, cols)) {
    return fail('No gaps allowed within a word.');
  }

  /* Opening: player's first word must cover their start (even if opponent tiles exist). */
  var playerHasTiles = false;
  var bi;
  for (bi = 0; bi < board.length; bi++) {
    if (!letterAt(board, bi)) continue;
    var bc = board[bi];
    if (bc && typeof bc === 'object' && bc.owner != null && Number(bc.owner) === Number(player)) {
      playerHasTiles = true;
      break;
    }
  }
  if (!playerHasTiles && !coversStart(placed, startIdx)) {
    return fail('Opening word must cover your starting square');
  }

  if (!coversStart(placed, startIdx) && !touchesExisting(board, placed, cols, rows)) {
    return fail('Placement must connect to existing tiles or cover the starting square.');
  }

  var newBoard = applyPlacements(board, placed, player);
  var placedPositions = placed.map(function (p) {
    return p.idx;
  });
  var formed = getAllWordsFormed(newBoard, placedPositions, {
    cols: cols,
    rows: rows,
    player: player,
    startIdx: startIdx,
    boardBefore: board,
  });

  if (formed.error) {
    return fail(formed.error);
  }

  if (!formed.words.length) {
    return fail('Must form at least one word of 2+ letters.');
  }

  for (i = 0; i < formed.words.length; i++) {
    var w = formed.words[i].word;
    if (!isValidWord(w)) {
      return fail('"' + w + '" is not a valid word.');
    }
  }

  var bonusConnections = countBonusConnections(board, placed, player, formed.words);
  var bingo = placed.length > 0 && placed.length === rackTileCount;
  /*
   * Every newly formed word scores length × 10 (full runs from getAllWordsFormed).
   * +75 only when this play first connects to opponent words (boardsLinked was false).
   */
  var letterScore = 0;
  for (i = 0; i < formed.words.length; i++) {
    letterScore += TILE_POINTS * String(formed.words[i].word || '').length;
  }
  var alreadyLinked = !!ctx.boardsLinked;
  var linkBonus =
    bonusConnections > 0 && !alreadyLinked ? CONNECTION_BONUS : 0;
  var score = letterScore + linkBonus + (bingo ? BINGO_BONUS : 0);

  return {
    success: true,
    score: score,
    letterScore: letterScore,
    linkBonus: linkBonus,
    wordsFormed: formed.words.map(function (entry) {
      return {
        word: entry.word,
        positions: entry.positions.slice(),
        direction: entry.direction,
        isMain: !!entry.isMain,
      };
    }),
    newBoard: newBoard,
    bonusConnections: bonusConnections,
    bingo: bingo,
  };
}

/** Same as validateAndScorePlacement — kept as the public attemptPlace API name. */
function attemptPlace(board, placements, ctx) {
  return validateAndScorePlacement(board, placements, ctx);
}

var api = {
  validateAndScorePlacement: validateAndScorePlacement,
  attemptPlace: attemptPlace,
  countBonusConnections: countBonusConnections,
  TILE_POINTS: TILE_POINTS,
  CONNECTION_BONUS: CONNECTION_BONUS,
  BINGO_BONUS: BINGO_BONUS,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QWERTYValidateScore = api;
}
