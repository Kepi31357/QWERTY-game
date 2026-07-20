/**
 * Robust word extraction — finds ALL full words formed after a placement.
 * Works even if placedPositions are unsorted or partial.
 *
 * Algorithm:
 * 1. Collect affected rows/cols from new tiles.
 * 2. Scan each affected row for horizontal runs; each affected col for vertical.
 * 3. For every run, walk back to true start then forward (LTR / top-to-bottom).
 * 4. Keep only runs that include ≥1 newly placed tile (length ≥ 2).
 *
 * Flat board: index = row * cols + col (same as game-engine).
 */
'use strict';

var DEFAULT_COLS = 15;
var DEFAULT_ROWS = 15;

function letterAt(board, idx) {
  if (idx == null || idx < 0 || !board || !board[idx]) return null;
  var cell = board[idx];
  if (typeof cell === 'string') {
    var s = String(cell).trim();
    return s ? s.toUpperCase() : null;
  }
  if (cell.letter == null || cell.letter === '') return null;
  return String(cell.letter).trim().toUpperCase();
}

function cellKey(positions) {
  return positions
    .slice()
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    })
    .join(',');
}

function sortPositionsByRowCol(positions, cols) {
  return positions.slice().sort(function (a, b) {
    var ra = Math.floor(Number(a) / cols);
    var rb = Math.floor(Number(b) / cols);
    if (ra !== rb) return ra - rb;
    return (Number(a) % cols) - (Number(b) % cols);
  });
}

function idxToPos(idx, cols) {
  return { row: Math.floor(Number(idx) / cols), col: Number(idx) % cols };
}

function posToIdx(row, col, cols) {
  return row * cols + col;
}

/**
 * Walk back to the true start of a contiguous letter run, then forward
 * building the word in canonical order (LTR or top-to-bottom).
 *
 * @param {Array} board - flat board
 * @param {number} seedIdx - any occupied cell in the run
 * @param {boolean} horizontal
 * @param {number} cols
 * @param {number} rows
 * @returns {{ word: string, positions: number[], direction: string } | null}
 */
function extractRunThrough(board, seedIdx, horizontal, cols, rows) {
  if (!letterAt(board, seedIdx)) return null;

  var row = Math.floor(seedIdx / cols);
  var col = seedIdx % cols;
  var r = row;
  var c = col;
  var idx;
  var word;
  var positions;

  if (horizontal) {
    while (c > 0 && letterAt(board, row * cols + (c - 1))) c--;
    word = '';
    positions = [];
    while (c < cols) {
      idx = row * cols + c;
      if (!letterAt(board, idx)) break;
      positions.push(idx);
      word += letterAt(board, idx);
      c++;
    }
  } else {
    while (r > 0 && letterAt(board, (r - 1) * cols + col)) r--;
    word = '';
    positions = [];
    while (r < rows) {
      idx = r * cols + col;
      if (!letterAt(board, idx)) break;
      positions.push(idx);
      word += letterAt(board, idx);
      r++;
    }
  }

  if (positions.length < 2) return null;
  return {
    word: word,
    positions: positions,
    direction: horizontal ? 'horizontal' : 'vertical',
  };
}

/** Alias matching the scan-based API name. */
function extractFullRun(board, seedIdx, direction, cols, rows) {
  return extractRunThrough(
    board,
    seedIdx,
    direction === 'horizontal',
    cols,
    rows
  );
}

function placementsAreHorizontal(placedPositions, cols) {
  if (!placedPositions || placedPositions.length <= 1) return true;
  var row0 = Math.floor(Number(placedPositions[0]) / cols);
  return placedPositions.every(function (idx) {
    return Math.floor(Number(idx) / cols) === row0;
  });
}

function placementsAreVertical(placedPositions, cols) {
  if (!placedPositions || placedPositions.length <= 1) return true;
  var col0 = Number(placedPositions[0]) % cols;
  return placedPositions.every(function (idx) {
    return Number(idx) % cols === col0;
  });
}

function runUsesNewTile(positions, newTileSet) {
  var i;
  for (i = 0; i < positions.length; i++) {
    if (newTileSet[positions[i]]) return true;
  }
  return false;
}

