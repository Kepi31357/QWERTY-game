'use strict';

/**
 * Opponent bingo reconstruction + banner naming.
 * Run: node server/test-bingo-both-seats.js
 */

var fail = 0;
function assert(cond, msg) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg);
  } else {
    console.log('OK', msg);
  }
}

var BINGO_BONUS = 100;
var LINK_BONUS = 75;
var STAR_BONUS = 50;
var RACK_SIZE = 8;
var TILE_POINTS = 10;

function inferBonuses(word, score, placedLen) {
  var main = String(word || '').toUpperCase();
  var letterScore = main.length * TILE_POINTS;
  var total = Number(score) || 0;
  var rem = Math.max(0, total - letterScore);
  var linkBonus = 0;
  var bingoPoints = 0;
  var starsCaptured = 0;
  var starPoints = 0;
  var placed = { length: placedLen };

  if (rem >= BINGO_BONUS) {
    var afterBingo = rem - BINGO_BONUS;
    var bingoShaped =
      afterBingo === 0 ||
      afterBingo === LINK_BONUS ||
      afterBingo % STAR_BONUS === 0 ||
      (afterBingo > LINK_BONUS && (afterBingo - LINK_BONUS) % STAR_BONUS === 0);
    var likelyBingo =
      placed.length >= RACK_SIZE ||
      (main && main.length >= RACK_SIZE) ||
      (placed.length === 0 && main && main.length >= RACK_SIZE);
    if (bingoShaped && likelyBingo) {
      bingoPoints = BINGO_BONUS;
      rem -= BINGO_BONUS;
    }
  }
  if (rem >= LINK_BONUS) {
    var afterLink = rem - LINK_BONUS;
    if (afterLink === 0 || afterLink % STAR_BONUS === 0) {
      linkBonus = LINK_BONUS;
      rem -= LINK_BONUS;
    }
  }
  if (rem >= STAR_BONUS) {
    starsCaptured = Math.floor(rem / STAR_BONUS);
    starPoints = starsCaptured * STAR_BONUS;
  }
  return { bingoPoints: bingoPoints, linkBonus: linkBonus, starPoints: starPoints, starsCaptured: starsCaptured };
}

/* MEDICINE 80 + bingo 100 = 180 — opponent often has placedLen 0 or 8 */
var a = inferBonuses('MEDICINE', 180, 0);
assert(a.bingoPoints === 100, 'MEDICINE +180 with unknown placed → bingo not star');
assert(a.starPoints === 0, 'no star mislabel');

var b = inferBonuses('MEDICINE', 180, 8);
assert(b.bingoPoints === 100, 'MEDICINE +180 with 8 cells → bingo');

var c = inferBonuses('MEDICINE', 180, 3);
assert(c.bingoPoints === 100, 'MEDICINE length >= rack → bingo even if placedLen 3');

/* rem===100 alone must not invent bingo (two stars / word-total coincidence) */
var d = inferBonuses('BAKE', 150, 4);
assert(d.bingoPoints === 0, 'short word + rem 100 is not bingo');
assert(d.starPoints === 100, 'rem 100 attributed to two stars instead');

/* Merge server flags wins */
function merge(obs, msg) {
  if (msg.bingo != null) obs.bingo = !!msg.bingo;
  if (msg.bingoPoints != null) obs.bingoPoints = msg.bingoPoints;
  if (obs.bingoPoints > 0) obs.bingo = true;
  return obs;
}
var merged = merge({ bingo: false, bingoPoints: 0, starPoints: 100 }, { bingo: true, bingoPoints: 100 });
assert(merged.bingo === true && merged.bingoPoints === 100, 'server bingo flags override inference');

function bingoTitle(whoLabel) {
  var who = whoLabel ? String(whoLabel).trim() : '';
  var isSelf = !who || /^you$/i.test(who);
  if (isSelf) return 'BINGO!';
  return who.toUpperCase() + ' · BINGO!';
}
assert(bingoTitle('') === 'BINGO!', 'active seat title');
assert(bingoTitle('Deb') === 'DEB · BINGO!', 'opponent seat title');
assert(bingoTitle('You') === 'BINGO!', 'You treated as self');

if (fail) process.exit(1);
console.log('All bingo both-seats tests passed.');
