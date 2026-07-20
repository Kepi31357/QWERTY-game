'use strict';

/**
 * JERKY horizontal + vertical cross regression (live "OJ" bug).
 * Run: node server/test-jerky-cross.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');
var formedApi = require('../getAllWordsFormed.js');

function loadDictionary() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'dictionary.js'), 'utf8');
  var sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);
}

loadDictionary();

var COLS = 15;
var PLAYER = engine.PLAYER;
var getAllWordsFormed = formedApi.getAllWordsFormed;

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

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + i };
  });
  while (state.racks[player].length < 8) state.racks[player].push(null);
}

assert(engine.isValidWord('JO'), 'JO is a valid dictionary/Scrabble two-letter word');
assert(!engine.isValidWord('OJ'), 'OJ is not a valid word');

/* --- Extraction log: JERKY with O below J (canonical JO) --- */
(function () {
  var board = new Array(COLS * 15).fill(null);
  var row = 10;
  var col0 = 3;
  board[(row + 1) * COLS + col0] = { letter: 'O', owner: PLAYER.P2 };
  var placed = [];
  'JERKY'.split('').forEach(function (ch, i) {
    var idx = row * COLS + col0 + i;
    board[idx] = { letter: ch, owner: PLAYER.P1 };
    placed.push(idx);
  });

  console.log('DEBUG placedPositions', placed);
  var raw = getAllWordsFormed(board, placed);
  console.log('DEBUG getAllWordsFormed', JSON.stringify(raw, null, 2));

  assert(raw.main && raw.main.word === 'JERKY', 'main extracted as JERKY LTR');
  var cross = raw.words.filter(function (w) {
    return !w.isMain;
  });
  assert(cross.length === 1 && cross[0].word === 'JO', 'cross extracted as JO (not OJ)');
  assert(cross[0].direction === 'vertical', 'cross is vertical');
  assert(
    cross[0].positions[0] === row * COLS + col0 &&
      cross[0].positions[1] === (row + 1) * COLS + col0,
    'JO positions are top-to-bottom J then O'
  );

  /* Unsorted placedPositions must not reverse the cross */
  var rawRev = getAllWordsFormed(board, placed.slice().reverse());
  assert(
    rawRev.words.some(function (w) {
      return w.word === 'JO';
    }) &&
      !rawRev.words.some(function (w) {
        return w.word === 'OJ';
      }),
    'reversed placedPositions still yields JO not OJ'
  );
})();

/* --- Live engine: JERKY + JO must accept --- */
(function () {
  var st = emptyState();
  var row = 10;
  var col0 = 3;
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[(15 - 1) * COLS] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[(row + 1) * COLS + col0] = { letter: 'O', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'JERKYXXX');
  var placements = 'JERKY'.split('').map(function (ch, i) {
    return { idx: row * COLS + col0 + i, letter: ch, rackIndex: i };
  });
  var r = engine.validateMove(st, placements, PLAYER.P1);
  assert(r.valid, 'JERKY+JO validates: ' + (r.reason || r.word));
  assert(r.word === 'JERKY', 'primary word JERKY');
  assert(
    r.formedWords.some(function (w) {
      return w.word === 'JO';
    }),
    'formedWords includes JO'
  );
  assert(
    !r.formedWords.some(function (w) {
      return w.word === 'OJ';
    }),
    'formedWords must not include OJ'
  );
})();

/* --- O above J → canonical OJ must reject (not silently flip to JO) --- */
(function () {
  var st = emptyState();
  var row = 10;
  var col0 = 3;
  st.openingPlayed = [true, true];
  st.boardsLinked = true;
  st.board[(15 - 1) * COLS] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[(row - 1) * COLS + col0] = { letter: 'O', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'JERKYXXX');
  var placements = 'JERKY'.split('').map(function (ch, i) {
    return { idx: row * COLS + col0 + i, letter: ch, rackIndex: i };
  });
  var r = engine.validateMove(st, placements, PLAYER.P1);
  assert(!r.valid, 'O-above-J rejects');
  assert(/OJ/.test(r.reason || ''), 'reject reason mentions OJ (canonical TTB), got: ' + r.reason);
  assert(!/JO/.test(r.reason || '') || /OJ/.test(r.reason || ''), 'must not invent JO from OJ board');
})();

console.log('All JERKY cross tests passed.');
