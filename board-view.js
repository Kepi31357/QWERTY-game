/**
 * Shared fixed board (build 226).
 *
 * Logical board / validation / scoring / display: ALWAYS the same for both seats.
 *   row 0 = top, col 0 = left, idx = row * COLS + col
 *   P1 start = bottom-left (green), P2 start = top-right (amber)
 *
 * No per-viewer transforms. getVisualPosition / visualToLogical are identity.
 * applyReadableViewPaint is a no-op (cell-faithful display).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QWERTYBoardView = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VIEWER_FLIP = 1;

  /** Always false — shared fixed camera for host and guest. */
  function viewerNeedsFlip(viewerPlayerId) {
    return false;
  }

  function getVisualPosition(viewerPlayerId, logicalPos, boardHeight, boardWidth) {
    var row = logicalPos.row;
    var col = logicalPos.col;
    if (!viewerNeedsFlip(viewerPlayerId)) {
      return { row: row, col: col };
    }
    return {
      row: boardHeight - 1 - row,
      col: boardWidth - 1 - col,
    };
  }

  function visualToLogical(viewerPlayerId, visualPos, boardHeight, boardWidth) {
    return getLogicalPosition(viewerPlayerId, visualPos, boardHeight, boardWidth);
  }

  function getLogicalPosition(viewerPlayerId, visualPos, boardHeight, boardWidth) {
    var row = visualPos.row;
    var col = visualPos.col;
    if (!viewerNeedsFlip(viewerPlayerId)) {
      return { row: row, col: col };
    }
    return {
      row: boardHeight - 1 - row,
      col: boardWidth - 1 - col,
    };
  }

  function logicalIdx(row, col, boardWidth) {
    return row * boardWidth + col;
  }

  function rowColFromIdx(idx, boardWidth) {
    return {
      row: Math.floor(idx / boardWidth),
      col: idx % boardWidth,
    };
  }

  function visualIdxFromLogicalIdx(viewerPlayerId, logicalIndex, boardHeight, boardWidth) {
    var rc = rowColFromIdx(logicalIndex, boardWidth);
    var vis = getVisualPosition(viewerPlayerId, rc, boardHeight, boardWidth);
    return logicalIdx(vis.row, vis.col, boardWidth);
  }

  function logicalIdxFromVisualRowCol(viewerPlayerId, visualRow, visualCol, boardHeight, boardWidth) {
    var log = visualToLogical(
      viewerPlayerId,
      { row: visualRow, col: visualCol },
      boardHeight,
      boardWidth
    );
    return logicalIdx(log.row, log.col, boardWidth);
  }

  function visualRowColFromLogicalIdx(viewerPlayerId, logicalIndex, boardHeight, boardWidth) {
    var rc = rowColFromIdx(logicalIndex, boardWidth);
    var vis = getVisualPosition(viewerPlayerId, rc, boardHeight, boardWidth);
    return { vr: vis.row, vc: vis.col, row: vis.row, col: vis.col };
  }

  function defaultLetterAt(board, idx) {
    return board[idx] && board[idx].letter
      ? String(board[idx].letter).toUpperCase()
      : null;
  }

  function readLogicalHorizontal(board, row, col0, len, boardWidth, letterAt) {
    var at = letterAt || defaultLetterAt;
    var s = '';
    var c;
    for (c = 0; c < len; c++) {
      var ch = at(board, logicalIdx(row, col0 + c, boardWidth));
      if (!ch) return null;
      s += ch;
    }
    return s;
  }

  function readLogicalVertical(board, col, row0, len, boardWidth, letterAt) {
    var at = letterAt || defaultLetterAt;
    var s = '';
    var r;
    for (r = 0; r < len; r++) {
      var ch = at(board, logicalIdx(row0 + r, col, boardWidth));
      if (!ch) return null;
      s += ch;
    }
    return s;
  }

  function sortCellsVisual(viewerPlayerId, cells, alongRow, boardHeight, boardWidth) {
    return cells.slice().map(Number).sort(function (a, b) {
      var va = visualRowColFromLogicalIdx(viewerPlayerId, a, boardHeight, boardWidth);
      var vb = visualRowColFromLogicalIdx(viewerPlayerId, b, boardHeight, boardWidth);
      if (alongRow) return va.vc - vb.vc;
      return va.vr - vb.vr;
    });
  }

  function readVisualRun(board, viewerPlayerId, cells, alongRow, boardHeight, boardWidth, letterAt) {
    var at = letterAt || defaultLetterAt;
    var sorted = sortCellsVisual(viewerPlayerId, cells, alongRow, boardHeight, boardWidth);
    var s = '';
    var i;
    for (i = 0; i < sorted.length; i++) {
      var ch = at(board, sorted[i]);
      if (!ch) return { text: null, cells: sorted };
      s += ch;
    }
    return { text: s, cells: sorted };
  }

  function runIsHorizontal(cells, boardWidth) {
    if (!cells || cells.length < 2) return true;
    var row0 = Math.floor(Number(cells[0]) / boardWidth);
    return cells.every(function (idx) {
      return Math.floor(Number(idx) / boardWidth) === row0;
    });
  }

  function cellSetKey(cells) {
    return cells
      .slice()
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      })
      .join(',');
  }

  function reverseStr(s) {
    return String(s || '')
      .split('')
      .reverse()
      .join('');
  }

  /** Maximal letter runs on the logical board (H and V). */
  function collectBoardRuns(board, boardHeight, boardWidth, letterAt) {
    var at = letterAt || defaultLetterAt;
    var runs = [];
    var r, c, start, idx, ch;

    for (r = 0; r < boardHeight; r++) {
      c = 0;
      while (c < boardWidth) {
        idx = logicalIdx(r, c, boardWidth);
        if (!at(board, idx)) {
          c++;
          continue;
        }
        start = c;
        while (c < boardWidth && at(board, logicalIdx(r, c, boardWidth))) c++;
        if (c - start >= 2) {
          var cellsH = [];
          var wordH = '';
          for (var hc = start; hc < c; hc++) {
            cellsH.push(logicalIdx(r, hc, boardWidth));
            wordH += at(board, logicalIdx(r, hc, boardWidth));
          }
          runs.push({ cells: cellsH, logicalAsc: wordH, alongRow: true });
        }
      }
    }

    for (c = 0; c < boardWidth; c++) {
      r = 0;
      while (r < boardHeight) {
        idx = logicalIdx(r, c, boardWidth);
        if (!at(board, idx)) {
          r++;
          continue;
        }
        start = r;
        while (r < boardHeight && at(board, logicalIdx(r, c, boardWidth))) r++;
        if (r - start >= 2) {
          var cellsV = [];
          var wordV = '';
          for (var vr = start; vr < r; vr++) {
            cellsV.push(logicalIdx(vr, c, boardWidth));
            wordV += at(board, logicalIdx(vr, c, boardWidth));
          }
          runs.push({ cells: cellsV, logicalAsc: wordV, alongRow: false });
        }
      }
    }
    return runs;
  }

  /**
   * Display-only: make every word read LTR/TTB in this viewer's frame.
   * Uses acceptedRuns (canonical spellings) + board-scan fallback.
   * Commits each run atomically — never partial-paints a word.
   *
   * CRITICAL: letterFromOriginal must accept (board, idx) because collectBoardRuns
   * and defaultLetterAt call letterAt(board, idx). A one-arg version never paints.
   */
  function applyReadableViewPaint(displayBoard, viewerPlayerId, acceptedRuns, boardHeight, boardWidth) {
    /*
     * Display letter remapping breaks adjacency: the glyph you see beside a
     * cell is not the logical letter validation uses (SINE→SW/IE/NR). Keep
     * cell-faithful display; 180° flip alone moves cells, not letters.
     */
    return { paintedRuns: 0, skippedConflicts: 0, debug: [] };
    if (!displayBoard) {
      return { paintedRuns: 0, skippedConflicts: 0, debug: [] };
    }

    var original = {};
    var i;
    for (i = 0; i < displayBoard.length; i++) {
      if (displayBoard[i] && displayBoard[i].letter) {
        original[i] = String(displayBoard[i].letter).toUpperCase();
      }
    }

    function letterFromOriginal(_board, idx) {
      return original[idx] || null;
    }

    var acceptedByKey = {};
    var ar = acceptedRuns || [];
    for (i = 0; i < ar.length; i++) {
      if (!ar[i] || !ar[i].word || !ar[i].cells || ar[i].cells.length < 2) continue;
      acceptedByKey[cellSetKey(ar[i].cells)] = String(ar[i].word).toUpperCase();
    }

    var boardRuns = collectBoardRuns(displayBoard, boardHeight, boardWidth, letterFromOriginal);
    var jobs = [];
    var seenKeys = {};

    function enqueue(cells, alongRow, targetWord, source) {
      if (!cells || cells.length < 2 || !targetWord) return;
      if (cells.length !== targetWord.length) return;
      var key = cellSetKey(cells);
      if (seenKeys[key]) return;
      seenKeys[key] = true;
      jobs.push({
        cells: cells.map(Number),
        alongRow: !!alongRow,
        target: String(targetWord).toUpperCase(),
        source: source || '',
      });
    }

    /* Prefer acceptedRuns (handles toward-corner storage like NRUB→BURN). */
    for (i = 0; i < ar.length; i++) {
      if (!ar[i] || !ar[i].word || !ar[i].cells) continue;
      var cells = ar[i].cells.map(Number);
      enqueue(cells, runIsHorizontal(cells, boardWidth), ar[i].word, 'accepted');
    }

    /* Board-scan: fix any run that only looks reversed due to the 180° view. */
    for (i = 0; i < boardRuns.length; i++) {
      var br = boardRuns[i];
      var accepted = acceptedByKey[cellSetKey(br.cells)];
      var target = accepted || br.logicalAsc;
      enqueue(br.cells, br.alongRow, target, accepted ? 'accepted+scan' : 'scan');
    }

    jobs.sort(function (a, b) {
      return b.target.length - a.target.length;
    });

    var paintedRuns = 0;
    var skippedConflicts = 0;
    var debug = [];
    var committed = {}; /* idx -> letter already painted */

    for (i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var sorted = sortCellsVisual(
        viewerPlayerId,
        job.cells,
        job.alongRow,
        boardHeight,
        boardWidth
      );
      var visualRaw = '';
      var k;
      var ch;
      var ok = true;
      for (k = 0; k < sorted.length; k++) {
        ch = letterFromOriginal(displayBoard, sorted[k]);
        if (!ch) {
          ok = false;
          break;
        }
        visualRaw += ch;
      }
      if (!ok) continue;

      var entry = {
        target: job.target,
        visualRaw: visualRaw,
        visualAfter: visualRaw,
        source: job.source,
        painted: false,
      };

      if (visualRaw === job.target) {
        debug.push(entry);
        continue;
      }
      if (reverseStr(visualRaw) !== job.target) {
        entry.note = 'not-simple-reverse';
        debug.push(entry);
        continue;
      }

      /* Atomic: skip entire run if any cell already committed to a different letter. */
      var conflict = false;
      for (k = 0; k < sorted.length; k++) {
        var want = job.target.charAt(k);
        if (committed[sorted[k]] !== undefined && committed[sorted[k]] !== want) {
          conflict = true;
          break;
        }
      }
      if (conflict) {
        skippedConflicts++;
        entry.note = 'conflict-skip';
        debug.push(entry);
        continue;
      }

      for (k = 0; k < sorted.length; k++) {
        var idx = sorted[k];
        var letter = job.target.charAt(k);
        committed[idx] = letter;
        if (displayBoard[idx]) displayBoard[idx].letter = letter;
      }
      paintedRuns++;
      entry.painted = true;
      entry.visualAfter = job.target;
      debug.push(entry);
    }

    return {
      paintedRuns: paintedRuns,
      skippedConflicts: skippedConflicts,
      debug: debug,
    };
  }

  function buildViewerDisplayBoard(sourceBoard, viewerPlayerId, acceptedRuns, boardHeight, boardWidth) {
    var out = new Array(sourceBoard.length).fill(null);
    var i, cell;
    for (i = 0; i < sourceBoard.length; i++) {
      cell = sourceBoard[i];
      if (!cell) continue;
      out[i] = {
        letter: cell.letter,
        owner: cell.owner,
        isBlank: cell.isBlank,
      };
    }
    var stats = applyReadableViewPaint(
      out,
      viewerPlayerId,
      acceptedRuns,
      boardHeight,
      boardWidth
    );
    out._paintStats = stats;
    return out;
  }

  /**
   * Compare logical vs visual spellings for debugging a play.
   */
  function describeRunOrientation(logicalBoard, displayBoard, viewerPlayerId, cells, word, boardHeight, boardWidth) {
    var alongRow = runIsHorizontal(cells, boardWidth);
    var asc = cells
      .slice()
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
    var logicalAsc = '';
    var i;
    for (i = 0; i < asc.length; i++) {
      logicalAsc += defaultLetterAt(logicalBoard, asc[i]) || '?';
    }
    var raw = readVisualRun(
      logicalBoard,
      viewerPlayerId,
      cells,
      alongRow,
      boardHeight,
      boardWidth
    );
    var painted = readVisualRun(
      displayBoard || logicalBoard,
      viewerPlayerId,
      cells,
      alongRow,
      boardHeight,
      boardWidth
    );
    return {
      word: word ? String(word).toUpperCase() : '',
      logicalAsc: logicalAsc,
      visualRaw: raw.text,
      visualPainted: painted.text,
      flip: viewerNeedsFlip(viewerPlayerId),
      ok: painted.text && word
        ? painted.text === String(word).toUpperCase()
        : painted.text === logicalAsc ||
          painted.text === reverseStr(logicalAsc),
    };
  }

  function assertRoundTrip(viewerPlayerId, boardHeight, boardWidth) {
    var r, c, vis, back;
    for (r = 0; r < boardHeight; r++) {
      for (c = 0; c < boardWidth; c++) {
        vis = getVisualPosition(viewerPlayerId, { row: r, col: c }, boardHeight, boardWidth);
        back = visualToLogical(viewerPlayerId, vis, boardHeight, boardWidth);
        if (back.row !== r || back.col !== c) {
          return {
            ok: false,
            at: { row: r, col: c },
            vis: vis,
            back: back,
          };
        }
      }
    }
    return { ok: true };
  }

  return {
    VIEWER_FLIP: VIEWER_FLIP,
    viewerNeedsFlip: viewerNeedsFlip,
    getVisualPosition: getVisualPosition,
    getLogicalPosition: getLogicalPosition,
    visualToLogical: visualToLogical,
    logicalIdx: logicalIdx,
    rowColFromIdx: rowColFromIdx,
    visualIdxFromLogicalIdx: visualIdxFromLogicalIdx,
    logicalIdxFromVisualRowCol: logicalIdxFromVisualRowCol,
    visualRowColFromLogicalIdx: visualRowColFromLogicalIdx,
    readLogicalHorizontal: readLogicalHorizontal,
    readLogicalVertical: readLogicalVertical,
    readVisualRun: readVisualRun,
    sortCellsVisual: sortCellsVisual,
    collectBoardRuns: collectBoardRuns,
    applyReadableViewPaint: applyReadableViewPaint,
    buildViewerDisplayBoard: buildViewerDisplayBoard,
    describeRunOrientation: describeRunOrientation,
    assertRoundTrip: assertRoundTrip,
  };
});
