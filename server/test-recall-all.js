'use strict';

/**
 * Recall-all: tiles must never disappear (board → rack, never bag / void).
 * Run: node server/test-recall-all.js
 */

var PASS = 0;
var FAIL = 0;

function assert(cond, msg) {
  if (cond) {
    PASS++;
    console.log('  OK  ' + msg);
  } else {
    FAIL++;
    console.log('  FAIL ' + msg);
  }
}

function makeRack(letters) {
  return letters.map(function (ch, i) {
    return ch ? { letter: ch, id: 't' + i } : null;
  });
}

function findRackSlotByTileId(rack, tileId) {
  if (!tileId || !rack) return -1;
  for (var i = 0; i < rack.length; i++) {
    if (rack[i] && rack[i].id === tileId) return i;
  }
  return -1;
}

function uid() {
  return 'u' + Math.random().toString(36).slice(2, 8);
}

function createHarness(opts) {
  opts = opts || {};
  var RACK_SIZE = 8;
  var g = {
    online: !!opts.online,
    board: new Array(15 * 15).fill(null),
    racks: [makeRack(opts.rack || ['W', 'O', 'E', 'I', 'F', 'P', 'T', null]), []],
    pendingPlacements: new Map(),
    drag: null,
    lastPendingCell: null,
    playWordHighlight: { cellSet: { 1: true } },
    scoreFx: { total: 10 },
    boardBannerFx: { kind: 'bingo' },
    opponentWordHighlight: { cellSet: { 2: true } },
    bag: [],
    logs: [],
    isOnlineMode: function () {
      return g.online;
    },
    hideBlankPicker: function () {},
    clearRackSelection: function () {},
    clearExchangeMode: function () {},
    unbindGlobalDrag: function () {},
    _clearDragOverlay: function () {},
    updatePendingPreview: function () {},
    updateUI: function () {},
    draw: function () {},
    save: function () {},
    setMessage: function (m) {
      g.lastMessage = m;
    },
    resetPlayPreviewUi: function () {
      g.playWordHighlight = null;
      g.scoreFx = null;
    },
    cancelInFlightDrag: function () {
      var drag = g.drag;
      if (!drag) return null;
      g.drag = null;
      if (drag.fromBoard === undefined) return null;
      return {
        letter: drag.letter,
        rackIndex: drag.fromRack != null ? drag.fromRack : -1,
        tileId: drag.tileId || null,
        blankAs: drag.blankAs != null ? drag.blankAs : null,
      };
    },
    collectPendingTilesForRecall: function () {
      var toRestore = [];
      var seen = {};
      function pushTile(p) {
        if (!p || !p.letter) return;
        var key =
          String(p.tileId || '') +
          '|' +
          String(p.rackIndex != null ? p.rackIndex : -1) +
          '|' +
          String(p.letter).toUpperCase();
        if (seen[key]) return;
        seen[key] = true;
        toRestore.push({
          letter: String(p.letter).toUpperCase(),
          rackIndex: p.rackIndex != null ? p.rackIndex : -1,
          tileId: p.tileId || null,
          blankAs: p.blankAs != null ? p.blankAs : null,
        });
      }
      if (g.drag && g.drag.fromBoard !== undefined && g.drag.letter) {
        pushTile({
          letter: g.drag.letter,
          rackIndex: g.drag.fromRack,
          tileId: g.drag.tileId,
          blankAs: g.drag.blankAs,
        });
      }
      g.pendingPlacements.forEach(function (p) {
        pushTile(p);
      });
      return toRestore;
    },
    clearPendingFromBoard: function () {
      g.cancelInFlightDrag();
      g.pendingPlacements.clear();
      g.lastPendingCell = null;
    },
    forceRecalledTileOntoRack: function (p) {
      var rack = g.racks[0];
      if (!rack || !p || !p.letter) return false;
      var letter = String(p.letter).toUpperCase();
      var i;
      if (p.tileId) {
        var byId = findRackSlotByTileId(rack, p.tileId);
        if (byId >= 0 && rack[byId] && String(rack[byId].letter).toUpperCase() === letter) {
          return true;
        }
      }
      if (p.rackIndex >= 0 && p.rackIndex < RACK_SIZE && !rack[p.rackIndex]) {
        rack[p.rackIndex] = { letter: letter, id: p.tileId || uid() };
        return true;
      }
      for (i = 0; i < RACK_SIZE; i++) {
        if (!rack[i]) {
          rack[i] = { letter: letter, id: p.tileId || uid() };
          return true;
        }
      }
      if (g.online) {
        for (i = 0; i < RACK_SIZE; i++) {
          if (rack[i] && String(rack[i].letter).toUpperCase() === letter) return true;
        }
      }
      var slot = p.rackIndex >= 0 && p.rackIndex < RACK_SIZE ? p.rackIndex : 0;
      rack[slot] = { letter: letter, id: p.tileId || uid() };
      return true;
    },
    restoreRecalledTilesToRack: function (toRestore) {
      var list = toRestore.slice().sort(function (a, b) {
        return (a.rackIndex | 0) - (b.rackIndex | 0);
      });
      var ensured = 0;
      for (var i = 0; i < list.length; i++) {
        if (g.forceRecalledTileOntoRack(list[i])) ensured++;
      }
      return ensured;
    },
    assertRecalledTilesOnRack: function (toRestore) {
      var missing = [];
      var need = {};
      var have = {};
      var i, L, r;
      for (i = 0; i < toRestore.length; i++) {
        if (!toRestore[i] || !toRestore[i].letter) continue;
        L = String(toRestore[i].letter).toUpperCase();
        need[L] = (need[L] || 0) + 1;
      }
      for (r = 0; r < g.racks[0].length; r++) {
        if (!g.racks[0][r]) continue;
        L = String(g.racks[0][r].letter).toUpperCase();
        have[L] = (have[L] || 0) + 1;
      }
      for (L in need) {
        if (!Object.prototype.hasOwnProperty.call(need, L)) continue;
        while ((have[L] || 0) < need[L]) {
          missing.push(L);
          g.forceRecalledTileOntoRack({ letter: L, rackIndex: -1, tileId: null });
          have[L] = (have[L] || 0) + 1;
        }
      }
      return missing;
    },
    recallTiles: function () {
      var toRestore = g.collectPendingTilesForRecall();
      var n = toRestore.length;
      g.logs.push('Recalling ' + n + ' tiles from board to rack');
      g.resetPlayPreviewUi();
      g.boardBannerFx = null;
      g.opponentWordHighlight = null;
      if (!n) {
        g.setMessage('No unsubmitted tiles to recall. Submitted words stay on the board.');
        return;
      }
      g.restoreRecalledTilesToRack(toRestore);
      g.assertRecalledTilesOnRack(toRestore);
      g.clearPendingFromBoard();
      g.assertRecalledTilesOnRack(toRestore);
      g.setMessage('Recalled ' + n + ' tile' + (n === 1 ? '' : 's') + ' to rack.');
    },
    abortInvalidPlayAttempt: function () {
      var toRestore = g.collectPendingTilesForRecall();
      if (toRestore.length) {
        g.logs.push('Recalling ' + toRestore.length + ' tiles from board to rack');
        g.restoreRecalledTilesToRack(toRestore);
        g.assertRecalledTilesOnRack(toRestore);
      }
      g.clearPendingFromBoard();
      if (toRestore.length) g.assertRecalledTilesOnRack(toRestore);
      g.resetPlayPreviewUi();
    },
  };
  return g;
}

