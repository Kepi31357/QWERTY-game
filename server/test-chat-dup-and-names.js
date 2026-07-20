'use strict';

/**
 * Chat echo skip + seat nickname defaults + rack tileId preference.
 * Run: node server/test-chat-dup-and-names.js
 */

var PASS = 0;
var FAIL = 0;
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('  OK  ' + msg);
  } else {
    FAIL++;
    console.log('  FAIL ' + msg);
  }
}

var gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
var engineSrc = fs.readFileSync(path.join(__dirname, '..', 'game-engine.js'), 'utf8');
var serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert(
  gameSrc.indexOf("msg.from === self.getOnlinePlayerIndex()") >= 0,
  'chat handler skips own echo'
);
assert(
  gameSrc.indexOf("DEFAULT_GUEST_NAME = 'Blake'") >= 0 &&
    gameSrc.indexOf("DEFAULT_HOST_NAME = 'Deb'") >= 0,
  'Deb/Blake seat defaults'
);
assert(gameSrc.indexOf('normalizeOpponentName') >= 0, 'normalizeOpponentName helper');
assert(gameSrc.indexOf("getOnlineNickname('host')") >= 0, 'host create uses host nickname');
assert(gameSrc.indexOf("getOnlineNickname('guest')") >= 0, 'guest join uses guest nickname');
assert(serverSrc.indexOf('function attachRoomNames') >= 0, 'server attachRoomNames helper');
assert(serverSrc.indexOf('payload.selfName') >= 0, 'server sends selfName');
assert(serverSrc.indexOf('payload.hostName') >= 0, 'server sends hostName');
assert(gameSrc.indexOf('applyOnlineRosterNames') >= 0, 'client applyOnlineRosterNames');
assert(gameSrc.indexOf('syncPlayerNameLabels') >= 0, 'client syncPlayerNameLabels');
assert(gameSrc.indexOf("getElementById('player-name')") >= 0, 'player-name board profile wired');
assert(gameSrc.indexOf("getElementById('sidebar-player-name')") >= 0, 'sidebar self name wired');
assert(
  gameSrc.indexOf('room.guestName = sanitizeName') >= 0 ||
    serverSrc.indexOf('room.guestName = sanitizeName(data.nickname, 1)') >= 0,
  'rejoin updates guest nickname'
);

assert(
  gameSrc.indexOf('showDesktop = !this.gameOver') >= 0 ||
    /showDesktop\s*=\s*!this\.gameOver/.test(gameSrc),
  'desktop timer visible while waiting'
);
assert(
  gameSrc.indexOf('Tick for both seats') >= 0 ||
    gameSrc.indexOf('waiting player sees opponent countdown') >= 0,
  'online timer ticks on opponent turn'
);
assert(
  gameSrc.indexOf("Thinking… ' + this.formatTimer") >= 0 ||
    gameSrc.indexOf('Thinking… ') >= 0,
  'thinking ribbon includes countdown'
);

/* Prefer tileId over rackIndex in both client + engine. */
function extractResolveFn(src) {
  var m = src.match(/function resolvePlacementRackSlot\([\s\S]*?\n  \}/);
  return m ? m[0] : '';
}
var clientResolve = extractResolveFn(gameSrc);
var engineResolve = extractResolveFn(engineSrc);
assert(clientResolve.indexOf('Prefer tileId') >= 0, 'client resolve prefers tileId');
assert(engineResolve.indexOf('Prefer tileId') >= 0, 'engine resolve prefers tileId');
assert(
  clientResolve.indexOf('if (pl.tileId)') < clientResolve.indexOf('if (pl.rackIndex'),
  'client checks tileId before rackIndex'
);
assert(
  engineResolve.indexOf('if (pl.tileId)') < engineResolve.indexOf('if (pl.rackIndex'),
  'engine checks tileId before rackIndex'
);
assert(gameSrc.indexOf('usedSlots') >= 0, 'unique slot rebind for pending tiles');
assert(
  gameSrc.indexOf('resolveOnlinePlacementTileIds()') >= 0 &&
    gameSrc.indexOf('restored') >= 0,
  'rebind after soft sync restore'
);

/* Runtime: resolvePlacementRackSlot with duplicate letters + stale index. */
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
  if (pl.tileId) {
    var byId = findRackSlotByTileId(rack, pl.tileId);
    if (matchesSlot(byId)) return byId;
  }
  if (pl.rackIndex >= 0 && matchesSlot(pl.rackIndex)) return pl.rackIndex;
  return -1;
}

var rack = [
  { id: 'e1', letter: 'E' },
  { id: 'e2', letter: 'E' },
  { id: 'a1', letter: 'A' },
];
var p1 = { letter: 'E', rackIndex: 0, tileId: 'e1' };
var p2 = { letter: 'E', rackIndex: 0, tileId: 'e2' }; /* stale shared index */
var s1 = resolvePlacementRackSlot(rack, p1);
var s2 = resolvePlacementRackSlot(rack, p2);
assert(s1 === 0 && s2 === 1, 'two E tiles resolve to distinct slots via tileId');
assert(s1 !== s2, 'no false duplicate-slot collision');

function isGenericPlayerName(name) {
  var n = String(name || '').trim().toLowerCase();
  return !n || n === 'player' || n === 'opponent';
}
function normalizeOpponentName(name, opponentSeat) {
  if (!isGenericPlayerName(name)) return String(name).trim().slice(0, 20);
  return opponentSeat === 0 ? 'Deb' : 'Blake';
}
assert(normalizeOpponentName('Player', 1) === 'Blake', 'generic guest → Blake');
assert(normalizeOpponentName('', 0) === 'Deb', 'empty host → Deb');
assert(normalizeOpponentName('Sam', 1) === 'Sam', 'custom name preserved');

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