function shouldDebugWord(word) {
  if (!word) return false;
  var u = String(word).toUpperCase();
  return (
    u === 'ROW' ||
    u === 'OW' ||
    u === 'WOR' ||
    u === 'GLOW' ||
    u === 'LOW' ||
    u === 'WOLG' ||
    u.indexOf('COOZIE') >= 0 ||
    u.indexOf('DARED') >= 0 ||
    u === 'DARE' ||
    u === 'COZY' ||
    u === 'COOZE'
  );
}

/**
 * Player start square as { row, col }.
 * P1 / "you" / "player1" → bottom-left; P2 / guest → top-right.
 */
function getPlayerStartSquare(playerId, cols, rows) {
  cols = cols != null ? cols : DEFAULT_COLS;
  rows = rows != null ? rows : DEFAULT_ROWS;
  var id = playerId;
  if (typeof id === 'number') {
    return id === 0
      ? { row: rows - 1, col: 0 }
      : { row: 0, col: cols - 1 };
  }
  var s = String(id == null ? '' : id).toLowerCase();
  if (s === 'you' || s === 'player1' || s === 'p1' || s === 'host' || s === '0') {
    return { row: rows - 1, col: 0 };
  }
  return { row: 0, col: cols - 1 };
}

function getPlayerStartIdx(playerId, cols, rows) {
  cols = cols != null ? cols : DEFAULT_COLS;
  rows = rows != null ? rows : DEFAULT_ROWS;
  var pos = getPlayerStartSquare(playerId, cols, rows);
  return posToIdx(pos.row, pos.col, cols);
}

function placementTouchesStart(placedPositions, startIdx) {
  if (startIdx == null) return false;
  var i;
  for (i = 0; i < (placedPositions || []).length; i++) {
    if (Number(placedPositions[i]) === Number(startIdx)) return true;
  }
  return false;
}

/**
 * True when the board has no letters yet, or the current player has no tiles
 * (opening play for that player).
 */
function isFirstMoveOrEmptyArea(board, playerId, cols, rows) {
  cols = cols != null ? cols : DEFAULT_COLS;
  rows = rows != null ? rows : DEFAULT_ROWS;
  var i;
  var anyLetter = false;
  var playerHasTile = false;
  var playerNum =
    typeof playerId === 'number'
      ? playerId
      : String(playerId || '').toLowerCase() === 'you' ||
          String(playerId || '').toLowerCase() === 'player1' ||
          String(playerId || '').toLowerCase() === 'p1' ||
          String(playerId || '').toLowerCase() === 'host' ||
          String(playerId || '') === '0'
        ? 0
        : 1;

  for (i = 0; i < cols * rows; i++) {
    if (!letterAt(board, i)) continue;
    anyLetter = true;
    var cell = board[i];
    if (cell && typeof cell === 'object' && cell.owner != null) {
      if (Number(cell.owner) === Number(playerNum)) playerHasTile = true;
    }
  }
  if (!anyLetter) return true;
  return !playerHasTile;
}

var START_SQUARE_ERROR = 'Opening word must cover your starting square';

/**
 * Optional opening-square safety (does not throw — returns error string or null).
 */
function checkStartingSquareRule(board, placedPositions, opts) {
  opts = opts || {};
  var cols = opts.cols != null ? opts.cols : DEFAULT_COLS;
  var rows = opts.rows != null ? opts.rows : DEFAULT_ROWS;
  if (opts.skipStartCheck) return null;
  if (opts.playerId == null && opts.player == null && opts.startIdx == null) {
    return null;
  }
  var playerKey = opts.playerId != null ? opts.playerId : opts.player;
  var startIdx =
    opts.startIdx != null
      ? Number(opts.startIdx)
      : getPlayerStartIdx(playerKey, cols, rows);
  if (!isFirstMoveOrEmptyArea(board, playerKey != null ? playerKey : 0, cols, rows)) {
    return null;
  }
  if (!placementTouchesStart(placedPositions, startIdx)) {
    return START_SQUARE_ERROR;
  }
  return null;
}

/**
 * Expand seeds to every letter on play-line runs through new tiles.
 * Kept for callers/tests that inspect playLinePositions.
 */