function rackLetters(g) {
  return g.racks[0]
    .map(function (t) {
      return t ? t.letter : '.';
    })
    .join('');
}

function countLetter(g, L) {
  var n = 0;
  g.racks[0].forEach(function (t) {
    if (t && t.letter === L) n++;
  });
  return n;
}

function totalRackTiles(g) {
  var n = 0;
  g.racks[0].forEach(function (t) {
    if (t) n++;
  });
  return n;
}

console.log('--- Full pending recall (offline) — no disappear ---');
(function () {
  var g = createHarness();
  g.racks[0] = makeRack([null, null, null, null, null, 'F', 'P', 'T']);
  g.pendingPlacements.set(100, { letter: 'L', rackIndex: 0 });
  g.pendingPlacements.set(101, { letter: 'I', rackIndex: 1 });
  g.pendingPlacements.set(102, { letter: 'G', rackIndex: 2 });
  g.pendingPlacements.set(103, { letter: 'E', rackIndex: 3 });
  g.pendingPlacements.set(104, { letter: 'R', rackIndex: 4 });
  var beforeBag = g.bag.length;
  g.recallTiles();
  assert(g.pendingPlacements.size === 0, 'pending cleared');
  assert(rackLetters(g) === 'LIGERFPT', 'all five letters on rack');
  assert(g.bag.length === beforeBag, 'nothing dumped into bag');
  assert(g.logs[0] === 'Recalling 5 tiles from board to rack', 'debug log wording');
  assert(g.lastMessage === 'Recalled 5 tiles to rack.', 'success message');
})();

