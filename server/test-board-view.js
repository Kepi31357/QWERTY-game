'use strict';

/**
 * Build 223 — guest 180° position helpers.
 * Run: node server/test-board-view.js
 */

var boardView = require('../board-view.js');
var engine = require('../game-engine.js');

var COLS = engine.COLS;
var ROWS = engine.ROWS;
var START_P1_IDX = (ROWS - 1) * COLS;
var START_P2_IDX = COLS - 1;

var rt0 = boardView.assertRoundTrip(0, ROWS, COLS);
if (!rt0.ok) {
  console.error('FAIL host round-trip', rt0);
  process.exit(1);
}
var rt1 = boardView.assertRoundTrip(1, ROWS, COLS);
if (!rt1.ok) {
  console.error('FAIL guest round-trip', rt1);
  process.exit(1);
}
if (!boardView.viewerNeedsFlip(1)) {
  console.error('FAIL guest must flip');
  process.exit(1);
}
console.log('OK round-trips; guest flip on');

var p2 = boardView.rowColFromIdx(START_P2_IDX, COLS);
var p2v = boardView.getVisualPosition(1, p2, ROWS, COLS);
if (p2v.row !== ROWS - 1 || p2v.col !== 0) {
  console.error('FAIL P2 start must be guest visual BL', p2v);
  process.exit(1);
}
var p1 = boardView.rowColFromIdx(START_P1_IDX, COLS);
var p1v = boardView.getVisualPosition(0, p1, ROWS, COLS);
if (p1v.row !== ROWS - 1 || p1v.col !== 0) {
  console.error('FAIL P1 start must stay bottom-left for host', p1v);
  process.exit(1);
}
console.log('OK host P1 BL; guest P2 visual BL');

var click = boardView.logicalIdxFromVisualRowCol(1, ROWS - 1, 0, ROWS, COLS);
if (click !== START_P2_IDX) {
  console.error('FAIL guest BL click maps to P2 start', click);
  process.exit(1);
}
console.log('OK guest visual BL click → START_P2');
console.log('All board-view flip tests passed.');
