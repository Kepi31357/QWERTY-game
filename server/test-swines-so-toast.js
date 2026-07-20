'use strict';

/**
 * SWINES+SO validation + least-crowded toast placement.
 * Run: node server/test-swines-so-toast.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var COLS = 15;
var ROWS = 15;
var PLAYER = engine.PLAYER;
var PASS = 0;
var FAIL = 0;

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('  OK  ' + msg);
  } else {
    FAIL++;
    console.log('  FAIL ' + msg);
  }
}

function idx(c, r) {
  return r * COLS + c;
}

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + i };
  });
  while (state.racks[player].length < 8) state.racks[player].push(null);
}

function put(board, c, r, letter, owner) {
  board[idx(c, r)] = { letter: letter, owner: owner };
}

console.log('--- Dictionary ---');
assert(engine.isValidWord('SWINE'), 'SWINE in dictionary');
assert(!engine.isValidWord('SWINES'), 'SWINES rejected (not in local list)');
assert(engine.isValidWord('SO'), 'SO in classic 2-letter list');
assert(engine.isValidWord('SLUB'), 'SLUB in dictionary');
assert(engine.isValidWord('PRUNED'), 'PRUNED in dictionary');

/**
 * Seed board: SLUB + SWINE + PRUNED (Blake/P2).
 * Play S+O as P1 → SWINES vertical + SO horizontal.
 */
function buildSwinesState() {
  var state = engine.createInitialState(function () {
    return 0.5;
  });
  var b = state.board;
  var opp = PLAYER.P2;
  put(b, 3, 8, 'S', opp);
  put(b, 4, 8, 'L', opp);
  put(b, 5, 8, 'U', opp);
  put(b, 6, 8, 'B', opp);
  put(b, 3, 9, 'W', opp);
  put(b, 3, 10, 'I', opp);
  put(b, 3, 11, 'N', opp);
  put(b, 3, 12, 'E', opp);
  put(b, 1, 12, 'P', opp);
  put(b, 2, 12, 'R', opp);
  put(b, 4, 12, 'N', opp);
  put(b, 5, 12, 'E', opp);
  put(b, 6, 12, 'D', opp);
  /* P1 already opened elsewhere so this is a mid-game connect play. */
  put(b, 0, 14, 'A', PLAYER.P1);
  put(b, 1, 14, 'T', PLAYER.P1);
  state.boardsLinked = true;
  state.openingPlayed = [true, true];
  state.firstMovePlayed = true;
  setRack(state, PLAYER.P1, 'SOXIVVE');
  return state;
}

console.log('--- validateMove SWINES + SO (full run must be in dict) ---');
(function () {
  var state = buildSwinesState();
  var placements = [
    { idx: idx(3, 13), letter: 'S' },
    { idx: idx(4, 13), letter: 'O' },
  ];
  var result = engine.validateMove(state, placements, PLAYER.P1, {
    intendedWord: 'SO',
    wordCells: [idx(3, 13), idx(4, 13)],
  });
  console.log('  valid=', result.valid, 'reason=', result.reason || '');
  console.log('  invalidWords=', result.invalidWords || []);
  assert(result.valid === false, 'SWINES+SO rejected — SWINES not in dictionary');
  var invalid = (result.invalidWords || []).map(function (w) {
    return String(w).toUpperCase();
  });
  assert(invalid.indexOf('SWINES') >= 0, 'invalidWords flags full run SWINES');
})();