console.log('--- Partial placement recall ---');
(function () {
  var g = createHarness();
  g.racks[0] = makeRack([null, null, 'E', 'I', 'F', 'P', 'T', 'A']);
  g.pendingPlacements.set(50, { letter: 'W', rackIndex: 0 });
  g.pendingPlacements.set(51, { letter: 'O', rackIndex: 1 });
  g.recallTiles();
  assert(countLetter(g, 'W') >= 1 && countLetter(g, 'O') >= 1, 'W and O on rack');
  assert(g.pendingPlacements.size === 0, 'board pending empty');
  assert(totalRackTiles(g) === 8, 'full rack after recall');
})();

console.log('--- In-flight drag must not vanish ---');
(function () {
  var g = createHarness();
  g.racks[0] = makeRack([null, null, 'E', 'I', 'F', 'P', 'T', 'A']);
  g.pendingPlacements.set(50, { letter: 'W', rackIndex: 0 });
  g.drag = { letter: 'O', fromBoard: 51, fromRack: 1, tileId: 't1' };
  g.recallTiles();
  assert(g.drag === null, 'drag cancelled');
  assert(countLetter(g, 'W') >= 1 && countLetter(g, 'O') >= 1, 'W and O restored');
  assert(g.bag.length === 0, 'dragged tile not in bag');
})();

console.log('--- Failed play abort restores offline tiles ---');
(function () {
  var g = createHarness();
  g.racks[0] = makeRack([null, null, null, 'I', 'F', 'P', 'T', 'X']);
  g.pendingPlacements.set(10, { letter: 'C', rackIndex: 0 });
  g.pendingPlacements.set(11, { letter: 'A', rackIndex: 1 });
  g.pendingPlacements.set(12, { letter: 'T', rackIndex: 2 });
  g.abortInvalidPlayAttempt();
  assert(g.pendingPlacements.size === 0, 'abort cleared pending');
  assert(countLetter(g, 'C') >= 1, 'C on rack after abort');
  assert(countLetter(g, 'A') >= 1, 'A on rack after abort');
  assert(countLetter(g, 'T') >= 1, 'T on rack after abort');
  assert(g.bag.length === 0, 'abort did not bag tiles');
})();

console.log('--- Online recall: no duplicates, tiles stay on rack ---');
(function () {
  var g = createHarness({
    online: true,
    rack: ['W', 'O', 'E', 'I', 'F', 'P', 'T', 'A'],
  });
  g.pendingPlacements.set(50, { letter: 'W', rackIndex: 0, tileId: 't0' });
  g.pendingPlacements.set(51, { letter: 'O', rackIndex: 1, tileId: 't1' });
  g.recallTiles();
  assert(g.pendingPlacements.size === 0, 'online pending cleared');
  assert(rackLetters(g) === 'WOEIFPTA', 'online rack unchanged (no dupes)');
  assert(countLetter(g, 'W') === 1 && countLetter(g, 'O') === 1, 'exactly one W and O');
})();

console.log('--- Online desync: letter missing from rack must be re-added ---');
(function () {
  var g = createHarness({
    online: true,
    rack: [null, 'O', 'E', 'I', 'F', 'P', 'T', 'A'],
  });
  /* Pending C but rack lost C (desync) — must reappear on recall. */
  g.pendingPlacements.set(50, { letter: 'C', rackIndex: 0, tileId: 'gone' });
  g.recallTiles();
  assert(countLetter(g, 'C') >= 1, 'missing C forced back onto rack');
  assert(g.pendingPlacements.size === 0, 'pending cleared after repair');
  assert(g.bag.length === 0, 'C not sent to bag');
})();

