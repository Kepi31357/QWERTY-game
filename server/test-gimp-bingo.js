'use strict';

/**
 * GIMP cross-word (IM/MI reverse bug) + bingo banner priority.
 * Run: node server/test-gimp-bingo.js
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
var PLAYER = engine.PLAYER;
var fail = 0;

function assert(cond, msg) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg);
  } else {
    console.log('OK', msg);
  }
}

function idx(c, r) {
  return r * COLS + c;
}

function put(board, c, r, letter, owner) {
  board[idx(c, r)] = { letter: letter, owner: owner };
}

assert(engine.isValidWord('GIMP'), 'GIMP in dictionary');
assert(engine.isValidWord('MI'), 'MI is a valid 2-letter word (the trap)');
assert(!engine.isValidWord('GMIP'), 'GMIP not a word');

console.log('--- GIMP placement through GRACE…PLATTER ---');
(function () {
  var st = engine.createInitialState(function () {
    return 0.5;
  });
  var b = st.board;
  'GRACE'.split('').forEach(function (ch, i) {
    put(b, 2 + i, 8, ch, PLAYER.P1);
  });
  'PLATTER'.split('').forEach(function (ch, i) {
    put(b, 2 + i, 11, ch, PLAYER.P1);
  });
  put(b, 0, 14, 'C', PLAYER.P1);
  put(b, 1, 14, 'H', PLAYER.P1);
  st.boardsLinked = true;
  st.openingPlayed = [true, true];
  st.firstMovePlayed = true;
  st.racks[0] = 'IMEBSTFY'.split('').map(function (L, i) {
    return { letter: L, id: 't' + i };
  });

  var placements = [
    { idx: idx(2, 9), letter: 'I', rackIndex: 0 },
    { idx: idx(2, 10), letter: 'M', rackIndex: 1 },
  ];

  var canon = engine.canonicalizePlacements(
    placements.map(function (p) {
      return { idx: p.idx, letter: p.letter, rackIndex: p.rackIndex };
    }),
    st,
    PLAYER.P1
  );
  assert(canon[0].letter === 'I' && canon[1].letter === 'M', 'canonicalize keeps I above M (does not swap to MI)');

  var result = engine.validateMove(st, placements, PLAYER.P1, {
    intendedWord: 'GIMP',
    wordCells: [idx(2, 8), idx(2, 9), idx(2, 10), idx(2, 11)],
  });
  assert(result.valid === true, 'GIMP play accepted');
  var words = (result.formedWords || []).map(function (w) {
    return String(w.word).toUpperCase();
  });
  assert(words.indexOf('GIMP') >= 0, 'formed includes GIMP');
  assert(words.indexOf('GMIP') < 0, 'formed does not include GMIP');
})();

console.log('--- Standalone MI reverse still works ---');
(function () {
  var st = engine.createInitialState(function () {
    return 0.5;
  });
  /* Opening covering P1 start with toward-corner MI → store as IM? or accept MI reverse */
  st.racks[0] = 'MIXXXXXX'.split('').map(function (L, i) {
    return { letter: L, id: 't' + i };
  });
  var start = (15 - 1) * COLS;
  /* Place M above I toward corner: rows 13=M, 14=I on start */
  var placements = [
    { idx: start - COLS, letter: 'M', rackIndex: 0 },
    { idx: start, letter: 'I', rackIndex: 1 },
  ];
  var result = engine.validateMove(st, placements, PLAYER.P1, { preview: false });
  assert(result.valid === true, 'standalone MI/IM opening still validates');
})();

console.log('--- Bingo banner priority (logic mirror) ---');
(function () {
  function pickBanner(scoreResult) {
    if (!scoreResult) return null;
    if (scoreResult.bingo || scoreResult.bingoPoints) {
      return { kind: 'bingo', title: 'BINGO!', subtitle: '+' + (scoreResult.bingoPoints || 100) };
    }
    if (scoreResult.linkBonus) {
      return { kind: 'connection', title: 'CONNECTION!', subtitle: '+' + scoreResult.linkBonus };
    }
    return null;
  }
  var bingoOnly = pickBanner({ bingo: true, bingoPoints: 100 });
  assert(bingoOnly && bingoOnly.kind === 'bingo', 'bingo-only → BINGO!');
  var both = pickBanner({ bingo: true, bingoPoints: 100, linkBonus: 75 });
  assert(both && both.kind === 'bingo', 'bingo+connect → BINGO! (not CONNECTION)');
  var connectOnly = pickBanner({ linkBonus: 75 });
  assert(connectOnly && connectOnly.kind === 'connection', 'connect-only → CONNECTION!');
})();

if (fail) {
  console.error('FAILED', fail);
  process.exit(1);
}
console.log('All GIMP/bingo tests passed.');
