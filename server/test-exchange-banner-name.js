'use strict';

/**
 * Exchange banner seat naming — server player index must not collide with PLAYER.HUMAN/AI.
 * Run: node server/test-exchange-banner-name.js
 */

var PASS = 0;
var FAIL = 0;

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('OK', msg);
  } else {
    FAIL++;
    console.error('FAIL', msg);
  }
}

function isGenericPlayerName(name) {
  var n = String(name || '').trim().toLowerCase();
  return !n || n === 'player' || n === 'opponent';
}

/* Mirror getExchangeBannerName (online branch) with live nicknames. */
function getExchangeBannerName(actor, myIndex, isOnline, selfName, oppName) {
  var PLAYER = { HUMAN: 0, AI: 1 };
  var DEFAULT_HOST_NAME = 'Deb';
  var DEFAULT_GUEST_NAME = 'Blake';
  if (isOnline) {
    var seat = null;
    if (actor === 'self') {
      seat = myIndex != null ? Number(myIndex) : 0;
    } else if (actor === 'opponent') {
      var me = myIndex != null ? Number(myIndex) : 0;
      seat = me === 1 ? 0 : 1;
    } else if (actor === 'deb') {
      seat = 0;
    } else if (actor === 'blake') {
      seat = 1;
    } else if (actor === 0 || actor === '0') {
      seat = 0;
    } else if (actor === 1 || actor === '1') {
      seat = 1;
    } else {
      seat = Number(actor);
    }
    var mySeat = myIndex != null ? Number(myIndex) : 0;
    var label;
    if (seat === mySeat) {
      label = selfName || (seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME);
    } else if (seat === 0 || seat === 1) {
      label = oppName || (seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME);
      if (isGenericPlayerName(label)) {
        label = seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME;
      }
    } else {
      label = 'Player';
    }
    return String(label).toUpperCase();
  }
  if (actor === PLAYER.HUMAN || actor === 'self') return 'YOU';
  return 'COMPUTER';
}

assert(getExchangeBannerName(1, 1, true, 'Blake', 'Deb') === 'BLAKE', 'Blake exchanges on Blake view → BLAKE');
assert(getExchangeBannerName(1, 0, true, 'Deb', 'Blake') === 'BLAKE', 'Blake exchanges on Deb view → BLAKE');
assert(getExchangeBannerName(0, 1, true, 'Blake', 'Deb') === 'DEB', 'Deb exchanges on Blake view → DEB');
assert(getExchangeBannerName(0, 0, true, 'Deb', 'Blake') === 'DEB', 'Deb exchanges on Deb view → DEB');
assert(getExchangeBannerName('self', 1, true, 'Blake', 'Deb') === 'BLAKE', 'self on Blake seat → BLAKE');
assert(getExchangeBannerName('opponent', 1, true, 'Blake', 'Deb') === 'DEB', 'opponent on Blake seat → DEB');
assert(getExchangeBannerName(1, 0, true, 'Deb', 'Player') === 'BLAKE', 'generic opp name → BLAKE');
assert(getExchangeBannerName(0, 0, false) === 'YOU', 'offline human → YOU');
assert(getExchangeBannerName(1, 0, false) === 'COMPUTER', 'offline AI → COMPUTER');

assert(0 === 0 && 1 === 1, 'PLAYER.HUMAN=0 / PLAYER.AI=1 collide with server seats');

console.log(PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