function expandPlayLinePositions(board, newTiles, horizontal, cols, rows) {
  var seen = {};
  var out = [];
  var i, run, p;
  for (i = 0; i < newTiles.length; i++) {
    run = extractRunThrough(board, newTiles[i], horizontal, cols, rows);
    if (!run) {
      if (letterAt(board, newTiles[i]) && !seen[newTiles[i]]) {
        seen[newTiles[i]] = true;
        out.push(newTiles[i]);
      }
      continue;
    }
    for (p = 0; p < run.positions.length; p++) {
      if (!seen[run.positions[p]]) {
        seen[run.positions[p]] = true;
        out.push(run.positions[p]);
      }
    }
  }
  return sortPositionsByRowCol(out, cols);
}

/**
 * @param {Array} board - board AFTER new tiles are applied (flat)
 * @param {number[]} placedPositions - indices of tiles placed this turn
 * @param {{
 *   cols?: number,
 *   rows?: number,
 *   debug?: boolean,
 *   playerId?: string|number,
 *   player?: number,
 *   startIdx?: number,
 *   skipStartCheck?: boolean,
 *   boardBefore?: Array,
 * }} [opts]
 *   When playerId/player/startIdx is set, opening plays must cover that start
 *   square (checked against boardBefore if provided, else board without
 *   treating new tiles as "already owned").
 */
