'use strict';

/**
 * Robust local-dictionary Set lookup + full cross-run validation.
 * Run: node server/test-dictionary-set.js
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
  return sandbox.window.QWERTY_WORD_LIST;
}

var wordList = loadDictionary();
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

console.log('--- isValidWord (Set, exact, case-insensitive, length ≥ 2) ---');
assert(engine.dictionarySize() > 10000, 'dictionary Set populated (' + engine.dictionarySize() + ')');
assert(engine.isValidWord('SWINE'), 'SWINE accepted');
assert(engine.isValidWord('swine'), 'swine (lowercase) accepted');
assert(engine.isValidWord('Swine'), 'Swine (mixed case) accepted');
assert(!engine.isValidWord('SWINES'), 'SWINES rejected — not in local list');
assert(engine.isValidWord('SO'), 'SO accepted (classic 2-letter)');
assert(engine.isValidWord('so'), 'so accepted');
assert(!engine.isValidWord('AE'), 'AE rejected (not on classic 2-letter list)');
assert(!engine.isValidWord('A'), 'single letter rejected');
assert(!engine.isValidWord(''), 'empty rejected');
assert(!engine.isValidWord(null), 'null rejected');
assert(!engine.isValidWord('  '), 'whitespace-only rejected');
assert(engine.isValidWord('  SWINE  '), 'trimmed SWINE accepted');
assert(engine.isValidWord('SWINE\t'), 'tab-trimmed SWINE accepted');

/* Confirm raw list membership matches isValidWord for samples. */
var listHas = {};
var i;
for (i = 0; i < wordList.length; i++) {
  listHas[String(wordList[i]).toLowerCase()] = true;
}
assert(!!listHas.swine, 'raw list contains swine');
assert(!listHas.swines, 'raw list does not contain swines');

console.log('--- Full cross-run: SO extending SWINE forms SWINES (must reject) ---');
(function () {
  function idx(c, r) {
    return r * COLS + c;
  }
  function put(board, c, r, letter, owner) {
    board[idx(c, r)] = { letter: letter, owner: owner };
  }
  function setRack(state, player, letters) {
    state.racks[player] = letters.split('').map(function (ch, n) {
      return { letter: ch, id: 't' + n };
    });
    while (state.racks[player].length < 8) state.racks[player].push(null);
  }

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
  put(b, 0, 14, 'A', PLAYER.P1);
  put(b, 1, 14, 'T', PLAYER.P1);
  state.boardsLinked = true;
  state.openingPlayed = [true, true];
  state.firstMovePlayed = true;
  setRack(state, PLAYER.P1, 'SOXIVVE');

  var result = engine.validateMove(
    state,
    [
      { idx: idx(3, 13), letter: 'S' },
      { idx: idx(4, 13), letter: 'O' },
    ],
    PLAYER.P1,
    { intendedWord: 'SO', wordCells: [idx(3, 13), idx(4, 13)] }
  );

  assert(result.valid === false, 'play rejected because full run SWINES is not in dict');
  var invalid = (result.invalidWords || []).map(function (w) {
    return String(w).toUpperCase();
  });
  assert(invalid.indexOf('SWINES') >= 0, 'invalidWords includes full run SWINES (not a substring)');
  assert(invalid.indexOf('SO') < 0, 'SO itself is not listed as invalid');
})();

console.log('--- Valid short cross still accepted (JO on JERKY) ---');
(function () {
  /* Smoke: JO remains valid so we did not break 2-letter / cross path. */
  assert(engine.isValidWord('JO'), 'JO valid');
  assert(engine.isValidWord('JERKY'), 'JERKY valid');
})();

if (fail) {
  console.error('FAILED:', fail);
  process.exit(1);
}
console.log('All dictionary Set tests passed.');