console.log('--- Toast least-crowded placement ---');
(function () {
  var cellSize = 24;
  var boardW = COLS * cellSize;
  var boardH = ROWS * cellSize;
  var margin = 4;
  var gap = Math.max(8, cellSize * 0.25);
  var boxW = cellSize * 6;
  var boxH = cellSize * 2.5;

  var occupied = {};
  var r, c;
  for (r = 0; r < 12; r++) {
    for (c = 0; c < 10; c++) {
      if (r < 8 || c < 7) occupied[r * COLS + c] = true;
    }
  }
  var playCells = [idx(6, 10), idx(7, 10), idx(8, 10)];
  var playSet = {};
  playCells.forEach(function (i) {
    playSet[i] = true;
    occupied[i] = true;
  });
  var playTop = 10 * cellSize;
  var playBottom = 11 * cellSize;
  var playLeft = 6 * cellSize;
  var playRight = 9 * cellSize;

  function clampBox(x, y) {
    var bx = x;
    var by = y;
    if (bx < margin) bx = margin;
    if (by < margin) by = margin;
    if (bx + boxW > boardW - margin) bx = boardW - margin - boxW;
    if (by + boxH > boardH - margin) by = boardH - margin - boxH;
    return { boxX: bx, boxY: by };
  }
  function overlapsPlay(bx, by) {
    return !(
      bx + boxW <= playLeft - gap ||
      bx >= playRight + gap ||
      by + boxH <= playTop - gap ||
      by >= playBottom + gap
    );
  }
  function crowdScore(bx, by) {
    var score = 0;
    var c0 = Math.max(0, Math.floor(bx / cellSize));
    var r0 = Math.max(0, Math.floor(by / cellSize));
    var c1 = Math.min(COLS - 1, Math.floor((bx + boxW - 1) / cellSize));
    var r1 = Math.min(ROWS - 1, Math.floor((by + boxH - 1) / cellSize));
    var rr, cc, id;
    for (rr = r0; rr <= r1; rr++) {
      for (cc = c0; cc <= c1; cc++) {
        id = rr * COLS + cc;
        if (occupied[id]) score += playSet[id] ? 40 : 8;
      }
    }
    score += (1 - (bx + boxW / 2) / boardW) * 1.5;
    score += (1 - (by + boxH / 2) / boardH) * 1.2;
    if (overlapsPlay(bx, by)) score += 500;
    return score;
  }

  var candidates = [
    { mode: 'lower-right', x: boardW - margin - boxW, y: boardH - margin - boxH },
    { mode: 'lower-left', x: margin, y: boardH - margin - boxH },
    { mode: 'upper-right', x: boardW - margin - boxW, y: margin + cellSize * 0.15 },
    { mode: 'upper-left', x: margin, y: margin + cellSize * 0.15 },
    { mode: 'center-top', x: (boardW - boxW) / 2, y: margin + cellSize * 0.2 },
    { mode: 'center', x: (boardW - boxW) / 2, y: (boardH - boxH) / 2 - cellSize * 0.2 },
  ];

  var best = null;
  var bestScore = Infinity;
  var ci, placed, sc;
  for (ci = 0; ci < candidates.length; ci++) {
    placed = clampBox(candidates[ci].x, candidates[ci].y);
    sc = crowdScore(placed.boxX, placed.boxY) + ci * 0.01;
    if (sc < bestScore) {
      bestScore = sc;
      best = { mode: candidates[ci].mode, boxX: placed.boxX, boxY: placed.boxY };
    }
  }
  console.log('  best mode=', best.mode, 'score=', bestScore.toFixed(2));
  assert(best.mode === 'lower-right', 'crowded mid-board → lower-right toast');
  assert(!overlapsPlay(best.boxX, best.boxY), 'toast does not overlap play HAE');

  occupied = {};
  for (r = 0; r < 8; r++) {
    for (c = 0; c < 8; c++) occupied[r * COLS + c] = true;
  }
  playCells = [idx(12, 13), idx(13, 13), idx(14, 13)];
  playSet = {};
  playCells.forEach(function (i) {
    playSet[i] = true;
    occupied[i] = true;
  });
  playTop = 13 * cellSize;
  playBottom = 14 * cellSize;
  playLeft = 12 * cellSize;
  playRight = 15 * cellSize;
  best = null;
  bestScore = Infinity;
  for (ci = 0; ci < candidates.length; ci++) {
    placed = clampBox(candidates[ci].x, candidates[ci].y);
    sc = crowdScore(placed.boxX, placed.boxY) + ci * 0.01;
    if (sc < bestScore) {
      bestScore = sc;
      best = { mode: candidates[ci].mode, boxX: placed.boxX, boxY: placed.boxY };
    }
  }
  console.log('  play in LR → best mode=', best.mode);
  assert(best.mode !== 'lower-right', 'when play is lower-right, toast leaves that corner');
  assert(!overlapsPlay(best.boxX, best.boxY), 'toast still clears play cells');
})();

console.log('--- Summary: ' + PASS + ' passed, ' + FAIL + ' failed ---');
process.exit(FAIL ? 1 : 0);