function getAllWordsFormed(board, placedPositions, opts) {
  opts = opts || {};
  var cols = opts.cols != null ? opts.cols : DEFAULT_COLS;
  var rows = opts.rows != null ? opts.rows : DEFAULT_ROWS;
  var newTiles = sortPositionsByRowCol(
    (placedPositions || []).map(Number).filter(function (idx) {
      return idx >= 0 && letterAt(board, idx);
    }),
    cols
  );

  if (!newTiles.length) {
    return {
      main: null,
      words: [],
      newTiles: [],
      playLinePositions: [],
      error: null,
    };
  }

  /*
   * Starting-square safety: use boardBefore when provided so newly placed
   * tiles are not counted as the player's existing board presence.
   */
  var startErr = checkStartingSquareRule(
    opts.boardBefore != null ? opts.boardBefore : board,
    newTiles,
    opts
  );
  if (startErr) {
    if (opts.debug) {
      console.log('[getAllWordsFormed] start-square reject', startErr, {
        newTiles: newTiles.slice(),
        startIdx: opts.startIdx,
        playerId: opts.playerId != null ? opts.playerId : opts.player,
      });
    }
    return {
      main: null,
      words: [],
      newTiles: newTiles.slice(),
      playLinePositions: [],
      error: startErr,
    };
  }

  var newTileSet = {};
  var i;
  for (i = 0; i < newTiles.length; i++) newTileSet[newTiles[i]] = true;

  var affectedRows = {};
  var affectedCols = {};
  for (i = 0; i < newTiles.length; i++) {
    affectedRows[Math.floor(newTiles[i] / cols)] = true;
    affectedCols[newTiles[i] % cols] = true;
  }

  var words = [];
  var seen = {};
  var key;
  var row;
  var col;
  var run;

  function pushRun(runInfo) {
    if (!runInfo) return;
    if (!runUsesNewTile(runInfo.positions, newTileSet)) return;
    key = cellKey(runInfo.positions);
    if (seen[key]) return;
    seen[key] = true;
    words.push({
      word: runInfo.word,
      positions: runInfo.positions.slice(),
      direction: runInfo.direction,
      isMain: false,
    });
  }

  /* Scan horizontal runs in every affected row. */
  Object.keys(affectedRows).forEach(function (rowKey) {
    row = Number(rowKey);
    col = 0;
    while (col < cols) {
      if (!letterAt(board, posToIdx(row, col, cols))) {
        col++;
        continue;
      }
      pushRun(extractFullRun(board, posToIdx(row, col, cols), 'horizontal', cols, rows));
      while (col < cols && letterAt(board, posToIdx(row, col, cols))) col++;
    }
  });

  /* Scan vertical runs in every affected column. */
  Object.keys(affectedCols).forEach(function (colKey) {
    col = Number(colKey);
    row = 0;
    while (row < rows) {
      if (!letterAt(board, posToIdx(row, col, cols))) {
        row++;
        continue;
      }
      pushRun(extractFullRun(board, posToIdx(row, col, cols), 'vertical', cols, rows));
      while (row < rows && letterAt(board, posToIdx(row, col, cols))) row++;
    }
  });

  /* Mark main word: along placement axis, maximizing new tiles then length. */
  var horizontalLine = placementsAreHorizontal(newTiles, cols);
  var verticalLine = placementsAreVertical(newTiles, cols);
  var preferHorizontal = horizontalLine;
  if (newTiles.length === 1) {
    var hLen = 0;
    var vLen = 0;
    for (i = 0; i < words.length; i++) {
      if (words[i].direction === 'horizontal' && words[i].positions.length > hLen) {
        hLen = words[i].positions.length;
      }
      if (words[i].direction === 'vertical' && words[i].positions.length > vLen) {
        vLen = words[i].positions.length;
      }
    }
    preferHorizontal = hLen >= vLen;
  } else if (!horizontalLine && verticalLine) {
    preferHorizontal = false;
  }

  var mainIdx = -1;
  var bestScore = -1;
  var wi;
  var newCount;
  var pi;
  var score;
  for (wi = 0; wi < words.length; wi++) {
    if (preferHorizontal && words[wi].direction !== 'horizontal') continue;
    if (!preferHorizontal && words[wi].direction !== 'vertical') continue;
    newCount = 0;
    for (pi = 0; pi < words[wi].positions.length; pi++) {
      if (newTileSet[words[wi].positions[pi]]) newCount++;
    }
    score = newCount * 1000 + words[wi].positions.length;
    if (score > bestScore) {
      bestScore = score;
      mainIdx = wi;
    }
  }
  if (mainIdx < 0 && words.length) {
    /* Fallback: longest word using the most new tiles. */
    for (wi = 0; wi < words.length; wi++) {
      newCount = 0;
      for (pi = 0; pi < words[wi].positions.length; pi++) {
        if (newTileSet[words[wi].positions[pi]]) newCount++;
      }
      score = newCount * 1000 + words[wi].positions.length;
      if (score > bestScore) {
        bestScore = score;
        mainIdx = wi;
      }
    }
  }
  if (mainIdx >= 0) words[mainIdx].isMain = true;

  /* Stable order: main first, then others. */
  if (mainIdx > 0) {
    var mainEntry = words.splice(mainIdx, 1)[0];
    words.unshift(mainEntry);
  }

  var main = mainIdx >= 0 ? words[0] : null;
  var playLinePositions =
    main && main.positions
      ? main.positions.slice()
      : expandPlayLinePositions(
          board,
          newTiles,
          preferHorizontal,
          cols,
          rows
        );

  var debug =
    !!opts.debug ||
    words.some(function (w) {
      return shouldDebugWord(w.word);
    });
  if (debug) {
    console.log('[getAllWordsFormed] newTiles(sorted)', newTiles.slice());
    console.log('[getAllWordsFormed] playLinePositions', playLinePositions.slice());
    console.log(
      '[getAllWordsFormed] words',
      words.map(function (w) {
        return {
          word: w.word,
          direction: w.direction,
          isMain: w.isMain,
          positions: w.positions,
        };
      })
    );
  }

  return {
    main: main
      ? {
          word: main.word,
          positions: main.positions.slice(),
          direction: main.direction,
        }
      : null,
    words: words,
    newTiles: newTiles.slice(),
    playLinePositions: playLinePositions.slice(),
    error: null,
  };
}

var api = {
  getAllWordsFormed: getAllWordsFormed,
  extractRunThrough: extractRunThrough,
  extractFullRun: extractFullRun,
  expandPlayLinePositions: expandPlayLinePositions,
  sortPositionsByRowCol: sortPositionsByRowCol,
  letterAt: letterAt,
  idxToPos: idxToPos,
  posToIdx: posToIdx,
  getPlayerStartSquare: getPlayerStartSquare,
  getPlayerStartIdx: getPlayerStartIdx,
  placementTouchesStart: placementTouchesStart,
  isFirstMoveOrEmptyArea: isFirstMoveOrEmptyArea,
  checkStartingSquareRule: checkStartingSquareRule,
  START_SQUARE_ERROR: START_SQUARE_ERROR,
  DEFAULT_COLS: DEFAULT_COLS,
  DEFAULT_ROWS: DEFAULT_ROWS,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QWERTYWordsFormed = api;
}
