/**
 * QWERTY shared game engine — used by the Node server (authoritative) and optionally the client.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.QWERTYEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLS = 15;
  var ROWS = 15;
  var RACK_SIZE = 8;
  var STAR_BONUS = 50;
  var LINK_BONUS = 75;
  var BINGO_BONUS = 100;
  var WIN_SCORE = 1000;
  var TURN_MS = 120000;
  var TILE_POINTS = 10;
  var PLAYER = { P1: 0, P2: 1 };
  var START_P1_IDX = (ROWS - 1) * COLS;
  var START_P2_IDX = COLS - 1;
  var STAR_PAIR_COUNT = 5;
  var wordsFormedMod = null;
  try {
    if (typeof require !== 'undefined') {
      wordsFormedMod = require('./getAllWordsFormed.js');
    }
  } catch (errRequireWords) {
    wordsFormedMod = null;
  }
  if (!wordsFormedMod && typeof globalThis !== 'undefined') {
    wordsFormedMod = globalThis.QWERTYWordsFormed || null;
  }

  var TWO_LETTER_WORDS = [
    'ab', 'ad', 'ag', 'ah', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
    'ba', 'be', 'bi', 'bo', 'by', 'de', 'do', 'ed', 'ef', 'eh', 'el', 'em', 'en', 'er',
    'es', 'et', 'ex', 'fa', 'fe', 'go', 'ha', 'he', 'hi', 'hm', 'ho', 'id', 'if',
    'in', 'is', 'it', 'jo', 'ka', 'ki', 'la', 'li', 'lo', 'ma', 'me', 'mi', 'mm', 'mo', 'mu',
    'my', 'na', 'ne', 'no', 'nu', 'od', 'of', 'oh', 'om', 'on', 'op', 'or', 'ow',
    'ox', 'oy', 'pa', 'pe', 'pi', 'po', 'qi', 're', 'sh', 'si', 'so', 'ta', 'te', 'ti', 'to',
    'uh', 'um', 'un', 'up', 'us', 'ut', 'we', 'wo', 'xi', 'xu', 'ya', 'ye', 'yo', 'za',
  ];
  /* Classic 2-letter allowlist (TWL extras like AE/AA are excluded). */
  var TWO_LETTER_SET = new Set(TWO_LETTER_WORDS);

  var TILE_BAG = (function () {
    var counts = {
      A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
      N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
    };
    var bag = [];
    var letters = Object.keys(counts);
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i];
      for (var j = 0; j < counts[L]; j++) bag.push(L);
    }
    bag.push('*', '*');
    return bag;
  })();

  /* Local TWL-style word list as a Set for O(1) exact-match lookup. */
  var DICTIONARY = new Set();

  function shuffle(arr, rng) {
    var random = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function uid(rng) {
    var random = rng || Math.random;
    return random().toString(36).slice(2, 11);
  }

  /**
   * Build DICTIONARY Set from the shipped local word list.
   * - Exact lowercase keys only (isValidWord is case-insensitive).
   * - Length ≥ 2 only.
   * - 2-letter entries limited to the classic allowlist.
   */
  function initDictionary(wordList) {
    DICTIONARY = new Set();
    if (!wordList || !wordList.length) {
      throw new Error('Dictionary word list is empty');
    }
    var i, w, lower;
    for (i = 0; i < wordList.length; i++) {
      w = wordList[i];
      if (w == null) continue;
      lower = String(w).trim().toLowerCase();
      if (lower.length < 2) continue;
      if (lower.length === 2 && !TWO_LETTER_SET.has(lower)) continue;
      DICTIONARY.add(lower);
    }
    for (i = 0; i < TWO_LETTER_WORDS.length; i++) {
      DICTIONARY.add(TWO_LETTER_WORDS[i]);
    }
  }

  /**
   * Exact dictionary match (case-insensitive). Rejects length < 2.
   * Cross-words must pass the full contiguous run through this check.
   */
  function isValidWord(word) {
    if (word == null) return false;
    var lower = String(word).trim().toLowerCase();
    if (lower.length < 2) return false;
    return DICTIONARY.has(lower);
  }

  function dictionarySize() {
    return DICTIONARY.size;
  }

  function letterValue(letter) {
    return letter ? TILE_POINTS : 0;
  }

  function starCoordKey(c, r) {
    return c + ',' + r;
  }

  function starCoordDistance(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }

  function mirrorStarCoord(c, r) {
    return [COLS - 1 - c, ROWS - 1 - r];
  }

  function collectStarRepresentatives() {
    var reps = [];
    var r, c, mr, mc, idx;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        mr = ROWS - 1 - r;
        mc = COLS - 1 - c;
        if (r > mr || (r === mr && c >= mc)) continue;
        if (r === mr && c === mc) continue;
        idx = r * COLS + c;
        if (idx === START_P1_IDX || idx === START_P2_IDX) continue;
        reps.push([c, r]);
      }
    }
    return reps;
  }

  function expandStarPairs(representatives) {
    var coords = [];
    var seen = {};
    var i, c, r, mir, key, k, pair;
    for (i = 0; i < representatives.length; i++) {
      c = representatives[i][0];
      r = representatives[i][1];
      mir = mirrorStarCoord(c, r);
      pair = [[c, r], mir];
      for (k = 0; k < pair.length; k++) {
        key = starCoordKey(pair[k][0], pair[k][1]);
        if (seen[key]) continue;
        seen[key] = true;
        coords.push(pair[k]);
      }
    }
    return coords;
  }

  function generateSymmetricStarCoords(rng) {
    var reps = shuffle(collectStarRepresentatives(), rng);
    var picked = [];
    var minSep = 3;
    var i, j, cand, ok;

    while (picked.length < STAR_PAIR_COUNT && minSep >= 1) {
      for (i = 0; i < reps.length && picked.length < STAR_PAIR_COUNT; i++) {
        cand = reps[i];
        ok = true;
        for (j = 0; j < picked.length; j++) {
          if (starCoordDistance(cand, picked[j]) < minSep) {
            ok = false;
            break;
          }
        }
        if (ok) picked.push(cand);
      }
      if (picked.length < STAR_PAIR_COUNT) {
        minSep--;
        if (minSep < 1) break;
      }
    }

    for (i = 0; i < reps.length && picked.length < STAR_PAIR_COUNT; i++) {
      cand = reps[i];
      ok = true;
      for (j = 0; j < picked.length; j++) {
        if (starCoordKey(cand[0], cand[1]) === starCoordKey(picked[j][0], picked[j][1])) {
          ok = false;
          break;
        }
      }
      if (ok) picked.push(cand);
    }

    return expandStarPairs(picked);
  }

  function buildSpecials(starCoords) {
    var s = new Array(COLS * ROWS).fill(0);
    s[START_P1_IDX] = 2;
    s[START_P2_IDX] = 3;
    var coords = starCoords || [];
    var seen = {};
    var i, c, r, key;
    for (i = 0; i < coords.length; i++) {
      c = coords[i][0];
      r = coords[i][1];
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      key = starCoordKey(c, r);
      if (seen[key]) continue;
      seen[key] = true;
      if (s[r * COLS + c] === 2 || s[r * COLS + c] === 3) continue;
      s[r * COLS + c] = 1;
    }
    return s;
  }

  function createTileBag(rng) {
    return shuffle(TILE_BAG.slice(), rng);
  }

  function drawTiles(bag, count) {
    var drawn = [];
    while (drawn.length < count && bag.length > 0) drawn.push(bag.pop());
    return drawn;
  }

  function wordCellsH(row, colStart, len) {
    var cells = [];
    for (var i = 0; i < len; i++) cells.push(row * COLS + (colStart + i));
    return cells;
  }

  function wordCellsV(col, rowStart, len) {
    var cells = [];
    for (var i = 0; i < len; i++) cells.push((rowStart + i) * COLS + col);
    return cells;
  }

  function getAllWordsFromBoard(board) {
    var words = [];
    var seen = {};
    var r, c, run, start, cell, letter, key;
    for (r = 0; r < ROWS; r++) {
      run = '';
      start = 0;
      for (c = 0; c <= COLS; c++) {
        cell = c < COLS ? board[r * COLS + c] : null;
        letter = cell && cell.letter;
        if (letter) {
          if (!run) start = c;
          run += letter;
        } else if (run.length >= 2) {
          key = 'h-' + r + '-' + start + '-' + run;
          if (!seen[key]) {
            seen[key] = true;
            words.push({ word: run, cells: wordCellsH(r, start, run.length) });
          }
          run = '';
        } else run = '';
      }
    }
    for (c = 0; c < COLS; c++) {
      run = '';
      start = 0;
      for (r = 0; r <= ROWS; r++) {
        cell = r < ROWS ? board[r * COLS + c] : null;
        letter = cell && cell.letter;
        if (letter) {
          if (!run) start = r;
          run += letter;
        } else if (run.length >= 2) {
          key = 'v-' + c + '-' + start + '-' + run;
          if (!seen[key]) {
            seen[key] = true;
            words.push({ word: run, cells: wordCellsV(c, start, run.length) });
          }
          run = '';
        } else run = '';
      }
    }
    return words;
  }

  function cellOwner(cell) {
    if (!cell || cell.owner == null) return null;
    return Number(cell.owner);
  }

  function boardCellLetter(cell) {
    if (!cell) return null;
    if (typeof cell === 'string') {
      var s = String(cell).trim();
      return s ? s.toUpperCase() : null;
    }
    if (cell.letter == null || cell.letter === '') return null;
    return String(cell.letter).toUpperCase();
  }

  function adjacentIndices(idx) {
    var c = idx % COLS;
    var r = Math.floor(idx / COLS);
    var out = [];
    if (c > 0) out.push(idx - 1);
    if (c < COLS - 1) out.push(idx + 1);
    if (r > 0) out.push(idx - COLS);
    if (r < ROWS - 1) out.push(idx + COLS);
    return out;
  }

  function findRackSlotByTileId(rack, tileId) {
    if (!tileId || !rack) return -1;
    for (var i = 0; i < rack.length; i++) {
      if (rack[i] && rack[i].id === tileId) return i;
    }
    return -1;
  }

  function resolvePlacementRackSlot(rack, pl) {
    if (!pl || !rack) return -1;
    var expected = String(pl.letter || '').toUpperCase();
    function matchesSlot(slot) {
      return (
        slot >= 0 &&
        rack[slot] &&
        String(rack[slot].letter || '').toUpperCase() === expected
      );
    }
    /* Prefer tileId — duplicate letters can share a stale rackIndex. */
    if (pl.tileId) {
      var byId = findRackSlotByTileId(rack, pl.tileId);
      if (matchesSlot(byId)) return byId;
    }
    if (pl.rackIndex >= 0 && matchesSlot(pl.rackIndex)) return pl.rackIndex;
    return -1;
  }

  function placementsMapFromArray(arr) {
    var map = new Map();
    if (!arr) return map;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      map.set(Number(p.idx), {
        letter: p.letter,
        rackIndex: p.rackIndex,
        tileId: p.tileId || null,
        blankAs: p.blankAs != null ? p.blankAs : null,
      });
    }
    return map;
  }

  function playerHasBoardTiles(board, player) {
    for (var i = 0; i < board.length; i++) {
      if (board[i] && cellOwner(board[i]) === player) return true;
    }
    return false;
  }

  function placementTouchesOwner(board, placements, player) {
    for (var idx of placements.keys()) {
      var neighbors = adjacentIndices(idx);
      for (var n = 0; n < neighbors.length; n++) {
        var existing = board[neighbors[n]];
        if (existing && !placements.has(neighbors[n]) && cellOwner(existing) === player) return true;
      }
    }
    return false;
  }

  function placementTouchesOpponent(board, placements, player) {
    for (var idx of placements.keys()) {
      var neighbors = adjacentIndices(idx);
      for (var n = 0; n < neighbors.length; n++) {
        var existing = board[neighbors[n]];
        if (existing && !placements.has(neighbors[n]) && cellOwner(existing) !== player) return true;
      }
    }
    return false;
  }

  function placementTouchesBoard(board, placements) {
    for (var idx of placements.keys()) {
      var neighbors = adjacentIndices(idx);
      for (var n = 0; n < neighbors.length; n++) {
        if (board[neighbors[n]] && !placements.has(neighbors[n])) return true;
      }
    }
    return false;
  }

  function countRackTiles(rack) {
    var n = 0;
    var i;
    if (!rack) return 0;
    for (i = 0; i < rack.length; i++) {
      if (rack[i]) n++;
    }
    return n;
  }