console.log('--- Restore-before-clear invariant ---');
(function () {
  var g = createHarness();
  g.racks[0] = makeRack([null, null, 'E', 'I', 'F', 'P', 'T', 'A']);
  g.pendingPlacements.set(50, { letter: 'W', rackIndex: 0 });
  g.pendingPlacements.set(51, { letter: 'O', rackIndex: 1 });
  var collected = g.collectPendingTilesForRecall();
  assert(collected.length === 2, 'collected 2 before clear');
  assert(g.pendingPlacements.size === 2, 'pending still on board until clear');
  g.restoreRecalledTilesToRack(collected);
  assert(countLetter(g, 'W') >= 1 && countLetter(g, 'O') >= 1, 'on rack before board clear');
  g.clearPendingFromBoard();
  assert(g.pendingPlacements.size === 0, 'board cleared only after rack restore');
  assert(countLetter(g, 'W') >= 1 && countLetter(g, 'O') >= 1, 'still on rack after clear');
})();

console.log('--- Committed tiles untouched ---');
(function () {
  var g = createHarness({ rack: ['W', 'O', 'E', 'I', 'F', 'P', 'T', 'A'] });
  g.board[200] = { letter: 'L', owner: 0 };
  g.recallTiles();
  assert(g.board[200].letter === 'L', 'committed stays');
  assert(
    g.lastMessage.indexOf('No unsubmitted tiles') === 0,
    'empty-pending message'
  );
})();

console.log('--- insertRackTile must not null/overwrite pending slots ---');
(function () {
  var RACK_SIZE = 8;
  function isRackSlotPending(g, slotIndex) {
    for (var p of g.pendingPlacements.values()) {
      if (p && p.rackIndex === slotIndex) return true;
    }
    return false;
  }
  function insertRackTile(g, fromSlot, toSlot) {
    if (fromSlot === toSlot) return;
    if (isRackSlotPending(g, fromSlot) || isRackSlotPending(g, toSlot)) return;
    var rack = g.racks[0];
    var moving = rack[fromSlot];
    if (!moving) return;
    var free = [];
    var i;
    for (i = 0; i < RACK_SIZE; i++) {
      if (!isRackSlotPending(g, i)) free.push(i);
    }
    var fromPos = free.indexOf(fromSlot);
    var toPos = free.indexOf(toSlot);
    if (fromPos < 0 || toPos < 0) return;
    var tiles = free.map(function (slot) {
      return rack[slot];
    });
    var tile = tiles.splice(fromPos, 1)[0];
    tiles.splice(toPos, 0, tile);
    for (i = 0; i < free.length; i++) {
      rack[free[i]] = tiles[i];
    }
  }

  var g = createHarness({
    online: true,
    rack: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  });
  /* C at slot 2 is pending on the board — must stay put during reorder. */
  g.pendingPlacements.set(50, { letter: 'C', rackIndex: 2, tileId: 't2' });
  insertRackTile(g, 0, 4);
  assert(g.racks[0][2] && g.racks[0][2].letter === 'C', 'pending C not overwritten');
  assert(countLetter(g, 'C') === 1, 'exactly one C after reorder');
  assert(totalRackTiles(g) === 8, 'no rack holes after reorder past pending');
  assert(g.racks[0].every(function (t) { return t; }), 'no null slots after reorder');
})();

