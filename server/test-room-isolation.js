'use strict';

/**
 * Per-room game state isolation + room-code rules.
 * Run: node server/test-room-isolation.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var engine = require('../game-engine.js');

var fail = 0;
function assert(cond, msg) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg);
  } else {
    console.log('OK', msg);
  }
}

var dictPath = path.join(__dirname, '..', 'dictionary.js');
var src = fs.readFileSync(dictPath, 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
engine.initDictionary(sandbox.window.QWERTY_WORD_LIST);

var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeRoomCode(raw) {
  var code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length < 4 || code.length > 6) return null;
  for (var i = 0; i < code.length; i++) {
    if (CODE_CHARS.indexOf(code[i]) < 0) return null;
  }
  return code;
}

assert(normalizeRoomCode('testa') === 'TESTA', 'custom code normalizes');
assert(normalizeRoomCode('AB') === null, 'rejects short codes');
assert(normalizeRoomCode('TOOLONG') === null, 'rejects long codes');
assert(normalizeRoomCode('ROOM0') === null, 'rejects ambiguous 0');
assert(normalizeRoomCode('TEST2') === 'TEST2', 'allows 2–9 digits');

var rooms = new Map();

function createIsolatedRoom(code, rng) {
  var room = {
    code: code,
    state: engine.createInitialState(rng),
  };
  rooms.set(code, room);
  return room;
}

var roomA = createIsolatedRoom('TESTA', function () {
  return 0.11;
});
var roomB = createIsolatedRoom('TESTB', function () {
  return 0.77;
});

assert(rooms.size === 2, 'two rooms coexist in Map');
assert(roomA.state !== roomB.state, 'rooms hold distinct state objects');

roomA.state.scores[0] = 999;
roomA.state.board[0] = { letter: 'Q', owner: 0 };
assert(roomB.state.scores[0] === 0, 'mutating room A scores does not affect room B');
assert(!roomB.state.board[0], 'mutating room A board does not affect room B');

var viewA = engine.getClientView(roomA.state, 0);
var viewB = engine.getClientView(roomB.state, 0);
assert(viewA.scores[0] === 999, 'client view A sees its own score');
assert(viewB.scores[0] === 0, 'client view B stays isolated');

if (fail) {
  console.error('\n' + fail + ' failure(s)');
  process.exit(1);
}
console.log('\nAll room isolation checks passed.');