/**
 * Distinct opponent-owned tiles in newly formed words (not merely edge-adjacent
 * to a new tile). Extending …GA + K → KGA counts both G and A.
 * @param {Array} boardBefore - board before this turn's tiles
 * @param {Map|Set|object} placedSet - indices placed this turn
 * @param {Array<{positions:number[]}>} formedWords
 * @param {number} player
 */
function countBonusConnections(boardBefore, placedSet, formedWords, player) {
  var seen = {};
  var count = 0;
  var wi, pi, pos, existing;
  function isPlaced(idx) {
    if (!placedSet) return false;
    if (typeof placedSet.has === 'function') return placedSet.has(idx);
    return !!placedSet[idx];
  }
  for (wi = 0; wi < (formedWords || []).length; wi++) {
    var positions = formedWords[wi].positions || formedWords[wi].cells || [];
    for (pi = 0; pi < positions.length; pi++) {
      pos = Number(positions[pi]);
      if (seen[pos] || isPlaced(pos)) continue;
      existing = boardBefore[pos];
      if (!existing || cellOwner(existing) == null) continue;
      if (cellOwner(existing) === player) continue;
      seen[pos] = true;
      count++;
    }
  }
  return count;
}

  function preparePlacementArr(placementArr, player, state) {
    return placementArr;
  }

  function resolveValidWord(w, player) {
    var upper = w.toUpperCase();
    if (isValidWord(upper)) return upper;
    return null;
  }

  function wordFromBoardCells(board, cells) {
    var i, out = '';
    for (i = 0; i < cells.length; i++) {
      var cell = board[cells[i]];
      if (cell && cell.letter) out += cell.letter;
    }
    return out.toUpperCase();
  }

  function isVerticalWordCells(cells) {
    if (!cells || cells.length < 2) return false;
    var col = cells[0] % COLS;
    var i;
    for (i = 1; i < cells.length; i++) {
      if (cells[i] % COLS !== col) return false;
    }
    return true;
  }

  function isHorizontalWordCells(cells) {
    if (!cells || cells.length < 2) return false;
    var row = Math.floor(cells[0] / COLS);
    var i;
    for (i = 1; i < cells.length; i++) {
      if (Math.floor(cells[i] / COLS) !== row) return false;
    }
    return true;
  }

  function horizontalLineUsesBoardTile(placements, state) {
    if (!state || !state.board || !placements || !placements.size) return false;
    var indices = Array.from(placements.keys());
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    if (!rows.every(function (r) { return r === rows[0]; })) return false;
    var row = rows[0];
    var minC = Math.min.apply(null, cols);
    var maxC = Math.max.apply(null, cols);
    while (minC > 0) {
      if (!state.board[row * COLS + (minC - 1)]) break;
      minC--;
    }
    while (maxC < COLS - 1) {
      if (!state.board[row * COLS + (maxC + 1)]) break;
      maxC++;
    }
    var c, idx;
    for (c = minC; c <= maxC; c++) {
      idx = row * COLS + c;
      if (state.board[idx] && !placements.has(idx)) return true;
    }
    return false;
  }

  function cornerBoardTileIsHorizontalAnchor(board, cornerIdx) {
    if (Number(cornerIdx) !== Number(START_P2_IDX)) return false;
    var row = Math.floor(cornerIdx / COLS);
    var col = cornerIdx % COLS;
    if (col > 0 && board[row * COLS + (col - 1)]) return true;
    return false;
  }

  /**
   * Linear vertical read only (ascending). Do NOT move the top tile to the end —
   * that invented SUP from PSU/USP while letters stayed U-S-P on screen.
   */
  function wordFromP2VerticalRun(board, cells) {
    var sorted = cells.slice().sort(function (a, b) {
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
    return wordFromBoardCells(board, sorted);
  }

  /** P2 vertical words build toward the top-right corner (ascending row → corner at row 0). */
  function wordFromP2VerticalTowardCorner(board, cells) {
    var sorted = cells.slice().sort(function (a, b) {
      return Math.floor(b / COLS) - Math.floor(a / COLS);
    });
    return wordFromBoardCells(board, sorted);
  }

  /** P1 vertical words build from the bottom-left corner upward (row 14 → lower rows). */
  function wordFromP1VerticalTowardCorner(board, cells) {
    var sorted = cells.slice().sort(function (a, b) {
      return Math.floor(b / COLS) - Math.floor(a / COLS);
    });
    return wordFromBoardCells(board, sorted);
  }

  function wordRunOwners(board, cells) {
    var owner = null;
    var i, cell, o;
    for (i = 0; i < cells.length; i++) {
      cell = board[cells[i]];
      if (!cell || cell.owner == null) continue;
      o = Number(cell.owner);
      if (owner === null) owner = o;
      else if (owner !== o) return 'mixed';
    }
    return owner;
  }

  function isReversedSpelling(ascWord, otherWord) {
    if (!ascWord || !otherWord || ascWord.length !== otherWord.length) return false;
    return String(otherWord).toUpperCase() === String(ascWord).toUpperCase().split('').reverse().join('');
  }

  function runIncludesCorner(cells, cornerIdx) {
    var i;
    for (i = 0; i < cells.length; i++) {
      if (Number(cells[i]) === Number(cornerIdx)) return true;
    }
    return false;
  }

  function runCornerLetter(board, cells, cornerIdx) {
    var i, cell;
    for (i = 0; i < cells.length; i++) {
      if (Number(cells[i]) === Number(cornerIdx)) {
        cell = board[cells[i]];
        return cell ? boardCellLetter(cell) : '';
      }
    }
    return '';
  }

  function sortedWordCells(cells, horizontal) {
    var sorted = cells.slice();
    if (horizontal) {
      sorted.sort(function (a, b) { return (a % COLS) - (b % COLS); });
    } else {
      sorted.sort(function (a, b) { return Math.floor(a / COLS) - Math.floor(b / COLS); });
    }
    return sorted;
  }

  /**
   * Resolve a word from board cells using one player's orientation rules.
   * Vertical words read top-to-bottom (ascending row). Reversed readings (AK→KA,
   * EAT→TEA) are only allowed for opening plays that cover the start corner.
   */
  function wordMultiset(str) {
    return String(str || '').toUpperCase().split('').sort().join('');
  }

  function sameLetterMultiset(a, b) {
    return wordMultiset(a) === wordMultiset(b);
  }

  function resolveWordFromRunForPlayer(board, cells, player) {
    var horizontal = isHorizontalWordCells(cells);
    var ascCells = sortedWordCells(cells, horizontal);
    var accepted = resolveValidWord(wordFromBoardCells(board, ascCells), player);
    if (accepted && horizontal) return accepted;
    if (player === PLAYER.P1 && isVerticalWordCells(cells)) {
      var p1AscWord = wordFromBoardCells(board, ascCells);
      var p1AscValid = resolveValidWord(p1AscWord, player);
      if (p1AscValid) return p1AscValid;

      var p1TowardWord = wordFromP1VerticalTowardCorner(board, cells);
      var p1TowardValid = resolveValidWord(p1TowardWord, player);
      if (!p1TowardValid) return null;
      /* Only allow reverse-of-TTB for runs that cover P1 start (grow-up openings). */
      if (isReversedSpelling(p1AscWord, p1TowardValid)) {
        if (runIncludesCorner(cells, START_P1_IDX)) return p1TowardValid;
        return null;
      }
      return p1TowardValid;
    }
    if (player === PLAYER.P2 && isVerticalWordCells(cells)) {
      var ascWord = wordFromBoardCells(board, ascCells);
      var towardWord = wordFromP2VerticalTowardCorner(board, cells);
      var ascValid = resolveValidWord(ascWord, player);
      var towardValid = resolveValidWord(towardWord, player);
      var cornerCh = runCornerLetter(board, cells, START_P2_IDX);
      if (ascValid) return ascValid;
      /* Reverse/toward only when the run covers P2 start. */
      if (towardValid && runIncludesCorner(cells, START_P2_IDX)) {
        if (isReversedSpelling(ascWord, towardValid)) return towardValid;
        return towardValid;
      }
      return null;
    }
    if (accepted) return accepted;
    if (player === PLAYER.P2 && isHorizontalWordCells(cells)) {
      var hAscWord = wordFromBoardCells(board, ascCells);
      var hAscValid = resolveValidWord(hAscWord, player);
      if (hAscValid) return hAscValid;

      var hRevWord = wordFromBoardCells(board, ascCells.slice().reverse());
      var hRevValid = resolveValidWord(hRevWord, player);
      if (!hRevValid) return null;
      if (isReversedSpelling(hAscWord, hRevValid)) {
        var hCornerCh = runCornerLetter(board, cells, START_P2_IDX);
        /* Reverse H reading only for P2 start-cover openings (grow-left). */
        if (runIncludesCorner(cells, START_P2_IDX) && hCornerCh === hRevValid.charAt(hRevValid.length - 1)) {
          return hRevValid;
        }
        if (runIncludesCorner(cells, START_P2_IDX) && hCornerCh === hRevValid.charAt(0)) {
          return hRevValid;
        }
        return null;
      }
      return null;
    }
    return null;
  }

  /**
   * Pick the valid dictionary word for a run. Uses tile owners so P2 vertical words
   * stored toward the corner (TAE on board = EAT) still validate when P1 crosses them.
   */
  function resolveWordFromRun(board, cells, player) {
    var owners = wordRunOwners(board, cells);
    var tryPlayers = [];
    var accepted;
    var pi;

    if (owners === 'mixed') {
      tryPlayers.push(player);
      tryPlayers.push(player === PLAYER.P1 ? PLAYER.P2 : PLAYER.P1);
    } else if (owners === PLAYER.P1 || owners === PLAYER.P2) {
      tryPlayers.push(owners);
      if (owners !== player) tryPlayers.push(player);
    } else {
      tryPlayers.push(player);
      tryPlayers.push(player === PLAYER.P1 ? PLAYER.P2 : PLAYER.P1);
    }

    for (pi = 0; pi < tryPlayers.length; pi++) {
      accepted = resolveWordFromRunForPlayer(board, cells, tryPlayers[pi]);
      if (accepted) return accepted;
    }
    return null;
  }

  /** P2 may place tiles right-to-left toward the corner; fix letter order before validate/commit. */
  function placementDisplayLetter(p) {
    if (p.blankAs != null) return String(p.blankAs).toUpperCase();
    return String(p.letter || '').toUpperCase();
  }

  /**
   * Vertical opening/extension with only new tiles: players often build toward the
   * corner so ascending row order reads the word backwards. Swap tile assignments
   * so the stored board spells the word top-to-bottom.
   *
   * CRITICAL: Decide using the *full column run* (including locked board tiles).
   * Reversing from the new-tile substring alone (e.g. IM→MI because MI is a word)
   * corrupted real crosses like GIMP → GMIP.
   */
  function canonicalizeVerticalPlacementLetters(placementArr, state, player) {
    if (!placementArr || placementArr.length < 2 || !state) return placementArr;
    /* Guest board is mirrored; vertical letter swaps turned GOF into FOG. Horizontal
       mirror reads are handled in resolveWordFromRun for P2 only. */
    if (player === PLAYER.P2) return placementArr;
    var placements = placementsMapFromArray(placementArr);
    var indices = Array.from(placements.keys());
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var sameCol = cols.every(function (c) { return c === cols[0]; });
    if (!sameCol) return placementArr;

    var col = cols[0];
    var minR = Math.min.apply(null, rows);
    var maxR = Math.max.apply(null, rows);
    var r, idx, i;

    /* Expand to the full contiguous column run. */
    while (minR > 0) {
      idx = (minR - 1) * COLS + col;
      if (state.board[idx] || placements.has(idx)) minR--;
      else break;
    }
    while (maxR < ROWS - 1) {
      idx = (maxR + 1) * COLS + col;
      if (state.board[idx] || placements.has(idx)) maxR++;
      else break;
    }

    var serverOrder = indices.slice().sort(function (a, b) {
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });

    function spellFull(assignByIdx) {
      var out = '';
      for (r = minR; r <= maxR; r++) {
        idx = r * COLS + col;
        if (placements.has(idx)) {
          out +=
            assignByIdx[idx] != null
              ? assignByIdx[idx]
              : placementDisplayLetter(placements.get(idx));
        } else if (state.board[idx]) {
          out += boardCellLetter(state.board[idx]);
        }
      }
      return String(out).toUpperCase();
    }

    var currentAssign = {};
    for (i = 0; i < serverOrder.length; i++) {
      currentAssign[serverOrder[i]] = placementDisplayLetter(placements.get(serverOrder[i]));
    }
    var fullCurrent = spellFull(currentAssign);
    /* Full run already a real word (GIMP) — never scramble new tiles. */
    if (isValidWord(fullCurrent)) return placementArr;

    var displayLetters = serverOrder.map(function (id) {
      return placementDisplayLetter(placements.get(id));
    });
    var letters = displayLetters.join('');
    var revDisplay = displayLetters.slice().reverse();
    var rev = revDisplay.join('');

    var revAssign = {};
    for (i = 0; i < serverOrder.length; i++) {
      revAssign[serverOrder[i]] = revDisplay[i];
    }
    var fullRev = spellFull(revAssign);

    var hasBoardInRun = false;
    for (r = minR; r <= maxR; r++) {
      idx = r * COLS + col;
      if (state.board[idx] && !placements.has(idx)) {
        hasBoardInRun = true;
        break;
      }
    }

    if (hasBoardInRun) {
      /* Crossword / extension: only reverse if it makes the FULL run valid. */
      if (!isValidWord(fullRev)) return placementArr;
    } else {
      /* Standalone vertical: reverse when the reversed substring is a word. */
      if (isValidWord(letters)) return placementArr;
      if (!isValidWord(rev)) return placementArr;
    }

    var ordered = serverOrder.map(function (id) {
      var p = placements.get(id);
      var tile = {
        idx: id,
        letter: p.letter,
        rackIndex: p.rackIndex,
        tileId: p.tileId || null,
      };
      if (p.blankAs != null) tile.blankAs = p.blankAs;
      return tile;
    });
    ordered.reverse();

    var out = [];
    var tile;
    for (i = 0; i < serverOrder.length; i++) {
      tile = ordered[i];
      out.push({
        idx: serverOrder[i],
        letter: tile.letter,
        rackIndex: tile.rackIndex,
        tileId: tile.tileId,
        blankAs: tile.blankAs != null ? tile.blankAs : null,
      });
    }

    if (player === PLAYER.P1 && !state.openingPlayed[PLAYER.P1]) {
      var cornerLetter = null;
      var checkWord = hasBoardInRun ? fullRev : rev;
      for (i = 0; i < out.length; i++) {
        if (Number(out[i].idx) === Number(START_P1_IDX)) {
          cornerLetter = placementDisplayLetter(out[i]);
          break;
        }
      }
      if (cornerLetter && !cornerLetterMatchesWord(cornerLetter, checkWord)) {
        return placementArr;
      }
    }

    return out;
  }

  /**
   * Guest vertical extension through an existing tile: only permute letters among
   * newly placed cells so the column reads a valid word (board letters stay fixed).
   */
  function canonicalizeP2VerticalPlacementLetters(placementArr, state) {
    if (!placementArr || !placementArr.length || !state) return placementArr;
    var placements = placementsMapFromArray(placementArr);
    var indices = Array.from(placements.keys());
    if (indices.length < 1) return placementArr;
    var cols = indices.map(function (i) { return i % COLS; });
    if (!cols.every(function (c) { return c === cols[0]; })) return placementArr;

    var col = cols[0];
    var minR = Math.min.apply(null, indices.map(function (i) { return Math.floor(i / COLS); }));
    var maxR = Math.max.apply(null, indices.map(function (i) { return Math.floor(i / COLS); }));
    var r, idx;
    while (minR > 0) {
      idx = (minR - 1) * COLS + col;
      if (state.board[idx] || placements.has(idx)) minR--;
      else break;
    }
    while (maxR < ROWS - 1) {
      idx = (maxR + 1) * COLS + col;
      if (state.board[idx] || placements.has(idx)) maxR++;
      else break;
    }

    var hasBoardInRun = false;
    for (r = minR; r <= maxR; r++) {
      idx = r * COLS + col;
      if (state.board[idx] && !placements.has(idx)) {
        hasBoardInRun = true;
        break;
      }
    }

    var pOrder = indices.slice().sort(function (a, b) {
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });

    if (!hasBoardInRun) {
      /* Toward-corner openings (EAT→TAE) are handled by resolve + alignP2.
         Do not reverse standalone vertical placements here. */
      return placementArr;
    }

    function wordFromLetterAssignment(orderedTiles) {
      var byIdx = {};
      var i;
      for (i = 0; i < pOrder.length; i++) {
        byIdx[pOrder[i]] = placementDisplayLetter(orderedTiles[i]);
      }
      var minRowIdx = minR * COLS + col;
      var minRowIsBoardOnly = state.board[minRowIdx] && !placements.has(minRowIdx);
      var out = '';
      if (minRowIsBoardOnly) {
        for (r = minR + 1; r <= maxR; r++) {
          idx = r * COLS + col;
          if (placements.has(idx)) {
            out += byIdx[idx] || '';
          } else if (state.board[idx]) {
            out += boardCellLetter(state.board[idx]);
          }
        }
        out += boardCellLetter(state.board[minRowIdx]);
        return out;
      }
      for (r = minR; r <= maxR; r++) {
        idx = r * COLS + col;
        if (placements.has(idx)) {
          out += byIdx[idx] || '';
        } else if (state.board[idx]) {
          out += boardCellLetter(state.board[idx]);
        }
      }
      return out;
    }

    var tiles = pOrder.map(function (i) { return placements.get(i); });
    if (isValidWord(wordFromLetterAssignment(tiles))) return placementArr;

    /* Do not reverse when top-down is already a word, or when reverse would
       pick the other of a BIF/FIB pair — shared view keeps placed order. */
    return placementArr;
  }

  function canonicalizeP2PlacementLetters(placementArr, state) {
    /* Horizontal P2 plays must already read left-to-right; do not reverse letters. */
    return placementArr;
  }

  function cornerLetterMatchesWord(cornerCh, word) {
    if (!cornerCh || !word) return false;
    var ch = String(cornerCh).toUpperCase();
    var w = String(word).toUpperCase();
    return ch === w.charAt(0) || ch === w.charAt(w.length - 1);
  }

  /**
   * Dictionary check for a formed run: exact case-insensitive match on the full
   * LTR/TTB spelling, or (for short crosses) its reverse if that is a real word.
   * Never accepts length < 2.
   */
  function resolveDictionaryWord(rawWord, player, opts) {
    opts = opts || {};
    var w = String(rawWord || '').toUpperCase();
    if (w.length < 2) return null;
    var hit = resolveValidWord(w, player);
    if (hit) return hit;
    /* Forgiving short crosses: WE vs EW, ON vs NO, etc. */
    if (opts.allowReverse && w.length === 2) {
      var rev = w.split('').reverse().join('');
      hit = resolveValidWord(rev, player);
      if (hit) return hit;
    }
    return null;
  }

  function canonicalizePlacements(placementArr, state, player) {
    if (player === PLAYER.P1) {
      placementArr = canonicalizeVerticalPlacementLetters(placementArr, state, player);
    } else {
      placementArr = normalizeP2Placements(placementArr, state);
      placementArr = canonicalizeP2VerticalPlacementLetters(placementArr, state);
      placementArr = canonicalizeP2PlacementLetters(placementArr, state);
    }
    return placementArr;
  }

  function validateMove(state, placementArr, player, opts) {
    if (!opts) opts = {};
    var p2IntentFirstLetter = null;
    if (player === PLAYER.P2 && placementArr && placementArr.length) {
      p2IntentFirstLetter = placementDisplayLetter(placementArr[0]);
    }
    if (!opts.precanonicalized) {
      placementArr = canonicalizePlacements(placementArr, state, player);
    }
    var placements = placementsMapFromArray(placementArr);
    var indices = Array.from(placements.keys());
    if (indices.length === 0) return { valid: false, reason: 'No tiles placed.' };

    var pi, pp;
    for (pi = 0; pi < indices.length; pi++) {
      pp = placements.get(indices[pi]);
      if (pp.letter === '*' && pp.blankAs == null) {
        return { valid: false, reason: 'Choose a letter for each blank tile.' };
      }
    }

    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var sameRow = rows.every(function (r) { return r === rows[0]; });
    var sameCol = cols.every(function (c) { return c === cols[0]; });
    if (!sameRow && !sameCol) {
      return { valid: false, reason: 'Tiles must be in one row or column.' };
    }

    if (sameRow) {
      var r0 = rows[0];
      var minC = Math.min.apply(null, cols);
      var maxC = Math.max.apply(null, cols);
      for (var c = minC; c <= maxC; c++) {
        var idxH = r0 * COLS + c;
        if (!placements.has(idxH) && !state.board[idxH]) {
          return { valid: false, reason: 'No gaps allowed within a word.' };
        }
      }
    } else {
      var c0 = cols[0];
      var minR = Math.min.apply(null, rows);
      var maxR = Math.max.apply(null, rows);
      for (var r = minR; r <= maxR; r++) {
        var idxV = r * COLS + c0;
        if (!placements.has(idxV) && !state.board[idxV]) {
          return { valid: false, reason: 'No gaps allowed within a word.' };
        }
      }
    }

    var rack = state.racks[player];
    var usedRack = {};
    for (var idx of placements.keys()) {
      var pl = placements.get(idx);
      var slot = resolvePlacementRackSlot(rack, pl);
      if (slot < 0) continue;
      if (usedRack[slot]) {
        return { valid: false, reason: 'Each rack tile can only be used once.' };
      }
      usedRack[slot] = true;
      var rackTile = rack[slot];
      if (!rackTile) {
        return { valid: false, reason: 'Invalid rack tile.' };
      }
      var expected = String(pl.letter || '').toUpperCase();
      var rackLetter = String(rackTile.letter || '').toUpperCase();
      if (rackLetter !== expected) {
        return { valid: false, reason: 'Tile mismatch with rack.' };
      }
    }

    var tempBoard = state.board.map(function (cell, i) {
      if (placements.has(i)) {
        var p = placements.get(i);
        return {
          letter: (p.blankAs != null ? p.blankAs : p.letter).toUpperCase(),
          owner: player,
        };
      }
      if (!cell) return null;
      var letter = boardCellLetter(cell);
      if (!letter) return null;
      return { letter: letter, owner: cell.owner };
    });

    var startIdx = player === PLAYER.P1 ? START_P1_IDX : START_P2_IDX;
    var needsOpening = !playerHasBoardTiles(state.board, player);

    if (!opts.preview) {
      if (needsOpening) {
        var coversCorner = false;
        for (pi = 0; pi < indices.length; pi++) {
          if (Number(indices[pi]) === Number(startIdx)) {
            coversCorner = true;
            break;
          }
        }
        if (!coversCorner) {
          return {
            valid: false,
            reason: player === PLAYER.P1
              ? 'First word must cover your green start square (bottom-left) — at least one tile on start.'
              : 'First word must cover your start square (top-right) — at least one tile on start.',
          };
        }
      } else if (!state.boardsLinked) {
        if (!placementTouchesOwner(state.board, placements, player)) {
          return {
            valid: false,
            reason: 'Must extend from your own tiles until you connect to your opponent\'s words.',
          };
        }
      } else if (!placementTouchesBoard(state.board, placements)) {
        return {
          valid: false,
          reason: 'New tiles must connect to words already on the board.',
        };
      }
    }

    var newWordCells = new Set(indices);
    var connections = 0;
    var starsCaptured = 0;
    var primaryWord = '';
    var primaryWordCells = null;
    var primaryScore = -1;
    var formedWords = [];

    for (var idxStar of placements.keys()) {
      if (state.specials[idxStar] === 1) starsCaptured++;
    }

    var p2ServerWord = null;
    var p2VisualWord = null;
    if (player === PLAYER.P2 && (sameRow || sameCol)) {
      p2ServerWord = computeP2PlacementServerWord(placements, state, sameRow, sameCol);
      p2VisualWord = computeP2PlacementVisualWord(placements, state, sameRow, sameCol);
    }

    /* Canonical LTR / top-to-bottom runs via getAllWordsFormed (Phase 2.5). */
    var wordRuns = [];
    var formedApi = wordsFormedMod && wordsFormedMod.getAllWordsFormed;
    var sortPositions =
      wordsFormedMod && wordsFormedMod.sortPositionsByRowCol
        ? wordsFormedMod.sortPositionsByRowCol
        : function (arr) {
            return arr.slice().sort(function (a, b) {
              return a - b;
            });
          };
    if (formedApi) {
      var sortedIndices = sortPositions(indices.map(Number), COLS);
      var debugWords =
        (typeof process !== 'undefined' &&
          process.env &&
          process.env.QWERTY_DEBUG_WORDS) ||
        !!opts.debugWords;
      var formed = formedApi(tempBoard, sortedIndices, {
        cols: COLS,
        rows: ROWS,
        debug: !!debugWords,
        player: player,
        startIdx: startIdx,
        boardBefore: state.board,
        /* Engine already enforces opening; skip duplicate here unless preview. */
        skipStartCheck: !needsOpening || !!opts.preview,
      });
      if (formed.error) {
        return { valid: false, reason: formed.error };
      }
      if (debugWords || (formed.main && /^(ROW|GLOW|OW|LOW|DARED|COOZIE)/i.test(formed.main.word))) {
        console.log('[validateMove] placedPositions(sorted)', sortedIndices.slice());
        console.log(
          '[validateMove] playLinePositions',
          (formed.playLinePositions || []).slice()
        );
        console.log(
          '[validateMove] formed words',
          formed.words.map(function (w) {
            return w.word + (w.isMain ? ' (main)' : '');
          })
        );
      }
      var fiFormed;
      for (fiFormed = 0; fiFormed < formed.words.length; fiFormed++) {
        wordRuns.push({
          word: formed.words[fiFormed].word,
          cells: formed.words[fiFormed].positions.slice(),
          isMain: !!formed.words[fiFormed].isMain,
        });
      }
    } else {
      var legacyWords = getAllWordsFromBoard(tempBoard);
      var li;
      for (li = 0; li < legacyWords.length; li++) {
        if (!legacyWords[li].cells.some(function (c) { return newWordCells.has(c); })) continue;
        wordRuns.push({
          word: legacyWords[li].word,
          cells: legacyWords[li].cells,
          isMain: false,
        });
      }
    }

    var invalidWords = [];
    for (var wi = 0; wi < wordRuns.length; wi++) {
      var wordEntry = wordRuns[wi];
      var w = String(wordEntry.word || '').toUpperCase();
      var cells = wordEntry.cells;
      /*
       * Full contiguous run only (LTR / top-to-bottom, length ≥ 2).
       * Exact Set lookup via isValidWord — never accept a substring of a longer invalid run.
       */
      var accepted = w.length >= 2 ? resolveValidWord(w, player) : null;
      if (!accepted) {
        accepted = resolveWordFromRun(tempBoard, cells, player);
      }
      if (
        player === PLAYER.P2 &&
        sameRow &&
        isHorizontalWordCells(cells) &&
        wordEntry.isMain &&
        accepted &&
        p2VisualWord &&
        isValidWord(p2VisualWord) &&
        accepted !== p2VisualWord &&
        sameLetterMultiset(accepted, p2VisualWord)
      ) {
        accepted = p2VisualWord;
      }
      if (
        player === PLAYER.P2 &&
        sameCol &&
        isVerticalWordCells(cells) &&
        wordEntry.isMain &&
        accepted &&
        p2ServerWord &&
        p2VisualWord &&
        isValidWord(p2ServerWord) &&
        isValidWord(p2VisualWord) &&
        isReversedSpelling(p2ServerWord, p2VisualWord) &&
        p2IntentFirstLetter
      ) {
        var vCornerCh = runCornerLetter(tempBoard, cells, START_P2_IDX);
        if (vCornerCh && vCornerCh === p2VisualWord.charAt(p2VisualWord.length - 1)) {
          accepted = p2VisualWord;
        } else if (vCornerCh && vCornerCh === p2ServerWord.charAt(0)) {
          accepted = p2ServerWord;
        } else if (p2IntentFirstLetter === p2VisualWord.charAt(0)) {
          accepted = p2VisualWord;
        } else if (p2IntentFirstLetter === p2ServerWord.charAt(0)) {
          accepted = p2ServerWord;
        } else {
          accepted = p2VisualWord;
        }
      }
      if (
        opts.intendedWord &&
        opts.wordCells &&
        opts.wordCells.length >= 2 &&
        cellSetKey(cells) === cellSetKey(opts.wordCells)
      ) {
        var intent = String(opts.intendedWord).toUpperCase();
        var orderedSpell = wordFromBoardCells(tempBoard, opts.wordCells.map(Number));
        if (orderedSpell === intent && resolveValidWord(intent, player)) {
          accepted = intent;
        }
      }
      if (!accepted) {
        invalidWords.push(w);
        continue;
      }
      if (wordEntry.isMain || primaryScore < 0) {
        primaryScore = wordEntry.isMain ? 1e9 : accepted.length;
        primaryWord = accepted;
        primaryWordCells = cells.slice();
      } else if (!wordEntry.isMain && primaryScore < 1e9) {
        var orientMatch =
          (sameRow && isHorizontalWordCells(cells)) ||
          (sameCol && isVerticalWordCells(cells));
        var newCount = 0;
        var ciPick;
        for (ciPick = 0; ciPick < cells.length; ciPick++) {
          if (newWordCells.has(cells[ciPick])) newCount++;
        }
        var pickScore = accepted.length * 10 + newCount * 5 + (orientMatch ? 100 : 0);
        if (pickScore > primaryScore) {
          primaryScore = pickScore;
          primaryWord = accepted;
          primaryWordCells = cells.slice();
        }
      }
      formedWords.push({ word: accepted, cells: cells.slice() });
    }

    if (invalidWords.length) {
      var uniq = [];
      var ui;
      for (ui = 0; ui < invalidWords.length; ui++) {
        if (uniq.indexOf(invalidWords[ui]) < 0) uniq.push(invalidWords[ui]);
      }
      /*
       * Prefer the player's intended spelling in errors when the engine only
       * saw the LTR reverse (REWOTS vs STOWER). Keep real invalid crosses as-is.
       */
      if (opts.intendedWord) {
        var intentErr = String(opts.intendedWord).toUpperCase();
        for (ui = 0; ui < uniq.length; ui++) {
          if (
            intentErr.length >= 2 &&
            uniq[ui] !== intentErr &&
            isReversedSpelling(uniq[ui], intentErr)
          ) {
            uniq[ui] = intentErr;
          }
        }
      }
      return {
        valid: false,
        reason:
          uniq.length === 1
            ? '"' + uniq[0] + '" is not a valid word.'
            : 'Invalid words: ' +
              uniq
                .map(function (x) {
                  return '"' + x + '"';
                })
                .join(', ') +
              '.',
        invalidWords: uniq,
      };
    }

    if (!primaryWord) {
      return { valid: false, reason: 'Must form at least one new word.' };
    }

    if (opts.intendedWord && opts.wordCells && opts.wordCells.length >= 2) {
      var intentWord = String(opts.intendedWord).trim().toUpperCase();
      var intentCells = opts.wordCells.map(Number);
      var spelledIntent = wordFromBoardCells(tempBoard, intentCells);
      var intentHorizontal = isHorizontalWordCells(intentCells);
      var ltrCells = sortedWordCells(intentCells, intentHorizontal);
      var ltrSpell = wordFromBoardCells(tempBoard, ltrCells);
      var formedOnCells = null;
      var formedCellsRef = null;
      var fiMatch;
      for (fiMatch = 0; fiMatch < formedWords.length; fiMatch++) {
        if (cellSetKey(formedWords[fiMatch].cells) === cellSetKey(intentCells)) {
          formedOnCells = formedWords[fiMatch].word;
          formedCellsRef = formedWords[fiMatch].cells;
          break;
        }
      }
      var intentValid = !!resolveValidWord(intentWord, player);
      var formedValid = !!(formedOnCells && resolveValidWord(formedOnCells, player));
      var ltrValid = !!resolveValidWord(ltrSpell, player);

      /*
       * Prefer formed LTR when the submitted cell *order* differs from LTR but
       * the intended word is a *valid* dictionary word matching formed/LTR
       * (or its reverse for guest visual submit of a real word like ROW).
       * Never remap an *invalid* intended word (XIF) to its reverse (FIX).
       */
      if (spelledIntent !== intentWord) {
        if (
          intentValid &&
          formedValid &&
          (intentWord === formedOnCells || isReversedSpelling(formedOnCells, intentWord))
        ) {
          console.log('[validateMove] intendedWord → formed LTR/TTB', {
            intended: intentWord,
            spelledAlongCells: spelledIntent,
            formed: formedOnCells,
          });
          intentWord = formedOnCells;
          intentCells = sortedWordCells(
            formedCellsRef,
            isHorizontalWordCells(formedCellsRef)
          );
          intentValid = true;
        } else if (
          intentValid &&
          ltrValid &&
          (intentWord === ltrSpell || isReversedSpelling(ltrSpell, intentWord))
        ) {
          console.log('[validateMove] intendedWord → LTR/TTB spelling', {
            intended: intentWord,
            ltr: ltrSpell,
          });
          intentWord = ltrSpell;
          intentCells = ltrCells;
          intentValid = true;
        } else if (!intentValid) {
          /* Bad client label (e.g. painted TIML/PMIE) but cells form a real word. */
          var spelledValid = !!resolveValidWord(spelledIntent, player);
          if (spelledValid) {
            console.log('[validateMove] intendedWord ignored; using cell spelling', {
              intended: intentWord,
              spelledAlongCells: spelledIntent,
            });
            intentWord = spelledIntent;
            intentValid = true;
          } else if (
            formedValid &&
            isReversedSpelling(spelledIntent, formedOnCells)
          ) {
            console.log('[validateMove] intendedWord ignored; using formed LTR/TTB', {
              intended: intentWord,
              spelledAlongCells: spelledIntent,
              formed: formedOnCells,
            });
            intentWord = formedOnCells;
            intentCells = sortedWordCells(
              formedCellsRef,
              isHorizontalWordCells(formedCellsRef)
            );
            intentValid = true;
          } else {
            return {
              valid: false,
              reason: '"' + intentWord + '" is not a valid word.',
              invalidWords: [intentWord],
            };
          }
        } else {
          return {
            valid: false,
            reason:
              'Submitted reading order spells "' +
              spelledIntent +
              '" but word was "' +
              intentWord +
              '".',
            invalidWords: [intentWord],
          };
        }
      } else if (!intentValid) {
        /* Visual order spells the intended invalid word (e.g. XIF) — reject.
         * Do not silently accept the reverse (FIX). */
        return {
          valid: false,
          reason: '"' + intentWord + '" is not a valid word.',
          invalidWords: [intentWord],
        };
      }

      if (!resolveValidWord(intentWord, player)) {
        return { valid: false, reason: '"' + intentWord + '" is not a valid word.' };
      }
      var intentKey = cellSetKey(intentCells);
      var foundFormed = false;
      var fi;
      for (fi = 0; fi < formedWords.length; fi++) {
        if (cellSetKey(formedWords[fi].cells) === intentKey) {
          formedWords[fi].word = intentWord;
          formedWords[fi].cells = intentCells.slice();
          foundFormed = true;
          break;
        }
      }
      if (!foundFormed) {
        return {
          valid: false,
          reason: 'Submitted word cells do not match a word formed by this play.',
        };
      }
      primaryWord = intentWord;
      primaryWordCells = intentCells.slice();
    }

    /* Opening already required at least one new tile on the player's start
       square (P1 bottom-left / P2 top-right). Do not also demand first vs last
       letter — HITTER with H on start is valid horizontal or vertical. */

    connections = countBonusConnections(
      state.board,
      newWordCells,
      formedWords,
      player
    );
    var tilesPlaced = placements.size;
    var rackTilesBefore = countRackTiles(rack);
    var bingo = tilesPlaced > 0 && tilesPlaced === rackTilesBefore;
    /*
     * Every newly formed word scores length × 10 (getAllWordsFormed full runs).
     * GOB+GO+OR+BI → 30+20+20+20 = 90. GO alone → 20.
     * +75 only on the first play that connects to any opponent word (boards not yet linked).
     */
    var letterScore = 0;
    var fiScore;
    for (fiScore = 0; fiScore < formedWords.length; fiScore++) {
      letterScore += TILE_POINTS * String(formedWords[fiScore].word || '').length;
    }
    var linkBonus =
      connections > 0 && !state.boardsLinked ? LINK_BONUS : 0;
    var bingoPoints = bingo ? BINGO_BONUS : 0;
    var starPoints = starsCaptured * STAR_BONUS;
    var score = letterScore + linkBonus + bingoPoints + starPoints;

    var usedRackIndices = [];
    for (var pIdx of placements.values()) {
      var usedSlot = resolvePlacementRackSlot(rack, pIdx);
      if (usedSlot >= 0) usedRackIndices.push(usedSlot);
    }

    return {
      valid: true,
      success: true,
      score: score,
      starsCaptured: starsCaptured,
      starPoints: starPoints,
      connections: connections,
      bonusConnections: connections,
      linkBonus: linkBonus,
      letterScore: letterScore,
      bingo: bingo,
      bingoPoints: bingoPoints,
      word: primaryWord,
      primaryWordCells: primaryWordCells,
      formedWords: formedWords,
      wordsFormed: formedWords.map(function (fw) {
        return {
          word: fw.word,
          positions: fw.cells.slice(),
          cells: fw.cells.slice(),
        };
      }),
      usedRackIndices: usedRackIndices,
    };
  }

  function refillRack(state, player, usedRackIndices) {
    var rack = state.racks[player];
    var i, ri;
    for (i = 0; i < usedRackIndices.length; i++) {
      ri = usedRackIndices[i];
      if (ri >= 0) rack[ri] = null;
    }
    for (i = 0; i < RACK_SIZE; i++) {
      if (!rack[i] && state.bag.length) {
        rack[i] = { letter: state.bag.pop(), id: uid() };
      }
    }
  }

  function markBoardsLinked(state, placements, player) {
    if (state.boardsLinked) return;
    if (placementTouchesOpponent(state.board, placements, player)) {
      state.boardsLinked = true;
    }
  }

  function commitPlacements(state, placements, player) {
    for (var idx of placements.keys()) {
      var p = placements.get(idx);
      state.board[idx] = {
        letter: p.blankAs != null ? p.blankAs : p.letter,
        owner: player,
        isBlank: p.letter === '*',
      };
    }
  }

  function computeP2PlacementServerWord(placements, state, sameRow, sameCol) {
    if (!placements || placements.size < 2 || !state) return null;
    var indices = Array.from(placements.keys());
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var allCells = indices.slice();
    var minC, maxC, minR, maxR, row, col, c, r, idx;

    if (sameRow) {
      row = rows[0];
      minC = Math.min.apply(null, cols);
      maxC = Math.max.apply(null, cols);
      while (minC > 0) {
        idx = row * COLS + (minC - 1);
        if (state.board[idx] || placements.has(idx)) minC--;
        else break;
      }
      while (maxC < COLS - 1) {
        idx = row * COLS + (maxC + 1);
        if (state.board[idx] || placements.has(idx)) maxC++;
        else break;
      }
      allCells = [];
      for (c = minC; c <= maxC; c++) {
        idx = row * COLS + c;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    } else if (sameCol) {
      col = cols[0];
      minR = Math.min.apply(null, rows);
      maxR = Math.max.apply(null, rows);
      while (minR > 0) {
        idx = (minR - 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) minR--;
        else break;
      }
      while (maxR < ROWS - 1) {
        idx = (maxR + 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) maxR++;
        else break;
      }
      allCells = [];
      for (r = minR; r <= maxR; r++) {
        idx = r * COLS + col;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    } else {
      return null;
    }

    var serverOrder = allCells.slice().sort(function (a, b) {
      if (sameRow) return (a % COLS) - (b % COLS);
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });

    function letterAtCell(cellIdx) {
      if (placements.has(cellIdx)) return placementDisplayLetter(placements.get(cellIdx));
      if (state.board[cellIdx]) return boardCellLetter(state.board[cellIdx]);
      return '';
    }

    var out = '';
    var i;
    for (i = 0; i < serverOrder.length; i++) {
      out += letterAtCell(serverOrder[i]);
    }
    return isValidWord(out) ? out : null;
  }

  function computeP2PlacementVisualWord(placements, state, sameRow, sameCol) {
    if (!placements || placements.size < 2 || !state) return null;
    var indices = Array.from(placements.keys());
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var allCells = indices.slice();
    var minC, maxC, minR, maxR, row, col, c, r, idx;

    if (sameRow) {
      row = rows[0];
      minC = Math.min.apply(null, cols);
      maxC = Math.max.apply(null, cols);
      while (minC > 0) {
        idx = row * COLS + (minC - 1);
        if (state.board[idx] || placements.has(idx)) minC--;
        else break;
      }
      while (maxC < COLS - 1) {
        idx = row * COLS + (maxC + 1);
        if (state.board[idx] || placements.has(idx)) maxC++;
        else break;
      }
      allCells = [];
      for (c = minC; c <= maxC; c++) {
        idx = row * COLS + c;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    } else if (sameCol) {
      col = cols[0];
      minR = Math.min.apply(null, rows);
      maxR = Math.max.apply(null, rows);
      while (minR > 0) {
        idx = (minR - 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) minR--;
        else break;
      }
      while (maxR < ROWS - 1) {
        idx = (maxR + 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) maxR++;
        else break;
      }
      allCells = [];
      for (r = minR; r <= maxR; r++) {
        idx = r * COLS + col;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    } else {
      return null;
    }

    var visualOrder = allCells.slice().sort(function (a, b) {
      /* Guest 180° / toward-corner: visual LTR/TTB ≡ descending server col/row. */
      if (sameRow) return (b % COLS) - (a % COLS);
      return Math.floor(b / COLS) - Math.floor(a / COLS);
    });

    function letterAtCell(cellIdx) {
      if (placements.has(cellIdx)) return placementDisplayLetter(placements.get(cellIdx));
      if (state.board[cellIdx]) return boardCellLetter(state.board[cellIdx]);
      return '';
    }

    function wordFromOrder(order) {
      var out = '';
      var i;
      for (i = 0; i < order.length; i++) {
        out += letterAtCell(order[i]);
      }
      return out;
    }

    var visualWord = wordFromOrder(visualOrder);
    if (!isValidWord(visualWord)) {
      visualOrder = visualOrder.slice().reverse();
      visualWord = wordFromOrder(visualOrder);
    }
    return isValidWord(visualWord) ? visualWord : null;
  }

  function normalizeP2Placements(placementArr, state) {
    if (!placementArr || !placementArr.length || !state) return placementArr;
    var placements = placementsMapFromArray(placementArr);
    var indices = Array.from(placements.keys());
    if (indices.length < 2) return placementArr;
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var sameRow = rows.every(function (r) { return r === rows[0]; });
    var sameCol = cols.every(function (c) { return c === cols[0]; });
    if (!sameRow && !sameCol) return placementArr;

    var allCells = indices.slice();
    var minC, maxC, minR, maxR, row, col, c, r, idx;
    if (sameRow) {
      row = rows[0];
      minC = Math.min.apply(null, cols);
      maxC = Math.max.apply(null, cols);
      while (minC > 0) {
        idx = row * COLS + (minC - 1);
        if (state.board[idx] || placements.has(idx)) minC--;
        else break;
      }
      while (maxC < COLS - 1) {
        idx = row * COLS + (maxC + 1);
        if (state.board[idx] || placements.has(idx)) maxC++;
        else break;
      }
      allCells = [];
      for (c = minC; c <= maxC; c++) {
        idx = row * COLS + c;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    } else {
      col = cols[0];
      minR = Math.min.apply(null, rows);
      maxR = Math.max.apply(null, rows);
      while (minR > 0) {
        idx = (minR - 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) minR--;
        else break;
      }
      while (maxR < ROWS - 1) {
        idx = (maxR + 1) * COLS + col;
        if (state.board[idx] || placements.has(idx)) maxR++;
        else break;
      }
      allCells = [];
      for (r = minR; r <= maxR; r++) {
        idx = r * COLS + col;
        if (state.board[idx] || placements.has(idx)) allCells.push(idx);
      }
    }

    var serverOrder = allCells.slice().sort(function (a, b) {
      if (sameRow) return (a % COLS) - (b % COLS);
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
    var visualOrder = allCells.slice().sort(function (a, b) {
      /* Toward-corner visual (matches guest flipped LTR/TTB). */
      if (sameRow) return (b % COLS) - (a % COLS);
      return Math.floor(b / COLS) - Math.floor(a / COLS);
    });

    function letterAtCell(cellIdx) {
      if (placements.has(cellIdx)) return placementDisplayLetter(placements.get(cellIdx));
      if (state.board[cellIdx]) return boardCellLetter(state.board[cellIdx]);
      return '';
    }

    function wordFromOrder(order) {
      var out = '';
      var i;
      for (i = 0; i < order.length; i++) {
        out += letterAtCell(order[i]);
      }
      return out;
    }

    var serverWord = wordFromOrder(serverOrder);
    var visualWord = wordFromOrder(visualOrder);
    if (!isValidWord(visualWord)) {
      visualOrder = visualOrder.slice().reverse();
      visualWord = wordFromOrder(visualOrder);
      if (!isValidWord(visualWord)) {
        return placementArr;
      }
    }

    if (isValidWord(serverWord)) return placementArr;

    if (!isValidWord(visualWord)) return placementArr;

    /* Do not remap reverse→LTR here. Remapping before validate moves letters
     * onto other cells and invents false crosses (SINE→SW/IE/NR). Keep the
     * player's physical placement; resolveWordFromRun accepts reverse readings. */
    if (
      visualWord === serverWord.split('').reverse().join('') &&
      isValidWord(visualWord) &&
      !isValidWord(serverWord)
    ) {
      return placementArr;
    }

    return placementArr;
  }

  function remapP2PlacementsToSpellWord(placementArr, placements, sortedCells, targetWord, state) {
    var target = String(targetWord).toUpperCase();
    if (sortedCells.length !== target.length) return placementArr;

    function letterAt(cellIdx) {
      if (placements.has(cellIdx)) return placementDisplayLetter(placements.get(cellIdx));
      if (state.board[cellIdx]) return boardCellLetter(state.board[cellIdx]);
      return '';
    }

    var hostRead = sortedCells.map(letterAt).join('');
    if (hostRead === target) return placementArr;

    var si, expected, cellIdx;
    for (si = 0; si < sortedCells.length; si++) {
      expected = target.charAt(si);
      cellIdx = sortedCells[si];
      if (!placements.has(cellIdx) && letterAt(cellIdx) !== expected) {
        return placementArr;
      }
    }

    var pool = [];
    placements.forEach(function (p) {
      pool.push({ tile: p, display: placementDisplayLetter(p) });
    });
    var used = {};
    var out = [];
    var pi, ti, src, tile;

    for (si = 0; si < sortedCells.length; si++) {
      cellIdx = sortedCells[si];
      if (!placements.has(cellIdx)) continue;
      expected = target.charAt(si);
      ti = -1;
      for (pi = 0; pi < pool.length; pi++) {
        if (used[pi]) continue;
        if (pool[pi].display === expected) {
          ti = pi;
          break;
        }
      }
      if (ti < 0) {
        for (pi = 0; pi < pool.length; pi++) {
          if (used[pi]) continue;
          if (pool[pi].tile.letter === '*') {
            ti = pi;
            break;
          }
        }
      }
      if (ti < 0) return placementArr;
      used[ti] = true;
      src = pool[ti].tile;
      tile = {
        idx: cellIdx,
        letter: src.letter,
        rackIndex: src.rackIndex,
        tileId: src.tileId || null,
      };
      if (src.letter === '*') tile.blankAs = expected;
      else if (src.blankAs != null) tile.blankAs = expected;
      out.push(tile);
    }
    return out.length ? out : placementArr;
  }

  /**
   * Store P2 words LTR / top-to-bottom on the shared fixed board.
   * Safe without guest flip: both seats see the same cells.
   */
  function alignP2PlacementsToHostWordOrder(placementArr, state, word, cells, player) {
    if (player !== PLAYER.P2 || !word || !cells || !cells.length) return placementArr;
    if (!placementArr || !placementArr.length) return placementArr;

    var placements = placementsMapFromArray(placementArr);
    var horizontal = isHorizontalWordCells(cells);
    var target = String(word).toUpperCase();
    var ascOrder = cells.slice().sort(function (a, b) {
      if (horizontal) return (a % COLS) - (b % COLS);
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
    function letterAt(cellIdx) {
      if (placements.has(cellIdx)) return placementDisplayLetter(placements.get(cellIdx));
      if (state.board[cellIdx]) return boardCellLetter(state.board[cellIdx]);
      return '';
    }
    var hostRead = ascOrder.map(letterAt).join('');
    if (hostRead === target) return placementArr;
    return remapP2PlacementsToSpellWord(placementArr, placements, ascOrder, target, state);
  }

  function applyPlay(state, placementArr, player, playOpts) {
    if (!playOpts) playOpts = {};
    placementArr = canonicalizePlacements(placementArr, state, player);
    var result = validateMove(state, placementArr, player, {
      precanonicalized: true,
      intendedWord: playOpts.intendedWord || playOpts.word || null,
      wordCells: playOpts.wordCells || playOpts.cells || null,
    });
    if (!result.valid) return result;
    if (player === PLAYER.P2 && result.word && result.primaryWordCells) {
      placementArr = alignP2PlacementsToHostWordOrder(
        placementArr,
        state,
        result.word,
        result.primaryWordCells,
        player
      );
    }
    var placements = placementsMapFromArray(placementArr);

    commitPlacements(state, placements, player);
    markBoardsLinked(state, placements, player);
    state.openingPlayed[player] = true;
    state.stars[player] += result.starsCaptured;
    state.scores[player] += result.score;
    state.lastWordPlayed = { player: player, word: result.word, score: result.score };
    if (result.formedWords && result.formedWords.length) {
      for (var fi = 0; fi < result.formedWords.length; fi++) {
        recordAcceptedRun(state, result.formedWords[fi].word, result.formedWords[fi].cells);
      }
    } else {
      recordAcceptedRun(state, result.word, result.primaryWordCells);
    }
    state.firstMovePlayed = true;
    refillRack(state, player, result.usedRackIndices);
    state.turnSeq = (state.turnSeq || 0) + 1;
    return result;
  }

  function applyExchange(state, player, slots) {
    if (!slots || !slots.length) {
      return { valid: false, reason: 'No tiles selected to exchange.' };
    }
    if (state.bag.length === 0) {
      return { valid: false, reason: 'No tiles left in the bag to exchange.' };
    }
    if (slots.length > state.bag.length) {
      return { valid: false, reason: 'Not enough tiles in the bag for that exchange.' };
    }
    var rack = state.racks[player];
    var i, slot, tile;
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      tile = rack[slot];
      if (!tile) {
        return { valid: false, reason: 'Invalid exchange slot.' };
      }
    }
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      tile = rack[slot];
      if (tile) state.bag.push(tile.letter);
      rack[slot] = null;
    }
    state.bag = shuffle(state.bag);
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      if (state.bag.length) {
        rack[slot] = { letter: state.bag.pop(), id: uid() };
      }
    }
    state.turnSeq = (state.turnSeq || 0) + 1;
    return { valid: true, exchanged: slots.length };
  }

  function checkGameOver(state) {
    if (state.scores[0] >= WIN_SCORE || state.scores[1] >= WIN_SCORE) {
      state.gameOver = true;
      state.winner = state.scores[0] >= WIN_SCORE ? 0 : 1;
      if (state.scores[0] === state.scores[1]) state.winner = null;
      return true;
    }
    var p0Empty = !state.racks[0].some(Boolean) && state.bag.length === 0;
    var p1Empty = !state.racks[1].some(Boolean) && state.bag.length === 0;
    if (!p0Empty && !p1Empty) return false;
    state.gameOver = true;
    if (state.scores[0] > state.scores[1]) state.winner = 0;
    else if (state.scores[1] > state.scores[0]) state.winner = 1;
    else state.winner = null;
    return true;
  }

  function createInitialState(rng) {
    var random = rng || Math.random;
    var bag = createTileBag(random);
    var starCoords = generateSymmetricStarCoords(random);
    return {
      starCoords: starCoords,
      specials: buildSpecials(starCoords),
      board: new Array(COLS * ROWS).fill(null),
      racks: [
        drawTiles(bag, RACK_SIZE).map(function (l) { return { letter: l, id: uid(random) }; }),
        drawTiles(bag, RACK_SIZE).map(function (l) { return { letter: l, id: uid(random) }; }),
      ],
      bag: bag,
      scores: [0, 0],
      stars: [0, 0],
      currentPlayer: 0,
      firstMovePlayed: false,
      openingPlayed: [false, false],
      boardsLinked: false,
      gameOver: false,
      winner: null,
      lastWordPlayed: { player: null, word: '', score: 0 },
      acceptedRuns: [],
      turnSeq: 0,
    };
  }

  function cellSetKey(cells) {
    return cells
      .slice()
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .join(',');
  }

  function recordAcceptedRun(state, word, cells) {
    if (!state || !word || !cells || cells.length < 2) return;
    if (!state.acceptedRuns) state.acceptedRuns = [];
    var key = cellSetKey(cells);
    var entry = {
      cells: cells.slice().map(Number).sort(function (a, b) { return a - b; }),
      word: String(word).toUpperCase(),
    };
    var i;
    for (i = 0; i < state.acceptedRuns.length; i++) {
      if (cellSetKey(state.acceptedRuns[i].cells) === key) {
        state.acceptedRuns[i] = entry;
        return;
      }
    }
    state.acceptedRuns.push(entry);
  }

  function advanceTurn(state) {
    state.currentPlayer = 1 - state.currentPlayer;
  }

  function getOpponentRackCount(state, viewerIndex) {
    var opp = 1 - viewerIndex;
    var rack = state.racks[opp];
    var count = 0;
    for (var i = 0; i < rack.length; i++) {
      if (rack[i]) count++;
    }
    return count;
  }

  function cloneBoardForClient(board) {
    var out = new Array(COLS * ROWS);
    var i, c;
    for (i = 0; i < COLS * ROWS; i++) {
      c = board && board[i];
      if (!c) {
        out[i] = null;
        continue;
      }
      out[i] = {
        letter: c.letter,
        owner: c.owner,
        isBlank: !!c.isBlank,
      };
    }
    return out;
  }

  function cloneRackForClient(rack) {
    if (!rack) return new Array(RACK_SIZE).fill(null);
    var out = new Array(RACK_SIZE);
    var i;
    for (i = 0; i < RACK_SIZE; i++) {
      var t = rack[i];
      out[i] = t ? { letter: t.letter, id: t.id } : null;
    }
    return out;
  }

  function getClientView(state, viewerIndex) {
    var opp = 1 - viewerIndex;
    return {
      starCoords: state.starCoords,
      board: cloneBoardForClient(state.board),
      myRack: cloneRackForClient(state.racks[viewerIndex]),
      opponentRackCount: getOpponentRackCount(state, viewerIndex),
      bagCount: state.bag.length,
      scores: state.scores.slice(),
      stars: state.stars.slice(),
      currentPlayer: state.currentPlayer,
      firstMovePlayed: state.firstMovePlayed,
      openingPlayed: state.openingPlayed.slice(),
      boardsLinked: state.boardsLinked,
      gameOver: state.gameOver,
      winner: state.winner,
      lastWordPlayed: state.lastWordPlayed,
      acceptedRuns: (state.acceptedRuns || []).map(function (run) {
        return {
          cells: run.cells.slice(),
          word: run.word,
        };
      }),
      turnSeq: state.turnSeq,
      myIndex: viewerIndex,
      turnEndsAt: state.turnEndsAt || null,
    };
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    RACK_SIZE: RACK_SIZE,
    WIN_SCORE: WIN_SCORE,
    TURN_MS: TURN_MS,
    TILE_POINTS: TILE_POINTS,
    LINK_BONUS: LINK_BONUS,
    BINGO_BONUS: BINGO_BONUS,
    STAR_BONUS: STAR_BONUS,
    PLAYER: PLAYER,
    initDictionary: initDictionary,
    isValidWord: isValidWord,
    dictionarySize: dictionarySize,
    createInitialState: createInitialState,
    validateMove: validateMove,
    canonicalizePlacements: canonicalizePlacements,
    applyPlay: applyPlay,
    applyExchange: applyExchange,
    checkGameOver: checkGameOver,
    advanceTurn: advanceTurn,
    getClientView: getClientView,
    placementsMapFromArray: placementsMapFromArray,
    canonicalizeP2PlacementLetters: canonicalizeP2PlacementLetters,
    canonicalizeP2VerticalPlacementLetters: canonicalizeP2VerticalPlacementLetters,
    canonicalizeVerticalPlacementLetters: canonicalizeVerticalPlacementLetters,
    normalizeP2Placements: normalizeP2Placements,
  };
});