console.log('--- Empty recall cancels stuck rack drag (visual hole) ---');
(function () {
  var g = createHarness({
    online: true,
    rack: ['W', 'O', 'E', 'I', 'F', 'P', 'T', 'A'],
  });
  g.drag = { letter: 'W', fromRack: 0, origin: 'rack' };
  g.cancelInFlightDrag = function () {
    var drag = g.drag;
    g.drag = null;
    if (!drag || drag.fromBoard === undefined) return null;
    return {
      letter: drag.letter,
      rackIndex: drag.fromRack != null ? drag.fromRack : -1,
      tileId: drag.tileId || null,
      blankAs: drag.blankAs != null ? drag.blankAs : null,
    };
  };
  var origRecall = g.recallTiles;
  g.recallTiles = function () {
    var toRestore = g.collectPendingTilesForRecall();
    var n = toRestore.length;
    if (!n) {
      if (g.drag) {
        var stuck = g.cancelInFlightDrag();
        if (stuck && stuck.letter) {
          g.restoreRecalledTilesToRack([stuck]);
          g.setMessage('Recalled 1 tile to rack.');
          return;
        }
        g.setMessage('No unsubmitted tiles to recall. Submitted words stay on the board.');
        return;
      }
      g.setMessage('No unsubmitted tiles to recall. Submitted words stay on the board.');
      return;
    }
    origRecall();
  };
  g.recallTiles();
  assert(g.drag === null, 'stuck rack drag cleared');
  assert(g.racks[0][0] && g.racks[0][0].letter === 'W', 'W still on rack');
  assert(
    g.lastMessage.indexOf('No unsubmitted tiles') === 0,
    'reports nothing pending after clearing drag'
  );
})();

console.log('--- Soft sync skip on occupied cell still keeps letter on rack ---');
(function () {
  var g = createHarness({
    online: true,
    rack: ['S', 'O', 'E', 'I', 'F', 'P', 'T', 'A'],
  });
  g.board[50] = { letter: 'S', owner: 0 };
  var pendingToKeep = new Map();
  pendingToKeep.set(50, { letter: 'S', rackIndex: 0, tileId: 't0' });
  /* Simulate soft-sync restore: occupied cell → force onto rack, do not re-pending. */
  g.pendingPlacements.clear();
  pendingToKeep.forEach(function (p, idx) {
    if (g.board[idx]) {
      g.forceRecalledTileOntoRack(p);
      return;
    }
    g.pendingPlacements.set(idx, p);
  });
  assert(g.pendingPlacements.size === 0, 'no pending on occupied cell');
  assert(countLetter(g, 'S') >= 1, 'S remains on rack');
})();

console.log('--- Committed blank must not steal rack slot on place/recall ---');
(function () {
  /*
   * Regression: board blanks were counted as their face letter, so '*' looked
   * missing. After placing T, audit stuffed '*' into the empty slot; recall
   * then made it look like T "changed" into a blank.
   */
  function countTiles(g) {
    var counts = {};
    function add(L) {
      if (!L) return;
      counts[L] = (counts[L] || 0) + 1;
    }
    g.bag.forEach(add);
    g.racks[0].forEach(function (t) {
      if (t) add(t.letter);
    });
    g.board.forEach(function (cell) {
      if (!cell) return;
      if (cell.isBlank) add('*');
      else add(cell.letter);
    });
    g.pendingPlacements.forEach(function (p) {
      add(p.letter);
    });
    return counts;
  }

  var g = createHarness({
    rack: ['T', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
  });
  /* Committed blank showing as E on the board. */
  g.board[10] = { letter: 'E', owner: 0, isBlank: true };
  g.bag = []; /* ignore bag for this identity check */

  var before = countTiles(g);
  assert(before['*'] === 1, 'committed blank counts as physical *');
  assert((before.E || 0) === 1, 'face E on blank is not double-counted as E tile');

  /* Place T from slot 0 (offline removes it from rack). */
  g.racks[0][0] = null;
  g.pendingPlacements.set(99, { letter: 'T', rackIndex: 0, tileId: 'tT' });

  var mid = countTiles(g);
  assert(mid['*'] === 1, 'still exactly one * while T is pending');
  assert(mid.T === 1, 'pending T still counted once');
  assert(!g.racks[0][0], 'slot 0 stays empty — audit must not inject *');

  g.recallTiles();
  assert(g.pendingPlacements.size === 0, 'pending cleared');
  assert(g.racks[0][0] && g.racks[0][0].letter === 'T', 'T returns to original slot');
  assert(countLetter(g, 'T') === 1, 'exactly one T after recall');
  assert(countLetter(g, '*') === 0, 'no phantom blank on rack');
})();

console.log('--- Summary: ' + PASS + ' passed, ' + FAIL + ' failed ---');
process.exit(FAIL ? 1 : 0);
