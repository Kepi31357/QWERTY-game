'use strict';

/**
 * Scoring: full formed-word lengths × 10; +75 only on first opponent connect.
 * GO = 20; GOB+GO+OR+BI = 90.
 * Run: node server/test-engine-score-integration.js
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

var PLAYER = engine.PLAYER;
var COLS = 15;
var ROWS = 15;
var START_P1 = (ROWS - 1) * COLS;

function emptyState() {
  return engine.createInitialState(function () {
    return 0.5;
  });
}

function setRack(state, player, letters) {
  state.racks[player] = letters.split('').map(function (ch, i) {
    return { letter: ch, id: 't' + player + i };
  });
  while (state.racks[player].length < 8) {
    state.racks[player].push(null);
  }
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

['GO', 'GOB', 'OR', 'BI', 'SAVORING'].forEach(function (w) {
  assert(engine.isValidWord(w), w + ' in dictionary');
});

/* First connect: own A + place G on opponent O → AG + GO = 40 + 75 */
(function () {
  var st = emptyState();
  st.openingPlayed[PLAYER.P1] = true;
  st.boardsLinked = false;
  st.board[START_P1] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[idx(11, 8)] = { letter: 'A', owner: PLAYER.P1 };
  st.board[idx(12, 9)] = { letter: 'O', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'GXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: idx(11, 9), letter: 'G', rackIndex: 0 }],
    PLAYER.P1
  );
  assert(r.valid, 'first-connect GO/AG valid: ' + (r.reason || r.word));
  assert(r.letterScore === 40, 'AG+GO = 40, got ' + r.letterScore);
  assert(r.linkBonus === 75, 'first connect +75');
})();

/* GO alone (boards linked): G on opponent O → 20, no +75 */
(function () {
  var st = emptyState();
  st.openingPlayed[PLAYER.P1] = true;
  st.boardsLinked = true;
  st.board[START_P1] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[idx(12, 9)] = { letter: 'O', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'GXXXXXXX');
  var r = engine.validateMove(
    st,
    [{ idx: idx(11, 9), letter: 'G', rackIndex: 0 }],
    PLAYER.P1
  );
  assert(r.valid && r.word === 'GO', 'GO valid: ' + (r.reason || r.word));
  assert(r.letterScore === 20, 'GO = 20, got ' + r.letterScore);
  assert(r.linkBonus === 0, 'no second connect bonus');
  assert(r.score === 20 + (r.starPoints || 0), 'linked GO no +75');
})();

/*
 * GOB on O,R,I: GOB + GO + OR + BI = 30+20+20+20 = 90.
 * Boards already linked → no +75.
 */
(function () {
  var st = emptyState();
  st.openingPlayed[PLAYER.P1] = true;
  st.boardsLinked = true;
  st.board[START_P1] = { letter: 'Q', owner: PLAYER.P1 };
  st.board[idx(12, 9)] = { letter: 'O', owner: PLAYER.P2 };
  st.board[idx(12, 10)] = { letter: 'R', owner: PLAYER.P2 };
  st.board[idx(12, 11)] = { letter: 'I', owner: PLAYER.P2 };
  setRack(st, PLAYER.P1, 'GOBXXXXX');
  var place = [
    { idx: idx(11, 9), letter: 'G', rackIndex: 0 },
    { idx: idx(11, 10), letter: 'O', rackIndex: 1 },
    { idx: idx(11, 11), letter: 'B', rackIndex: 2 },
  ];
  var r = engine.validateMove(st, place, PLAYER.P1);
  assert(r.valid, 'GOB valid: ' + (r.reason || r.word));
  var names = (r.formedWords || [])
    .map(function (f) {
      return f.word;
    })
    .sort();
  assert(names.indexOf('GOB') >= 0, 'forms GOB: ' + names);
  assert(names.indexOf('GO') >= 0, 'forms GO: ' + names);
  assert(names.indexOf('OR') >= 0, 'forms OR: ' + names);
  assert(names.indexOf('BI') >= 0, 'forms BI: ' + names);
  assert(r.letterScore === 90, 'GOB+GO+OR+BI = 90, got ' + r.letterScore);
  assert(r.linkBonus === 0, 'already linked → no +75');
  assert(r.score === 90 + (r.starPoints || 0), 'GOB total without reconnect');
})();

console.log('All GO/GOB scoring tests passed.');
