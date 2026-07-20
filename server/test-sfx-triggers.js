/**
 * Sound-effect trigger wiring + /sounds/*.mp3 paths.
 * Run: node server/test-sfx-triggers.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  OK  ' + msg);
}

var src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
var serverSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
var soundsDir = path.join(__dirname, '..', 'public', 'sounds');

assert(src.indexOf("introduction: 'introduction3.mp3'") >= 0, 'intro maps to introduction3.mp3');
assert(src.indexOf("connection: 'connection.mp3'") >= 0, 'connection maps to connection.mp3');
assert(src.indexOf("submit: 'wordplayed.mp3'") >= 0, 'submit maps to wordplayed.mp3');
assert(src.indexOf("place: 'swoosh.mp3'") >= 0, 'place maps to swoosh.mp3');
assert(src.indexOf("bingo: 'rackemptiedbonus.mp3'") >= 0, 'bingo maps to rackemptiedbonus.mp3');
assert(src.indexOf("end: 'end.mp3'") >= 0, 'end maps to end.mp3');

assert(fs.existsSync(path.join(soundsDir, 'introduction3.mp3')), 'introduction3.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'connection.mp3')), 'connection.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'wordplayed.mp3')), 'wordplayed.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'swoosh.mp3')), 'swoosh.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'rackemptiedbonus.mp3')), 'rackemptiedbonus.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'end.mp3')), 'end.mp3 installed');
assert(fs.existsSync(path.join(soundsDir, 'exchange.mp3')), 'exchange.mp3 installed');

assert(src.indexOf("playSfx('introduction')") >= 0, 'introduction plays on online game start');
assert(src.indexOf("playSfx('submit')") >= 0, 'submit trigger wired');
assert(src.indexOf("playSfx('connection')") >= 0, 'connection trigger wired');
assert(src.indexOf("playSfx('place')") >= 0, 'place trigger wired');
assert(src.indexOf("playSfx('error')") >= 0, 'error trigger wired');
assert(src.indexOf("playSfx('bingo')") >= 0, 'bingo trigger wired');
assert(src.indexOf("playSfx('exchange')") >= 0, 'exchange trigger wired');
var exchIdx = src.indexOf('exchangeTiles() {');
assert(exchIdx >= 0, 'exchangeTiles exists');
var exchBody = src.slice(exchIdx, exchIdx + 2200);
assert(exchBody.indexOf("playSfx('exchange')") >= 0, 'exchange plays on Confirm Exchange');
assert(
  src.indexOf('Local confirm already played exchange SFX') >= 0,
  'self exchange does not double-play on banner'
);
assert(src.indexOf("playSfx('end')") >= 0, 'end trigger wired');
assert(src.indexOf("playSfx('tick')") >= 0, 'tick trigger wired');

var placeIdx = src.indexOf('placePendingFromDrag(drag, idx)');
assert(placeIdx >= 0, 'placePendingFromDrag exists');
var placeBody = src.slice(placeIdx, placeIdx + 1400);
assert(placeBody.indexOf("playSfx('place')") >= 0, 'tile drop plays place SFX');

assert(serverSrc.indexOf('PUBLIC_DIR') >= 0, 'server has PUBLIC_DIR');
assert(serverSrc.indexOf('resolveStaticPath') >= 0, 'server resolves public/ first');

var fxIdx = src.indexOf('startScoreFx(scoreResult, mainLabel, opts)');
assert(fxIdx >= 0, 'startScoreFx exists');
var fxBody = src.slice(fxIdx, fxIdx + 3200);
assert(fxBody.indexOf('do not also play wordplayed') >= 0, 'connection/bingo skip wordplayed');
assert(fxBody.indexOf("playSfx('submit')") >= 0, 'non-connect plays still use submit/wordplayed');

console.log('All SFX trigger tests passed.');
