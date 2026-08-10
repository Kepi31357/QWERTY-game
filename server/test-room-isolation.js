'use strict';

/**
 * Per-room game state isolation + room-code rules (unique codes; MAIN discouraged).
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
var DEFAULT_ROOM_CODE = 'MAIN';

function normalizeRoomCode(raw) {
  var code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length < 4 || code.length > 6) return null;
  if (code === DEFAULT_ROOM_CODE) return code;
  for (var i = 0; i < code.length; i++) {
    if (CODE_CHARS.indexOf(code[i]) < 0) return null;
  }
  return code;
}

function resolveRoomCode(raw, opts) {
  var allowDefault = opts && opts.allowDefault === true;
  if (raw == null || String(raw).trim() === '') {
    return allowDefault ? DEFAULT_ROOM_CODE : null;
  }
  return normalizeRoomCode(raw);
}

assert(normalizeRoomCode('testa') === 'TESTA', 'custom code normalizes');
assert(normalizeRoomCode('AB') === null, 'rejects short codes');
assert(normalizeRoomCode('TOOLONG') === null, 'rejects long codes');
assert(normalizeRoomCode('ROOM0') === null, 'rejects ambiguous 0');
assert(normalizeRoomCode('TEST2') === 'TEST2', 'allows 2–9 digits');
assert(normalizeRoomCode('MAIN') === 'MAIN', 'MAIN still normalizes (blocked at create/join)');
assert(resolveRoomCode('') === null, 'blank no longer resolves to MAIN');
assert(resolveRoomCode(null) === null, 'null no longer resolves to MAIN');
assert(resolveRoomCode('testb') === 'TESTB', 'non-blank still normalizes');

var serverSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
assert(serverSrc.indexOf("DEFAULT_ROOM_CODE = 'MAIN'") >= 0, 'server defines MAIN constant');
assert(serverSrc.indexOf('function resolveRoomCode') >= 0, 'server resolveRoomCode helper');
assert(serverSrc.indexOf('PRODUCTION_PUBLIC_URL') >= 0, 'server defines production public URL');
assert(serverSrc.indexOf('qwerty-game.onrender.com') >= 0, 'server knows Render public host');
assert(serverSrc.indexOf('never MAIN') >= 0 || serverSrc.indexOf('Never MAIN') >= 0 || serverSrc.indexOf('always mint a private') >= 0, 'blank create mints private code');
assert(serverSrc.indexOf('Please pick a unique room code instead of MAIN') >= 0, 'create rejects MAIN');

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
var roomC = createIsolatedRoom('K7MP2Q', function () {
  return 0.05;
});

assert(rooms.size === 3, 'three private rooms coexist');
assert(roomA.state !== roomB.state, 'rooms hold distinct state objects');
assert(roomC.state !== roomA.state, 'third room state is distinct');

roomA.state.scores[0] = 999;
roomA.state.board[0] = { letter: 'Q', owner: 0 };
assert(roomB.state.scores[0] === 0, 'mutating room A scores does not affect room B');
assert(!roomB.state.board[0], 'mutating room A board does not affect room B');
assert(roomC.state.scores[0] === 0, 'mutating room A does not affect room C');

var viewA = engine.getClientView(roomA.state, 0);
var viewB = engine.getClientView(roomB.state, 0);
assert(viewA.scores[0] === 999, 'client view A sees its own score');
assert(viewB.scores[0] === 0, 'client view B stays isolated');

var gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
assert(gameSrc.indexOf('PRODUCTION_SHARE_ORIGIN') >= 0, 'client defines production share origin');
assert(gameSrc.indexOf('isPrivateOrLocalHostUrl') >= 0, 'client rejects private LAN share URLs');
assert(gameSrc.indexOf('makeSuggestedRoomCode') >= 0, 'client can suggest unique codes');

if (fail) {
  console.error('\n' + fail + ' failure(s)');
  process.exit(1);
}
console.log('\nAll room isolation checks passed.');
console.log('Also run: node server/test-multi-room-ws.js');
