(function () {
  'use strict';

  function bootError(msg) {
    var el = document.getElementById('message');
    var row = document.getElementById('panel-message-row');
    if (el) {
      el.textContent = msg;
      el.className = 'message-bar error';
      el.hidden = false;
    }
    if (row) row.hidden = false;
  }

  var QWERTY_BUILD = '303';
  var CHAT_EMOJI_LIST = [
    '😀', '😂', '😍', '😎', '🤩', '😇', '🥰', '😭',
    '❤️', '👍', '👎', '👏', '🙏', '💪', '👀', '👋',
    '🎉', '🔥', '✅', '❌', '💯', '⭐', '✨', '🏆',
    '🎯', '🎮', '🤝', '💀', '😮', '😢', '🤣', '😘',
  ];
  var DEFAULT_ROOM_CODE = 'MAIN';
  var SAVE_KEY = 'qwerty-pogo-save';
  var DIFFICULTY_KEY = 'qwerty-ai-difficulty';
  var SOUND_KEY = 'qwerty-sound-enabled';
  var NICKNAME_KEY = 'qwerty-nickname';
  var DEFAULT_HOST_NAME = 'Deb';
  var DEFAULT_GUEST_NAME = 'Blake';
  var SFX_BASE = '/sounds/';
  /* Logical kind → filename under public/sounds/ */
  var SFX_FILES = {
    introduction: 'introduction3.mp3',
    connection: 'connection.mp3',
    submit: 'wordplayed.mp3',
    place: 'swoosh.mp3',
    error: 'error.mp3',
    bingo: 'rackemptiedbonus.mp3',
    exchange: 'exchange.mp3',
    end: 'end.mp3',
    win: 'end.mp3',
    lose: 'end.mp3',
    tick: 'tick.mp3',
  };
  var SFX_KINDS = Object.keys(SFX_FILES);

  /** Stored difficulty ids — default Medium when missing or invalid. */
  var AI_DIFFICULTY = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

  function isValidDifficulty(d) {
    return d === AI_DIFFICULTY.EASY || d === AI_DIFFICULTY.MEDIUM || d === AI_DIFFICULTY.HARD;
  }

  function aiMoveSortValue(m, cfg) {
    var starWeight = cfg.mode === 'hard' ? 14 : 5;
    var v = m.score + m.starsCaptured * starWeight;
    if (cfg.mode === 'hard') {
      v += (m.connections || 0) * 6;
      v += (m.linkBonus || 0) * 3;
      if (m.usedRackIndices && m.usedRackIndices.length >= 7) v += 20;
    }
    return v;
  }

  /*
   * AI difficulty tuning (mobile-friendly: smaller word pools on Easy).
   * Easy:    short/common words, low score cap, high randomness, occasional pass.
   * Medium:  skips top ~25% of moves, moderate randomness in upper-mid band.
   * Hard:    deep search, strong move evaluation, almost always plays the best line.
   */
  var DIFFICULTY_CONFIG = {
    easy: {
      mode: 'easy',
      maxWordLength: 5,
      maxScore: 30,
      preferCommon: true,
      weakPickChance: 0.55,
      passChance: 0.12,
      wordsPerLength: 80,
      maxWordLenSearch: 5,
      allowFallbackOpening: false,
      thinkMs: 3500,
    },
    medium: {
      mode: 'medium',
      excludeTopFraction: 0.25,
      weakPickChance: 0.35,
      passChance: 0,
      wordsPerLength: 220,
      maxWordLenSearch: 8,
      allowFallbackOpening: true,
      thinkMs: 5500,
    },
    hard: {
      mode: 'hard',
      optimalPlayChance: 0.97,
      topCandidates: 2,
      weakPickChance: 0,
      passChance: 0,
      wordsPerLength: 550,
      maxWordLenSearch: 8,
      allowFallbackOpening: true,
      thinkMs: 8500,
    },
  };

  var EASY_COMMON_SET = null;

  function loadStoredDifficulty() {
    try {
      var d = localStorage.getItem(DIFFICULTY_KEY);
      if (d === 'expert') return AI_DIFFICULTY.HARD;
      if (isValidDifficulty(d)) return d;
    } catch (_) {}
    return AI_DIFFICULTY.MEDIUM;
  }

  function saveStoredDifficulty(difficulty) {
    try {
      localStorage.setItem(DIFFICULTY_KEY, difficulty);
    } catch (_) {}
  }

  function loadSoundEnabled() {
    try {
      var v = localStorage.getItem(SOUND_KEY);
      if (v === '0' || v === 'false') return false;
    } catch (_) {}
    return true;
  }

  function loadStoredNickname() {
    try {
      var n = localStorage.getItem(NICKNAME_KEY);
      if (n && String(n).trim()) return String(n).trim().slice(0, 20);
    } catch (_) {}
    return '';
  }

  function saveStoredNickname(name) {
    var n = String(name || '').trim().slice(0, 20);
    if (!n) return;
    try {
      localStorage.setItem(NICKNAME_KEY, n);
    } catch (_) {}
  }

  function isGenericPlayerName(name) {
    var n = String(name || '').trim().toLowerCase();
    return !n || n === 'player' || n === 'opponent';
  }

  function saveSoundEnabled(on) {
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch (_) {}
  }

  /** Common / short words Easy AI prefers (dictionary order + curated basics). */
  function getEasyCommonSet() {
    if (EASY_COMMON_SET) return EASY_COMMON_SET;
    EASY_COMMON_SET = {};
    var i, len, bucket, w;
    for (i = 0; i < TWO_LETTER_WORDS.length; i++) {
      EASY_COMMON_SET[TWO_LETTER_WORDS[i].toUpperCase()] = true;
    }
    var extras = [
      'CAT', 'DOG', 'RUN', 'SUN', 'FUN', 'WIN', 'EAT', 'ATE', 'SIT', 'HIT', 'HOT', 'COT',
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS',
      'ONE', 'OUR', 'OUT', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD',
      'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
      'WORD', 'PLAY', 'GAME', 'TILE', 'STAR', 'GOOD', 'BEST', 'LOVE', 'LIFE', 'TIME',
    ];
    for (i = 0; i < extras.length; i++) EASY_COMMON_SET[extras[i]] = true;
    for (len = 3; len <= 5; len++) {
      bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      for (i = 0; i < Math.min(160, bucket.length); i++) {
        EASY_COMMON_SET[bucket[i].toUpperCase()] = true;
      }
    }
    return EASY_COMMON_SET;
  }

  var TILE_POINTS = 10;

  /* Classic Scrabble-style two-letter list (excludes obscure extras like AE/AA/AI). */
  var TWO_LETTER_WORDS = [
    'ab', 'ad', 'ag', 'ah', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
    'ba', 'be', 'bi', 'bo', 'by', 'de', 'do', 'ed', 'ef', 'eh', 'el', 'em', 'en', 'er',
    'es', 'et', 'ex', 'fa', 'fe', 'go', 'ha', 'he', 'hi', 'hm', 'ho', 'id', 'if',
    'in', 'is', 'it', 'jo', 'ka', 'ki', 'la', 'li', 'lo', 'ma', 'me', 'mi', 'mm', 'mo', 'mu',
    'my', 'na', 'ne', 'no', 'nu', 'od', 'of', 'oh', 'om', 'on', 'op', 'or', 'ow',
    'ox', 'oy', 'pa', 'pe', 'pi', 'po', 'qi', 're', 'sh', 'si', 'so', 'ta', 'te', 'ti', 'to',
    'uh', 'um', 'un', 'up', 'us', 'ut', 'we', 'wo', 'xi', 'xu', 'ya', 'ye', 'yo', 'za',
  ];
  var TWO_LETTER_SET = new Set(TWO_LETTER_WORDS);

  /*
   * Local TWL-style word list (window.QWERTY_WORD_LIST) as a Set for O(1) exact lookup.
   */
  var TWO_LETTER_COLUMNS = [
    ['ab', 'ad', 'ag', 'ah', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay'],
    ['ba', 'be', 'bi', 'bo', 'by', 'de', 'do', 'ed', 'ef', 'eh', 'el', 'em', 'en', 'er'],
    ['es', 'et', 'ex', 'fa', 'fe', 'go', 'ha', 'he', 'hi', 'hm', 'ho', 'id', 'if'],
    ['in', 'is', 'it', 'jo', 'ka', 'ki', 'la', 'li', 'lo', 'ma', 'me', 'mi', 'mm', 'mo', 'mu'],
    ['my', 'na', 'ne', 'no', 'nu', 'od', 'of', 'oh', 'om', 'on', 'op', 'or', 'ow'],
    ['ox', 'oy', 'pa', 'pe', 'pi', 'po', 'qi', 're', 'sh', 'si', 'so', 'ta', 'te', 'ti', 'to'],
    ['uh', 'um', 'un', 'up', 'us', 'ut', 'we', 'wo', 'xi', 'xu', 'ya', 'ye', 'yo', 'za'],
  ];

  var GAME_RULES = {
    intro:
      'To play, use the letters in your rack to make a word by placing your first word on the corner colored square. On your next turn, create another word to connect with your first word. You can stack letters. You cannot play on your opponent\'s words until a connection is made. Once both player\'s words are connected, the letter tiles will turn purple and play continues except now you can play on your opponent\'s words.',
    bullets: [
      'Cover a gold star for an additional 50 points.',
      'Score 10 points per letter for every new word you form (full word length).',
      'Utilize blank "wild" tiles and change them to any letter.',
      'If you do not like your letters, hit the "Exchange" button and select the letters you would like to exchange.',
      'You have 2:00 minutes to make your play. If you exceed the time limit, you lose your turn and the next play goes to your opponent.',
      'The first time you connect to an opponent\'s word(s), score an additional 75 points (once).',
      'Empty your rack in one play for a Bingo bonus of 100 points.',
      'Score 1000 points to win the game!',
      'You can choose to play a computer bot or a real live player.',
      'You can choose which level bot you want to play against: Easy, Medium, or Hard.',
    ],
  };

  var TILE_BAG = (function () {
    var counts = { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1 };
    var bag = [];
    var letters = Object.keys(counts);
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i];
      for (var j = 0; j < counts[L]; j++) bag.push(L);
    }
    bag.push('*', '*');
    return bag;
  })();

  var DICTIONARY = new Set();
  var AI_WORDS_BY_LENGTH = [];
  var _rackWordCache = {};

  function buildDictionary() {
    var list = window.QWERTY_WORD_LIST;
    if (!list || !list.length) {
      throw new Error('Dictionary not loaded — refresh the page or use OPEN GAME.bat.');
    }
    DICTIONARY = new Set();
    AI_WORDS_BY_LENGTH = [];
    var i, w, lower;
    for (i = 0; i < list.length; i++) {
      w = list[i];
      if (w == null) continue;
      lower = String(w).trim().toLowerCase();
      if (lower.length < 2) continue;
      if (lower.length === 2 && !TWO_LETTER_SET.has(lower)) continue;
      DICTIONARY.add(lower);
      if (lower.length <= 8) {
        if (!AI_WORDS_BY_LENGTH[lower.length]) AI_WORDS_BY_LENGTH[lower.length] = [];
        AI_WORDS_BY_LENGTH[lower.length].push(lower);
      }
    }
    for (i = 0; i < TWO_LETTER_WORDS.length; i++) {
      lower = TWO_LETTER_WORDS[i];
      if (!DICTIONARY.has(lower)) {
        DICTIONARY.add(lower);
        if (!AI_WORDS_BY_LENGTH[2]) AI_WORDS_BY_LENGTH[2] = [];
        AI_WORDS_BY_LENGTH[2].push(lower);
      }
    }
  }

  try {
    buildDictionary();
    if (typeof QWERTYEngine !== 'undefined' && QWERTYEngine.initDictionary) {
      QWERTYEngine.initDictionary(window.QWERTY_WORD_LIST || []);
    }
  } catch (err) {
    bootError(err.message);
    return;
  }

  /**
   * Exact dictionary match (case-insensitive). Rejects length < 2.
   * Cross-words must pass the full contiguous run through this check.
   */
  function isValidWord(word) {
    if (word == null) return false;
    var lower = String(word).trim().toLowerCase();
    if (lower.length < 2) return false;
    return DICTIONARY.has(lower);
  }

  function letterValue(letter) {
    if (!letter) return 0;
    if (letter === '*') return TILE_POINTS;
    return TILE_POINTS;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function createTileBag() { return shuffle(TILE_BAG.slice()); }

  var EXPECTED_TILE_COUNTS = (function () {
    var counts = {};
    for (var i = 0; i < TILE_BAG.length; i++) {
      var L = TILE_BAG[i];
      counts[L] = (counts[L] || 0) + 1;
    }
    return counts;
  })();

  function normalizeTileCountKey(letter) {
    if (!letter) return null;
    var L = String(letter);
    if (L === '*') return '*';
    return L.length === 1 ? L.toUpperCase() : null;
  }

  function countGameTiles(game) {
    var counts = {};
    function add(letter) {
      var key = normalizeTileCountKey(letter);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (var i = 0; i < game.bag.length; i++) add(game.bag[i]);
    for (var p = 0; p < 2; p++) {
      var rack = game.racks[p];
      if (!rack) continue;
      for (var r = 0; r < rack.length; r++) {
        if (!rack[r]) continue;
        if (
          p === 0 &&
          game.isOnlineMode &&
          game.isOnlineMode() &&
          typeof game.isRackSlotPending === 'function' &&
          game.isRackSlotPending(r)
        ) {
          continue;
        }
        add(tileLetter(rack[r]));
      }
    }
    for (var b = 0; b < game.board.length; b++) {
      var cell = game.board[b];
      if (!cell) continue;
      /*
       * Committed blanks store the face letter (blankAs) but remain physical '*'.
       * Counting the face letter made '*' look missing — auditRecover then stuffed
       * a blank into the empty rack slot after place, so recall looked like the
       * letter "changed".
       */
      if (cell.isBlank) add('*');
      else {
        var letter = game.boardCellLetter
          ? game.boardCellLetter(cell)
          : cell.letter;
        if (letter) add(letter);
      }
    }
    if (game.pendingPlacements) {
      game.pendingPlacements.forEach(function (pending) {
        /* Pending blanks keep letter:'*' (blankAs is display-only). */
        add(pending.letter);
      });
    }
    /* In-flight board drag is removed from pending until drop — still counts as a tile. */
    if (game.drag && game.drag.fromBoard !== undefined && game.drag.letter) {
      add(game.drag.letter);
    }
    return counts;
  }

  function drawTiles(bag, count) {
    var drawn = [];
    while (drawn.length < count && bag.length > 0) drawn.push(bag.pop());
    return drawn;
  }

  function getAllWordsFromBoard(board, cols, rows) {
    var words = [], seen = {}, r, c, run, start, cell, letter, key, k;
    for (r = 0; r < rows; r++) {
      run = ''; start = 0;
      for (c = 0; c <= cols; c++) {
        cell = c < cols ? board[r * cols + c] : null;
        letter = cell && cell.letter;
        if (letter) { if (!run) start = c; run += letter; }
        else if (run.length >= 2) {
          key = 'h-' + r + '-' + start + '-' + run;
          if (!seen[key]) { seen[key] = true; words.push({ word: run, cells: wordCellsH(r, start, run.length, cols) }); }
          run = '';
        } else run = '';
      }
    }
    for (c = 0; c < cols; c++) {
      run = ''; start = 0;
      for (r = 0; r <= rows; r++) {
        cell = r < rows ? board[r * cols + c] : null;
        letter = cell && cell.letter;
        if (letter) { if (!run) start = r; run += letter; }
        else if (run.length >= 2) {
          key = 'v-' + c + '-' + start + '-' + run;
          if (!seen[key]) { seen[key] = true; words.push({ word: run, cells: wordCellsV(c, start, run.length, cols) }); }
          run = '';
        } else run = '';
      }
    }
    return words;
  }

  function wordCellsH(row, colStart, len, cols) {
    var cells = [];
    for (var i = 0; i < len; i++) cells.push(row * cols + (colStart + i));
    return cells;
  }

  function wordCellsV(col, rowStart, len, cols) {
    var cells = [];
    for (var i = 0; i < len; i++) cells.push((rowStart + i) * cols + col);
    return cells;
  }

  function tileLetter(tile) {
    if (!tile) return null;
    if (typeof tile === 'string') return tile;
    return tile.letter || null;
  }

  function normalizeRack(rack) {
    if (!rack || !rack.length) return null;
    var out = [];
    for (var i = 0; i < RACK_SIZE; i++) {
      var t = rack[i];
      if (!t) { out[i] = null; continue; }
      if (typeof t === 'string') out[i] = { letter: t, id: uid() };
      else if (t.letter) out[i] = t;
      else out[i] = null;
    }
    return out;
  }

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
    /* Prefer tileId — duplicate letters can share a stale rackIndex. */
    if (pl.tileId) {
      var byId = findRackSlotByTileId(rack, pl.tileId);
      if (matchesSlot(byId)) return byId;
    }
    if (pl.rackIndex >= 0 && matchesSlot(pl.rackIndex)) return pl.rackIndex;
    return -1;
  }

/* ── Board config ─────────────────────────────────────────── */
const COLS = 15;
const ROWS = 15;
const RACK_SIZE = 8;
const MAX_CELL_SIZE = 52;
const MIN_CELL_SIZE = 14;
const LAYOUT_GAP = 8;
const STAR_BONUS = 50;
const LINK_BONUS = 75;
const BINGO_BONUS = 100; // empty the rack this turn
const TURN_SECONDS = 120;
const TIMER_WARN_SECONDS = 30;
const TIMER_TICK_SECONDS = 10;
const WIN_SCORE = 1000;
const AI_THINK_MS = 10000;
/* How long submitted / opponent plays stay highlighted on the board (desktop + mobile). */
const SUBMIT_WORD_HIGHLIGHT_MS = 5000;
const OPPONENT_WORD_HIGHLIGHT_MS = SUBMIT_WORD_HIGHLIGHT_MS;
const PLAY_SCORE_FX_MS = 3600;
const BOARD_BANNER_MS = 2600;
const PLACEMENT_PULSE_MS = 640;
const RACK_SETTLE_MS = 420;
const BONUS_CALLOUT_MS = 1400;
const GAME_OVER_SPLASH_MS = 2400;
const POST_GAME_DIALOG_DELAY_MS = 4000;
const POST_GAME_BOARD_CLEAR_MS = 5000;

function canvasDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function canvasClientPos(canvas, clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  var dpr = canvasDpr();
  var scaleX = canvas.width / dpr / rect.width;
  var scaleY = canvas.height / dpr / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

const CHAT_PLAYER_NAME = 'You';
const CHAT_AI_NAME = 'Computer';
const AI_CHAT_LINES = [
  'Nice word!',
  'Good play.',
  'Hmm, let me think…',
  'Interesting move!',
  'I see what you did there.',
  'The board is heating up!',
  'Going for a gold star?',
];

const CELL_EMPTY = 0;
const CELL_STAR = 1;
const CELL_START_P1 = 2;
const CELL_START_P2 = 3;

const PLAYER = { HUMAN: 0, AI: 1 };

/** Human / Deb (P1): bottom-left (green). Blake / AI (P2): top-right (amber). Shared fixed camera. */
const START_P1_IDX = (ROWS - 1) * COLS;
const START_P2_IDX = COLS - 1;

var BOARD_THEME = {
  frame: '#1a2744',
  cellLight: '#f4f0e8',
  cellDark: '#e6e0d4',
  gridLine: 'rgba(26, 39, 68, 0.08)',
  startP1: '#4ade80',
  startP1Edge: '#16a34a',
  /* P2 start: amber (distinct from P1 green) — shared camera labels both corners. */
  startP2: '#fbbf24',
  startP2Edge: '#d97706',
  starFill: '#ffe082',
  starGlow: '#ffb74d',
  starIcon: '#c67c00',
  tileHumanTop: '#f0a060',
  tileHumanBottom: '#d97838',
  tileHumanText: '#ffffff',
  tileAiTop: '#6eb0e0',
  tileAiBottom: '#3d85c4',
  tileAiText: '#ffffff',
  tileLinkedTop: '#b388ff',
  tileLinkedBottom: '#7c3aed',
  tileLinkedText: '#ffffff',
  tileLinkedPending: '#5b21b6',
  tileRackTop: '#faf6ef',
  tileRackBottom: '#e8dfd0',
  tileRackText: '#2d1b4e',
  tileBackTop: '#c9a87c',
  tileBackBottom: '#9a7348',
  tileBackEdge: '#7a5a38',
  tileBackAccent: 'rgba(255, 255, 255, 0.35)',
  tileEdge: 'rgba(0,0,0,0.12)',
  opponentHighlight: '#ffd23f',
  opponentHighlightGlow: 'rgba(255, 210, 63, 0.55)',
  playHighlight: '#c4b5fd',
  playHighlightGlow: 'rgba(167, 139, 250, 0.28)',
  playHighlightRing: 'rgba(196, 181, 253, 0.95)',
  playHighlightPending: '#ddd6fe',
  connectBadge: '#34d399',
  bingoBadge: '#f472b6',
  starBadge: '#fbbf24',
  bannerConnectFill: 'rgba(88, 28, 68, 0.94)',
  bannerConnectBorder: '#e879a8',
  bannerConnectGlow: 'rgba(244, 114, 182, 0.55)',
  bannerExchangeFill: 'rgba(45, 27, 78, 0.94)',
  bannerExchangeBorder: '#ffd23f',
  bannerExchangeGlow: 'rgba(255, 210, 63, 0.45)',
};

function applyBoardThemeCss() {
  var root = document.documentElement;
  var T = BOARD_THEME;
  root.style.setProperty('--board-tile-rack-top', T.tileRackTop);
  root.style.setProperty('--board-tile-rack-bottom', T.tileRackBottom);
  root.style.setProperty('--board-tile-rack-text', T.tileRackText);
  root.style.setProperty('--board-tile-ai-top', T.tileAiTop);
  root.style.setProperty('--board-tile-ai-bottom', T.tileAiBottom);
  root.style.setProperty('--board-tile-ai-text', T.tileAiText);
  root.style.setProperty('--board-tile-edge', T.tileEdge);
  root.style.setProperty('--board-star-fill', T.starFill);
  root.style.setProperty('--board-star-glow', T.starGlow);
}

applyBoardThemeCss();

function tileLetterFont(size) {
  return '500 ' + Math.round(size * 0.78) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
}

function drawStarShape(ctx, cx, cy, outerR, innerR, fill) {
  var i, angle, x, y;
  ctx.beginPath();
  for (i = 0; i < 10; i++) {
    angle = -Math.PI / 2 + i * Math.PI / 5;
    var r = i % 2 === 0 ? outerR : innerR;
    x = cx + Math.cos(angle) * r;
    y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/* Build special-cell map — gold stars mirror across the board center so each player gets equal access. */
const STAR_PAIR_COUNT = 5;

/** Classic layout used when loading older saves without stored star positions. */
const DEFAULT_STAR_COORDS = [
  [2, 2], [8, 2],
  [5, 4],
  [10, 5],
  [1, 7], [13, 7],
  [4, 9],
  [9, 10],
  [6, 12], [12, 12],
];

function mirrorStarCoord(c, r) {
  return [COLS - 1 - c, ROWS - 1 - r];
}

function shuffleArray(arr, rng) {
  var random = rng || Math.random;
  var i, j, t;
  for (i = arr.length - 1; i > 0; i--) {
    j = Math.floor(random() * (i + 1));
    t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function starCoordKey(c, r) {
  return c + ',' + r;
}

function starCoordDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function collectStarRepresentatives() {
  var reps = [];
  var r, c, mr, mc, idx;
  for (r = 0; r < ROWS; r++) {
    for (c = 0; c < COLS; c++) {
      mr = ROWS - 1 - r;
      mc = COLS - 1 - c;
      if (r > mr || (r === mr && c >= mc)) continue;
      if (r === mr && c === mc) continue;
      idx = r * COLS + c;
      if (idx === START_P1_IDX || idx === START_P2_IDX) continue;
      reps.push([c, r]);
    }
  }
  return reps;
}

function expandStarPairs(representatives) {
  var coords = [];
  var seen = {};
  var i, c, r, mir, key, k, pair;
  for (i = 0; i < representatives.length; i++) {
    c = representatives[i][0];
    r = representatives[i][1];
    mir = mirrorStarCoord(c, r);
    pair = [[c, r], mir];
    for (k = 0; k < pair.length; k++) {
      key = starCoordKey(pair[k][0], pair[k][1]);
      if (seen[key]) continue;
      seen[key] = true;
      coords.push(pair[k]);
    }
  }
  return coords;
}

function generateSymmetricStarCoords(rng) {
  var reps = shuffleArray(collectStarRepresentatives(), rng);
  var picked = [];
  var minSep = 3;
  var i, j, cand, ok;

  while (picked.length < STAR_PAIR_COUNT && minSep >= 1) {
    for (i = 0; i < reps.length && picked.length < STAR_PAIR_COUNT; i++) {
      cand = reps[i];
      ok = true;
      for (j = 0; j < picked.length; j++) {
        if (starCoordDistance(cand, picked[j]) < minSep) {
          ok = false;
          break;
        }
      }
      if (ok) picked.push(cand);
    }
    if (picked.length < STAR_PAIR_COUNT) {
      minSep--;
      if (minSep < 1) break;
    }
  }

  for (i = 0; i < reps.length && picked.length < STAR_PAIR_COUNT; i++) {
    cand = reps[i];
    ok = true;
    for (j = 0; j < picked.length; j++) {
      if (starCoordKey(cand[0], cand[1]) === starCoordKey(picked[j][0], picked[j][1])) {
        ok = false;
        break;
      }
    }
    if (ok) picked.push(cand);
  }

  return expandStarPairs(picked);
}

function buildSpecials(starCoords) {
  const s = new Array(COLS * ROWS).fill(CELL_EMPTY);
  s[START_P1_IDX] = CELL_START_P1;
  s[START_P2_IDX] = CELL_START_P2;

  var coords = starCoords || DEFAULT_STAR_COORDS;
  var seen = {};
  var c, r, key;
  for (var i = 0; i < coords.length; i++) {
    c = coords[i][0];
    r = coords[i][1];
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    key = starCoordKey(c, r);
    if (seen[key]) continue;
    seen[key] = true;
    if (s[r * COLS + c] === CELL_START_P1 || s[r * COLS + c] === CELL_START_P2) continue;
    s[r * COLS + c] = CELL_STAR;
  }
  return s;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function matchWordToRackStatic(word, letters) {
  const pool = letters.map((l) => ({ letter: l.letter, i: l.i }));
  const used = [];
  for (const ch of word) {
    let idx = pool.findIndex((l) => String(l.letter).toUpperCase() === ch);
    if (idx < 0) idx = pool.findIndex((l) => l.letter === '*');
    if (idx < 0) return null;
    used.push({ letter: pool[idx].letter, i: pool[idx].i });
    pool.splice(idx, 1);
  }
  return used;
}

/* ── Game state ─────────────────────────────────────────────── */
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.rackCanvas = document.getElementById('rack-canvas');
    this.opponentRackCanvas = document.getElementById('opponent-rack-canvas');

    this.ui = {
      playerScore: document.getElementById('player-score'),
      aiScore: document.getElementById('ai-score'),
      playerPanel: document.getElementById('player-panel'),
      aiPanel: document.getElementById('ai-panel'),
      playerTurnRibbon: document.getElementById('player-turn-ribbon'),
      aiTurnRibbon: document.getElementById('ai-turn-ribbon'),
      message: document.getElementById('message'),
      btnPlay: document.getElementById('btn-play'),
      btnRecall: document.getElementById('btn-recall'),
      btnShuffle: document.getElementById('btn-shuffle'),
      btnPass: document.getElementById('btn-pass'),
      btnCancelExchange: document.getElementById('btn-cancel-exchange'),
      btnNew: document.getElementById('btn-new'),
      btnSoundToggle: document.getElementById('btn-sound-toggle'),
      btnSoundToggleInGame: document.getElementById('btn-sound-toggle-ingame'),
      turnTimer: document.getElementById('turn-timer'),
      blankPicker: document.getElementById('blank-picker'),
      blankPickerGrid: document.getElementById('blank-picker-grid'),
      blankPickerCancel: document.getElementById('blank-picker-cancel'),
      twoLetterLink: document.getElementById('two-letter-link'),
      twoLetterModal: document.getElementById('two-letter-modal'),
      twoLetterGrid: document.getElementById('two-letter-grid'),
      twoLetterClose: document.getElementById('two-letter-close'),
      rulesLink: document.getElementById('rules-link'),
      mainMenuRulesLink: document.getElementById('main-menu-rules-link'),
      rulesModal: document.getElementById('rules-modal'),
      rulesBody: document.getElementById('rules-body'),
      rulesClose: document.getElementById('rules-close'),
      chatPanel: document.getElementById('chat-panel'),
      chatLog: document.getElementById('chat-log'),
      chatInput: document.getElementById('chat-input'),
      chatForm: document.getElementById('chat-form'),
      btnChatSend: document.getElementById('btn-chat-send'),
      btnChatEmoji: document.getElementById('btn-chat-emoji'),
      chatEmojiPicker: document.getElementById('chat-emoji-picker'),
      btnChatClose: document.getElementById('btn-chat-close'),
      btnMobileChat: document.getElementById('btn-mobile-chat'),
      mobileChatBackdrop: document.getElementById('mobile-chat-backdrop'),
      mobileChatBadge: document.getElementById('mobile-chat-badge'),
      chatRoomCode: document.getElementById('chat-room-code'),
      chatRoomCodeValue: document.getElementById('chat-room-code-value'),
      btnMute: document.getElementById('btn-mute'),
      btnBlock: document.getElementById('btn-block'),
      chatOpponentRow: document.querySelector('.whos-here-opponent'),
      boardAvatarAi: document.getElementById('board-avatar-ai'),
      boardAvatarHuman: document.getElementById('board-avatar-human'),
      sidebarPlayerScore: document.getElementById('sidebar-player-score'),
      sidebarAiScore: document.getElementById('sidebar-ai-score'),
      mobilePlayerScore: document.getElementById('mobile-player-score'),
      mobileOppScore: document.getElementById('mobile-opp-score'),
      mobileOppName: document.getElementById('mobile-opp-name'),
      mobilePlayerName: document.getElementById('mobile-player-name'),
      mobileTurnTimer: document.getElementById('mobile-turn-timer'),
      sidebarPlayerName: document.getElementById('sidebar-player-name'),
      sidebarOpponentName: document.getElementById('sidebar-opponent-name'),
      sidebarLastWord: document.getElementById('sidebar-last-word'),
      mainMenu: document.getElementById('main-menu'),
      difficultyPicker: document.getElementById('difficulty-picker'),
      boardDifficultyPicker: document.getElementById('board-difficulty-picker'),
      btnStartGame: document.getElementById('btn-start-game'),
      btnContinueGame: document.getElementById('btn-continue-game'),
      aiName: document.getElementById('ai-name'),
      playerName: document.getElementById('player-name'),
      chatSelfName: document.getElementById('chat-self-name'),
      chatOpponentName: document.getElementById('chat-opponent-name'),
      playAgainOverlay: document.getElementById('play-again-overlay'),
      playAgainTitle: document.getElementById('play-again-title'),
      playAgainSummary: document.getElementById('play-again-summary'),
      playAgainDifficulty: document.getElementById('play-again-difficulty'),
      playAgainHumanScore: document.getElementById('play-again-human-score'),
      playAgainAiScore: document.getElementById('play-again-ai-score'),
      btnPlayAgainYes: document.getElementById('btn-play-again-yes'),
      btnPlayAgainLeave: document.getElementById('btn-play-again-leave'),
      gameOverSplash: document.getElementById('game-over-splash'),
      gameOverSplashTitle: document.getElementById('game-over-splash-title'),
      gameOverSplashWinner: document.getElementById('game-over-splash-winner'),
      gameExitScreen: document.getElementById('game-exit-screen'),
      btnExitPlay: document.getElementById('btn-exit-play'),
      exchangeNoticeOverlay: document.getElementById('exchange-notice-overlay'),
      exchangeNoticeTitle: document.getElementById('exchange-notice-title'),
      exchangeNoticeBody: document.getElementById('exchange-notice-body'),
      exchangeNoticeHint: document.getElementById('exchange-notice-hint'),
      exchangeNoticeOk: document.getElementById('exchange-notice-ok'),
      onlineNickname: document.getElementById('online-nickname'),
      onlineJoinCode: document.getElementById('online-join-code'),
      onlineStatus: document.getElementById('online-status'),
      onlineWaiting: document.getElementById('online-waiting'),
      onlineRoomCode: document.getElementById('online-room-code'),
      onlineHostWaiting: document.getElementById('online-host-waiting'),
      onlineHostRoomCode: document.getElementById('online-host-room-code'),
      onlineHostWaitingMsg: document.getElementById('online-host-waiting-msg'),
      onlineHostStatus: document.getElementById('online-host-status'),
      onlineShareBlock: document.getElementById('online-share-block'),
      onlineShareUrl: document.getElementById('online-share-url'),
      btnCopyShareLink: document.getElementById('btn-copy-share-link'),
      onlineHostShareBlock: document.getElementById('online-host-share-block'),
      onlineHostShareUrl: document.getElementById('online-host-share-url'),
      btnCopyHostShareLink: document.getElementById('btn-copy-host-share-link'),
      btnCreateRoom: document.getElementById('btn-create-room'),
      btnJoinRoom: document.getElementById('btn-join-room'),
      inGameRoomBadge: document.getElementById('in-game-room-badge'),
      inGameRoomCode: document.getElementById('in-game-room-code'),
      legendStartYou: document.getElementById('legend-start-you'),
      legendStartOpponent: document.getElementById('legend-start-opponent'),
      legendSwatchYou: document.getElementById('legend-swatch-you'),
      legendSwatchOpponent: document.getElementById('legend-swatch-opponent'),
      legendOpponentTiles: document.getElementById('legend-opponent-tiles'),
    };

    this.appEl = document.querySelector('.app');
    this.gameMode = 'ai';
    this.onlinePlayerIndex = 0;
    this.onlineOpponentName = 'Opponent';
    this.onlineSelfName = '';
    this.friendCode = '';
    this._hostInfo = null;
    this._onlineConnected = false;
    this._onlineTurnEndsAt = null;
    this._onlineAwaitingServer = false;
    this._onlineStateReady = false;
    this._onlineGameStarted = false;
    this._rematchPending = false;
    this._hostStateRetryId = null;
    this._guestStartWatchId = null;
    this._guestBoardFlip = false;
    this.aiDifficulty = loadStoredDifficulty();
    this.menuResumePending = false;
    this.chatMuted = false;
    this.chatBlocked = false;
    this.mobileChatOpen = false;
    this.mobileChatUnread = 0;
    this.turnTimerId = null;
    this._audioCtx = null;
    this._sfxAudio = {};
    this._sfxFailed = {};
    this.soundEnabled = loadSoundEnabled();
    this.opponentWordHighlight = null;
    this.opponentHighlightTimerId = null;
    this.playWordHighlight = null; /* { cellSet, words, scoreResult, pulseAt } */
    this.scoreFx = null; /* floating breakdown after submit */
    this.boardBannerFx = null; /* upper-band CONNECTION! / bingo / exchange banner */
    this.rackSettleFx = null; /* soft bounce when tiles return to rack */
    this._uiAnimId = null;
    this._previewUiEpoch = 0; /* bumped on every invalid/reset so stale anims die */
    this._pendingUiScoreResult = null;
    this._pendingUiScoreLabel = null;
    this.postGameTimeoutId = null;
    this.postGameDialogTimeoutId = null;
    this.pendingGameOverMessage = null;
    this._postGameFlowStarted = false;
    this.aiRunTimeoutId = null;
    this.aiRunGeneration = 0;
    this.gameOverDialogDismissed = false;
    this.suppressExitPlayUntil = 0;
    this.blankPickerIdx = null;
    this._exchangeNoticeDismiss = null;
    this._exchangeNoticeReady = false;

    if (!this.canvas || !this.rackCanvas) {
      throw new Error('Canvas elements not found');
    }
    this.ctx = this.canvas.getContext('2d');
    this.rackCtx = this.rackCanvas.getContext('2d');
    this.opponentRackCtx = this.opponentRackCanvas
      ? this.opponentRackCanvas.getContext('2d')
      : null;
    if (!this.ctx || !this.rackCtx) {
      throw new Error('Canvas 2D is not supported in this browser');
    }

    this.cellSize = 42;
    this.tileSize = 40;
    this.rackTileGap = 6;
    this.opponentRackTileGap = 6;
    this.drag = null;
    this.rackSelectedSlot = -1;
    this.exchangeMode = false;
    this.exchangeSlots = {};
    this.pendingPlacements = new Map();
    this.lastPendingCell = null;
    this.starCoords = DEFAULT_STAR_COORDS.slice();
    this.specials = buildSpecials(this.starCoords);

    this.bindEvents();
    this.warnIfFileProtocol();
    this.setupSoundToggle();
    this.setupMainMenu();
    this.setupOnline();
    this.applyOnlineUrlParams();
    this.setupBoardDifficultyPicker();
    this.setupPlayAgainDialog();
    this.setupExitScreen();
    this.setupBlankPicker();
    this.setupExchangeNotice();
    this.setupTwoLetterModal();
    this.setupRulesModal();
    this.setupChat();
    this._guestDisplayBoard = null;
    this._needsWindowResize = false;
    this._cancelLayoutRestore();
    this.resize();
    this.loadOrNew();
    this.tryAutoRejoinOnline();
    requestAnimationFrame(() => {
      if (!this.drag) this.resize();
    });
  }

  getBoardVerticalChrome(wrapPadV, cellSizeGuess) {
    var padV = wrapPadV || 0;
    var oppSlot = document.querySelector('.board-grid-rack');
    var oppH = 0;
    if (oppSlot && oppSlot.offsetHeight > 0) {
      oppH = oppSlot.offsetHeight;
    } else if (this.opponentRackCanvas && this.opponentRackCanvas.offsetHeight > 0) {
      oppH = this.opponentRackCanvas.offsetHeight;
    } else {
      var cs = cellSizeGuess != null ? cellSizeGuess : (this.cellSize || MIN_CELL_SIZE + 10);
      var ts = Math.max(MIN_CELL_SIZE - 2, cs - 2);
      oppH = ts + 16;
    }
    var headerEl = document.querySelector('.board-top-header');
    var headerH = headerEl && headerEl.offsetHeight > 0 ? headerEl.offsetHeight : 0;
    return { oppRackH: oppH, headerH: headerH, wrapPadV: padV, total: oppH + headerH + padV };
  }

  getCompactPlayReservedHeight() {
    /*
     * Use a stable chrome estimate on mobile. Reading live panel/message heights
     * while placing tiles causes cellSize to change → board jump.
     */
    if (this._compactChromeReserve != null) return this._compactChromeReserve;
    var reserved = 0;
    var app = document.querySelector('.app');
    if (app) {
      var appStyle = window.getComputedStyle(app);
      reserved += (parseFloat(appStyle.paddingTop) || 0) + (parseFloat(appStyle.paddingBottom) || 0);
      reserved += parseFloat(appStyle.gap) || 0;
    }
    reserved += 8; /* table gap */
    var mobileBar = document.querySelector('.mobile-play-bar');
    if (mobileBar && mobileBar.offsetHeight > 20) {
      reserved += mobileBar.offsetHeight;
    } else {
      reserved += 48;
    }
    var panel = document.getElementById('player-panel');
    if (panel && panel.offsetHeight > 20) {
      /* Cap so a tall controls stack does not crush the board. */
      reserved += Math.min(panel.offsetHeight, 168);
    } else {
      reserved += 132;
    }
    /* In-flow status strip under the board (~3 lines). */
    reserved += 44;
    this._compactChromeReserve = reserved + 8;
    return this._compactChromeReserve;
  }

  getCanvasHeightBudget(innerWrapH, wrapPadV, cellSizeGuess) {
    if (this.isCompactLayout()) {
      var boardWrap = this.getBoardWrapEl();
      var wrapW = boardWrap ? boardWrap.clientWidth : document.documentElement.clientWidth;
      var wrapStyle = boardWrap ? window.getComputedStyle(boardWrap) : null;
      var wrapPadH = wrapStyle
        ? (parseFloat(wrapStyle.paddingLeft) || 0) + (parseFloat(wrapStyle.paddingRight) || 0)
        : 0;
      var byWidth = Math.floor(Math.max(120, wrapW - wrapPadH) / COLS) * ROWS;
      /*
       * Prefer width-derived size (original larger board feel). Height is only a
       * soft ceiling when the board would clearly overflow the viewport.
       */
      var viewportH = window.innerHeight || document.documentElement.clientHeight || 600;
      var reserved = document.body.classList.contains('menu-visible')
        ? 0
        : this.getCompactPlayReservedHeight();
      var byHeight = Math.floor(Math.max(120, viewportH - reserved) / ROWS) * ROWS;
      var budget = byWidth;
      /* Only shrink when height is meaningfully tighter than width (not 1-cell noise). */
      if (byHeight > 0 && byHeight < byWidth - ROWS * 2) {
        budget = byHeight;
      }
      return Math.max(ROWS * MIN_CELL_SIZE, budget);
    }
    var canvasBudget = this.measureBoardBudget();
    var chrome = this.getBoardVerticalChrome(wrapPadV, cellSizeGuess);
    var boardRow = document.querySelector('.game-board-row');
    if (boardRow && boardRow.clientHeight > 80) {
      canvasBudget = Math.min(canvasBudget, boardRow.clientHeight - chrome.total);
    }
    if (innerWrapH > 80) {
      canvasBudget = Math.min(canvasBudget, innerWrapH - chrome.oppRackH);
    }
    return Math.max(ROWS * MIN_CELL_SIZE, canvasBudget);
  }

  measureBoardBudget() {
    var boardWrap = this.getBoardWrapEl();
    var boardRow = boardWrap && boardWrap.closest('.game-board-row');
    var boardSlot = boardRow || boardWrap;
    var gameTable = boardWrap && boardWrap.closest('.game-table');
    if (!boardWrap || !gameTable) {
      return Math.max(200, (window.innerHeight || 800) * 0.48);
    }

    var tableStyle = window.getComputedStyle(gameTable);
    var tableGap = parseFloat(tableStyle.rowGap || tableStyle.gap) || 6;
    var reserved = 0;
    var siblings = gameTable.children;
    var s;
    for (s = 0; s < siblings.length; s++) {
      if (siblings[s] === boardSlot || siblings[s] === boardWrap) continue;
      if (siblings[s].classList && siblings[s].classList.contains('human-panel-drag-placeholder')) continue;
      reserved += siblings[s].offsetHeight;
    }
    if (siblings.length > 1) {
      reserved += tableGap * (siblings.length - 1);
    }

    var wrapStyle = window.getComputedStyle(boardWrap);
    var wrapPadV =
      (parseFloat(wrapStyle.paddingTop) || 0) + (parseFloat(wrapStyle.paddingBottom) || 0);
    var chrome = this.getBoardVerticalChrome(wrapPadV);

    var tableH = gameTable.clientHeight;
    if (tableH > 80) {
      return Math.max(120, tableH - reserved - chrome.total);
    }

    var gameMain = gameTable.closest('.game-main');
    if (!gameMain) {
      return Math.max(120, (window.innerHeight || 800) * 0.48);
    }

    var app = document.querySelector('.app');
    var appRect = app ? app.getBoundingClientRect() : { top: 0 };
    var appStyle = app ? window.getComputedStyle(app) : null;
    var padBottom = appStyle ? parseFloat(appStyle.paddingBottom) || 0 : 0;
    var legendRow = document.querySelector('.legend-row');

    reserved = padBottom;
    /* Message lives under the board inside .game-board-column (flex sibling of
       .board-wrap), so wrap height already excludes it — do not double-count. */
    if (legendRow) {
      reserved += legendRow.offsetHeight + LAYOUT_GAP;
    }
    reserved += tableGap * Math.max(0, siblings.length - 1);
    for (s = 0; s < siblings.length; s++) {
      if (siblings[s] === boardSlot || siblings[s] === boardWrap) continue;
      if (siblings[s].classList && siblings[s].classList.contains('human-panel-drag-placeholder')) continue;
      reserved += siblings[s].offsetHeight;
    }
    reserved += chrome.total;

    var viewportH = window.innerHeight || document.documentElement.clientHeight || 800;
    return Math.max(120, viewportH - appRect.top - reserved);
  }

  getBoardWrapEl() {
    return this.canvas ? this.canvas.closest('.board-wrap') : null;
  }

  isCompactLayout() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  }

  getLayoutInsets() {
    if (this.isCompactLayout()) {
      return { gutterW: 0, sidebarW: 0, edgePad: 16 };
    }
    return { gutterW: 236, sidebarW: 260, edgePad: 48 };
  }

  getBoardCenterEl() {
    return this.canvas ? this.canvas.closest('.board-center') : null;
  }

  _applyLayoutStyle(el, prop, value) {
    if (!el) return;
    if (!el._qwertyLayout) el._qwertyLayout = {};
    if (el._qwertyLayout[prop] === value) return;
    el._qwertyLayout[prop] = value;
    el.style[prop] = value;
  }

  _elementOffsetWithin(el, root) {
    var y = 0;
    var node = el;
    while (node && node !== root) {
      y += node.offsetTop;
      node = node.parentElement;
    }
    return y;
  }

  _refreshGutterMetrics(stackAi, stackHuman, aiAvatar, humanAvatar) {
    if (this._gutterMetrics && this._gutterMetricsCellSize === this.cellSize) return;
    this._gutterMetrics = {
      aiAvatarRelTop: stackAi && aiAvatar
        ? this._elementOffsetWithin(aiAvatar, stackAi)
        : 0,
      aiStackOffset: stackAi ? stackAi.offsetTop : 0,
      humanStackOffset: stackHuman ? stackHuman.offsetTop : 0,
    };
    this._gutterMetricsCellSize = this.cellSize;
  }

  _cancelLayoutRestore() {
    if (this._layoutRestoreOuterRAF) {
      cancelAnimationFrame(this._layoutRestoreOuterRAF);
      this._layoutRestoreOuterRAF = null;
    }
    if (this._layoutRestoreInnerRAF) {
      cancelAnimationFrame(this._layoutRestoreInnerRAF);
      this._layoutRestoreInnerRAF = null;
    }
  }

  _ensureDragOverlay() {
    if (this._dragOverlay) return;
    var canvas = document.createElement('canvas');
    canvas.id = 'drag-overlay-canvas';
    canvas.className = 'drag-overlay-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    this._dragOverlay = canvas;
    this._dragOverlayCtx = canvas.getContext('2d');
  }

  _syncDragOverlaySize() {
    if (!this._dragOverlay || !this._dragOverlayCtx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth || document.documentElement.clientWidth || 800;
    var h = window.innerHeight || document.documentElement.clientHeight || 600;
    if (this._dragOverlayW === w && this._dragOverlayH === h && this._dragOverlayDpr === dpr) return;
    this._dragOverlayW = w;
    this._dragOverlayH = h;
    this._dragOverlayDpr = dpr;
    this._dragOverlay.width = w * dpr;
    this._dragOverlay.height = h * dpr;
    this._dragOverlay.style.width = w + 'px';
    this._dragOverlay.style.height = h + 'px';
    this._dragOverlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _clearDragOverlay() {
    if (!this._dragOverlay || !this._dragOverlayCtx) return;
    this._dragOverlayCtx.clearRect(0, 0, this._dragOverlayW || 0, this._dragOverlayH || 0);
  }

  _pointInRect(clientX, clientY, rect) {
    return (
      rect &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  getRackDropRect() {
    if (this.isCompactLayout() && this.rackCanvas) {
      var rackRect = this.rackCanvas.getBoundingClientRect();
      return {
        left: rackRect.left - 10,
        right: rackRect.right + 10,
        top: rackRect.top - 10,
        bottom: rackRect.bottom + 12,
      };
    }
    var main = this.rackCanvas && this.rackCanvas.closest('.human-panel-main');
    if (!main) {
      return this.rackCanvas ? this.rackCanvas.getBoundingClientRect() : null;
    }
    var rect = main.getBoundingClientRect();
    var controls = main.querySelector('.controls-row');
    if (controls) {
      var controlsRect = controls.getBoundingClientRect();
      if (controlsRect.top > rect.top) {
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: controlsRect.top - 2,
        };
      }
    }
    return rect;
  }

  _flushWindowResizeIfNeeded() {
    if (this._needsWindowResize && !this.drag && !this.isLayoutFrozen()) {
      this._needsWindowResize = false;
      this.withStableScroll(() => this.resize());
    }
  }

  isLayoutFrozen() {
    if (this.drag) return true;
    if (this._layoutFreezeUntil && Date.now() < this._layoutFreezeUntil) return true;
    return false;
  }

  freezeLayoutBriefly(ms) {
    var until = Date.now() + (ms != null ? ms : 450);
    if (!this._layoutFreezeUntil || until > this._layoutFreezeUntil) {
      this._layoutFreezeUntil = until;
    }
  }

  resize() {
    if (this.isLayoutFrozen()) {
      this._needsWindowResize = true;
      return;
    }
    var row = document.querySelector('.game-board-row');
    var wrap = this.getBoardWrapEl();
    if (row) this._applyLayoutStyle(row, 'minHeight', '');
    if (wrap) this._applyLayoutStyle(wrap, 'minHeight', '');
    if (this.isCompactLayout() && wrap && wrap.clientHeight < 80) {
      var self = this;
      requestAnimationFrame(function () {
        if (!self.isLayoutFrozen()) self.resize();
      });
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prevCellSize = this.cellSize;
    const prevBoardW = this._lastBoardW;
    const prevBoardH = this._lastBoardH;
    const prevCenterW = this._lastCenterW;
    const compact = this.isCompactLayout();
    const insets = this.getLayoutInsets();
    const boardWrap = this.getBoardWrapEl();
    const boardCenter = this.getBoardCenterEl();
    const boardWrapStyle = boardWrap ? window.getComputedStyle(boardWrap) : null;
    const wrapPadH = boardWrapStyle
      ? (parseFloat(boardWrapStyle.paddingLeft) || 0) + (parseFloat(boardWrapStyle.paddingRight) || 0)
      : 0;
    const gutterW = insets.gutterW;
    const sidebarW = insets.sidebarW;
    let centerW = boardCenter && boardCenter.clientWidth >= 50 ? boardCenter.clientWidth : 0;
    if (!centerW && boardWrap) {
      centerW = Math.max(120, boardWrap.clientWidth - wrapPadH - gutterW);
    }
    if (centerW < 100) {
      centerW = Math.min(
        Math.max(document.documentElement.clientWidth - insets.edgePad - gutterW - sidebarW, 200),
        compact ? document.documentElement.clientWidth - insets.edgePad : 640
      );
    }

    const wrapStyle = boardWrap ? boardWrapStyle : window.getComputedStyle(boardCenter || this.canvas.parentElement);
    const wrapPadV =
      (parseFloat(wrapStyle.paddingTop) || 0) + (parseFloat(wrapStyle.paddingBottom) || 0);
    const innerWrapH = boardWrap ? boardWrap.clientHeight - wrapPadV : (boardCenter || this.canvas.parentElement).clientHeight;

    /* One-shot: drop stale compact locks from older (smaller) board sizing. */
    if (!this._boardSizeEnlarge303) {
      this._boardSizeEnlarge303 = true;
      this._compactLayoutLock = null;
      this._compactChromeReserve = null;
    }

    var nextCellSize;
    if (compact) {
      /*
       * Mobile: lock cell size to width (+ soft height ceiling). Ignore tiny
       * width noise and reuse the last locked size so placement never jumps.
       */
      var lockW = Math.round(centerW);
      var orient = (window.innerWidth || 0) >= (window.innerHeight || 0) ? 'l' : 'p';
      var lock = this._compactLayoutLock;
      if (
        lock &&
        lock.orient === orient &&
        Math.abs(lock.w - lockW) < 8 &&
        lock.cellSize > 0
      ) {
        nextCellSize = lock.cellSize;
      } else {
        var canvasBudget = this.getCanvasHeightBudget(innerWrapH, wrapPadV, this.cellSize);
        var cellFromW = centerW / COLS;
        var cellFromH = canvasBudget / ROWS;
        /* Width-first — restores the larger original board proportion. */
        nextCellSize = Math.max(
          MIN_CELL_SIZE,
          Math.floor(Math.min(cellFromW, MAX_CELL_SIZE))
        );
        if (cellFromH >= MIN_CELL_SIZE && nextCellSize > cellFromH + 1) {
          nextCellSize = Math.max(MIN_CELL_SIZE, Math.floor(cellFromH));
        }
        if (boardWrap) {
          var maxCenterW = Math.max(120, boardWrap.clientWidth - wrapPadH - gutterW);
          nextCellSize = Math.max(MIN_CELL_SIZE, Math.min(nextCellSize, Math.floor(maxCenterW / COLS)));
        }
        this._compactLayoutLock = { w: lockW, orient: orient, cellSize: nextCellSize };
        this._compactChromeReserve = null; /* refresh chrome estimate on real width change */
      }
    } else {
      this._compactLayoutLock = null;
      var canvasBudgetDesk = this.getCanvasHeightBudget(innerWrapH, wrapPadV, this.cellSize);
      const cellFromW = centerW / COLS;
      const cellFromH = canvasBudgetDesk / ROWS;
      nextCellSize = Math.max(
        MIN_CELL_SIZE,
        Math.floor(Math.min(cellFromW, MAX_CELL_SIZE))
      );
      if (cellFromH >= MIN_CELL_SIZE && nextCellSize > cellFromH + 1) {
        nextCellSize = Math.max(MIN_CELL_SIZE, Math.floor(cellFromH));
      }

      if (boardWrap) {
        const maxCenterW = Math.max(120, boardWrap.clientWidth - wrapPadH - gutterW);
        const maxByWrapW = Math.floor(maxCenterW / COLS);
        nextCellSize = Math.max(MIN_CELL_SIZE, Math.min(nextCellSize, maxByWrapW));
      }

      canvasBudgetDesk = this.getCanvasHeightBudget(innerWrapH, wrapPadV, nextCellSize);
      var cellFromH2 = canvasBudgetDesk / ROWS;
      if (cellFromH2 >= MIN_CELL_SIZE && nextCellSize > cellFromH2 + 1) {
        nextCellSize = Math.max(MIN_CELL_SIZE, Math.floor(cellFromH2));
      }
      nextCellSize = Math.max(
        MIN_CELL_SIZE,
        Math.min(nextCellSize, Math.floor(cellFromW), MAX_CELL_SIZE)
      );

      if (boardCenter && boardCenter.clientWidth >= 50) {
        const maxByCenterW = Math.floor(boardCenter.clientWidth / COLS);
        nextCellSize = Math.max(MIN_CELL_SIZE, Math.min(nextCellSize, maxByCenterW));
      }
    }

    this.cellSize = nextCellSize;

    /* Same on-screen tile size for board and rack (1px grid gap each side). */
    this.tileSize = Math.max(MIN_CELL_SIZE - 2, this.cellSize - 2);

    const boardW = COLS * this.cellSize;
    const boardH = ROWS * this.cellSize;
    /* Keep under-board status bar the same width as the grid, centered with margin:auto. */
    try {
      document.documentElement.style.setProperty('--qwerty-board-px', boardW + 'px');
    } catch (_) {}
    var dimensionsUnchanged =
      prevCellSize === this.cellSize &&
      prevBoardW === boardW &&
      prevBoardH === boardH &&
      prevCenterW === centerW;
    this._lastBoardW = boardW;
    this._lastBoardH = boardH;
    this._lastCenterW = centerW;

    if (dimensionsUnchanged) {
      this.draw();
      return;
    }

    this.canvas.width = boardW * dpr;
    this.canvas.height = boardH * dpr;
    this.canvas.style.width = boardW + 'px';
    this.canvas.style.height = boardH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rackW = Math.min(centerW, RACK_SIZE * (this.tileSize + 6) + 20);
    this.rackCanvas.width = rackW * dpr;
    this.rackCanvas.height = (this.tileSize + 16) * dpr;
    this.rackCanvas.style.width = rackW + 'px';
    this.rackCanvas.style.height = (this.tileSize + 16) + 'px';
    this.rackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.rackTileGap = Math.max(4, (rackW - RACK_SIZE * this.tileSize) / (RACK_SIZE + 1));

    if (this.opponentRackCanvas && this.opponentRackCtx) {
      this.opponentRackCanvas.width = rackW * dpr;
      this.opponentRackCanvas.height = (this.tileSize + 16) * dpr;
      this.opponentRackCanvas.style.width = rackW + 'px';
      this.opponentRackCanvas.style.height = (this.tileSize + 16) + 'px';
      this.opponentRackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.opponentRackTileGap = this.rackTileGap;
    }

    var cellSizeChanged = prevCellSize !== this.cellSize;
    var layoutKey = this.cellSize + ':' + Math.round(centerW);
    var needsLayoutSync = cellSizeChanged || layoutKey !== this._lastLayoutKey;
    this._lastLayoutKey = layoutKey;
    if (cellSizeChanged) this._gutterMetrics = null;

    var self = this;
    var finishLayout = function () {
      self.syncRackRowAlignment();
      self.syncPanelProfileAlignment();
      self.draw();
    };
    if (needsLayoutSync) {
      this.withStableScroll(finishLayout);
    } else {
      finishLayout();
    }
  }

  syncRackRowAlignment() {
    if (this._skipLayoutSync || this.drag) {
      return;
    }
    var boardWrap = this.getBoardWrapEl();
    if (!boardWrap) return;

    var leftGutter = document.getElementById('board-gutter-left');
    var rightGutter = document.getElementById('board-gutter-right');
    var stackAi = document.getElementById('board-stack-ai');
    var stackHuman = document.getElementById('board-stack-human');

    if (this.isCompactLayout()) {
      var oppHeaderRow = document.querySelector('.opponent-header-row');
      if (oppHeaderRow) {
        this._applyLayoutStyle(oppHeaderRow, 'width', '');
        this._applyLayoutStyle(oppHeaderRow, 'marginLeft', '');
      }
      var headerMarkCompact = document.querySelector('.board-top-header .board-grid-header');
      if (headerMarkCompact) this._applyLayoutStyle(headerMarkCompact, 'transform', '');
      if (this.opponentRackCanvas) {
        var oppRackSlot = this.opponentRackCanvas.closest('.board-grid-rack');
        var oppWrapper = this.opponentRackCanvas.closest('.rack-slot');
        if (oppRackSlot) {
          this._applyLayoutStyle(oppRackSlot, 'width', '');
          this._applyLayoutStyle(oppRackSlot, 'marginLeft', '');
        }
        if (oppWrapper) {
          this._applyLayoutStyle(oppWrapper, 'marginLeft', '');
          this._applyLayoutStyle(oppWrapper, 'transform', '');
        }
      }
      if (this.rackCanvas) {
        var rackMain = this.rackCanvas.closest('.rack-main');
        if (rackMain) this._applyLayoutStyle(rackMain, 'marginLeft', '');
      }
      var controlsRow = document.querySelector('.controls-row');
      if (controlsRow) {
        this._applyLayoutStyle(controlsRow, 'width', '');
        this._applyLayoutStyle(controlsRow, 'marginLeft', '');
      }
      var rackRowEl = this.rackCanvas && this.rackCanvas.closest('.rack-row');
      if (rackRowEl) {
        this._applyLayoutStyle(rackRowEl, 'width', '');
        this._applyLayoutStyle(rackRowEl, 'marginLeft', '');
      }
      var legendRow = document.querySelector('.legend-row');
      if (legendRow) {
        this._applyLayoutStyle(legendRow, 'width', '');
        this._applyLayoutStyle(legendRow, 'marginLeft', '');
      }
      if (stackAi) this._applyLayoutStyle(stackAi, 'transform', '');
      if (stackHuman) this._applyLayoutStyle(stackHuman, 'transform', '');
      if (leftGutter) {
        this._applyLayoutStyle(leftGutter, 'paddingTop', '');
        this._applyLayoutStyle(leftGutter, 'paddingBottom', '');
      }
      if (rightGutter) {
        this._applyLayoutStyle(rightGutter, 'paddingTop', '');
        this._applyLayoutStyle(rightGutter, 'paddingBottom', '');
      }
      this.syncSidebarToBoardGrid();
      return;
    }

    var canvasRect = this.canvas.getBoundingClientRect();
    var boardCenter = canvasRect.left + canvasRect.width / 2;
    var wrapRect = boardWrap.getBoundingClientRect();

    var oppHeaderRow = document.querySelector('.opponent-header-row');
    if (oppHeaderRow) {
      this._applyLayoutStyle(oppHeaderRow, 'width', '');
      this._applyLayoutStyle(oppHeaderRow, 'marginLeft', '');
    }

    /* Shared horizontal center for QWERTY header + both letter racks. */
    var rackAxisCenter = boardCenter;
    if (this.rackCanvas) {
      var humanRackRect = this.rackCanvas.getBoundingClientRect();
      if (humanRackRect.width > 0) {
        rackAxisCenter = humanRackRect.left + humanRackRect.width / 2;
      }
    }

    var headerMark = document.querySelector('.board-top-header .board-grid-header');
    if (headerMark) {
      this._applyLayoutStyle(headerMark, 'transform', '');
      var headerRect = headerMark.getBoundingClientRect();
      if (headerRect.width > 0) {
        var headerShift = Math.round(
          rackAxisCenter - (headerRect.left + headerRect.width / 2)
        );
        if (headerShift) {
          this._applyLayoutStyle(headerMark, 'transform', 'translateX(' + headerShift + 'px)');
        }
      }
    }

    if (this.opponentRackCanvas) {
      var oppRackSlot = this.opponentRackCanvas.closest('.board-grid-rack');
      var oppWrapper = this.opponentRackCanvas.closest('.rack-slot');
      if (oppRackSlot) {
        /* Full board-column width; tiles centered in CSS like Deb's rack. */
        this._applyLayoutStyle(oppRackSlot, 'width', '');
        this._applyLayoutStyle(oppRackSlot, 'marginLeft', '');
      }
      if (oppWrapper) {
        this._applyLayoutStyle(oppWrapper, 'marginLeft', '');
        this._applyLayoutStyle(oppWrapper, 'transform', '');
        var rackCanvasRect = this.opponentRackCanvas.getBoundingClientRect();
        var oppCenter = rackCanvasRect.left + rackCanvasRect.width / 2;
        var shiftX = Math.round(rackAxisCenter - oppCenter);
        if (shiftX) {
          this._applyLayoutStyle(oppWrapper, 'transform', 'translateX(' + shiftX + 'px)');
        }
      }
    }

    if (this.rackCanvas) {
      var rackMain = this.rackCanvas.closest('.rack-main');
      if (rackMain) this._applyLayoutStyle(rackMain, 'marginLeft', '0');
    }

    var controlsRow = document.querySelector('.controls-row');
    if (controlsRow) {
      this._applyLayoutStyle(controlsRow, 'width', '');
      this._applyLayoutStyle(controlsRow, 'marginLeft', '');
    }

    var rackRowEl = this.rackCanvas && this.rackCanvas.closest('.rack-row');
    if (rackRowEl) {
      this._applyLayoutStyle(rackRowEl, 'width', '');
      this._applyLayoutStyle(rackRowEl, 'marginLeft', '');
    }

    var legendRow = document.querySelector('.legend-row');
    if (legendRow) {
      this._applyLayoutStyle(legendRow, 'width', '');
      this._applyLayoutStyle(legendRow, 'marginLeft', '');
    }

    var humanSlot = this.ui.boardAvatarHuman;
    var wrapStyle = window.getComputedStyle(boardWrap);
    var wrapPadL = parseFloat(wrapStyle.paddingLeft) || 0;
    var wrapPadR = parseFloat(wrapStyle.paddingRight) || 0;
    var boardInnerLeft = wrapRect.left + wrapPadL;
    var boardInnerRight = wrapRect.right - wrapPadR;
    var sidebarCol = document.querySelector('.sidebar-column');
    var chatLeft = sidebarCol ? sidebarCol.getBoundingClientRect().left : boardInnerRight;
    var computerCenterX = (boardInnerLeft + canvasRect.left) / 2;
    var youCenterX = (canvasRect.right + chatLeft) / 2;

    var aiSlot = this.ui.boardAvatarAi;
    var aiAvatar = aiSlot ? aiSlot.querySelector('.avatar') : null;
    var humanAvatar = humanSlot ? humanSlot.querySelector('.avatar') : null;
    this._refreshGutterMetrics(stackAi, stackHuman, aiAvatar, humanAvatar);
    var metrics = this._gutterMetrics || {};

    if (stackAi && leftGutter) {
      var leftGutterRect = leftGutter.getBoundingClientRect();
      var leftGutterMid = leftGutterRect.left + leftGutterRect.width / 2;
      var txAi = Math.round(computerCenterX - leftGutterMid);
      var tyAi = 0;
      if (aiAvatar) {
        this._applyLayoutStyle(stackAi, 'transform', 'translateX(' + txAi + 'px)');
        tyAi = Math.round(canvasRect.top - aiAvatar.getBoundingClientRect().top);
      }
      this._applyLayoutStyle(stackAi, 'transform', 'translate(' + txAi + 'px,' + tyAi + 'px)');
    } else if (stackAi) {
      this._applyLayoutStyle(stackAi, 'transform', '');
    }

    if (stackHuman && rightGutter) {
      var rightGutterRectForX = rightGutter.getBoundingClientRect();
      var rightGutterMid = rightGutterRectForX.left + rightGutterRectForX.width / 2;
      var txHuman = Math.round(youCenterX - rightGutterMid);
      var tyHuman = 0;
      if (humanAvatar) {
        this._applyLayoutStyle(stackHuman, 'transform', 'translateX(' + txHuman + 'px)');
        tyHuman = Math.round(canvasRect.bottom - humanAvatar.getBoundingClientRect().bottom);
      }
      this._applyLayoutStyle(stackHuman, 'transform', 'translate(' + txHuman + 'px,' + tyHuman + 'px)');
    } else if (stackHuman) {
      this._applyLayoutStyle(stackHuman, 'transform', '');
    }

    if (leftGutter) {
      this._applyLayoutStyle(leftGutter, 'paddingTop', '0');
      this._applyLayoutStyle(leftGutter, 'paddingBottom', '0');
    }
    if (rightGutter) {
      this._applyLayoutStyle(rightGutter, 'paddingTop', '0');
      this._applyLayoutStyle(rightGutter, 'paddingBottom', '0');
    }
    this.syncSidebarToBoardGrid();
  }

  /**
   * Scores sidebar alignment is CSS-owned (.board-play-row grid-row: 2).
   * Clear any legacy inline padding from older builds.
   */
  syncSidebarToBoardGrid() {
    var sidebarCol = document.querySelector('.sidebar-column');
    if (!sidebarCol) return;
    this._applyLayoutStyle(sidebarCol, 'paddingTop', '');
  }

  syncPanelProfileAlignment() {
    /* Submit + rules links stay in the human-panel CSS grid — no avatar tracking (breaks when maximized). */
    var linksWrap = document.querySelector('.human-panel-links-wrap');
    var rightCol = document.getElementById('human-panel-right');
    if (linksWrap) {
      this._applyLayoutStyle(linksWrap, 'left', '');
      this._applyLayoutStyle(linksWrap, 'width', '');
      this._applyLayoutStyle(linksWrap, 'transform', '');
    }
    if (rightCol) {
      this._applyLayoutStyle(rightCol, 'left', '');
      this._applyLayoutStyle(rightCol, 'transform', '');
    }
  }

  setStarLayout(starCoords) {
    this.starCoords = starCoords.slice();
    this.specials = buildSpecials(this.starCoords);
  }

  getDifficultyConfig() {
    return DIFFICULTY_CONFIG[this.aiDifficulty] || DIFFICULTY_CONFIG.medium;
  }

  getAIThinkDelay() {
    var cfg = this.getDifficultyConfig();
    return cfg.thinkMs || AI_THINK_MS;
  }

  getDifficultyLabel() {
    if (this.aiDifficulty === AI_DIFFICULTY.EASY) return 'Easy';
    if (this.aiDifficulty === AI_DIFFICULTY.HARD) return 'Hard';
    return 'Medium';
  }

  setupBoardDifficultyPicker() {
    var self = this;
    if (!this.ui.boardDifficultyPicker) return;
    this.ui.boardDifficultyPicker.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-difficulty]');
      if (!btn) return;
      self.setDifficulty(btn.getAttribute('data-difficulty'));
    });
  }

  warnIfFileProtocol() {
    if (location.protocol !== 'file:') return;
    this.setMessage(
      'Open with OPEN ONLINE GAME.bat (or OPEN GAME.bat) so everything loads from http://127.0.0.1 — not as a local file.',
      'error'
    );
  }

  setupMainMenu() {
    var self = this;
    if (!this.ui.mainMenu) return;

    this.syncDifficultyPickerUI();

    if (this.ui.difficultyPicker) {
      this.ui.difficultyPicker.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-difficulty]');
        if (!btn) return;
        self.setDifficulty(btn.getAttribute('data-difficulty'));
      });
    }

    if (this.ui.btnStartGame) {
      this.ui.btnStartGame.addEventListener('click', function () {
        saveStoredDifficulty(self.aiDifficulty);
        self.menuResumePending = false;
        if (typeof QWERTYOnline !== 'undefined' && QWERTYOnline.leaveRoom) {
          QWERTYOnline.leaveRoom();
        }
        self.gameMode = 'ai';
        self.friendCode = '';
        self.updateInGameRoomBadge('');
        self.hideMainMenu();
        self.newGame();
      });
    }

    if (this.ui.btnContinueGame) {
      this.ui.btnContinueGame.addEventListener('click', function () {
        saveStoredDifficulty(self.aiDifficulty);
        self.menuResumePending = false;
        self.hideMainMenu();
        if (!self.loadSavedGame()) {
          self.newGame();
        }
      });
    }
  }

  isOnlineMode() {
    return this.gameMode === 'online';
  }

  setOnlineStatus(text, isError) {
    if (!this.ui.onlineStatus) return;
    this.ui.onlineStatus.textContent = text || '';
    this.ui.onlineStatus.classList.toggle('error', !!isError);
  }

  getOnlineNickname(role) {
    var el = this.ui.onlineNickname;
    var name = el && el.value ? el.value.trim() : '';
    if (!name) name = loadStoredNickname();
    if (!name) {
      if (role === 'guest') name = DEFAULT_GUEST_NAME;
      else if (role === 'host') name = DEFAULT_HOST_NAME;
      else name = 'Player';
    }
    if (el && !String(el.value || '').trim() && name && name !== 'Player') {
      el.value = name;
    }
    saveStoredNickname(name);
    this.onlineSelfName = name;
    return name;
  }

  /** Map empty/generic server names to Deb (host seat 0) / Blake (guest seat 1). */
  normalizeOpponentName(name, opponentSeat) {
    if (!isGenericPlayerName(name)) return String(name).trim().slice(0, 20);
    return opponentSeat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME;
  }

  normalizeSelfName(name, selfSeat) {
    if (!isGenericPlayerName(name)) return String(name).trim().slice(0, 20);
    return selfSeat === 1 ? DEFAULT_GUEST_NAME : DEFAULT_HOST_NAME;
  }

  /**
   * Apply host/guest (or self/opponent) names from any online message.
   * Keeps both board profiles in sync when a new opponent joins/rejoins.
   */
  applyOnlineRosterNames(msg) {
    if (!msg) return false;
    var mySeat =
      msg.playerIndex != null
        ? (msg.playerIndex === 1 ? 1 : 0)
        : this.getOnlinePlayerIndex();
    var changed = false;
    var selfName = msg.selfName;
    var oppName = msg.opponentName;
    if ((!selfName || !oppName) && (msg.hostName || msg.guestName)) {
      selfName = mySeat === 0 ? msg.hostName : msg.guestName;
      oppName = mySeat === 0 ? msg.guestName : msg.hostName;
    }
    if (selfName) {
      var nextSelf = this.normalizeSelfName(selfName, mySeat);
      if (nextSelf !== this.onlineSelfName) {
        this.onlineSelfName = nextSelf;
        changed = true;
      }
    } else if (!this.onlineSelfName) {
      this.onlineSelfName = loadStoredNickname() ||
        (mySeat === 1 ? DEFAULT_GUEST_NAME : DEFAULT_HOST_NAME);
      changed = true;
    }
    if (oppName != null && String(oppName).trim() !== '') {
      var nextOpp = this.normalizeOpponentName(oppName, mySeat === 0 ? 1 : 0);
      if (nextOpp !== this.onlineOpponentName) {
        this.onlineOpponentName = nextOpp;
        changed = true;
      }
    }
    return changed;
  }

  /** Push current online (or offline) names onto both board/sidebar/chat profiles. */
  syncPlayerNameLabels() {
    var selfLabel = 'You';
    var oppLabel = 'Computer';
    if (this.isOnlineMode()) {
      if (isGenericPlayerName(this.onlineSelfName)) {
        this.onlineSelfName = this.normalizeSelfName(
          this.onlineSelfName,
          this.getOnlinePlayerIndex()
        );
      }
      if (isGenericPlayerName(this.onlineOpponentName)) {
        this.onlineOpponentName = this.normalizeOpponentName(
          this.onlineOpponentName,
          this.getOnlinePlayerIndex() === 0 ? 1 : 0
        );
      }
      selfLabel = this.onlineSelfName ||
        (this.getOnlinePlayerIndex() === 1 ? DEFAULT_GUEST_NAME : DEFAULT_HOST_NAME);
      oppLabel = this.onlineOpponentName ||
        (this.getOnlinePlayerIndex() === 0 ? DEFAULT_GUEST_NAME : DEFAULT_HOST_NAME);
    }

    if (this.ui.playerName) this.ui.playerName.textContent = selfLabel;
    if (this.ui.aiName) this.ui.aiName.textContent = oppLabel;
    if (this.ui.sidebarPlayerName) this.ui.sidebarPlayerName.textContent = selfLabel;
    if (this.ui.sidebarOpponentName) this.ui.sidebarOpponentName.textContent = oppLabel;
    if (this.ui.mobilePlayerName) this.ui.mobilePlayerName.textContent = selfLabel;
    if (this.ui.mobileOppName) this.ui.mobileOppName.textContent = oppLabel;
    if (this.ui.chatSelfName) this.ui.chatSelfName.textContent = selfLabel;
    if (this.ui.chatOpponentName) {
      this.ui.chatOpponentName.textContent = oppLabel;
    } else if (this.ui.chatOpponentRow) {
      var oppNameEl = this.ui.chatOpponentRow.querySelector('.whos-here-name');
      if (oppNameEl) oppNameEl.textContent = oppLabel;
    }

    if (this.ui.boardAvatarHuman) {
      var humanAvatar = this.ui.boardAvatarHuman.querySelector('.avatar');
      if (humanAvatar) {
        humanAvatar.setAttribute('aria-label', selfLabel);
      }
    }
    if (this.ui.boardAvatarAi) {
      this.ui.boardAvatarAi.setAttribute(
        'aria-label',
        this.isOnlineMode() ? oppLabel + ' avatar' : 'Computer opponent'
      );
      var aiAvatar = this.ui.boardAvatarAi.querySelector('.avatar');
      if (aiAvatar) aiAvatar.setAttribute('aria-label', oppLabel);
    }
  }

  parseOnlineUrlParams() {
    var params = new URLSearchParams(location.search);
    var guest = params.has('guest') || params.get('mode') === 'join';
    var code = String(params.get('code') || '').trim().toUpperCase();
    var name = String(params.get('name') || params.get('nickname') || '').trim();
    if (!name && params.has('guest')) {
      var guestVal = String(params.get('guest') || '').trim();
      if (guestVal && guestVal !== '1' && guestVal.toLowerCase() !== 'true') {
        name = guestVal;
      }
    }
    return { guest: guest, code: code, name: name };
  }

  applyOnlineUrlParams() {
    var parsed = this.parseOnlineUrlParams();
    if (!parsed.guest && !parsed.code && !parsed.name) {
      var stored = loadStoredNickname();
      if (stored && this.ui.onlineNickname && !String(this.ui.onlineNickname.value || '').trim()) {
        this.ui.onlineNickname.value = stored.slice(0, 20);
      }
      return;
    }

    if (parsed.name && this.ui.onlineNickname) {
      this.ui.onlineNickname.value = parsed.name.slice(0, 20);
      saveStoredNickname(parsed.name);
    } else if (parsed.guest && this.ui.onlineNickname && !String(this.ui.onlineNickname.value || '').trim()) {
      var guestDefault = loadStoredNickname() || DEFAULT_GUEST_NAME;
      this.ui.onlineNickname.value = guestDefault.slice(0, 20);
    }
    if (parsed.code && this.ui.onlineJoinCode) {
      this.ui.onlineJoinCode.value = parsed.code.slice(0, 6);
    }
    if ((parsed.guest || parsed.code) && !parsed.code) {
      this.setOnlineStatus('Enter the friend code from the host, then tap Join Game.');
      if (this.ui.onlineJoinCode) {
        this.ui.onlineJoinCode.focus();
      }
    }
  }

  tryAutoRejoinOnline() {
    if (typeof QWERTYOnline === 'undefined' || !QWERTYOnline.connect) return;
    var parsed = this.parseOnlineUrlParams();
    var stored = QWERTYOnline.getStoredSession ? QWERTYOnline.getStoredSession() : null;
    var code = parsed.code || (stored && stored.code);
    if (!code) return;
    var nick = parsed.name || (stored && stored.nickname) || this.getOnlineNickname(parsed.guest || parsed.code ? 'guest' : 'host');
    if (parsed.name && this.ui.onlineNickname) {
      this.ui.onlineNickname.value = parsed.name.slice(0, 20);
    }
    if (this.ui.onlineJoinCode) {
      this.ui.onlineJoinCode.value = code.slice(0, 6);
    }
    var self = this;
    var role =
      stored && stored.role
        ? stored.role
        : parsed.guest || (parsed.code && !parsed.host)
          ? 'guest'
          : 'host';
    this.setOnlineStatus('Reconnecting to room ' + code + '…');
    QWERTYOnline.connect().then(function () {
      QWERTYOnline.joinRoom(code, nick, role);
    }).catch(function (err) {
      self.setOnlineStatus(err.message || 'Could not reconnect.', true);
    });
  }

  isShareableNetworkUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return !/127\.0\.0\.1|localhost/i.test(url);
  }

  pickShareUrl(hostInfo) {
    if (!hostInfo) return '';
    var candidates = [];
    if (hostInfo.publicUrl) candidates.push(hostInfo.publicUrl);
    if (hostInfo.preferredLanUrl) candidates.push(hostInfo.preferredLanUrl);
    if (hostInfo.lanUrls && hostInfo.lanUrls.length) {
      candidates = candidates.concat(hostInfo.lanUrls);
    }
    if (
      location.hostname &&
      this.isShareableNetworkUrl(location.protocol + '//' + location.host + '/')
    ) {
      candidates.push(location.protocol + '//' + location.host + '/');
    }
    var i, u;
    for (i = 0; i < candidates.length; i++) {
      u = candidates[i];
      if (this.isShareableNetworkUrl(u)) return u;
    }
    return '';
  }

  buildGuestJoinUrl(hostInfo, code) {
    var shareUrl = this.pickShareUrl(hostInfo);
    if (!shareUrl || !code) return '';
    var base = shareUrl.replace(/\/+$/, '');
    return base + '/?guest&code=' + encodeURIComponent(code);
  }

  updateOnlineShareUI(hostInfo, code) {
    var joinUrl = this.buildGuestJoinUrl(hostInfo, code);
    var noLinkMsg =
      'Do NOT send 127.0.0.1 to Blake. Open the black server window or BLAKE-OPEN-THIS-LINK.txt on this PC for the full http://192.168.1.??? link (real digits, not the letters xxx). After Create Game, tap Copy link.';

    var blocks = [
      { block: this.ui.onlineShareBlock, urlEl: this.ui.onlineShareUrl },
      { block: this.ui.onlineHostShareBlock, urlEl: this.ui.onlineHostShareUrl },
    ];
    blocks.forEach(function (pair) {
      if (!pair.block || !pair.urlEl) return;
      pair.block.hidden = false;
      if (joinUrl) {
        pair.urlEl.textContent = joinUrl;
        pair.urlEl.classList.remove('online-share-warning');
      } else {
        pair.urlEl.textContent = noLinkMsg;
        pair.urlEl.classList.add('online-share-warning');
      }
    });
    return joinUrl;
  }

  copyTextToClipboard(text, onDone) {
    var done = onDone || function () {};
    if (!text) {
      done(false);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        done(true);
      }).catch(function () {
        done(false);
      });
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!ok);
    } catch (_) {
      done(false);
    }
  }

  fetchHostInfo() {
    var self = this;
    return fetch('/api/host-info', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('host-info failed');
        return res.json();
      })
      .then(function (info) {
        self._hostInfo = info;
        return info;
      })
      .catch(function () {
        return self._hostInfo;
      });
  }

  setupOnline() {
    var self = this;
    if (typeof window.QWERTYOnline === 'undefined') return;

    QWERTYOnline.on('hello', function (msg) {
      if (msg.hostInfo) self._hostInfo = msg.hostInfo;
    });

    QWERTYOnline.on('room_created', function (msg) {
      self.friendCode = msg.code;
      if (msg.hostInfo) self._hostInfo = msg.hostInfo;
      self.onlinePlayerIndex = msg.playerIndex;
      self.applyOnlineRosterNames(msg);
      self.onlineOpponentName = 'Opponent';
      self.gameMode = 'online';
      self._onlineConnected = true;
      self._onlineGameStarted = false;
      self._onlineStateReady = false;
      if (QWERTYOnline.saveStoredSession) {
        QWERTYOnline.saveStoredSession(msg.code, self.getOnlineNickname('host'), 'host');
      }
      self.hideExitScreen();
      self.ensureGameShell();
      self.syncPlayerNameLabels();
      self.updateInGameRoomBadge(msg.code);
      var joinUrl = self.updateOnlineShareUI(self._hostInfo, msg.code);
      self.showOnlineHostWaiting(msg.code, 'Waiting for opponent to join…');
      self.openOnlineGameShell();
      if (self.ui.onlineRoomCode) {
        self.ui.onlineRoomCode.textContent = msg.code;
      }
      if (self.ui.onlineWaiting) {
        self.ui.onlineWaiting.hidden = false;
      }
      self.setOnlineStatus('Room ' + msg.code + ' — waiting for friend…');
      self.setMessage(
        joinUrl
          ? 'Send Blake this link (NOT 127.0.0.1): ' + joinUrl
          : msg.message || 'Share code ' + msg.code + ' — use Wi-Fi link from server window, NOT 127.0.0.1.'
      );
      self.fetchHostInfo().then(function (info) {
        joinUrl = self.updateOnlineShareUI(info || self._hostInfo, msg.code);
        if (joinUrl) {
          self.setMessage('Send Blake this link (NOT 127.0.0.1): ' + joinUrl);
        }
      });
    });

    QWERTYOnline.on('left_room', function () {
      self.friendCode = '';
      self._onlineConnected = false;
      self._onlineGameStarted = false;
      self._onlineStateReady = false;
      if (self.gameMode === 'online') {
        self.gameMode = 'ai';
      }
      self.updateInGameRoomBadge('');
      self.hideOnlineHostWaiting();
      self.setOnlineStatus('Left room — ready to create or join another.');
    });

    QWERTYOnline.on('opponent_joined', function (msg) {
      self.applyOnlineRosterNames(msg);
      self.handleOnlineGameStart({
        playerIndex: msg.playerIndex != null ? msg.playerIndex : 0,
        opponentName: self.onlineOpponentName,
        selfName: self.onlineSelfName,
        hostName: msg.hostName,
        guestName: msg.guestName,
        state: msg.state,
      });
    });

    QWERTYOnline.on('joined', function (msg) {
      self.friendCode = msg.code;
      self.onlinePlayerIndex = msg.playerIndex === 1 ? 1 : 0;
      self.applyOnlineRosterNames(msg);
      self.gameMode = 'online';
      self.syncGuestBoardOrientation();
      self._onlineConnected = true;
      self._onlineGameStarted = false;
      self._onlineStateReady = false;
      self.hideExitScreen();
      self.hideOnlineHostWaiting();
      self.ensureGameShell();
      self.openOnlineGameShell();
      self.updateInGameRoomBadge(msg.code);
      self.setOnlineStatus('Joined room ' + msg.code);
      if (msg.state) {
        self.handleOnlineGameStart({
          playerIndex: msg.playerIndex != null ? msg.playerIndex : 1,
          opponentName: self.onlineOpponentName,
          selfName: self.onlineSelfName,
          hostName: msg.hostName,
          guestName: msg.guestName,
          state: msg.state,
        });
      } else {
        self.setMessage('Joined room ' + msg.code + ' — starting game…');
        if (self._guestStartWatchId) clearTimeout(self._guestStartWatchId);
        self._guestStartWatchId = setTimeout(function () {
          self._guestStartWatchId = null;
          if (self._onlineGameStarted && self._onlineStateReady) return;
          if (self.getOnlinePlayerIndex() !== 1) return;
          self.scheduleOnlineStateRetry('Loading game board…');
        }, 1200);
      }
    });

    QWERTYOnline.on('game_start', function (msg) {
      self._rematchPending = false;
      self.handleOnlineGameStart(msg);
    });

    QWERTYOnline.on('rematch_status', function (msg) {
      self.handleRematchStatus(msg);
    });

    QWERTYOnline.on('state_update', function (msg) {
      self.applyOnlineState(msg.state, msg);
    });

    QWERTYOnline.on('move_rejected', function (msg) {
      self._onlineAwaitingServer = false;
      var rejectReason = msg.reason || 'Move rejected.';
      /*
       * Server rejected the play. Prefer server state when present (rack/board
       * are authoritative). Always clear local preview/pending overlays so a
       * later play cannot stack on leftover highlight cells.
       */
      self.abortInvalidPlayAttempt(rejectReason);
      if (msg.state) {
        self.applyOnlineState(msg.state, { event: 'rejected' });
      } else if (self._lastOnlineServerView) {
        self.applyOnlineState(self._lastOnlineServerView, { event: 'rejected' });
      }
      self.showOnlineAlert(rejectReason, 'error');
    });

    QWERTYOnline.on('error', function (msg) {
      if (self.isOnlineMode() && self._onlineAwaitingServer) {
        self._onlineAwaitingServer = false;
        if (self._lastOnlineServerView) {
          self.applyOnlineState(self._lastOnlineServerView, { event: 'error' });
        }
      }
      self.setOnlineStatus(msg.message || 'Server error.', true);
    });

    QWERTYOnline.on('chat', function (msg) {
      if (!msg.text) return;
      /* Server broadcasts to both seats — skip our own echo (already shown as You). */
      if (msg.from === self.getOnlinePlayerIndex()) return;
      self.addChatLine(
        msg.name || self.onlineOpponentName || 'Opponent',
        msg.text,
        'opponent'
      );
    });

    QWERTYOnline.on('opponent_disconnected', function (msg) {
      var name = msg.playerIndex === self.getOnlinePlayerIndex()
        ? 'You'
        : (self.onlineOpponentName || 'Opponent');
      if (msg.playerIndex !== self.getOnlinePlayerIndex()) {
        self.setMessage(
          name + ' disconnected — waiting up to 2 minutes to reconnect…',
          'error'
        );
      }
    });

    QWERTYOnline.on('opponent_reconnected', function (msg) {
      if (msg.playerIndex !== self.getOnlinePlayerIndex()) {
        self.applyOnlineRosterNames(msg);
        self.syncPlayerNameLabels();
        self.syncOnlineLegendUI();
        self.setMessage(
          (self.onlineOpponentName || 'Opponent') + ' reconnected.',
          'success'
        );
      }
    });

    QWERTYOnline.on('rejoined', function (msg) {
      self.friendCode = msg.code;
      self.onlinePlayerIndex = msg.playerIndex === 1 ? 1 : 0;
      self.applyOnlineRosterNames(msg);
      self.gameMode = 'online';
      self.gameOver = false;
      self.syncGuestBoardOrientation();
      self._onlineConnected = true;
      self._onlineGameStarted = false;
      self._onlineStateReady = false;
      self.hideExitScreen();
      self.hideOnlineHostWaiting();
      self.ensureGameShell();
      self.openOnlineGameShell();
      self.updateInGameRoomBadge(msg.code);
      self.setOnlineStatus('Reconnected to room ' + msg.code);
      if (msg.state) {
        self.handleOnlineGameStart({
          playerIndex: msg.playerIndex != null ? msg.playerIndex : 1,
          opponentName: self.onlineOpponentName,
          selfName: self.onlineSelfName,
          hostName: msg.hostName,
          guestName: msg.guestName,
          state: msg.state,
        });
      } else {
        QWERTYOnline.requestState();
      }
    });

    QWERTYOnline.on('opponent_left', function () {
      self._rematchPending = false;
      if (QWERTYOnline.clearStoredSession) QWERTYOnline.clearStoredSession();
      self.setMessage('Your opponent left the game.', 'error');
      self.gameOver = true;
      self.stopTurnTimer();
      self.updateUI();
      self.draw();
    });

    QWERTYOnline.on('disconnected', function () {
      if (self.isOnlineMode()) {
        self._onlineConnected = false;
        if (self.friendCode) {
          self.setMessage('Connection lost — trying to reconnect…', 'error');
          self.setOnlineStatus('Reconnecting to room ' + self.friendCode + '…', true);
          return;
        }
        self._onlineGameStarted = false;
        self._onlineStateReady = false;
        var disconnectMsg = 'Disconnected from server. Refresh the page and create a new room.';
        self.setMessage(disconnectMsg, 'error');
        self.setOnlineStatus('Disconnected from server.', true);
        if (self.ui.onlineHostWaiting && !self.ui.onlineHostWaiting.hidden) {
          self.showOnlineHostWaitingStatus(disconnectMsg, true);
        }
      }
    });

    if (this.ui.btnCreateRoom) {
      this.ui.btnCreateRoom.addEventListener('click', function () {
        self.createOnlineRoom();
      });
    }

    if (this.ui.btnJoinRoom) {
      this.ui.btnJoinRoom.addEventListener('click', function () {
        self.joinOnlineRoom();
      });
    }

    function bindCopy(btn, getText, statusFn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        self.copyTextToClipboard(getText(), function (ok) {
          if (statusFn) statusFn(ok ? 'Link copied — send it to your friend.' : 'Could not copy. Select the link and copy manually.', !ok);
        });
      });
    }

    bindCopy(this.ui.btnCopyShareLink, function () {
      return self.ui.onlineShareUrl ? self.ui.onlineShareUrl.textContent : '';
    }, function (text, isError) {
      self.setOnlineStatus(text, isError);
    });

    bindCopy(this.ui.btnCopyHostShareLink, function () {
      return self.ui.onlineHostShareUrl ? self.ui.onlineHostShareUrl.textContent : '';
    }, function (text, isError) {
      self.showOnlineHostWaitingStatus(text, isError);
    });
  }

  getMenuRoomCode() {
    var codeEl = this.ui.onlineJoinCode;
    return codeEl && codeEl.value ? codeEl.value.trim().toUpperCase() : '';
  }

  updateInGameRoomBadge(code) {
    var badge = this.ui.inGameRoomBadge;
    var codeEl = this.ui.inGameRoomCode;
    var show = !!(code && this.gameMode === 'online');
    if (codeEl) codeEl.textContent = code || '';
    if (badge) badge.hidden = !show;
    if (this.ui.chatRoomCodeValue) this.ui.chatRoomCodeValue.textContent = code || '';
    if (this.ui.chatRoomCode) this.ui.chatRoomCode.hidden = !show;
  }

  createOnlineRoom() {
    var self = this;
    var code = this.getMenuRoomCode();
    if (code && (code.length < 4 || code.length > 6)) {
      this.setOnlineStatus('Room code must be 4–6 characters (or leave blank for MAIN).', true);
      return;
    }
    this.hideExitScreen();
    this.ensureGameShell();
    this.setOnlineStatus(code ? 'Creating room ' + code + '…' : 'Creating default room MAIN…');
    QWERTYOnline.connect()
      .then(function () {
        if (QWERTYOnline.leaveRoom) QWERTYOnline.leaveRoom();
        return new Promise(function (resolve) {
          setTimeout(resolve, 40);
        });
      })
      .then(function () {
        QWERTYOnline.createRoom(self.getOnlineNickname('host'), code || undefined);
      })
      .catch(function (err) {
        self.setOnlineStatus(err.message || 'Could not connect.', true);
      });
  }

  joinOnlineRoom() {
    var self = this;
    var code = this.getMenuRoomCode() || DEFAULT_ROOM_CODE;
    if (code.length < 4 || code.length > 6) {
      this.setOnlineStatus('Room code must be 4–6 characters (or leave blank for MAIN).', true);
      return;
    }
    this.setOnlineStatus('Joining room ' + code + '…');
    QWERTYOnline.connect()
      .then(function () {
        if (QWERTYOnline.leaveRoom) QWERTYOnline.leaveRoom();
        return new Promise(function (resolve) {
          setTimeout(resolve, 40);
        });
      })
      .then(function () {
        QWERTYOnline.joinRoom(code, self.getOnlineNickname('guest'), 'guest');
      })
      .catch(function (err) {
        self.setOnlineStatus(err.message || 'Could not connect.', true);
      });
  }

  openOnlineGameShell() {
    this.hideExitScreen();
    this.hidePlayAgainDialog();
    this.hideMainMenu();
    if (this.ui.onlineWaiting) this.ui.onlineWaiting.hidden = true;
    this.ensureGameShell();
    var self = this;
    requestAnimationFrame(function () {
      self.withStableScroll(function () {
        self.resize();
        self.draw();
      });
    });
  }

  showOnlineHostWaiting(code, message) {
    if (this.ui.onlineHostRoomCode) {
      this.ui.onlineHostRoomCode.textContent = code || this.friendCode || '';
    }
    if (this.ui.onlineHostWaitingMsg) {
      this.ui.onlineHostWaitingMsg.textContent = message || 'Waiting for opponent to join…';
    }
    var hint = 'Connected — share your code and link. Keep this window open.';
    if (this._hostInfo && this._hostInfo.shareHint) {
      hint = this._hostInfo.shareHint;
    }
    this.showOnlineHostWaitingStatus(hint);
    this.updateOnlineShareUI(this._hostInfo, code || this.friendCode);
    if (this.ui.onlineHostWaiting) {
      this.ui.onlineHostWaiting.hidden = false;
    }
  }

  showOnlineHostWaitingStatus(text, isError) {
    if (!this.ui.onlineHostStatus) return;
    this.ui.onlineHostStatus.textContent = text || '';
    this.ui.onlineHostStatus.classList.toggle('error', !!isError);
  }

  hideOnlineHostWaiting() {
    if (this.ui.onlineHostWaiting) {
      this.ui.onlineHostWaiting.hidden = true;
    }
    this.clearOnlineStateRetry();
  }

  clearOnlineStateRetry() {
    if (this._hostStateRetryId) {
      clearTimeout(this._hostStateRetryId);
      this._hostStateRetryId = null;
    }
    if (this._guestStartWatchId) {
      clearTimeout(this._guestStartWatchId);
      this._guestStartWatchId = null;
    }
  }

  scheduleOnlineStateRetry(reason) {
    var self = this;
    if (typeof QWERTYOnline === 'undefined' || !QWERTYOnline.requestState) return;
    this.clearOnlineStateRetry();
    if (this.getOnlinePlayerIndex() === 0) {
      this.showOnlineHostWaitingStatus(reason || 'Loading game…');
    } else {
      this.setMessage(reason || 'Loading game board…');
    }
    var attempt = 0;
    function retry() {
      if (self._onlineGameStarted && self._onlineStateReady) {
        self.clearOnlineStateRetry();
        return;
      }
      attempt++;
      if (attempt > 6) {
        var failMsg =
          'Game data did not arrive. Press Ctrl+F5, restart OPEN ONLINE GAME.bat, and try again.';
        if (self.getOnlinePlayerIndex() === 0) {
          self.showOnlineHostWaitingStatus(failMsg, true);
        }
        self.showOnlineAlert('Could not start online game. Refresh both players and try again.', 'error');
        return;
      }
      try {
        if (QWERTYOnline.isConnected && QWERTYOnline.isConnected()) {
          QWERTYOnline.requestState();
        } else {
          QWERTYOnline.connect().then(function () {
            QWERTYOnline.requestState();
          }).catch(function () {});
        }
      } catch (_) {}
      self._hostStateRetryId = setTimeout(retry, attempt < 3 ? 800 : 1500);
    }
    retry();
  }

  handleOnlineGameStart(msg) {
    if (!msg) return;
    this.hideExitScreen();
    this.hideOnlineHostWaiting();
    this.ensureGameShell();
    this.openOnlineGameShell();
    if (msg.playerIndex != null) {
      this.onlinePlayerIndex = msg.playerIndex === 1 ? 1 : 0;
    }
    this.applyOnlineRosterNames(msg);
    this.syncPlayerNameLabels();
    this.syncGuestBoardOrientation();
    if (msg.state) {
      this.clearOnlineStateRetry();
      this.beginOnlineGame(msg);
      return;
    }
    var opp = this.onlineOpponentName || 'Opponent';
    if (this.getOnlinePlayerIndex() === 0) {
      this.showOnlineHostWaiting(
        this.friendCode,
        opp + ' joined — loading your game…'
      );
    } else {
      this.setMessage('Joined — loading game board…');
    }
    this.scheduleOnlineStateRetry('Fetching game state from server…');
  }

  beginOnlineGame(msg) {
    this.openOnlineGameShell();
    this.hideOnlineHostWaiting();

    if (!msg || !msg.state) {
      this.showOnlineAlert('Server did not send a valid game state. Refresh and try again.', 'error');
      return false;
    }

    if (this._onlineGameStarted && this._onlineStateReady) {
      this.applyOnlineState(msg.state, { event: 'game_start' });
      return true;
    }

    try {
      this.cancelPostGameFlow();
      this.cancelPendingAI();
      this.gameMode = 'online';
      this.onlinePlayerIndex = msg.playerIndex === 1 ? 1 : 0;
      this.applyOnlineRosterNames(msg);
      this.syncGuestBoardOrientation();
      this.gameOverDialogDismissed = false;
      this.gameOver = false;
      this._postGameFlowStarted = false;
      this.hideGameOverSplash();
      this.hidePlayAgainDialog();
      this._onlineStateReady = false;
      this._rematchPending = false;
      this.setOnlineStatus('');
      this.ensureGameShell();
      this.resetChat();
      this.addChatSystem('Online game started vs ' + this.onlineOpponentName + '.');
      this.applyOnlineState(msg.state, { event: 'game_start' });
      if (!this._onlineStateReady) {
        this.showOnlineAlert('Could not sync game state. Refresh and try again.', 'error');
        return false;
      }
      this._onlineGameStarted = true;
      this.updateInGameRoomBadge(this.friendCode);
      this.ensureAudioContext();
      this.preloadSfx();
      this.playSfx('introduction');
      var cornerMsg =
        'Shared board: green bottom-left is Deb\'s start; amber top-right is Blake\'s start. ' +
        'Words read left-to-right / top-to-bottom.';
      this.setMessage(cornerMsg + ' First to 1000 wins!');
      this.syncOnlineLegendUI();
      var self = this;
      requestAnimationFrame(function () {
        self.withStableScroll(function () {
          self.resize();
          self.draw();
        });
      });
      return true;
    } catch (err) {
      console.error('beginOnlineGame failed', err);
      this.showOnlineAlert('Could not start online game: ' + (err.message || 'unknown error'), 'error');
      return false;
    }
  }

  clonePendingPlacements() {
    var copy = new Map();
    this.pendingPlacements.forEach(function (p, idx) {
      copy.set(idx, {
        letter: p.letter,
        rackIndex: p.rackIndex,
        tileId: p.tileId || null,
        blankAs: p.blankAs != null ? p.blankAs : null,
      });
    });
    return copy;
  }

  getOnlinePlayerIndex() {
    return this.onlinePlayerIndex === 1 ? 1 : 0;
  }

  /**
   * Shared fixed board — never flip for either seat.
   */
  shouldFlipOnlineBoard() {
    return false;
  }

  /** Viewer seat: 0 host (Deb), 1 guest (Blake). Not current turn. */
  getBoardViewerId() {
    if (!this.isOnlineMode()) return 0;
    return this.getOnlinePlayerIndex() === 1 ? 1 : 0;
  }

  getVisualPosition(playerId, logicalPos) {
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    var viewer = playerId != null ? playerId : this.getBoardViewerId();
    if (api) {
      return api.getVisualPosition(viewer, logicalPos, ROWS, COLS);
    }
    return { row: logicalPos.row, col: logicalPos.col };
  }

  /** Visual click/drop → logical board coords before any board update. */
  getLogicalPosition(playerId, visualPos) {
    return this.visualToLogical(playerId, visualPos);
  }

  /** Alias for placement paths: visual → logical. */
  visualToLogical(playerId, visualPos) {
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    var viewer = playerId != null ? playerId : this.getBoardViewerId();
    if (api) {
      return api.visualToLogical(viewer, visualPos, ROWS, COLS);
    }
    return { row: visualPos.row, col: visualPos.col };
  }

  syncGuestBoardOrientation() {
    /* Shared fixed camera — never flip guest view. */
    this._guestBoardFlip = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('qwerty-guest-view');
    }
    this.rebuildOnlineDisplayBoard();
  }

  /**
   * Visual row/col → logical index (identity — shared fixed board).
   */
  serverIdxFromVisualRowCol(visualRow, visualCol) {
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    if (api) {
      return api.logicalIdxFromVisualRowCol(
        this.getBoardViewerId(),
        visualRow,
        visualCol,
        ROWS,
        COLS
      );
    }
    var log = this.visualToLogical(this.getBoardViewerId(), {
      row: visualRow,
      col: visualCol,
    });
    return log.row * COLS + log.col;
  }

  visualRowColFromServerIdx(idx) {
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    if (api) {
      return api.visualRowColFromLogicalIdx(this.getBoardViewerId(), idx, ROWS, COLS);
    }
    var row = Math.floor(idx / COLS);
    var col = idx % COLS;
    var vis = this.getVisualPosition(this.getBoardViewerId(), { row: row, col: col });
    return { vr: vis.row, vc: vis.col };
  }

  /** True when this row's word span includes a committed board tile not being replaced. */
  guestHorizontalLineUsesBoardTile(placements) {
    if (!placements || !placements.size || !this.board) return false;
    var indices = Array.from(placements.keys());
    var cols = indices.map(function (i) { return i % COLS; });
    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    if (!rows.every(function (r) { return r === rows[0]; })) return false;
    var row = rows[0];
    var minC = Math.min.apply(null, cols);
    var maxC = Math.max.apply(null, cols);
    while (minC > 0) {
      if (!this.board[row * COLS + (minC - 1)]) break;
      minC--;
    }
    while (maxC < COLS - 1) {
      if (!this.board[row * COLS + (maxC + 1)]) break;
      maxC++;
    }
    var c, idx;
    for (c = minC; c <= maxC; c++) {
      idx = row * COLS + c;
      if (this.board[idx] && !placements.has(idx)) return true;
    }
    return false;
  }

  /**
   * Guest tiles are dropped on the correct server cells. Remap letters from
   * visual reading order (mirror view) into server row/column order before validate.
   */
  normalizeGuestPlacements(placements) {
    return placements;
  }

  /**
   * On the 180° guest view, words read backwards unless letter order is reversed
   * within each visual row/column run. Crossword cells skip conflicting overrides.
   */
  reverseVisualRunsForGuestMirror(board) {
    var overrides = {};
    var self = this;

    function proposeRun(indices) {
      if (!indices || indices.length < 2) return;
      var letters = indices.map(function (i) {
        return board[i] && board[i].letter ? board[i].letter : '';
      });
      if (letters.some(function (ch) { return !ch; })) return;
      var reversed = letters.slice().reverse();
      var j, idx, ch;
      for (j = 0; j < indices.length; j++) {
        idx = indices[j];
        ch = reversed[j];
        if (overrides[idx] !== undefined && overrides[idx] !== ch) continue;
        overrides[idx] = ch;
      }
    }

    function flushHorizontal(run) {
      proposeRun(run);
      run = [];
    }
    function flushVertical(run) {
      proposeRun(run);
      run = [];
    }

    var vr, vc, idx, cell, run;
    for (vr = 0; vr < ROWS; vr++) {
      run = [];
      for (vc = 0; vc <= COLS; vc++) {
        if (vc < COLS) {
          idx = self.serverIdxFromVisualRowCol(vr, vc);
          cell = board[idx];
          if (cell && cell.letter) {
            run.push(idx);
          } else {
            flushHorizontal(run);
            run = [];
          }
        } else {
          flushHorizontal(run);
        }
      }
    }
    for (vc = 0; vc < COLS; vc++) {
      run = [];
      for (vr = 0; vr <= ROWS; vr++) {
        if (vr < ROWS) {
          idx = self.serverIdxFromVisualRowCol(vr, vc);
          cell = board[idx];
          if (cell && cell.letter) {
            run.push(idx);
          } else {
            flushVertical(run);
            run = [];
          }
        } else {
          flushVertical(run);
        }
      }
    }

    Object.keys(overrides).forEach(function (key) {
      idx = Number(key);
      if (board[idx]) board[idx].letter = overrides[key];
    });
  }

  /** Reverse letter order within a run so guest flip view reads words left-to-right. */
  reverseRunLettersOnBoard(board, indices) {
    if (indices.length < 2) return;
    var tiles = indices.map(function (i) { return board[i]; });
    var i;
    for (i = 0; i < indices.length; i++) {
      board[indices[indices.length - 1 - i]] = tiles[i];
    }
  }

  /**
   * Guest view mirrors the board 180°, reversing visual reading order. Reverse
   * letters within each standalone valid word on the display clone (both players).
   * Skip valid-word crosswords — those keep server letters to avoid garbling.
   */
  applyGuestDisplayLetterFix(board) {
    var words = getAllWordsFromBoard(board, COLS, ROWS);
    var validWords = [];
    var runCount = {};
    var overrides = {};
    var i, j, w, cells, letters, rev, idx, owner;
    for (i = 0; i < words.length; i++) {
      w = words[i];
      cells = w.cells;
      if (!cells || cells.length < 2) continue;
      letters = cells.map(function (cellIdx) {
        return board[cellIdx] && board[cellIdx].letter ? board[cellIdx].letter : '';
      }).join('');
      if (isValidWord(letters) || isValidWord(letters.split('').reverse().join(''))) {
        validWords.push(w);
      }
    }
    validWords.forEach(function (entry) {
      entry.cells.forEach(function (cellIdx) {
        runCount[cellIdx] = (runCount[cellIdx] || 0) + 1;
      });
    });
    function runOwner(cellList) {
      var o = null;
      var k, c;
      for (k = 0; k < cellList.length; k++) {
        c = board[cellList[k]];
        if (!c) continue;
        if (o === null) o = c.owner;
        else if (o !== c.owner) return 'mixed';
      }
      return o;
    }
    for (i = 0; i < validWords.length; i++) {
      w = validWords[i];
      cells = w.cells;
      if (cells.some(function (cellIdx) { return runCount[cellIdx] >= 2; })) continue;
      owner = runOwner(cells);
      if (owner !== PLAYER.HUMAN && owner !== PLAYER.AI) continue;
      letters = cells.map(function (cellIdx) {
        return board[cellIdx] && board[cellIdx].letter ? board[cellIdx].letter : '';
      }).join('');
      rev = letters.split('').reverse();
      for (j = 0; j < cells.length; j++) {
        idx = cells[j];
        overrides[idx] = rev[j];
      }
    }
    Object.keys(overrides).forEach(function (key) {
      idx = Number(key);
      if (board[idx]) board[idx].letter = overrides[key];
    });
  }

  /**
   * Scan word runs as they appear on the flipped guest screen (visual rows/cols).
   * cells[] are server indices in left-to-right / top-to-bottom visual read order.
   */
  getVisualWordsFromBoard(board) {
    var words = [];
    var seen = {};
    var self = this;
    var vr, vc, run, start, idx, cell, letter, key, cells;

    function flushHorizontal(vr, startVc, text, cellList) {
      if (text.length < 2) return;
      key = 'vh-' + vr + '-' + startVc + '-' + text;
      if (seen[key]) return;
      seen[key] = true;
      words.push({ word: text, cells: cellList.slice(), horizontal: true });
    }

    function flushVertical(vc, startVr, text, cellList) {
      if (text.length < 2) return;
      key = 'vv-' + vc + '-' + startVr + '-' + text;
      if (seen[key]) return;
      seen[key] = true;
      words.push({ word: text, cells: cellList.slice(), horizontal: false });
    }

    for (vr = 0; vr < ROWS; vr++) {
      run = '';
      start = 0;
      cells = [];
      for (vc = 0; vc <= COLS; vc++) {
        if (vc < COLS) {
          idx = self.serverIdxFromVisualRowCol(vr, vc);
          cell = board[idx];
          letter = cell && cell.letter;
          if (letter) {
            if (!run) start = vc;
            run += letter;
            cells.push(idx);
          } else {
            flushHorizontal(vr, start, run, cells);
            run = '';
            cells = [];
          }
        } else {
          flushHorizontal(vr, start, run, cells);
        }
      }
    }

    for (vc = 0; vc < COLS; vc++) {
      run = '';
      start = 0;
      cells = [];
      for (vr = 0; vr <= ROWS; vr++) {
        if (vr < ROWS) {
          idx = self.serverIdxFromVisualRowCol(vr, vc);
          cell = board[idx];
          letter = cell && cell.letter;
          if (letter) {
            if (!run) start = vr;
            run += letter;
            cells.push(idx);
          } else {
            flushVertical(vc, start, run, cells);
            run = '';
            cells = [];
          }
        } else {
          flushVertical(vc, start, run, cells);
        }
      }
    }

    return words;
  }

  wordLettersFromBoardCells(board, cells) {
    return cells
      .map(function (i) {
        return board[i] && board[i].letter ? board[i].letter : '';
      })
      .join('');
  }

  sameDisplayLetterMultiset(sourceWord, targetWord) {
    var a = String(sourceWord || '').toUpperCase().split('').sort().join('');
    var b = String(targetWord || '').toUpperCase().split('').sort().join('');
    return a.length > 0 && a === b;
  }

  serverOwnerFromCell(idx) {
    var cell = this.board[idx];
    if (!cell) return null;
    var myIdx = this.getOnlinePlayerIndex();
    var co = this.cellOwner(cell);
    return co === PLAYER.HUMAN ? myIdx : 1 - myIdx;
  }

  runServerOwnerFromCells(cells) {
    var counts = [0, 0];
    var self = this;
    cells.forEach(function (cellIdx) {
      var so = self.serverOwnerFromCell(cellIdx);
      if (so === 0 || so === 1) counts[so]++;
    });
    return counts[0] >= counts[1] ? 0 : 1;
  }

  resolveDisplayWordForOwner(board, cells, horizontal, serverOwner) {
    var lettersVisual = this.wordLettersFromBoardCells(board, cells);
    if (isValidWord(lettersVisual)) {
      return { word: lettersVisual, order: cells };
    }

    var sortedAsc = cells.slice().sort(function (a, b) {
      if (horizontal) return (a % COLS) - (b % COLS);
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
    var lettersAsc = this.wordLettersFromBoardCells(board, sortedAsc);
    var sortedDesc = sortedAsc.slice().sort(function (a, b) {
      if (horizontal) return (b % COLS) - (a % COLS);
      return Math.floor(b / COLS) - Math.floor(a / COLS);
    });
    var lettersDesc = this.wordLettersFromBoardCells(board, sortedDesc);

    if (serverOwner === 1 && !horizontal) {
      if (isValidWord(lettersDesc)) {
        return { word: lettersDesc, order: cells };
      }
      if (isValidWord(lettersAsc)) {
        return { word: lettersAsc, order: cells };
      }
      return null;
    }

    if (isValidWord(lettersAsc)) {
      return { word: lettersAsc, order: cells };
    }
    if (isValidWord(lettersDesc)) {
      return { word: lettersDesc, order: cells };
    }
    return null;
  }

  /** Sort server indices in on-screen reading order (LTR / top-to-bottom). */
  visualSortServerIndices(indices, sameRow) {
    var self = this;
    if (this.shouldFlipOnlineBoard()) {
      return this.guestPreviewSortOrder(indices, sameRow);
    }
    if (sameRow) {
      return indices.slice().sort(function (a, b) { return (a % COLS) - (b % COLS); });
    }
    return indices.slice().sort(function (a, b) {
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
  }

  /**
   * Full pending word in viewer reading order, including locked board tiles.
   * For a single new tile, try both row and column spans and pick the best
   * reading (fixes "E" when the play is really ER/EL/ED).
   */
  pendingVisualFullWord(indices, sameRow) {
    if (!indices || !indices.length) return { text: '', cells: [] };
    var self = this;

    function expand(alongRow) {
      var allCells = indices.slice();
      var minC, maxC, minR, maxR, row, col, c, r, idx;
      if (alongRow) {
        row = Math.floor(indices[0] / COLS);
        minC = Math.min.apply(null, indices.map(function (i) { return i % COLS; }));
        maxC = Math.max.apply(null, indices.map(function (i) { return i % COLS; }));
        while (minC > 0) {
          idx = row * COLS + (minC - 1);
          if (self.board[idx] || self.pendingPlacements.has(idx)) minC--;
          else break;
        }
        while (maxC < COLS - 1) {
          idx = row * COLS + (maxC + 1);
          if (self.board[idx] || self.pendingPlacements.has(idx)) maxC++;
          else break;
        }
        allCells = [];
        for (c = minC; c <= maxC; c++) {
          idx = row * COLS + c;
          if (self.board[idx] || self.pendingPlacements.has(idx)) allCells.push(idx);
        }
      } else {
        col = indices[0] % COLS;
        minR = Math.min.apply(null, indices.map(function (i) { return Math.floor(i / COLS); }));
        maxR = Math.max.apply(null, indices.map(function (i) { return Math.floor(i / COLS); }));
        while (minR > 0) {
          idx = (minR - 1) * COLS + col;
          if (self.board[idx] || self.pendingPlacements.has(idx)) minR--;
          else break;
        }
        while (maxR < ROWS - 1) {
          idx = (maxR + 1) * COLS + col;
          if (self.board[idx] || self.pendingPlacements.has(idx)) maxR++;
          else break;
        }
        allCells = [];
        for (r = minR; r <= maxR; r++) {
          idx = r * COLS + col;
          if (self.board[idx] || self.pendingPlacements.has(idx)) allCells.push(idx);
        }
      }
      var sorted = self.visualSortServerIndices(allCells, alongRow);
      var text = sorted.map(function (i) {
        /* Always spell from logical board + pending (never display paint).
         * Paint is draw-only; using it here produced TIML/PMIE for EMIT/LIMP. */
        if (self.pendingPlacements.has(i)) {
          return self.pendingDisplayLetter(self.pendingPlacements.get(i)).toUpperCase();
        }
        var logical = self.getLetterAt(i);
        return logical ? String(logical).toUpperCase() : '';
      }).join('');
      return { text: text, cells: sorted, alongRow: alongRow };
    }

    function scoreCandidate(cand) {
      if (!cand || !cand.text) return -1;
      if (cand.text.length < 2) return 0;
      if (isValidWord(cand.text)) return 1000 + cand.text.length * 10;
      return cand.text.length;
    }

    /* Multi-tile line: honor caller orientation. */
    if (indices.length >= 2) {
      return expand(!!sameRow);
    }

    /* Single tile: consider both arms; prefer a valid dictionary word. */
    var horiz = expand(true);
    var vert = expand(false);
    if (scoreCandidate(vert) > scoreCandidate(horiz)) return vert;
    if (scoreCandidate(horiz) > 0) return horiz;
    if (vert.text && vert.text.length >= horiz.text.length) return vert;
    return horiz;
  }

  /** Read pending tiles in on-screen order (top-to-bottom / left-to-right). */
  pendingVisualWordText(indices, sameRow) {
    return this.pendingVisualFullWord(indices, sameRow).text;
  }

  /**
   * HARD NO-OP — never move letters between cells on the display clone.
   * Shared board is cell-faithful; guest view only flips coordinates.
   */
  applyGuestVisualWordOrder(displayBoard) {
    return;
  }

  /**
   * @deprecated Guest display uses server letters only (see rebuildOnlineDisplayBoard).
   */
  fixGuestDisplayWords(board) {
    return;
  }

  /**
   * @deprecated Use fixGuestDisplayWords — kept as alias for opponent-only callers.
   */
  fixOpponentWordsForGuestDisplay(board) {
    this.fixGuestDisplayWords(board);
  }

  fixOwnWordsForGuestDisplay(board) {
    /* merged into fixGuestDisplayWords */
  }

  /** Pick tile order for guest pending-word preview on the flipped board. */
  guestPreviewSortOrder(indices, sameRow) {
    var self = this;
    return indices.slice().sort(function (a, b) {
      var ra = self.visualRowColFromServerIdx(a);
      var rb = self.visualRowColFromServerIdx(b);
      if (sameRow) return ra.vc - rb.vc;
      return ra.vr - rb.vr;
    });
  }

  /**
   * @deprecated Host display uses server letters only (see rebuildOnlineDisplayBoard).
   */
  fixOpponentWordsForHostDisplay(board) {
    return;
  }

  /**
   * Display-only paint so words read LTR/TTB for this viewer seat.
   * Never mutates this.board — validation stays on the logical board.
   */
  applyViewerPaintReadingFix(displayBoard) {
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    if (!api || !displayBoard || !this.isOnlineMode()) return null;
    return api.applyReadableViewPaint(
      displayBoard,
      this.getBoardViewerId(),
      this.acceptedRuns || [],
      ROWS,
      COLS
    );
  }

  /**
   * Guest display clone: logical letters + readable paint (display-only).
   * Validation always uses this.board.
   */
  rebuildOnlineDisplayBoard() {
    if (!this.isOnlineMode()) {
      this._guestDisplayBoard = null;
      return;
    }
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    if (!api || !this.shouldFlipOnlineBoard()) {
      this._guestDisplayBoard = null;
      return;
    }
    this._guestDisplayBoard = api.buildViewerDisplayBoard(
      this.board,
      this.getBoardViewerId(),
      this.acceptedRuns || [],
      ROWS,
      COLS
    );
    this.logBoardConsistencyCheck('rebuildOnlineDisplayBoard');
    this.logViewerWordOrientation('rebuildOnlineDisplayBoard');
  }

  getDisplayBoard() {
    if (this.isOnlineMode() && this._guestDisplayBoard) {
      return this._guestDisplayBoard;
    }
    return this.board;
  }

  /**
   * Debug: logical vs visual for each accepted word.
   * Enable on-screen strip with ?debugView=1
   */
  logViewerWordOrientation(reason) {
    if (!this.isOnlineMode() || !this.board) return;
    var api = typeof QWERTYBoardView !== 'undefined' ? QWERTYBoardView : null;
    if (!api || !api.describeRunOrientation) return;
    var viewer = this.getBoardViewerId();
    var role = viewer === 1 ? 'guest(Blake)' : 'host(Deb)';
    var display = this._guestDisplayBoard || this.board;
    var runs = this.acceptedRuns || [];
    var lines = [];
    var i;
    for (i = 0; i < runs.length; i++) {
      if (!runs[i] || !runs[i].cells || runs[i].cells.length < 2) continue;
      var info = api.describeRunOrientation(
        this.board,
        display,
        viewer,
        runs[i].cells,
        runs[i].word,
        ROWS,
        COLS
      );
      lines.push(info);
      console.log(
        '[view-words]',
        reason || '',
        role,
        info.word,
        'logical=' + info.logicalAsc,
        'visualRaw=' + info.visualRaw,
        'visualPainted=' + info.visualPainted,
        info.ok ? 'OK' : 'BAD'
      );
    }
    if (this.lastWordPlayed && this.lastWordPlayed.word) {
      console.log(
        '[view-words] lastPlay',
        role,
        this.lastWordPlayed.word,
        '(see acceptedRuns above)'
      );
    }
    this._viewWordDebug = { role: role, reason: reason || '', lines: lines };
    this.updateViewWordDebugOverlay();
  }

  updateViewWordDebugOverlay() {
    var want =
      typeof location !== 'undefined' &&
      /(?:\?|&)debugView=1(?:&|$)/.test(String(location.search || ''));
    var el = document.getElementById('qwerty-view-debug');
    if (!want) {
      if (el) el.hidden = true;
      return;
    }
    if (!el && document.body) {
      el = document.createElement('div');
      el.id = 'qwerty-view-debug';
      el.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:92vw;' +
        'background:rgba(20,16,40,.92);color:#f5f0ff;font:11px/1.35 monospace;' +
        'padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre-wrap;';
      document.body.appendChild(el);
    }
    if (!el) return;
    var dbg = this._viewWordDebug;
    if (!dbg || !dbg.lines || !dbg.lines.length) {
      el.textContent = (dbg && dbg.role ? dbg.role + '\n' : '') + '(no accepted runs)';
      el.hidden = false;
      return;
    }
    el.textContent =
      dbg.role +
      ' ' +
      (dbg.reason || '') +
      '\n' +
      dbg.lines
        .map(function (info) {
          return (
            info.word +
            '  log=' +
            info.logicalAsc +
            '  raw=' +
            info.visualRaw +
            '  paint=' +
            info.visualPainted +
            (info.ok ? ' ✓' : ' ✗')
          );
        })
        .join('\n');
    el.hidden = false;
  }

  /**
   * After every sync/play: log raw-board spellings for known words so host and
   * guest can confirm identical letter positions (no display remapping).
   */
  logBoardConsistencyCheck(reason) {
    if (!this.isOnlineMode() || !this.board) return;
    var board = this.board;
    var cols = COLS;
    var targets = ['ALOES', 'GLOW', 'ROW', 'ET', 'TE', 'DARED', 'BURN'];
    var found = [];
    var wordsApi =
      typeof globalThis !== 'undefined' ? globalThis.QWERTYWordsFormed : null;
    var letterAt = wordsApi && wordsApi.letterAt
      ? wordsApi.letterAt
      : function (b, idx) {
          return b[idx] && b[idx].letter
            ? String(b[idx].letter).toUpperCase()
            : null;
        };

    function readH(row, startCol, len) {
      var s = '';
      var c;
      for (c = 0; c < len; c++) {
        var ch = letterAt(board, row * cols + startCol + c);
        if (!ch) return null;
        s += ch;
      }
      return s;
    }
    function readV(col, startRow, len) {
      var s = '';
      var r;
      for (r = 0; r < len; r++) {
        var ch = letterAt(board, (startRow + r) * cols + col);
        if (!ch) return null;
        s += ch;
      }
      return s;
    }

    var r, c, t, w, rev;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        for (t = 0; t < targets.length; t++) {
          w = targets[t];
          if (c + w.length <= COLS) {
            var h = readH(r, c, w.length);
            if (h === w) {
              found.push({ word: w, dir: 'H', row: r, col: c, spelling: h });
            }
            rev = w.split('').reverse().join('');
            if (h === rev && rev !== w) {
              found.push({
                word: w,
                dir: 'H',
                row: r,
                col: c,
                spelling: h,
                note: 'reversed-on-raw-board',
              });
            }
          }
          if (r + w.length <= ROWS) {
            var v = readV(c, r, w.length);
            if (v === w) {
              found.push({ word: w, dir: 'V', row: r, col: c, spelling: v });
            }
            rev = w.split('').reverse().join('');
            if (v === rev && rev !== w) {
              found.push({
                word: w,
                dir: 'V',
                row: r,
                col: c,
                spelling: v,
                note: 'reversed-on-raw-board',
              });
            }
          }
        }
      }
    }

    var role = this.getOnlinePlayerIndex() === 1 ? 'guest(Blake)' : 'host(Deb)';
    console.log(
      '[board-consistency]',
      reason || '',
      role,
      'flip=' + !!this.shouldFlipOnlineBoard(),
      found.length ? found : '(no target words on board yet)'
    );
  }

  syncOnlineLegendUI() {
    this.syncPlayerNameLabels();
    var opp = this.onlineOpponentName || 'Opponent';
    if (this.isOnlineMode() && isGenericPlayerName(opp)) {
      opp = this.normalizeOpponentName(
        opp,
        this.getOnlinePlayerIndex() === 0 ? 1 : 0
      );
      this.onlineOpponentName = opp;
    }
    /* Fixed board: green BL = Deb/P1, amber TR = Blake/P2 — always. */
    if (this.ui.legendStartYou) {
      this.ui.legendStartYou.textContent = this.isOnlineMode() && this.getOnlinePlayerIndex() === 1
        ? 'Your start (top-right, amber)'
        : 'Your start (bottom-left, green)';
    }
    if (this.ui.legendStartOpponent) {
      this.ui.legendStartOpponent.textContent = this.isOnlineMode() && this.getOnlinePlayerIndex() === 1
        ? opp + '\'s start (bottom-left, green)'
        : 'Blake\'s start (top-right, amber)';
    }
    if (this.isOnlineMode() && this.getOnlinePlayerIndex() === 0 && this.ui.legendStartOpponent) {
      this.ui.legendStartOpponent.textContent = opp + '\'s start (top-right, amber)';
    }
    if (this.ui.legendOpponentTiles) {
      this.ui.legendOpponentTiles.textContent = opp + '\'s words';
    }
    if (this.ui.legendSwatchYou && this.ui.legendSwatchOpponent) {
      if (this.isOnlineMode() && this.getOnlinePlayerIndex() === 1) {
        this.ui.legendSwatchYou.className = 'legend-swatch start-p2';
        this.ui.legendSwatchOpponent.className = 'legend-swatch start-p1';
      } else {
        this.ui.legendSwatchYou.className = 'legend-swatch start-p1';
        this.ui.legendSwatchOpponent.className = 'legend-swatch start-p2';
      }
    }
    if (!this.isOnlineMode()) {
      if (this.ui.legendStartYou) {
        this.ui.legendStartYou.textContent = 'Your start (bottom-left, green)';
      }
      if (this.ui.legendStartOpponent) {
        this.ui.legendStartOpponent.textContent = 'Blake\'s start (top-right, amber)';
      }
      if (this.ui.legendOpponentTiles) {
        this.ui.legendOpponentTiles.textContent = 'AI words';
      }
    }
  }

  handleRematchStatus(msg) {
    if (!this.isOnlineMode() || !msg.votes) return;
    var myIdx = this.getOnlinePlayerIndex();
    var oppIdx = 1 - myIdx;
    var opp = this.onlineOpponentName || 'Opponent';
    var iVoted = !!msg.votes[myIdx];
    var oppVoted = !!msg.votes[oppIdx];

    if (iVoted && oppVoted) {
      this.setMessage('Rematch starting…', 'success');
      return;
    }

    if (iVoted && !oppVoted) {
      this._rematchPending = true;
      this.hidePlayAgainDialog();
      this.setMessage('Waiting for ' + opp + ' to click Rematch…');
      this.addChatSystem('Rematch requested — waiting for ' + opp + '.');
      return;
    }

    if (oppVoted && !iVoted) {
      this.addChatSystem(opp + ' wants a rematch! Click Rematch on the results screen.');
      if (this.isGameOverDialogOpen() && this.ui.playAgainSummary) {
        this.ui.playAgainSummary.textContent = opp + ' wants a rematch! Click Rematch to play again.';
      }
      if (this.ui.btnPlayAgainYes) {
        this.ui.btnPlayAgainYes.classList.add('rematch-highlight');
      }
    }
  }

  requestOnlineRematch() {
    if (!this.isOnlineMode() || this._rematchPending) return;
    this.cancelPostGameFlow();
    this.hidePlayAgainDialog();
    try {
      QWERTYOnline.requestRematch();
      this._rematchPending = true;
      if (this.ui.btnPlayAgainYes) this.ui.btnPlayAgainYes.disabled = true;
      this.setMessage('Waiting for ' + (this.onlineOpponentName || 'opponent') + ' to click Rematch…');
    } catch (err) {
      this._rematchPending = false;
      this.showOnlineAlert(err.message || 'Not connected to server.', 'error');
      this.showPlayAgainDialog();
    }
  }

  buildOpponentRackPlaceholders(count) {
    var rack = new Array(RACK_SIZE).fill(null);
    var n = Math.max(0, Math.min(RACK_SIZE, count || 0));
    var i;
    for (i = 0; i < n; i++) {
      rack[i] = { letter: '?', id: 'opp-' + i };
    }
    return rack;
  }

  /** Solo play initializes racks in newGame(); online join must do the same before patching server state. */
  ensureGameShell() {
    if (!this.racks) {
      this.racks = [new Array(RACK_SIZE).fill(null), new Array(RACK_SIZE).fill(null)];
    }
    if (!this.scores) this.scores = [0, 0];
    if (!this.stars) this.stars = [0, 0];
    if (!this.board) this.board = new Array(COLS * ROWS).fill(null);
    if (!this.bag) this.bag = [];
    if (!this.lastWordPlayed) {
      this.lastWordPlayed = { player: null, word: '', score: 0 };
    }
    if (!this.acceptedRuns) this.acceptedRuns = [];
    if (this.firstMovePlayed === undefined) this.firstMovePlayed = false;
    if (!this.openingPlayed) this.openingPlayed = [false, false];
    if (this.boardsLinked === undefined) this.boardsLinked = false;
    if (this.gameOver === undefined) this.gameOver = false;
  }

  /** Server board uses player indices 0/1; map to local HUMAN/AI for this client. */
  cloneOnlineBoard(serverBoard, myIndex) {
    var out = new Array(COLS * ROWS).fill(null);
    var i, cell, letter, owner;
    if (!serverBoard) return out;
    for (i = 0; i < COLS * ROWS; i++) {
      cell = serverBoard[i];
      if (!cell) continue;
      if (typeof cell === 'string') {
        letter = String(cell).toUpperCase();
        owner = PLAYER.HUMAN;
      } else {
        letter = cell.letter != null ? String(cell.letter).toUpperCase() : '';
        if (!letter) continue;
        if (cell.owner != null) {
          owner = Number(cell.owner) === myIndex ? PLAYER.HUMAN : PLAYER.AI;
        } else {
          owner = PLAYER.HUMAN;
        }
      }
      out[i] = {
        letter: letter,
        owner: owner,
        isBlank: !!(cell.isBlank || letter === '*'),
      };
    }
    return out;
  }

  getOpeningStartIdx(player) {
    if (this.isOnlineMode()) {
      var myIdx = this.getOnlinePlayerIndex();
      if (player === PLAYER.HUMAN) {
        return myIdx === 0 ? START_P1_IDX : START_P2_IDX;
      }
      return myIdx === 0 ? START_P2_IDX : START_P1_IDX;
    }
    return player === PLAYER.HUMAN ? START_P1_IDX : START_P2_IDX;
  }

  /** Build authoritative server-shaped state for online move validation. */
  buildServerSnapshotForValidation() {
    var myIdx = this.getOnlinePlayerIndex();
    var oppIdx = 1 - myIdx;
    var board = new Array(COLS * ROWS).fill(null);
    var i, cell, owner;
    for (i = 0; i < COLS * ROWS; i++) {
      cell = this.board[i];
      if (!cell) continue;
      owner = this.cellOwner(cell);
      board[i] = {
        letter: this.boardCellLetter(cell),
        owner: owner === PLAYER.HUMAN ? myIdx : oppIdx,
        isBlank: !!cell.isBlank,
      };
    }
    var racks = [new Array(RACK_SIZE).fill(null), new Array(RACK_SIZE).fill(null)];
    var humanRack = this.racks[PLAYER.HUMAN] || [];
    for (i = 0; i < RACK_SIZE; i++) {
      if (humanRack[i]) {
        racks[myIdx][i] = {
          letter: humanRack[i].letter,
          id: humanRack[i].id,
        };
      }
    }
    return {
      board: board,
      racks: racks,
      bag: new Array(this.bag.length).fill('_'),
      boardsLinked: !!this.boardsLinked,
      openingPlayed: [
        myIdx === 0 ? !!this.openingPlayed[PLAYER.HUMAN] : !!this.openingPlayed[PLAYER.AI],
        myIdx === 0 ? !!this.openingPlayed[PLAYER.AI] : !!this.openingPlayed[PLAYER.HUMAN],
      ],
      specials: this.specials,
    };
  }

  placementsToServerList(placements) {
    var list = [];
    placements.forEach(function (p, idx) {
      list.push({
        idx: idx,
        letter: p.letter,
        rackIndex: p.rackIndex,
        tileId: p.tileId || null,
        blankAs: p.blankAs != null ? p.blankAs : null,
      });
    });
    return list;
  }

  /** Canonicalize placements before client-side validation (matches server applyPlay). */
  normalizedPlacementsForEngine(placements) {
    var list = this.placementsToServerList(placements);
    if (typeof QWERTYEngine !== 'undefined' && this.isOnlineMode()) {
      list = QWERTYEngine.canonicalizePlacements(
        list,
        this.buildServerSnapshotForValidation(),
        this.getOnlinePlayerIndex()
      );
    }
    return list;
  }

  /**
   * Word-oriented submit: cells in viewer reading order (LTR / TTB on screen)
   * so the server validates spelling along that path, not ascending indices.
   */
  orderedCellsForSubmittedWord(engineResult) {
    if (!engineResult || !engineResult.primaryWordCells || !engineResult.primaryWordCells.length) {
      return [];
    }
    var cells = engineResult.primaryWordCells.map(Number);
    var horizontal = cells.every(function (idx) {
      return Math.floor(idx / COLS) === Math.floor(cells[0] / COLS);
    });
    var self = this;
    if (this.shouldFlipOnlineBoard()) {
      return cells.slice().sort(function (a, b) {
        var ra = self.visualRowColFromServerIdx(a);
        var rb = self.visualRowColFromServerIdx(b);
        if (horizontal) return ra.vc - rb.vc;
        return ra.vr - rb.vr;
      });
    }
    return cells.slice().sort(function (a, b) {
      if (horizontal) return (a % COLS) - (b % COLS);
      return Math.floor(a / COLS) - Math.floor(b / COLS);
    });
  }

  spellServerCellsWithPending(cells) {
    var self = this;
    var out = '';
    var i, idx, p;
    for (i = 0; i < cells.length; i++) {
      idx = Number(cells[i]);
      if (this.pendingPlacements.has(idx)) {
        p = this.pendingPlacements.get(idx);
        out += this.pendingDisplayLetter(p).toUpperCase();
      } else if (this.board[idx]) {
        out += String(this.board[idx].letter || '').toUpperCase();
      } else {
        return '';
      }
    }
    return out;
  }

  /** Reconcile pending tiles with rack slots (shuffle/reorder can stale rackIndex/tileId). */
  resolveOnlinePlacementTileIds() {
    var rack = this.racks[PLAYER.HUMAN];
    if (!rack) return;
    var usedIds = {};
    var usedSlots = {};

    function letterMatch(tile, letter) {
      return (
        tile &&
        String(tileLetter(tile)).toUpperCase() === String(letter || '').toUpperCase()
      );
    }

    /* Pass 1: keep unique tileId bindings that still match the rack. */
    this.pendingPlacements.forEach(function (p) {
      if (!p || !p.tileId) return;
      var slot = findRackSlotByTileId(rack, p.tileId);
      if (
        slot >= 0 &&
        letterMatch(rack[slot], p.letter) &&
        !usedIds[p.tileId] &&
        !usedSlots[slot]
      ) {
        p.rackIndex = slot;
        usedIds[p.tileId] = true;
        usedSlots[slot] = true;
      } else {
        p.tileId = null;
      }
    });

    /* Pass 2: bind by unused rackIndex when letter still matches. */
    this.pendingPlacements.forEach(function (p) {
      if (!p || p.tileId) return;
      var slot = p.rackIndex >= 0 ? p.rackIndex : -1;
      var t = slot >= 0 ? rack[slot] : null;
      if (
        slot >= 0 &&
        t &&
        t.id &&
        letterMatch(t, p.letter) &&
        !usedSlots[slot] &&
        !usedIds[t.id]
      ) {
        p.tileId = t.id;
        usedIds[t.id] = true;
        usedSlots[slot] = true;
      } else {
        p.rackIndex = -1;
      }
    });

    /* Pass 3: assign any leftover placement to an unused matching letter tile. */
    this.pendingPlacements.forEach(function (p) {
      if (!p || p.tileId) return;
      var i, t;
      for (i = 0; i < RACK_SIZE; i++) {
        t = rack[i];
        if (!t || !t.id || usedIds[t.id] || usedSlots[i]) continue;
        if (letterMatch(t, p.letter)) {
          p.rackIndex = i;
          p.tileId = t.id;
          usedIds[t.id] = true;
          usedSlots[i] = true;
          break;
        }
      }
    });
  }

  validateOnlineMoveWithEngine(placements, moveOpts) {
    if (typeof QWERTYEngine === 'undefined') {
      return {
        valid: false,
        reason: 'Game engine failed to load. Refresh the page (Ctrl+F5) and try again.',
      };
    }
    this.resolveOnlinePlacementTileIds();
    var opts = moveOpts ? Object.assign({}, moveOpts) : {};
    return QWERTYEngine.validateMove(
      this.buildServerSnapshotForValidation(),
      this.normalizedPlacementsForEngine(placements),
      this.getOnlinePlayerIndex(),
      opts
    );
  }

  showOnlineAlert(text, type) {
    this.setMessage(text, type);
    if (this.ui.onlineStatus) {
      this.ui.onlineStatus.textContent = text || '';
      this.ui.onlineStatus.classList.toggle('error', type === 'error');
    }
    if (
      this.ui.onlineHostWaiting &&
      !this.ui.onlineHostWaiting.hidden &&
      text
    ) {
      this.showOnlineHostWaitingStatus(text, type === 'error');
    }
    if (this.isOnlineMode() && text) {
      this.addChatSystem(text);
    }
  }

  applyOnlineState(view, msg) {
    if (!view) {
      if (this.isOnlineMode()) {
        this.showOnlineAlert('Server sent an invalid game update.', 'error');
      }
      this._onlineAwaitingServer = false;
      return;
    }
    if (msg) this.applyOnlineRosterNames(msg);
    try {
      try {
        this._lastOnlineServerView = JSON.parse(JSON.stringify(view));
      } catch (_) {
        this._lastOnlineServerView = view;
      }
      this.ensureGameShell();
    var opp = 1 - view.myIndex;
    this.gameMode = 'online';
    this.onlinePlayerIndex = view.myIndex === 1 ? 1 : 0;

    if (view.starCoords) {
      this.setStarLayout(view.starCoords);
    } else {
      this.setStarLayout(DEFAULT_STAR_COORDS);
    }
    this.board = this.cloneOnlineBoard(view.board, view.myIndex);
    this.acceptedRuns = Array.isArray(view.acceptedRuns)
      ? view.acceptedRuns.map(function (run) {
          return {
            cells: (run.cells || []).slice(),
            word: run.word ? String(run.word).toUpperCase() : '',
          };
        })
      : [];
    if (view.lastWordPlayed && view.lastWordPlayed.word) {
      var lwPlayerEarly = view.lastWordPlayed.player === view.myIndex ? PLAYER.HUMAN : PLAYER.AI;
      this.setLastWordPlayed(lwPlayerEarly, view.lastWordPlayed.word, view.lastWordPlayed.score);
    }
    /* Guest flip is visual-only (coord map); board letters stay server-faithful. */
    this.syncGuestBoardOrientation();
    this.racks[PLAYER.HUMAN] = normalizeRack(view.myRack) || new Array(RACK_SIZE).fill(null);
    this.racks[PLAYER.AI] = this.buildOpponentRackPlaceholders(view.opponentRackCount);
    this.bag = new Array(view.bagCount || 0).fill('_');
    this.scores[PLAYER.HUMAN] = view.scores[view.myIndex];
    this.scores[PLAYER.AI] = view.scores[opp];
    this.stars[PLAYER.HUMAN] = view.stars[view.myIndex];
    this.stars[PLAYER.AI] = view.stars[opp];
    this.currentPlayer = view.currentPlayer === view.myIndex ? PLAYER.HUMAN : PLAYER.AI;
    this.firstMovePlayed = view.firstMovePlayed;
    this.openingPlayed = [
      !!(view.openingPlayed && view.openingPlayed[view.myIndex]),
      !!(view.openingPlayed && view.openingPlayed[opp]),
    ];
    this.boardsLinked = view.boardsLinked;
    this.gameOver = view.gameOver;
    var inflightBoardDrag =
      this.drag && this.drag.fromBoard !== undefined && this.drag.letter
        ? {
            letter: this.drag.letter,
            rackIndex: this.drag.fromRack != null ? this.drag.fromRack : -1,
            tileId: this.drag.tileId || null,
            blankAs: this.drag.blankAs != null ? this.drag.blankAs : null,
            cellIdx: this.drag.fromBoard,
          }
        : null;
    var hadPendingBeforeSync =
      this.pendingPlacements.size > 0 || !!inflightBoardDrag;
    var eventName = msg && msg.event ? String(msg.event) : '';
    var destructiveSync =
      eventName === 'play' ||
      eventName === 'exchange' ||
      eventName === 'turn_timeout' ||
      eventName === 'rejected' ||
      eventName === 'game_start' ||
      !!view.gameOver ||
      !!this._onlineAwaitingServer;
    /* Soft syncs (timer/presence) must not wipe the tiles the player is still arranging. */
    var pendingToKeep = null;
    if (
      !destructiveSync &&
      hadPendingBeforeSync &&
      view.currentPlayer === view.myIndex
    ) {
      pendingToKeep = this.clonePendingPlacements();
      if (inflightBoardDrag) {
        var dragCell = inflightBoardDrag.cellIdx;
        if (!pendingToKeep.has(dragCell)) {
          pendingToKeep.set(dragCell, {
            letter: inflightBoardDrag.letter,
            rackIndex: inflightBoardDrag.rackIndex,
            tileId: inflightBoardDrag.tileId,
            blankAs: inflightBoardDrag.blankAs,
          });
        }
      }
      if (!pendingToKeep.size) pendingToKeep = null;
    }
    /*
     * Timeout / reject: pending is about to be discarded — put letters back on the
     * rack first so RECALL is not required (and cannot fail with "nothing to recall").
     */
    if (
      destructiveSync &&
      hadPendingBeforeSync &&
      (eventName === 'turn_timeout' || eventName === 'rejected')
    ) {
      var timeoutRestore = this.collectPendingTilesForRecall();
      if (timeoutRestore.length) {
        this.restoreRecalledTilesToRack(timeoutRestore);
        this.assertRecalledTilesOnRack(timeoutRestore);
      }
    }
    this.cancelInFlightDrag();
    this.pendingPlacements.clear();
    this.exchangeMode = false;
    this.exchangeSlots = {};
    this.rackSelectedSlot = -1;

    if (view.lastWordPlayed && view.lastWordPlayed.word) {
      var lwPlayer = view.lastWordPlayed.player === view.myIndex ? PLAYER.HUMAN : PLAYER.AI;
      this.setLastWordPlayed(lwPlayer, view.lastWordPlayed.word, view.lastWordPlayed.score);
      if (msg && msg.event === 'play' && msg.word) {
        var playCells = this.placementCellsFromPlayMsg(msg);
        /* Always flash the submitted play for 5s (self + opponent, desktop + mobile). */
        this.highlightOpponentLastWord(msg.word, playCells);
      }
    }
    if (view.gameOver) {
      this.stopTurnTimer();
      if (view.winner === view.myIndex) {
        this.setMessage('You win!', 'success');
      } else if (view.winner === opp) {
        this.setMessage(this.onlineOpponentName + ' wins.', 'error');
      } else {
        this.setMessage('Game tied.', 'success');
      }
      /* Still play score FX / SFX for the winning submit before GAME OVER splash. */
      if (msg && msg.event === 'play' && msg.word) {
        var whoWin = msg.player === view.myIndex ? 'You' : this.onlineOpponentName;
        var playIsSelfWin = msg.player === view.myIndex;
        if (
          playIsSelfWin &&
          this._pendingUiScoreResult &&
          this._pendingUiScoreResult.valid
        ) {
          var uiResultWin = this._pendingUiScoreResult;
          var uiLabelWin = this._pendingUiScoreLabel || msg.word;
          this.mergePlayMsgBonuses(uiResultWin, msg);
          this.showPlayScoreFeedback('', uiLabelWin, msg.score != null ? msg.score : uiResultWin.score, null, uiResultWin);
          this._pendingUiScoreResult = null;
          this._pendingUiScoreLabel = null;
        } else if (!playIsSelfWin) {
          var oppCellsWin = this.placementCellsFromPlayMsg(msg);
          if (!oppCellsWin.length) oppCellsWin = this.findWordCellsOnBoard(msg.word, []);
          var oppResultWin = this.scoreResultFromPlayMsg(msg, oppCellsWin);
          this.showPlayScoreFeedback(whoWin || 'Opponent', msg.word, msg.score, oppCellsWin, oppResultWin);
        } else {
          var selfCellsWin = this.placementCellsFromPlayMsg(msg);
          if (!selfCellsWin.length) selfCellsWin = this.findWordCellsOnBoard(msg.word, []);
          var selfResultWin = this.scoreResultFromPlayMsg(msg, selfCellsWin);
          this.showPlayScoreFeedback('', msg.word, msg.score, selfCellsWin, selfResultWin);
        }
      }
      if (this.isOnlineMode() && !this.gameOverDialogDismissed) {
        this.schedulePostGameFlow();
      }
    } else if (msg && msg.event === 'play' && msg.word) {
      var who = msg.player === view.myIndex ? 'You' : this.onlineOpponentName;
      var playIsSelf = msg.player === view.myIndex;
      if (
        playIsSelf &&
        this._pendingUiScoreResult &&
        this._pendingUiScoreResult.valid
      ) {
        var uiResult = this._pendingUiScoreResult;
        var uiLabel = this._pendingUiScoreLabel || msg.word;
        this.mergePlayMsgBonuses(uiResult, msg);
        this.showPlayScoreFeedback('', uiLabel, msg.score != null ? msg.score : uiResult.score, null, uiResult);
        this._pendingUiScoreResult = null;
        this._pendingUiScoreLabel = null;
      } else if (!playIsSelf) {
        var oppCells = this.placementCellsFromPlayMsg(msg);
        if (!oppCells.length) oppCells = this.findWordCellsOnBoard(msg.word, []);
        var oppResult = this.scoreResultFromPlayMsg(msg, oppCells);
        this.showPlayScoreFeedback(who || 'Opponent', msg.word, msg.score, oppCells, oppResult);
      } else {
        var selfCells = this.placementCellsFromPlayMsg(msg);
        if (!selfCells.length) selfCells = this.findWordCellsOnBoard(msg.word, []);
        var selfResult = this.scoreResultFromPlayMsg(msg, selfCells);
        this.showPlayScoreFeedback('', msg.word, msg.score, selfCells, selfResult);
      }
    } else if (msg && msg.event === 'exchange') {
      var exchCount = msg.count != null ? msg.count : 0;
      /* msg.player is server seat (0=Deb/host, 1=Blake/guest) — not PLAYER.HUMAN/AI. */
      this.showExchangeBanner(msg.player, exchCount, { myIndex: view.myIndex });
      var exchWho = msg.player === view.myIndex ? 'You' : this.onlineOpponentName;
      this.setMessage(
        exchWho + ' exchanged ' + exchCount + ' tile' + (exchCount === 1 ? '' : 's') + '.',
        'success'
      );
    } else if (msg && msg.event === 'turn_timeout') {
      if (this._onlineAwaitingServer) {
        this.showOnlineAlert(
          'Turn timed out — your move was not accepted. Your tiles are back on the rack.',
          'error'
        );
      } else if (hadPendingBeforeSync) {
        this.showOnlineAlert(
          'Turn timed out — tiles were returned to your rack.',
          'error'
        );
      } else {
        this.setMessage('Turn timed out.', 'error');
      }
    }

    this.syncOnlineTurnTimer(view.turnEndsAt);
    this._onlineAwaitingServer = false;
    this._onlineStateReady = true;
    if (pendingToKeep && pendingToKeep.size && !this.gameOver) {
      var selfPending = this;
      pendingToKeep.forEach(function (p, idx) {
        if (!p || !p.letter) return;
        /* Cell already committed — do not re-pending; keep the letter on the rack. */
        if (selfPending.board[idx]) {
          selfPending.forceRecalledTileOntoRack(p);
          return;
        }
        selfPending.pendingPlacements.set(idx, {
          letter: p.letter,
          rackIndex: p.rackIndex != null ? p.rackIndex : -1,
          tileId: p.tileId || null,
          blankAs: p.blankAs != null ? p.blankAs : null,
        });
      });
      if (selfPending.pendingPlacements.size) {
        selfPending.resolveOnlinePlacementTileIds();
        console.info(
          '[QWERTY] restored',
          selfPending.pendingPlacements.size,
          'pending tile(s) after soft online sync (event=' + (eventName || 'state') + ')'
        );
      }
    }
    this.syncOnlineLegendUI();
    this.syncDifficultyPickerUI();
    this.updateUI();
    this.draw();
    if (this.isOnlineMode()) {
      var self = this;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          /* Avoid mid-drag / post-place jumps on phones when state syncs. */
          if (!self.isLayoutFrozen()) self.resize();
        });
      });
    }
    } catch (err) {
      console.error('applyOnlineState failed', err);
      this._onlineAwaitingServer = false;
      this.showOnlineAlert('Could not sync game state. Refresh if problems continue.', 'error');
      this.updateUI();
      this.draw();
    }
  }

  syncOnlineTurnTimer(turnEndsAt) {
    this._onlineTurnEndsAt = turnEndsAt || null;
    if (!turnEndsAt || this.gameOver) {
      this.stopTurnTimer();
      this.updateTimerDisplay();
      return;
    }
    var left = Math.ceil((turnEndsAt - Date.now()) / 1000);
    this.turnSecondsLeft = Math.max(0, Math.min(TURN_SECONDS, left));
    this.stopTurnTimer();
    /* Tick for both seats so the waiting player sees opponent countdown. */
    if (this.turnSecondsLeft > 0) {
      this._startTurnTimerInterval();
    }
    this.updateTimerDisplay();
  }

  setDifficulty(difficulty) {
    if (!isValidDifficulty(difficulty)) {
      difficulty = AI_DIFFICULTY.MEDIUM;
    }
    this.aiDifficulty = difficulty;
    saveStoredDifficulty(difficulty);
    this.syncDifficultyPickerUI();
    this.updateUI();
    if (!this.gameOver && this.currentPlayer === PLAYER.HUMAN) {
      this.setMessage('Computer set to ' + this.getDifficultyLabel() + ' difficulty.');
    }
  }

  syncDifficultyPickerUI() {
    var buttons = document.querySelectorAll('[data-difficulty]');
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('selected', buttons[i].getAttribute('data-difficulty') === this.aiDifficulty);
    }
  }

  ensureMainMenuHidden() {
    if (this.ui.mainMenu) {
      this.ui.mainMenu.hidden = true;
      this.ui.mainMenu.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('menu-visible');
    if (this.appEl) this.appEl.classList.remove('menu-open');
  }

  showMainMenu() {
    if (!this.ui.mainMenu) {
      return;
    }
    this.closeMobileChat();
    this.hideExitScreen();
    this.syncDifficultyPickerUI();
    var showContinue = false;
    try { showContinue = !!localStorage.getItem(SAVE_KEY); } catch (_) {}
    if (this.ui.btnContinueGame) {
      this.ui.btnContinueGame.hidden = !showContinue;
    }
    this.hidePlayAgainDialog();
    this.ui.mainMenu.hidden = false;
    this.ui.mainMenu.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-visible');
    if (this.appEl) this.appEl.classList.add('menu-open');
    this.setMessage('Choose difficulty, then start or continue your game.');
  }

  hideMainMenu() {
    if (!this.ui.mainMenu) return;
    this.ui.mainMenu.hidden = true;
    this.ui.mainMenu.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-visible');
    if (this.appEl) this.appEl.classList.remove('menu-open');
    if (this.appEl) this.appEl.style.visibility = '';
    var self = this;
    requestAnimationFrame(function () {
      self.withStableScroll(function () {
        self.resize();
        requestAnimationFrame(function () {
          if (!self.drag) self.withStableScroll(function () { self.resize(); });
        });
      });
    });
  }

  loadSavedGame() {
    try {
      this.gameMode = 'ai';
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || !data.board || !data.racks || !data.bag) return false;
      if (data.board.length !== COLS * ROWS) return false;

      if (data.starCoords && data.starCoords.length) {
        this.setStarLayout(data.starCoords);
      } else {
        this.setStarLayout(DEFAULT_STAR_COORDS);
      }
      this.board = data.board;
      this.normalizeBoardOwners();
      this.repairBoardOwners();
      this.racks = [
        normalizeRack(data.racks[0]),
        normalizeRack(data.racks[1]),
      ];
      if (!this.racks[0] || !this.racks[1]) return false;
      this.bag = data.bag;
      this.scores = data.scores || [0, 0];
      this.stars = data.stars || [0, 0];
      this.currentPlayer = data.currentPlayer || 0;
      this.firstMovePlayed = !!data.firstMovePlayed;
      this.openingPlayed = data.openingPlayed || [false, false];
      this.boardsLinked = !!data.boardsLinked;
      if (!this.boardsLinked) this.boardsLinked = this.inferBoardsLinked();
      this.syncOpeningPlayedFromBoard();
      this.gameOver = !!data.gameOver;
      this.lastWordPlayed = data.lastWordPlayed || { player: null, word: '', score: 0 };
      if (!this.gameOver && (this.scores[PLAYER.HUMAN] >= WIN_SCORE || this.scores[PLAYER.AI] >= WIN_SCORE)) {
        this.finalizeWinner({ skipPostGame: true });
      }
      this.pendingPlacements.clear();
      if (
        data.pendingPlacements &&
        data.pendingPlacements.length &&
        this.currentPlayer === PLAYER.HUMAN &&
        !this.gameOver
      ) {
        for (var pi = 0; pi < data.pendingPlacements.length; pi++) {
          var entry = data.pendingPlacements[pi];
          if (!entry || entry.length < 2) continue;
          var cellIdx = entry[0];
          var pendingTile = entry[1];
          if (cellIdx < 0 || cellIdx >= this.board.length || !pendingTile || !pendingTile.letter) continue;
          if (this.board[cellIdx] && !this.pendingPlacements.has(cellIdx)) continue;
          this.pendingPlacements.set(cellIdx, {
            letter: pendingTile.letter,
            rackIndex: pendingTile.rackIndex != null ? pendingTile.rackIndex : -1,
            tileId: pendingTile.tileId || null,
            blankAs: pendingTile.blankAs != null ? pendingTile.blankAs : null,
          });
        }
      }
      this.clearOpponentWordHighlight();
      for (var pendingEntry of this.pendingPlacements.values()) {
        if (pendingEntry.rackIndex >= 0 && this.racks[PLAYER.HUMAN][pendingEntry.rackIndex]) {
          this.racks[PLAYER.HUMAN][pendingEntry.rackIndex] = null;
        }
      }
      this.setMessage('Welcome back! Continue your game.');
      this.auditRecoverMissingTiles(false);
      if (this.currentPlayer === PLAYER.HUMAN && !this.gameOver) {
        this.startTurnTimer();
      } else {
        this.stopTurnTimer();
      }
      this.updateUI();
      this.draw();
      if (this.gameOver && !this.gameOverDialogDismissed) {
        this.ensureMainMenuHidden();
        this.hideExitScreen();
        this.showPlayAgainDialog();
      } else if (this.currentPlayer === PLAYER.AI) {
        this.scheduleRunAI(600);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  setupExitScreen() {
    var self = this;
    if (this.ui.btnExitPlay) {
      this.ui.btnExitPlay.addEventListener('click', function (e) {
        if (Date.now() < self.suppressExitPlayUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        self.hideExitScreen();
        self.gameOver = false;
        self.gameOverDialogDismissed = false;
        self.showMainMenu();
      });
    }
  }

  showExitScreen() {
    this.closeMobileChat();
    this.ensureMainMenuHidden();
    this.hidePlayAgainDialog();
    document.body.classList.add('game-exited');
    this.suppressExitPlayUntil = Date.now() + 500;
    if (this.ui.gameExitScreen) {
      this.ui.gameExitScreen.hidden = false;
      this.ui.gameExitScreen.setAttribute('aria-hidden', 'false');
      this.ui.gameExitScreen.classList.add('game-exit-screen--opening');
    }
    var self = this;
    setTimeout(function () {
      if (self.ui.gameExitScreen) {
        self.ui.gameExitScreen.classList.remove('game-exit-screen--opening');
      }
    }, 500);
  }

  hideExitScreen() {
    document.body.classList.remove('game-exited');
    if (this.ui.gameExitScreen) {
      this.ui.gameExitScreen.hidden = true;
      this.ui.gameExitScreen.setAttribute('aria-hidden', 'true');
    }
    if (this.appEl) {
      this.appEl.style.visibility = '';
    }
  }

  setupPlayAgainDialog() {
    var self = this;
    if (this.ui.btnPlayAgainLeave) {
      this.ui.btnPlayAgainLeave.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.leaveGame();
      });
    }
    if (this.ui.btnPlayAgainYes) {
      this.ui.btnPlayAgainYes.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (self.gameOverDialogDismissed) return;
        if (self.isOnlineMode()) {
          self.requestOnlineRematch();
          return;
        }
        self.hidePlayAgainDialog();
        self.cancelPostGameFlow();
        try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
        self.newGame();
      });
    }
  }

  isGameOverDialogOpen() {
    return !!(this.ui.playAgainOverlay && !this.ui.playAgainOverlay.hidden);
  }

  leaveGame() {
    if (document.body.classList.contains('game-exited')) {
      return;
    }
    this.gameOverDialogDismissed = true;
    this.cancelPostGameFlow();
    this.cancelPendingAI();
    this.hidePlayAgainDialog();
    if (typeof QWERTYOnline !== 'undefined' && QWERTYOnline.leaveRoom) {
      QWERTYOnline.leaveRoom();
    }
    this.gameMode = 'ai';
    this.friendCode = '';
    this.updateInGameRoomBadge('');
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    this.stopTurnTimer();
    this.pendingPlacements.clear();
    this.clearOpponentWordHighlight();
    var self = this;
    setTimeout(function () {
      self.showExitScreen();
    }, 0);
  }

  cancelPendingAI() {
    this.aiRunGeneration++;
    if (this.aiRunTimeoutId) {
      clearTimeout(this.aiRunTimeoutId);
      this.aiRunTimeoutId = null;
    }
  }

  scheduleRunAI(delayMs) {
    if (this.isOnlineMode()) return;
    var self = this;
    if (this.aiRunTimeoutId) {
      clearTimeout(this.aiRunTimeoutId);
      this.aiRunTimeoutId = null;
    }
    var gen = this.aiRunGeneration;
    this.aiRunTimeoutId = setTimeout(function () {
      self.aiRunTimeoutId = null;
      if (gen !== self.aiRunGeneration) return;
      self.runAI();
    }, delayMs);
  }

  cancelPostGameFlow() {
    if (this.postGameDialogTimeoutId) {
      clearTimeout(this.postGameDialogTimeoutId);
      this.postGameDialogTimeoutId = null;
    }
    if (this.postGameTimeoutId) {
      clearTimeout(this.postGameTimeoutId);
      this.postGameTimeoutId = null;
    }
    this.pendingGameOverMessage = null;
    this.hideGameOverSplash();
    this._postGameFlowStarted = false;
  }

  /** Winner line for the temporary GAME OVER splash (e.g. "YOU WIN!" / "DEB WINS!"). */
  getGameOverWinnerLabel() {
    var human = this.scores[PLAYER.HUMAN];
    var ai = this.scores[PLAYER.AI];
    if (human === ai) return 'IT\'S A TIE!';
    if (this.isOnlineMode()) {
      var myIndex = this.getOnlinePlayerIndex();
      if (human > ai) {
        return this.getExchangeBannerName('self', myIndex) + ' WINS!';
      }
      return this.getExchangeBannerName('opponent', myIndex) + ' WINS!';
    }
    if (human > ai) return 'YOU WIN!';
    return 'COMPUTER WINS!';
  }

  showGameOverSplash() {
    if (!this.ui.gameOverSplash) return;
    if (this.ui.gameOverSplashTitle) {
      this.ui.gameOverSplashTitle.textContent = 'GAME OVER';
    }
    if (this.ui.gameOverSplashWinner) {
      this.ui.gameOverSplashWinner.textContent = this.getGameOverWinnerLabel();
    }
    this.playSfx('end');
    this.ui.gameOverSplash.hidden = false;
    this.ui.gameOverSplash.setAttribute('aria-hidden', 'false');
  }

  hideGameOverSplash() {
    if (!this.ui.gameOverSplash) return;
    this.ui.gameOverSplash.hidden = true;
    this.ui.gameOverSplash.setAttribute('aria-hidden', 'true');
  }

  schedulePostGameFlow() {
    var self = this;
    if (this.gameOverDialogDismissed) return;
    if (document.body.classList.contains('game-exited')) return;
    /* Avoid restarting splash/results on every online state sync after game over. */
    if (this._postGameFlowStarted) return;
    if (this.isGameOverDialogOpen()) return;
    this._postGameFlowStarted = true;
    this.ensureMainMenuHidden();
    this.hideExitScreen();
    this.hidePlayAgainDialog();
    this.showGameOverSplash();
    this.postGameDialogTimeoutId = setTimeout(function () {
      self.postGameDialogTimeoutId = null;
      if (!self.gameOver || self.gameOverDialogDismissed) return;
      if (document.body.classList.contains('game-exited')) return;
      self.hideGameOverSplash();
      if (self.pendingGameOverMessage) {
        self.setMessage(self.pendingGameOverMessage, 'success');
        self.pendingGameOverMessage = null;
      }
      self.showPlayAgainDialog();
      self.postGameTimeoutId = setTimeout(function () {
        self.postGameTimeoutId = null;
        if (!self.gameOver || self.gameOverDialogDismissed) return;
        self.wipeBoardAfterGame();
      }, POST_GAME_BOARD_CLEAR_MS);
    }, GAME_OVER_SPLASH_MS);
  }

  wipeBoardAfterGame() {
    var i;
    this.board = new Array(COLS * ROWS).fill(null);
    this.pendingPlacements.clear();
    this.clearOpponentWordHighlight();
    this.racks[PLAYER.HUMAN] = new Array(RACK_SIZE).fill(null);
    this.racks[PLAYER.AI] = new Array(RACK_SIZE).fill(null);
    this.bag = [];
    this.boardsLinked = false;
    this.openingPlayed = [false, false];
    this.firstMovePlayed = false;
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    this.draw();
    this.updateUI();
  }

  showPlayAgainDialog() {
    if (!this.ui.playAgainOverlay || this.gameOverDialogDismissed) return;
    if (document.body.classList.contains('game-exited')) return;
    this.ui.playAgainOverlay.classList.remove('game-over-overlay--leaving');
    if (this.ui.playAgainTitle) {
      this.ui.playAgainTitle.textContent = this.getWinnerHeadline();
    }
    if (this.ui.playAgainSummary) {
      this.ui.playAgainSummary.textContent = this.getWinnerSubtext();
    }
    if (this.ui.playAgainDifficulty) {
      if (this.isOnlineMode()) {
        this.ui.playAgainDifficulty.textContent = 'ONLINE';
      } else {
        this.ui.playAgainDifficulty.textContent = this.getDifficultyLabel().toUpperCase();
      }
    }
    if (this.ui.playAgainHumanScore) {
      this.ui.playAgainHumanScore.textContent = String(this.scores[PLAYER.HUMAN]);
    }
    if (this.ui.playAgainAiScore) {
      this.ui.playAgainAiScore.textContent = String(this.scores[PLAYER.AI]);
    }
    if (this.ui.btnPlayAgainYes) {
      this.ui.btnPlayAgainYes.textContent = this.isOnlineMode() ? 'REMATCH' : 'PLAY AGAIN';
      this.ui.btnPlayAgainYes.disabled = false;
      this.ui.btnPlayAgainYes.classList.remove('rematch-highlight');
    }
    this.ui.playAgainOverlay.hidden = false;
    this.ui.playAgainOverlay.setAttribute('aria-hidden', 'false');
    if (this.ui.btnPlayAgainYes) {
      this.ui.btnPlayAgainYes.focus();
    }
  }

  hidePlayAgainDialog() {
    if (!this.ui.playAgainOverlay) return;
    this.ui.playAgainOverlay.classList.add('game-over-overlay--leaving');
    this.ui.playAgainOverlay.hidden = true;
    this.ui.playAgainOverlay.setAttribute('aria-hidden', 'true');
    if (this.ui.btnPlayAgainYes && document.activeElement === this.ui.btnPlayAgainYes) {
      this.ui.btnPlayAgainYes.blur();
    }
    if (this.ui.btnPlayAgainLeave && document.activeElement === this.ui.btnPlayAgainLeave) {
      this.ui.btnPlayAgainLeave.blur();
    }
  }

  randomizeStarLayout() {
    this.setStarLayout(generateSymmetricStarCoords());
  }

  newGame() {
    this.gameMode = 'ai';
    this.friendCode = '';
    this.updateInGameRoomBadge('');
    this.cancelPostGameFlow();
    this.cancelPendingAI();
    this._exchangeNoticeDismiss = null;
    if (this.ui.exchangeNoticeOverlay) {
      this.ui.exchangeNoticeOverlay.hidden = true;
      this.ui.exchangeNoticeOverlay.setAttribute('aria-hidden', 'true');
    }
    this.hideExitScreen();
    this.gameOverDialogDismissed = false;
    this.hidePlayAgainDialog();
    this.hideGameOverSplash();
    if (this.ui.playAgainOverlay) {
      this.ui.playAgainOverlay.classList.remove('game-over-overlay--leaving');
    }
    this.bag = createTileBag();
    this.board = new Array(COLS * ROWS).fill(null);
    this.scores = [0, 0];
    this.stars = [0, 0];
    this.lastWordPlayed = { player: null, word: '', score: 0 };
    this.acceptedRuns = [];
    this.clearOpponentWordHighlight();
    this.currentPlayer = PLAYER.HUMAN;
    this.gameOver = false;
    this.firstMovePlayed = false;
    this.openingPlayed = [false, false];
    this.boardsLinked = false;
    this.pendingPlacements.clear();
    this.scoreFx = null;
    this.boardBannerFx = null;
    this.playWordHighlight = null;
    this.rackSelectedSlot = -1;
    this.exchangeMode = false;
    this.exchangeSlots = {};
    this.randomizeStarLayout();
    this.racks = [
      drawTiles(this.bag, RACK_SIZE).map((l) => ({ letter: l, id: uid() })),
      drawTiles(this.bag, RACK_SIZE).map((l) => ({ letter: l, id: uid() })),
    ];
    this.setMessage('Build from your green corner (' + this.getDifficultyLabel() + ' opponent). Gold stars are in new spots — good luck!');
    this.resetChat();
    this.syncDifficultyPickerUI();
    this.save();
    this.startTurnTimer();
    this.updateUI();
    this.draw();
  }

  /* ── Persistence ──────────────────────────────────────────── */
  save() {
    if (this.isOnlineMode()) return;
    try {
      var pending = [];
      this.pendingPlacements.forEach(function (p, idx) {
        pending.push([idx, {
          letter: p.letter,
          rackIndex: p.rackIndex,
          tileId: p.tileId || null,
          blankAs: p.blankAs != null ? p.blankAs : null,
        }]);
      });
      const data = {
        starCoords: this.starCoords,
        board: this.board,
        racks: this.racks,
        bag: this.bag,
        scores: this.scores,
        stars: this.stars,
        currentPlayer: this.currentPlayer,
        firstMovePlayed: this.firstMovePlayed,
        openingPlayed: this.openingPlayed,
        boardsLinked: this.boardsLinked,
        gameOver: this.gameOver,
        lastWordPlayed: this.lastWordPlayed,
        pendingPlacements: pending,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (_) { /* quota */ }
  }

  loadOrNew() {
    this.aiDifficulty = loadStoredDifficulty();
    this.syncDifficultyPickerUI();
    this.ensureGameShell();
    /* Always show menu first so Play with a Friend / Create Game is reachable.
       Solo resume is via Continue Game only — not auto-loaded from localStorage. */
    this.showMainMenu();
  }

  /* ── UI ───────────────────────────────────────────────────── */
  updateUI() {
    this.ui.playerScore.textContent = this.scores[PLAYER.HUMAN];
    this.ui.aiScore.textContent = this.scores[PLAYER.AI];
    if (this.ui.sidebarPlayerScore) {
      this.ui.sidebarPlayerScore.textContent = this.scores[PLAYER.HUMAN];
    }
    if (this.ui.sidebarAiScore) {
      this.ui.sidebarAiScore.textContent = this.scores[PLAYER.AI];
    }
    if (this.ui.mobilePlayerScore) {
      this.ui.mobilePlayerScore.textContent = this.scores[PLAYER.HUMAN];
    }
    if (this.ui.mobileOppScore) {
      this.ui.mobileOppScore.textContent = this.scores[PLAYER.AI];
    }
    this.syncPlayerNameLabels();
    if (this.ui.boardDifficultyPicker) {
      this.ui.boardDifficultyPicker.classList.toggle('hidden-online', this.isOnlineMode());
    }
    this.updateLastWordSidebar();

    var aiTiles = this.countRackTiles(PLAYER.AI);
    var humanTiles = this.countRackTiles(PLAYER.HUMAN);
    if (this.opponentRackCanvas) {
      this.opponentRackCanvas.setAttribute(
        'aria-label',
        'Opponent rack, ' + aiTiles + ' tile' + (aiTiles === 1 ? '' : 's') + ', face down'
      );
    }
    if (this.rackCanvas) {
      this.rackCanvas.setAttribute(
        'aria-label',
        'Your rack, ' + humanTiles + ' tile' + (humanTiles === 1 ? '' : 's')
      );
    }

    const humanTurn = this.currentPlayer === PLAYER.HUMAN && !this.gameOver;
    const aiTurn = this.currentPlayer === PLAYER.AI && !this.gameOver;

    this.ui.playerPanel.classList.toggle('active', humanTurn);
    if (this.ui.aiPanel) {
      this.ui.aiPanel.classList.toggle('active', aiTurn);
    }
    if (this.ui.boardAvatarAi) {
      this.ui.boardAvatarAi.classList.toggle('active', aiTurn);
    }
    if (this.ui.boardAvatarHuman) {
      this.ui.boardAvatarHuman.classList.toggle('active', humanTurn);
    }

    if (this.ui.playerTurnRibbon) {
      this.ui.playerTurnRibbon.textContent = this.gameOver ? '' : 'Your Turn';
      this.ui.playerTurnRibbon.classList.toggle('visible', humanTurn);
    }
    if (this.ui.aiTurnRibbon) {
      var thinkingLabel = 'Thinking…';
      if (aiTurn && this.isOnlineMode() && this.turnSecondsLeft > 0) {
        thinkingLabel = 'Thinking… ' + this.formatTimer(this.turnSecondsLeft);
      }
      this.ui.aiTurnRibbon.textContent = this.gameOver ? '' : thinkingLabel;
      this.ui.aiTurnRibbon.classList.toggle('visible', aiTurn);
    }

    const canPlay = humanTurn && !this._onlineAwaitingServer;
    const canManageRack = !this.gameOver;
    if (!canPlay) {
      this.clearExchangeMode();
    }
    this.blurSubmitIfFocused();
    if (this.ui.btnPlay) this.ui.btnPlay.disabled = !canPlay;
    this.ui.btnRecall.disabled = !canPlay;
    this.ui.btnShuffle.disabled = !canManageRack;

    var btnPass = this.ui.btnPass;
    if (this.exchangeMode) {
      var exchangeCount = this.countExchangeSlots();
      btnPass.textContent = exchangeCount > 0
        ? 'Confirm Exchange (' + exchangeCount + ')'
        : 'Confirm Exchange';
      btnPass.disabled = exchangeCount === 0;
      if (this.ui.btnCancelExchange) {
        this.ui.btnCancelExchange.hidden = false;
        this.ui.btnCancelExchange.disabled = false;
      }
    } else {
      btnPass.textContent = 'Exchange Tiles';
      btnPass.disabled = !canPlay || this.bag.length === 0;
      if (this.ui.btnCancelExchange) {
        this.ui.btnCancelExchange.hidden = true;
      }
    }

    this.updateTimerDisplay();
  }

  setLastWordPlayed(player, word, score) {
    this.lastWordPlayed = {
      player: player,
      word: (word || '').toUpperCase(),
      score: score || 0,
    };
  }

  clearOpponentWordHighlight() {
    if (this.opponentHighlightTimerId) {
      clearTimeout(this.opponentHighlightTimerId);
      this.opponentHighlightTimerId = null;
    }
    this.opponentWordHighlight = null;
  }

  findWordCellsOnBoard(word, newIndices) {
    word = String(word || '').toUpperCase();
    if (!word) return [];
    var newSet = new Set(newIndices);
    var words = getAllWordsFromBoard(this.board, COLS, ROWS);
    var i, entry, ci;
    for (i = 0; i < words.length; i++) {
      entry = words[i];
      if (entry.word.toUpperCase() !== word) continue;
      for (ci = 0; ci < entry.cells.length; ci++) {
        if (newSet.has(entry.cells[ci])) return entry.cells.slice();
      }
    }
    return newIndices.slice();
  }

  /**
   * Highlight a just-played word for SUBMIT_WORD_HIGHLIGHT_MS so both seats
   * (and mobile) can see where tiles landed. Uses placement indices when given.
   */
  highlightOpponentLastWord(word, newPlacementIndices) {
    var self = this;
    this.clearOpponentWordHighlight();
    var placed = (newPlacementIndices || []).map(Number).filter(function (n) {
      return Number.isFinite(n) && n >= 0;
    });
    var cells = this.findWordCellsOnBoard(word, placed);
    if (!cells.length && placed.length) cells = placed.slice();
    if (!cells.length) return;

    /* Include every newly formed run that touches the placed tiles. */
    var cellSet = {};
    var i;
    for (i = 0; i < cells.length; i++) cellSet[cells[i]] = true;
    for (i = 0; i < placed.length; i++) cellSet[placed[i]] = true;
    if (placed.length) {
      var seed = {};
      for (i = 0; i < placed.length; i++) seed[placed[i]] = true;
      var all = getAllWordsFromBoard(this.board, COLS, ROWS);
      var wi, ci, runCells, touches;
      for (wi = 0; wi < all.length; wi++) {
        runCells = all[wi].cells || [];
        touches = false;
        for (ci = 0; ci < runCells.length; ci++) {
          if (seed[runCells[ci]]) {
            touches = true;
            break;
          }
        }
        if (!touches) continue;
        for (ci = 0; ci < runCells.length; ci++) cellSet[runCells[ci]] = true;
      }
    }

    var uniq = Object.keys(cellSet).map(Number);
    this.opponentWordHighlight = {
      cells: uniq,
      cellSet: cellSet,
      expiresAt: Date.now() + SUBMIT_WORD_HIGHLIGHT_MS,
    };

    this.opponentHighlightTimerId = setTimeout(function () {
      self.opponentWordHighlight = null;
      self.opponentHighlightTimerId = null;
      self.draw();
    }, SUBMIT_WORD_HIGHLIGHT_MS);
    this.ensureUiAnimLoop();
  }

  /** Collect board indices from an online play broadcast (placements or cells). */
  placementCellsFromPlayMsg(msg) {
    if (!msg) return [];
    var out = [];
    var seen = {};
    function push(n) {
      n = Number(n);
      if (!Number.isFinite(n) || n < 0 || seen[n]) return;
      seen[n] = true;
      out.push(n);
    }
    var i, p;
    if (msg.placements && msg.placements.length) {
      for (i = 0; i < msg.placements.length; i++) {
        p = msg.placements[i];
        if (p == null) continue;
        if (typeof p === 'number') push(p);
        else push(p.idx != null ? p.idx : p.index);
      }
    }
    if (msg.cells && msg.cells.length) {
      for (i = 0; i < msg.cells.length; i++) push(msg.cells[i]);
    }
    return out;
  }

  isOpponentWordHighlighted(idx) {
    var hl = this.opponentWordHighlight;
    if (!hl) return false;
    if (Date.now() >= hl.expiresAt) {
      this.opponentWordHighlight = null;
      return false;
    }
    return !!hl.cellSet[idx];
  }

  updateLastWordSidebar() {
    if (!this.ui.sidebarLastWord) return;
    var lw = this.lastWordPlayed;
    if (!lw || !lw.word) {
      this.ui.sidebarLastWord.innerHTML =
        '<span class="score-last-word-placeholder">No words played yet</span>';
      return;
    }
    var who = lw.player === PLAYER.HUMAN ? 'You' : (this.isOnlineMode() ? this.onlineOpponentName : 'Computer');
    this.ui.sidebarLastWord.innerHTML =
      '<span class="score-last-word-text">' + lw.word + '</span>' +
      '<span class="score-last-word-meta">' + who + '</span>' +
      '<span class="score-last-word-points">+' + lw.score + ' pts</span>';
  }

  formatTimer(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  ensureAudioContext() {
    if (!this._audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this._audioCtx = new AC();
    }
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume();
    }
    return this._audioCtx;
  }

  sfxUrl(kind) {
    var file = SFX_FILES[kind] || (kind + '.mp3');
    return SFX_BASE + file;
  }

  /** Preload /sounds/*.mp3 so first play is snappy. */
  preloadSfx() {
    var self = this;
    if (!this._sfxAudio) this._sfxAudio = {};
    SFX_KINDS.forEach(function (kind) {
      if (self._sfxAudio[kind] || self._sfxFailed[kind]) return;
      try {
        var audio = new Audio(self.sfxUrl(kind));
        audio.preload = 'auto';
        audio.addEventListener('error', function () {
          self._sfxFailed[kind] = true;
        });
        self._sfxAudio[kind] = audio;
      } catch (_) {
        self._sfxFailed[kind] = true;
      }
    });
  }

  /** Soft synth tone helper (fallback if an MP3 is missing). */
  _tone(ctx, opts) {
    var t0 = ctx.currentTime + (opts.delay || 0);
    var dur = opts.dur != null ? opts.dur : 0.08;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    var freq = Math.max(40, opts.freq || 440);
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.freqEnd && opts.freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t0 + dur);
    }
    var vol = opts.vol != null ? opts.vol : 0.14;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Play file from /sounds/<kind>.mp3; fall back to short synth recipes. */
  playSfx(kind) {
    if (!this.soundEnabled) return;
    if (!kind || SFX_KINDS.indexOf(kind) < 0) return;
    this.ensureAudioContext();
    var self = this;
    if (!this._sfxFailed[kind]) {
      try {
        if (!this._sfxAudio[kind]) this.preloadSfx();
        var base = this._sfxAudio[kind];
        if (base && !this._sfxFailed[kind]) {
          var node = base.cloneNode ? base.cloneNode(true) : new Audio(this.sfxUrl(kind));
          node.volume = 0.85;
          var playPromise = node.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(
              function () {},
              function () {
                /* Corrupt/blocked file — use synth so CONNECTION/bingo never go silent. */
                self._sfxFailed[kind] = true;
                self.playSfxSynth(kind);
              }
            );
            return;
          }
          return;
        }
      } catch (_) {
        this._sfxFailed[kind] = true;
      }
    }
    this.playSfxSynth(kind);
  }

  /**
   * Synth fallback recipes (used only if /sounds/<kind>.mp3 fails to load).
   * Kinds: submit | error | bingo | connection | exchange | win | lose | tick
   */
  playSfxSynth(kind) {
    var ctx = this.ensureAudioContext();
    if (!ctx) return;
    try {
      if (kind === 'submit') {
        this._tone(ctx, { type: 'sine', freq: 523.25, dur: 0.08, vol: 0.11, delay: 0 });
        this._tone(ctx, { type: 'sine', freq: 659.25, dur: 0.1, vol: 0.1, delay: 0.06 });
        return;
      }
      if (kind === 'error') {
        this._tone(ctx, { type: 'sawtooth', freq: 220, freqEnd: 110, dur: 0.16, vol: 0.08 });
        this._tone(ctx, { type: 'square', freq: 160, freqEnd: 90, dur: 0.12, vol: 0.04, delay: 0.04 });
        return;
      }
      if (kind === 'bingo') {
        this._tone(ctx, { type: 'sine', freq: 659.25, dur: 0.07, vol: 0.11, delay: 0 });
        this._tone(ctx, { type: 'sine', freq: 830.61, dur: 0.07, vol: 0.11, delay: 0.06 });
        this._tone(ctx, { type: 'triangle', freq: 1046.5, dur: 0.09, vol: 0.12, delay: 0.12 });
        this._tone(ctx, { type: 'sine', freq: 1318.51, dur: 0.16, vol: 0.1, delay: 0.2 });
        return;
      }
      if (kind === 'connection') {
        this._tone(ctx, { type: 'triangle', freq: 392, dur: 0.1, vol: 0.11, delay: 0 });
        this._tone(ctx, { type: 'sine', freq: 587.33, dur: 0.12, vol: 0.12, delay: 0.08 });
        this._tone(ctx, { type: 'sine', freq: 784, dur: 0.16, vol: 0.1, delay: 0.18 });
        return;
      }
      if (kind === 'exchange') {
        this._tone(ctx, { type: 'triangle', freq: 420, freqEnd: 560, dur: 0.09, vol: 0.09 });
        this._tone(ctx, { type: 'triangle', freq: 560, freqEnd: 380, dur: 0.1, vol: 0.07, delay: 0.07 });
        return;
      }
      if (kind === 'win') {
        this._tone(ctx, { type: 'sine', freq: 523.25, dur: 0.1, vol: 0.12, delay: 0 });
        this._tone(ctx, { type: 'triangle', freq: 659.25, dur: 0.1, vol: 0.08, delay: 0 });
        this._tone(ctx, { type: 'sine', freq: 783.99, dur: 0.11, vol: 0.13, delay: 0.1 });
        this._tone(ctx, { type: 'triangle', freq: 987.77, dur: 0.11, vol: 0.08, delay: 0.1 });
        this._tone(ctx, { type: 'sine', freq: 1046.5, dur: 0.14, vol: 0.14, delay: 0.2 });
        this._tone(ctx, { type: 'sine', freq: 1318.51, dur: 0.22, vol: 0.11, delay: 0.32 });
        this._tone(ctx, { type: 'triangle', freq: 1567.98, dur: 0.2, vol: 0.07, delay: 0.4 });
        return;
      }
      if (kind === 'lose') {
        this._tone(ctx, { type: 'triangle', freq: 349.23, dur: 0.14, vol: 0.1, delay: 0 });
        this._tone(ctx, { type: 'sine', freq: 293.66, dur: 0.16, vol: 0.09, delay: 0.12 });
        this._tone(ctx, { type: 'sine', freq: 246.94, dur: 0.2, vol: 0.08, delay: 0.26 });
        this._tone(ctx, { type: 'triangle', freq: 196, dur: 0.28, vol: 0.07, delay: 0.42 });
        return;
      }
      if (kind === 'tick') {
        this._tone(ctx, { type: 'square', freq: 1100, freqEnd: 750, dur: 0.07, vol: 0.14 });
        return;
      }
      if (kind === 'place') {
        this._tone(ctx, { type: 'triangle', freq: 880, dur: 0.045, vol: 0.08 });
        this._tone(ctx, { type: 'sine', freq: 1320, dur: 0.03, vol: 0.05, delay: 0.02 });
      }
    } catch (e) {
      /* ignore audio errors */
    }
  }

  playTimerTickSound() {
    this.playSfx('tick');
  }

  setupSoundToggle() {
    var self = this;
    function onToggle(e) {
      e.preventDefault();
      self.setSoundEnabled(!self.soundEnabled);
      if (self.soundEnabled) {
        self.ensureAudioContext();
        self.playSfx('submit');
      }
    }
    if (this.ui.btnSoundToggle) {
      this.ui.btnSoundToggle.addEventListener('click', onToggle);
    }
    if (this.ui.btnSoundToggleInGame) {
      this.ui.btnSoundToggleInGame.addEventListener('click', onToggle);
    }
    this.syncSoundToggleUI();
  }

  setSoundEnabled(on) {
    this.soundEnabled = !!on;
    saveSoundEnabled(this.soundEnabled);
    this.syncSoundToggleUI();
  }

  syncSoundToggleUI() {
    var label = this.soundEnabled ? 'Sound: On' : 'Sound: Off';
    var pressed = this.soundEnabled ? 'true' : 'false';
    var buttons = [this.ui.btnSoundToggle, this.ui.btnSoundToggleInGame];
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!btn) continue;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', pressed);
      btn.classList.toggle('sound-toggle--off', !this.soundEnabled);
      btn.title = this.soundEnabled ? 'Mute game sounds' : 'Enable game sounds';
    }
  }

  updateTimerDisplay() {
    if (!this.ui.turnTimer) return;
    var humanTurn = this.currentPlayer === PLAYER.HUMAN && !this.gameOver;
    var showDesktop = !this.gameOver;
    this.ui.turnTimer.classList.toggle('visible', showDesktop);
    this.ui.turnTimer.setAttribute('aria-hidden', showDesktop ? 'false' : 'true');

    var secs = Math.max(0, this.turnSecondsLeft);
    var label = this.formatTimer(secs);
    var warn = secs <= TIMER_WARN_SECONDS && secs > 0;
    var critical = humanTurn && secs <= TIMER_TICK_SECONDS && secs > 0;

    if (showDesktop) {
      this.ui.turnTimer.textContent = label;
      this.ui.turnTimer.classList.toggle('warn', warn && humanTurn);
      this.ui.turnTimer.classList.toggle('critical', critical);
      this.ui.turnTimer.classList.toggle('waiting', !humanTurn);
    } else {
      this.ui.turnTimer.classList.remove('warn', 'critical', 'waiting');
    }

    if (this.ui.mobileTurnTimer) {
      var showMobile = !this.gameOver;
      this.ui.mobileTurnTimer.classList.toggle('visible', showMobile);
      this.ui.mobileTurnTimer.setAttribute('aria-hidden', showMobile ? 'false' : 'true');
      if (showMobile) {
        this.ui.mobileTurnTimer.textContent = label;
        this.ui.mobileTurnTimer.classList.toggle('warn', warn && humanTurn);
        this.ui.mobileTurnTimer.classList.toggle('critical', critical);
        this.ui.mobileTurnTimer.classList.toggle('waiting', !humanTurn);
      }
    }
  }

  startTurnTimer() {
    if (this.isOnlineMode()) return;
    this.stopTurnTimer();
    this._turnTimerPausedForExchange = false;
    if (this.gameOver || this.currentPlayer !== PLAYER.HUMAN) {
      this.updateTimerDisplay();
      return;
    }
    this.turnSecondsLeft = TURN_SECONDS;
    this.updateTimerDisplay();
    this._startTurnTimerInterval();
  }

  _startTurnTimerInterval() {
    this.stopTurnTimer();
    if (this.gameOver || this.exchangeMode) return;
    if (this.isOnlineMode()) {
      if (!this._onlineTurnEndsAt) return;
    } else if (this.currentPlayer !== PLAYER.HUMAN) {
      return;
    }
    var self = this;
    this.turnTimerId = setInterval(function () { self.tickTurnTimer(); }, 1000);
  }

  pauseTurnTimerForExchange() {
    if (this.currentPlayer !== PLAYER.HUMAN || this.gameOver) return;
    this._turnTimerPausedForExchange = true;
    this.stopTurnTimer();
    this.updateTimerDisplay();
  }

  resumeTurnTimerAfterExchange() {
    if (!this._turnTimerPausedForExchange) return;
    this._turnTimerPausedForExchange = false;
    if (this.gameOver || this.currentPlayer !== PLAYER.HUMAN || this.exchangeMode) return;
    if (this.turnSecondsLeft <= 0) return;
    this._startTurnTimerInterval();
    this.updateTimerDisplay();
  }

  stopTurnTimer() {
    if (this.turnTimerId) {
      clearInterval(this.turnTimerId);
      this.turnTimerId = null;
    }
  }

  tickTurnTimer() {
    if (this.gameOver || this.exchangeMode) return;
    if (this.isOnlineMode()) {
      if (!this._onlineTurnEndsAt) {
        this.stopTurnTimer();
        return;
      }
      var left = Math.ceil((this._onlineTurnEndsAt - Date.now()) / 1000);
      this.turnSecondsLeft = Math.max(0, Math.min(TURN_SECONDS, left));
      this.updateTimerDisplay();
      if (
        this.currentPlayer === PLAYER.HUMAN &&
        this.turnSecondsLeft <= TIMER_TICK_SECONDS &&
        this.turnSecondsLeft > 0
      ) {
        this.playTimerTickSound();
      }
      if (this.turnSecondsLeft <= 0) {
        this.stopTurnTimer();
      }
      return;
    }
    if (this.currentPlayer !== PLAYER.HUMAN) {
      return;
    }
    this.turnSecondsLeft--;
    this.updateTimerDisplay();
    if (this.turnSecondsLeft <= TIMER_TICK_SECONDS && this.turnSecondsLeft >= 0) {
      this.playTimerTickSound();
    }
    if (this.turnSecondsLeft === TIMER_WARN_SECONDS) {
      this.setMessage(TIMER_WARN_SECONDS + ' seconds left!');
    }
    if (this.turnSecondsLeft <= 0) {
      this.stopTurnTimer();
      this.onTurnTimerExpired();
    }
  }

  onTurnTimerExpired() {
    if (this.isOnlineMode()) return;
    if (this.gameOver || this.currentPlayer !== PLAYER.HUMAN) return;
    this.clearExchangeMode();
    this.recallTiles();
    this.clearExchangeMode();
    this.endTurn(0, 'Time\'s up! Turn passed.');
  }

  setMessage(text, type) {
    if (!this.ui.message) return;
    var msg = text || '';
    this.ui.message.textContent = msg;
    this.ui.message.className = 'message-bar' + (type ? ' ' + type : '');
    this.ui.message.hidden = !msg;
    this.ui.message.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    var row = document.getElementById('panel-message-row');
    if (row) row.hidden = !msg;
  }

  withStableScroll(fn) {
    var root = document.scrollingElement || document.documentElement;
    var x = root.scrollLeft;
    var y = root.scrollTop;
    fn();
    var restore = function () {
      if (root.scrollLeft !== x || root.scrollTop !== y) {
        root.scrollTo(x, y);
      }
    };
    restore();
    requestAnimationFrame(function () {
      restore();
      requestAnimationFrame(restore);
    });
    setTimeout(restore, 0);
  }

  blurSubmitIfFocused() {
    if (this.ui.btnPlay && document.activeElement === this.ui.btnPlay) {
      this.ui.btnPlay.blur();
    }
  }

  /* ── Board helpers ────────────────────────────────────────── */
  cellAt(x, y) {
    const vc = Math.floor(x / this.cellSize);
    const vr = Math.floor(y / this.cellSize);
    if (vc < 0 || vc >= COLS || vr < 0 || vr >= ROWS) return -1;
    return this.serverIdxFromVisualRowCol(vr, vc);
  }

  cellCenter(idx) {
    var rc = this.visualRowColFromServerIdx(idx);
    return {
      x: rc.vc * this.cellSize + this.cellSize / 2,
      y: rc.vr * this.cellSize + this.cellSize / 2,
    };
  }

  getLetterAt(idx) {
    if (this.pendingPlacements.has(idx)) {
      var pending = this.pendingPlacements.get(idx);
      if (pending.blankAs != null) return String(pending.blankAs).toUpperCase();
      return pending.letter ? String(pending.letter).toUpperCase() : null;
    }
    return this.boardCellLetter(this.board[idx]);
  }

  getDisplayLetterAt(idx) {
    if (this.pendingPlacements.has(idx)) {
      return this.getLetterAt(idx);
    }
    return this.boardCellLetter(this.getDisplayBoard()[idx]);
  }

  getOwnerAt(idx) {
    if (this.pendingPlacements.has(idx)) return this.currentPlayer;
    var cell = this.board[idx];
    return cell && cell.owner !== undefined ? cell.owner : null;
  }

  isOccupied(idx) {
    return this.getLetterAt(idx) !== null;
  }

  /** Empty cell or another pending tile (for swap). Committed board tiles block drops. */
  canDropPendingAt(idx, drag) {
    if (idx < 0) return false;
    if (this.board[idx] && !this.pendingPlacements.has(idx)) return false;
    if (this.pendingPlacements.has(idx)) {
      if (drag && drag.fromBoard !== undefined && drag.fromBoard !== idx) return true;
      if (drag && drag.fromBoard === undefined && drag.fromRack >= 0) return true;
      return false;
    }
    return true;
  }

  placePendingFromDrag(drag, idx) {
    var incoming = {
      letter: drag.letter,
      rackIndex: drag.fromRack != null ? drag.fromRack : -1,
      tileId: drag.tileId || null,
      blankAs: drag.blankAs,
    };

    if (this.pendingPlacements.has(idx)) {
      var displaced = this.pendingPlacements.get(idx);
      this.pendingPlacements.set(idx, incoming);
      if (drag.fromBoard !== undefined) {
        this.pendingPlacements.set(drag.fromBoard, displaced);
      } else if (drag.fromRack >= 0 && !this.isOnlineMode()) {
        this.removeTileFromRack(PLAYER.HUMAN, drag.fromRack);
        if (!this.restoreTileToRack(PLAYER.HUMAN, displaced.rackIndex, displaced.letter)) {
          this.recoverOneMissingTile(displaced.letter);
        }
      }
      this.lastPendingCell = idx;
      if (!this.isOnlineMode()) this.save();
      this.freezeLayoutBriefly(480);
      this.playSfx('place');
      return;
    }

    this.pendingPlacements.set(idx, incoming);
    this.lastPendingCell = idx;
    if (drag.fromRack >= 0 && drag.fromBoard === undefined && !this.isOnlineMode()) {
      this.removeTileFromRack(PLAYER.HUMAN, drag.fromRack);
    }
    if (!this.isOnlineMode()) this.save();
    this.freezeLayoutBriefly(480);
    this.playSfx('place');
  }

  clearRackSelection() {
    this.rackSelectedSlot = -1;
  }

  clearExchangeMode() {
    var wasExchange = this.exchangeMode;
    this.exchangeMode = false;
    this.exchangeSlots = {};
    if (wasExchange) this.resumeTurnTimerAfterExchange();
  }

  countExchangeSlots() {
    var n = 0;
    for (var k in this.exchangeSlots) {
      if (this.exchangeSlots[k]) n++;
    }
    return n;
  }

  getExchangeSlotList() {
    var slots = [];
    for (var k in this.exchangeSlots) {
      if (this.exchangeSlots[k]) slots.push(parseInt(k, 10));
    }
    slots.sort(function (a, b) { return a - b; });
    return slots;
  }

  toggleExchangeSlot(slot) {
    if (this.exchangeSlots[slot]) delete this.exchangeSlots[slot];
    else this.exchangeSlots[slot] = true;
  }

  handleRackTap(slot) {
    if (this.gameOver) return;
    if (slot < 0 || !this.racks[PLAYER.HUMAN][slot] || this.isRackSlotPending(slot)) return;

    if (this.exchangeMode) {
      if (this.currentPlayer !== PLAYER.HUMAN) return;
      this.toggleExchangeSlot(slot);
      var n = this.countExchangeSlots();
      if (n > 0) {
        this.setMessage(
          n + ' selected — tap Confirm Exchange when ready'
        );
      } else {
        this.setMessage('Tap tiles to exchange, then Confirm or Cancel');
      }
      this.updateUI();
      this.draw();
      return;
    }

    if (this.rackSelectedSlot >= 0) {
      if (this.rackSelectedSlot === slot) {
        this.clearRackSelection();
        this.setMessage('Tap a tile to select it, then tap a slot to move it — or drag tiles to any rack position.');
      } else {
        this.insertRackTile(this.rackSelectedSlot, slot);
        this.clearRackSelection();
        this.setMessage('Rack tile moved.', 'success');
      }
    } else {
      this.rackSelectedSlot = slot;
      var letter = tileLetter(this.racks[PLAYER.HUMAN][slot]);
      this.setMessage('Selected "' + letter.toUpperCase() + '". Tap a slot to move it there, or drag to insert.');
    }
    this.updatePendingPreview();
    this.draw();
  }

  insertRackTile(fromSlot, toSlot) {
    if (fromSlot === toSlot) return;
    if (this.isRackSlotPending(fromSlot) || this.isRackSlotPending(toSlot)) return;
    var rack = this.racks[PLAYER.HUMAN];
    var moving = rack[fromSlot];
    if (!moving) return;

    /*
     * Pending slots still hold their tile objects (online) — treat them as fixed.
     * Only reorder non-pending slots so we never null or overwrite a pending letter.
     */
    var free = [];
    var i;
    for (i = 0; i < RACK_SIZE; i++) {
      if (!this.isRackSlotPending(i)) free.push(i);
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

  pendingDisplayLetter(p) {
    if (p.letter === '*') return p.blankAs != null ? p.blankAs : '?';
    return p.letter;
  }

  getPendingWordPreview() {
    if (this.pendingPlacements.size === 0) return null;
    var indices = [];
    var self = this;
    this.pendingPlacements.forEach(function (_, idx) { indices.push(idx); });

    var rows = indices.map(function (i) { return Math.floor(i / COLS); });
    var cols = indices.map(function (i) { return i % COLS; });
    var sameRow = rows.every(function (r) { return r === rows[0]; });
    var sameCol = cols.every(function (c) { return c === cols[0]; });

    if (!sameRow && !sameCol) {
      return {
        text: indices.map(function (i) {
          return self.pendingDisplayLetter(self.pendingPlacements.get(i)).toUpperCase();
        }).join(''),
        inLine: false,
      };
    }

    if (this.isOnlineMode()) {
      this.resolveOnlinePlacementTileIds();
    }

    /*
     * Spell the full board run (pending + locked letters), offline and online.
     * Pending-only spelling caused errors like: Invalid "OVATES" (tiles spell "RST").
     */
    var visualFull = this.pendingVisualFullWord(indices, sameRow);
    if (visualFull.text && visualFull.text.length >= 2) {
      return { text: visualFull.text, inLine: true, cells: visualFull.cells };
    }

    if (indices.length === 1) {
      var p = this.pendingPlacements.get(indices[0]);
      return { text: this.pendingDisplayLetter(p).toUpperCase(), inLine: true };
    }

    var sortedAsc = indices.slice();
    if (sameRow) {
      sortedAsc.sort(function (a, b) { return (a % COLS) - (b % COLS); });
    } else {
      sortedAsc.sort(function (a, b) { return Math.floor(a / COLS) - Math.floor(b / COLS); });
    }
    var lettersAsc = sortedAsc.map(function (i) {
      return self.pendingDisplayLetter(self.pendingPlacements.get(i)).toUpperCase();
    }).join('');

    return { text: lettersAsc, inLine: true };
  }

  getPendingScorePreview() {
    if (this.pendingPlacements.size === 0) return null;
    if (this.currentPlayer !== PLAYER.HUMAN || this.gameOver) return null;
    var result;
    if (this.isOnlineMode()) {
      var indices = [];
      this.pendingPlacements.forEach(function (_, idx) { indices.push(idx); });
      var rows = indices.map(function (i) { return Math.floor(i / COLS); });
      var cols = indices.map(function (i) { return i % COLS; });
      var sameRow = rows.every(function (r) { return r === rows[0]; });
      var sameCol = cols.every(function (c) { return c === cols[0]; });
      var opts = { preview: true };
      if (sameRow || sameCol) {
        var visualFull = this.pendingVisualFullWord(indices, sameRow);
        if (
          visualFull.text &&
          visualFull.text.length >= 2 &&
          visualFull.cells &&
          visualFull.cells.length >= 2
        ) {
          opts.intendedWord = visualFull.text;
          opts.wordCells = visualFull.cells;
        }
      }
      result = this.validateOnlineMoveWithEngine(this.pendingPlacements, opts);
    } else {
      result = this.validateMove(this.pendingPlacements, PLAYER.HUMAN, { preview: true });
    }
    return this.enrichScoreResultFormedWords(result, this.pendingPlacements);
  }

  /**
   * Attach formed-word cells for UI highlights/breakdowns when the scorer
   * returns totals but not per-word geometry (offline validateMove).
   */
  enrichScoreResultFormedWords(scoreResult, placements) {
    if (!scoreResult || !scoreResult.valid || !placements || !placements.size) {
      return scoreResult;
    }
    var starCells = [];
    placements.forEach(function (_, idx) {
      if (this.specials && this.specials[idx] === CELL_STAR) starCells.push(idx);
    }, this);
    scoreResult.starCells = starCells;

    if (scoreResult.formedWords && scoreResult.formedWords.length) {
      return scoreResult;
    }

    var board = this.getValidationBoard();
    var tempBoard = board.slice();
    var player = this.currentPlayer;
    var newWordCells = {};
    placements.forEach(function (p, idx) {
      newWordCells[idx] = true;
      tempBoard[idx] = {
        letter: p.blankAs != null ? p.blankAs : p.letter,
        owner: player,
        isBlank: p.letter === '*',
      };
    });

    var words = getAllWordsFromBoard(tempBoard, COLS, ROWS);
    var formed = [];
    var wi, cells, usesNew, accepted, primaryCells;
    for (wi = 0; wi < words.length; wi++) {
      cells = words[wi].cells;
      usesNew = cells.some(function (c) { return newWordCells[c]; });
      if (!usesNew) continue;
      accepted = this.resolveWordFromRun(tempBoard, cells, player);
      if (!accepted) continue;
      formed.push({ word: accepted, cells: cells.slice() });
      if (
        scoreResult.word &&
        String(accepted).toUpperCase() === String(scoreResult.word).toUpperCase()
      ) {
        primaryCells = cells.slice();
      }
    }
    scoreResult.formedWords = formed;
    if (!scoreResult.primaryWordCells && primaryCells) {
      scoreResult.primaryWordCells = primaryCells;
    } else if (!scoreResult.primaryWordCells && formed.length) {
      scoreResult.primaryWordCells = formed[0].cells.slice();
    }
    return scoreResult;
  }

  formatPlaySuccessMessage(who, scoreResult, mainLabel) {
    var breakdown = this.buildScoreBreakdown(scoreResult, mainLabel);
    var head = who ? who + ' · ' : '';
    return head + '+' + scoreResult.score + ' · ' + breakdown.summary;
  }

  getPendingScoreDisplayCell() {
    if (this.lastPendingCell != null && this.pendingPlacements.has(this.lastPendingCell)) {
      return this.lastPendingCell;
    }
    var lastIdx = null;
    this.pendingPlacements.forEach(function (_, idx) {
      lastIdx = idx;
    });
    return lastIdx;
  }

  formatPendingScoreMessage(previewText, scoreResult) {
    if (!scoreResult || !scoreResult.valid) {
      return null;
    }
    var breakdown = this.buildScoreBreakdown(scoreResult, previewText);
    var main = previewText ? String(previewText).toUpperCase() : '';
    var msg = main ? 'Play ' + main + ' · ' + breakdown.summary : breakdown.summary;
    msg += ' → +' + scoreResult.score;
    return msg;
  }

  /**
   * Build word/bonus breakdown for preview text and canvas popups.
   * Uses formedWords from the engine (length × 10 each).
   * Example: "GOB 30 + GO 20 + OR 20 = 70 (+75 connection)"
   */
  buildScoreBreakdown(scoreResult, mainLabel) {
    var words = [];
    var seen = {};
    var formed = scoreResult.formedWords || scoreResult.wordsFormed || [];
    var i, w, pts, key;
    for (i = 0; i < formed.length; i++) {
      w = String(formed[i].word || '').toUpperCase();
      if (!w) continue;
      pts = w.length * TILE_POINTS;
      key = w + ':' + (formed[i].cells || formed[i].positions || []).join(',');
      if (seen[key]) continue;
      seen[key] = true;
      words.push({ word: w, pts: pts, cells: formed[i].cells || formed[i].positions || [] });
    }
    if (!words.length && scoreResult.word) {
      w = String(scoreResult.word).toUpperCase();
      words.push({
        word: w,
        pts: scoreResult.letterScore != null ? scoreResult.letterScore : w.length * TILE_POINTS,
        cells: scoreResult.primaryWordCells || [],
      });
    }
    words.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      return a.word.localeCompare(b.word);
    });
    var main = mainLabel ? String(mainLabel).toUpperCase() : '';
    if (main) {
      words.sort(function (a, b) {
        if (a.word === main && b.word !== main) return -1;
        if (b.word === main && a.word !== main) return 1;
        return 0;
      });
    }

    var parts = words.map(function (entry) {
      return entry.word + ' ' + entry.pts;
    });
    var summary = parts.length ? parts.join(' + ') : '"' + (main || '?') + '"';
    if (scoreResult.letterScore != null && parts.length > 1) {
      summary += ' = ' + scoreResult.letterScore;
    }

    var parenBits = [];
    var badgeBits = [];
    if (scoreResult.linkBonus) {
      parenBits.push('+' + scoreResult.linkBonus + ' connection');
      badgeBits.push({
        kind: 'connect',
        text: '+' + scoreResult.linkBonus + ' Connect!',
        color: BOARD_THEME.connectBadge,
      });
    }
    if (scoreResult.bingo || scoreResult.bingoPoints) {
      var bingoPts = scoreResult.bingoPoints || BINGO_BONUS;
      parenBits.push('+' + bingoPts + ' bingo');
      badgeBits.push({
        kind: 'bingo',
        text: 'Bingo! +' + bingoPts,
        color: BOARD_THEME.bingoBadge,
      });
    }
    if (scoreResult.starsCaptured) {
      var starPts = scoreResult.starPoints || scoreResult.starsCaptured * STAR_BONUS;
      parenBits.push('+' + starPts + ' star');
      badgeBits.push({
        kind: 'star',
        text: 'Star +' + starPts,
        color: BOARD_THEME.starBadge,
      });
    }
    if (parenBits.length) {
      summary += ' (' + parenBits.join(', ') + ')';
    }

    return {
      words: words,
      summary: summary,
      bonusBits: parenBits.map(function (bit, idx) {
        /* keep legacy string list for older call sites */
        if (badgeBits[idx] && badgeBits[idx].kind === 'connect') {
          return 'Connect +' + scoreResult.linkBonus;
        }
        if (badgeBits[idx] && badgeBits[idx].kind === 'bingo') {
          return 'Bingo +' + (scoreResult.bingoPoints || BINGO_BONUS);
        }
        if (badgeBits[idx] && badgeBits[idx].kind === 'star') {
          return 'Star +' + (scoreResult.starPoints || scoreResult.starsCaptured * STAR_BONUS);
        }
        return bit;
      }),
      badges: badgeBits,
      letterScore: scoreResult.letterScore,
      total: scoreResult.score,
    };
  }

  syncPlayWordHighlightFromScore(scoreResult) {
    if (!scoreResult || !scoreResult.valid) {
      this.playWordHighlight = null;
      return;
    }
    var breakdown = this.buildScoreBreakdown(scoreResult);
    var cellSet = {};
    var wi, ci, cells, idx, letter;
    for (wi = 0; wi < breakdown.words.length; wi++) {
      cells = breakdown.words[wi].cells || [];
      for (ci = 0; ci < cells.length; ci++) {
        idx = Number(cells[ci]);
        if (!Number.isFinite(idx)) continue;
        /* Only highlight cells that currently show a letter (pending or committed). */
        letter = this.getDisplayLetterAt(idx);
        if (!letter) continue;
        cellSet[idx] = true;
      }
    }
    /* Fallback: at least highlight pending tiles. */
    if (!Object.keys(cellSet).length && this.pendingPlacements) {
      this.pendingPlacements.forEach(function (_, pIdx) {
        cellSet[pIdx] = true;
      });
    }
    this.playWordHighlight = {
      cellSet: cellSet,
      words: breakdown.words,
      scoreResult: scoreResult,
      breakdown: breakdown,
      pulseAt: Date.now(),
      epoch: this._previewUiEpoch,
    };
    this.ensureUiAnimLoop();
  }

  clearPlayWordHighlight() {
    this.playWordHighlight = null;
  }

  /**
   * Reset flow (highlights / toasts only — tiles stay for editing):
   * 1) Bump _previewUiEpoch so any in-flight rAF highlight tick is ignored
   * 2) Drop playWordHighlight + scoreFx
   * 3) Cancel UI animation frame
   * Used while the player is still arranging tiles and the preview goes invalid.
   */
  resetPlayPreviewUi() {
    this._previewUiEpoch = (this._previewUiEpoch || 0) + 1;
    this.playWordHighlight = null;
    this.scoreFx = null;
    this._pendingUiScoreResult = null;
    this._pendingUiScoreLabel = null;
    if (this._uiAnimId) {
      cancelAnimationFrame(this._uiAnimId);
      this._uiAnimId = null;
    }
  }

  /**
   * Full abort after a failed validation (submit / server reject):
   * 1) resetPlayPreviewUi() — clear highlights, score toast, stale anims
   * 2) Clear pending placements so the board shows only committed tiles
   * 3) Offline: return those letters to the rack. Online: rack already holds them.
   * Board is then exactly the last committed state (no partial play left).
   */
  abortInvalidPlayAttempt(reason) {
    var pendingCount = this.pendingPlacements ? this.pendingPlacements.size : 0;
    var hadDrag = !!(this.drag && this.drag.fromBoard !== undefined);
    console.info(
      '[QWERTY] abortInvalidPlayAttempt — reset flow:',
      'pendingTiles=' + pendingCount + ',',
      'inFlightBoardDrag=' + hadDrag + ',',
      'online=' + !!this.isOnlineMode() + ',',
      'reason=',
      reason || '(none)',
      '| restore to rack → clear pending → board = last committed state'
    );

    this.hideBlankPicker();
    this.resetPlayPreviewUi();
    this.playSfx('error');

    var toRestore = this.collectPendingTilesForRecall();
    if (toRestore.length) {
      console.info(
        '[QWERTY] Recalling ' + toRestore.length + ' tiles from board to rack (invalid play)'
      );
      this.restoreRecalledTilesToRack(toRestore);
      this.assertRecalledTilesOnRack(toRestore);
    }
    this.clearPendingFromBoard();
    if (toRestore.length) {
      this.assertRecalledTilesOnRack(toRestore);
    }

    this.clearRackSelection();
    this.clearExchangeMode();

    if (toRestore.length && !this.isOnlineMode()) {
      this.save();
    }

    this.updateUI();
    this.draw();
  }

  isPlayWordHighlighted(idx) {
    var hl = this.playWordHighlight;
    if (!hl || !hl.cellSet || !hl.cellSet[idx]) return false;
    if (hl.epoch != null && hl.epoch !== this._previewUiEpoch) return false;
    return true;
  }

  bumpPlacementPulse() {
    /* Only pulse a valid preview highlight — never invent/stack cells on invalid plays. */
    if (
      !this.playWordHighlight ||
      !this.playWordHighlight.scoreResult ||
      !this.playWordHighlight.scoreResult.valid
    ) {
      return;
    }
    if (
      this.playWordHighlight.epoch != null &&
      this.playWordHighlight.epoch !== this._previewUiEpoch
    ) {
      this.playWordHighlight = null;
      return;
    }
    var now = Date.now();
    /* Throttle placement pulse restarts so rapid drops don't thrash the anim loop. */
    if (this._lastPlacePulseAt && now - this._lastPlacePulseAt < 90) return;
    this._lastPlacePulseAt = now;
    this.playWordHighlight.pulseAt = now;
    this.ensureUiAnimLoop();
  }

  /** Soft bounce on rack tiles after Recall All (does not clear celebrate banners). */
  startRackSettle(tiles) {
    var list = tiles || [];
    if (!list.length) return;
    var now = Date.now();
    var byId = {};
    var byLetter = {};
    var i, t, id, L;
    for (i = 0; i < list.length; i++) {
      t = list[i];
      if (!t) continue;
      id = t.tileId || (t.id != null ? t.id : null);
      if (id) byId[id] = true;
      L = tileLetter(t);
      if (L) byLetter[L] = (byLetter[L] || 0) + 1;
    }
    this.rackSettleFx = {
      startedAt: now,
      expiresAt: now + RACK_SETTLE_MS,
      byId: byId,
      byLetter: byLetter,
    };
    this.ensureUiAnimLoop();
  }

  startScoreFx(scoreResult, mainLabel, opts) {
    if (!scoreResult || !scoreResult.valid) return;
    opts = opts || {};
    var breakdown = this.buildScoreBreakdown(scoreResult, mainLabel);
    var cellSet = {};
    var starCells = (scoreResult.starCells || []).slice();
    var wi, ci, cells, idx;
    for (wi = 0; wi < breakdown.words.length; wi++) {
      cells = breakdown.words[wi].cells || [];
      for (ci = 0; ci < cells.length; ci++) {
        idx = Number(cells[ci]);
        cellSet[idx] = true;
        if (
          starCells.indexOf(idx) < 0 &&
          this.specials &&
          this.specials[idx] === CELL_STAR
        ) {
          starCells.push(idx);
        }
      }
    }
    if (scoreResult.primaryWordCells) {
      for (ci = 0; ci < scoreResult.primaryWordCells.length; ci++) {
        cellSet[Number(scoreResult.primaryWordCells[ci])] = true;
      }
    }
    var anchor = this.getPendingScoreDisplayCell();
    if (anchor == null && scoreResult.primaryWordCells && scoreResult.primaryWordCells.length) {
      anchor = scoreResult.primaryWordCells[scoreResult.primaryWordCells.length - 1];
    }
    var mainWord = mainLabel
      ? String(mainLabel).toUpperCase()
      : String(scoreResult.word || '').toUpperCase();
    var whoLabel = opts.whoLabel ? String(opts.whoLabel) : '';
    var nowFx = Date.now();
    this.scoreFx = {
      breakdown: breakdown,
      scoreResult: scoreResult,
      cellSet: cellSet,
      starCells: starCells,
      mainWord: mainWord,
      whoLabel: whoLabel,
      hasConnect: !!(scoreResult.linkBonus),
      hasBingo: !!(scoreResult.bingo || scoreResult.bingoPoints),
      hasStar: starCells.length > 0 || !!(scoreResult.starsCaptured),
      anchorIdx: anchor,
      startedAt: nowFx,
      expiresAt: nowFx + PLAY_SCORE_FX_MS,
    };
    /* Board highlight outlives the score toast so opponents get a full 5s look. */
    this.playWordHighlight = {
      cellSet: cellSet,
      words: breakdown.words,
      breakdown: breakdown,
      scoreResult: scoreResult,
      pulseAt: nowFx,
      expiresAt: nowFx + SUBMIT_WORD_HIGHLIGHT_MS,
      submitFlash: true,
      epoch: this._previewUiEpoch,
    };
    /* Celebrate bingo / CONNECTION with their own SFX — do not also play wordplayed. */
    if (scoreResult.bingo || scoreResult.bingoPoints) {
      /* bingo SFX fired in maybeShowPlayCelebrateBanner */
    } else if (scoreResult.linkBonus) {
      /* connection SFX fired in maybeShowPlayCelebrateBanner */
    } else {
      this.playSfx('submit');
    }
    this.maybeShowPlayCelebrateBanner(scoreResult, { whoLabel: whoLabel, mainWord: mainWord });
    this.ensureUiAnimLoop();
  }

  /**
   * Centered temporary board banner (Pogo-style CONNECTION! / exchange notice).
   * kind: 'connection' | 'exchange'
   */
  showBoardBanner(opts) {
    if (!opts || !opts.title) return;
    var duration = opts.durationMs != null ? opts.durationMs : BOARD_BANNER_MS;
    this.boardBannerFx = {
      kind: opts.kind || 'exchange',
      title: String(opts.title),
      subtitle: opts.subtitle != null ? String(opts.subtitle) : '',
      startedAt: Date.now(),
      expiresAt: Date.now() + duration,
      durationMs: duration,
    };
    this.ensureUiAnimLoop();
    this.draw();
  }

  /**
   * Exchange banner actor label.
   * Online: prefer live nicknames; fall back to Deb (host) / Blake (guest).
   */
  getExchangeBannerName(actor, myIndex) {
    if (this.isOnlineMode()) {
      var seat = null;
      if (actor === 'self') {
        seat = myIndex != null ? Number(myIndex) : this.getOnlinePlayerIndex();
      } else if (actor === 'opponent') {
        var me = myIndex != null ? Number(myIndex) : this.getOnlinePlayerIndex();
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
      var mySeat = myIndex != null ? Number(myIndex) : this.getOnlinePlayerIndex();
      var label;
      if (seat === mySeat) {
        label = this.onlineSelfName || (seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME);
      } else if (seat === 0 || seat === 1) {
        label = this.onlineOpponentName || (seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME);
        if (isGenericPlayerName(label)) {
          label = seat === 0 ? DEFAULT_HOST_NAME : DEFAULT_GUEST_NAME;
        }
      } else {
        label = 'Player';
      }
      return String(label).toUpperCase();
    }
    /* Offline / vs computer — local roles only. */
    if (actor === PLAYER.HUMAN || actor === 'self') return 'YOU';
    return 'COMPUTER';
  }

  /**
   * @param {number|string} actor - Online: server player index (0 Deb / 1 Blake).
   *   Offline: PLAYER.HUMAN or PLAYER.AI.
   * @param {number} count
   * @param {{ myIndex?: number }} [opts]
   */
  showExchangeBanner(actor, count, opts) {
    opts = opts || {};
    var n = Math.max(0, Number(count) || 0);
    var myIndex = opts.myIndex != null ? opts.myIndex : this.getOnlinePlayerIndex();
    var who = this.getExchangeBannerName(actor, myIndex);
    var tileWord = n === 1 ? 'TILE' : 'TILES';
    /* Local confirm already played exchange SFX — only cue opponent exchanges here. */
    var isSelfOnline = this.isOnlineMode() && Number(actor) === Number(myIndex);
    var isSelfOffline =
      !this.isOnlineMode() && (actor === PLAYER.HUMAN || actor === 'self');
    if (!isSelfOnline && !isSelfOffline) {
      this.playSfx('exchange');
    }
    this.showBoardBanner({
      kind: 'exchange',
      title: who + ' EXCHANGED ' + n + ' ' + tileWord,
      subtitle: '',
      durationMs: BOARD_BANNER_MS,
    });
  }

  /** First-connect celebration — only when this play awards linkBonus. */
  maybeShowConnectionBanner(scoreResult) {
    if (!scoreResult || !scoreResult.linkBonus) return;
    this.showBoardBanner({
      kind: 'connection',
      title: 'CONNECTION!',
      subtitle: '+' + scoreResult.linkBonus,
      durationMs: BOARD_BANNER_MS,
    });
  }

  /** Bingo celebration when the rack is emptied this turn — shown on BOTH seats. */
  maybeShowBingoBanner(scoreResult, opts) {
    if (!scoreResult) return;
    opts = opts || {};
    var pts = scoreResult.bingoPoints || (scoreResult.bingo ? BINGO_BONUS : 0);
    if (!pts && !scoreResult.bingo) return;
    if (!pts) pts = BINGO_BONUS;
    var who = opts.whoLabel ? String(opts.whoLabel).trim() : '';
    var isSelf = !who || /^you$/i.test(who);
    var title;
    var subtitle;
    if (isSelf) {
      title = 'BINGO!';
      subtitle = '+' + pts;
    } else {
      /* Opponent seat: name the player who emptied their rack. */
      title = who.toUpperCase() + ' · BINGO!';
      subtitle = '+' + pts;
    }
    this.showBoardBanner({
      kind: 'bingo',
      title: title,
      subtitle: subtitle,
      durationMs: BOARD_BANNER_MS,
    });
  }

  /**
   * Board-center celebrate banner after a successful play.
   * Bingo takes priority over CONNECTION (emptying the rack is the louder moment).
   * Fired for the active player and the opponent when the play event syncs.
   */
  maybeShowPlayCelebrateBanner(scoreResult, opts) {
    if (!scoreResult) return;
    var hasConnect = !!(scoreResult.linkBonus && Number(scoreResult.linkBonus) > 0);
    if (scoreResult.bingo || scoreResult.bingoPoints) {
      this.playSfx('bingo');
      this.maybeShowBingoBanner(scoreResult, opts);
      /* Bingo banner wins visually, but still cue the connection sting. */
      if (hasConnect) this.playSfx('connection');
      return;
    }
    if (hasConnect) {
      this.playSfx('connection');
    }
    this.maybeShowConnectionBanner(scoreResult);
  }

  drawBoardBannerFx() {
    var fx = this.boardBannerFx;
    if (!fx) return;
    var now = Date.now();
    var dur = fx.durationMs || BOARD_BANNER_MS;
    var t = Math.min(1, Math.max(0, (now - fx.startedAt) / dur));
    if (t >= 1 || now >= fx.expiresAt) {
      this.boardBannerFx = null;
      return;
    }
    var alpha = t < 0.1 ? t / 0.1 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
    var pop = t < 0.18 ? 1 - Math.pow(1 - t / 0.18, 3) : 1;
    var scale = 0.86 + 0.14 * pop;
    var bob = Math.sin(now / 200) * (this.cellSize * 0.03);

    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var boardW = COLS * cellSize;
    var boardH = ROWS * cellSize;
    var cx = boardW / 2;
    /*
     * Keep celebrate banners in the upper band so mid-board plays stay readable.
     * Exchange notices sit a bit higher (less urgent / shorter copy).
     */
    var bandY =
      fx.kind === 'exchange' ? boardH * 0.2 : boardH * 0.26;
    var cy = bandY + bob;
    var isConnect = fx.kind === 'connection';
    var isBingo = fx.kind === 'bingo';
    var T = BOARD_THEME;

    var fontTitle = Math.max(
      isConnect || isBingo ? 22 : 14,
      Math.round(cellSize * (isConnect || isBingo ? 0.72 : 0.42))
    );
    var fontSub = Math.max(14, Math.round(cellSize * 0.48));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + fontTitle + 'px "Segoe UI", system-ui, sans-serif';
    var titleW = ctx.measureText(fx.title).width;
    var subW = 0;
    if (fx.subtitle) {
      ctx.font = '800 ' + fontSub + 'px "Segoe UI", system-ui, sans-serif';
      subW = ctx.measureText(fx.subtitle).width;
    }

    var padX = Math.max(18, cellSize * 0.55);
    var padY = Math.max(10, cellSize * ((isConnect || isBingo) && fx.subtitle ? 0.32 : 0.28));
    var lineGap = fx.subtitle ? Math.max(4, cellSize * 0.1) : 0;
    var boxW = Math.min(boardW * 0.92, Math.max(titleW, subW) + padX * 2);
    var boxH = padY * 2 + fontTitle + (fx.subtitle ? lineGap + fontSub : 0);
    var boxX = cx - boxW / 2;
    var boxY = cy - boxH / 2;

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    var fill = T.bannerExchangeFill;
    var border = T.bannerExchangeBorder;
    var glow = T.bannerExchangeGlow;
    if (isConnect) {
      fill = T.bannerConnectFill;
      border = T.bannerConnectBorder;
      glow = T.bannerConnectGlow;
    } else if (isBingo) {
      fill = 'rgba(76, 29, 64, 0.95)';
      border = T.bingoBadge;
      glow = 'rgba(244, 114, 182, 0.55)';
    }

    ctx.shadowColor = glow;
    ctx.shadowBlur = isConnect || isBingo ? 22 : 16;
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = isConnect || isBingo ? 3.5 : 2.5;
    roundRect(ctx, boxX, boxY, boxW, boxH, Math.min(boxH / 2, 22));
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    var y = boxY + padY + fontTitle / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 ' + fontTitle + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(fx.title, cx, y);
    if (fx.subtitle) {
      y += fontTitle / 2 + lineGap + fontSub / 2;
      ctx.fillStyle = '#ffd23f';
      ctx.font = '800 ' + fontSub + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(fx.subtitle, cx, y);
    }
    ctx.restore();
  }

  ensureUiAnimLoop() {
    if (this._uiAnimId) return;
    var self = this;
    var epochAtStart = this._previewUiEpoch;
    function tick() {
      self._uiAnimId = null;
      var now = Date.now();
      var need = false;
      var epochChanged = epochAtStart !== self._previewUiEpoch;

      if (self.scoreFx) {
        if (now >= self.scoreFx.expiresAt) {
          self.scoreFx = null;
        } else {
          need = true;
        }
      }
      if (self.boardBannerFx) {
        if (now >= self.boardBannerFx.expiresAt) {
          self.boardBannerFx = null;
        } else {
          need = true;
        }
      }
      if (self.rackSettleFx) {
        if (now >= self.rackSettleFx.expiresAt) {
          self.rackSettleFx = null;
        } else {
          need = true;
        }
      }
      if (self.opponentWordHighlight) {
        if (now >= self.opponentWordHighlight.expiresAt) {
          self.opponentWordHighlight = null;
        } else {
          need = true;
        }
      }
      /* Preview-epoch resets kill stale placement pulses, not celebrate banners. */
      if (!epochChanged) {
        if (self.playWordHighlight && self.playWordHighlight.pulseAt) {
          if (
            self.playWordHighlight.epoch != null &&
            self.playWordHighlight.epoch !== self._previewUiEpoch
          ) {
            self.playWordHighlight = null;
          } else if (
            self.playWordHighlight.expiresAt != null &&
            now >= self.playWordHighlight.expiresAt
          ) {
            self.playWordHighlight = null;
          } else if (now - self.playWordHighlight.pulseAt < PLACEMENT_PULSE_MS) {
            need = true;
          } else if (self.playWordHighlight.submitFlash) {
            /* Keep rings animating for the full submit highlight window. */
            need = true;
          } else if (self.playWordHighlight.expiresAt != null && now < self.playWordHighlight.expiresAt) {
            need = true;
          }
        }
        if (self.pendingPlacements && self.pendingPlacements.size && self.playWordHighlight) {
          need = true;
        }
      } else if (
        self.scoreFx ||
        self.boardBannerFx ||
        self.rackSettleFx ||
        self.opponentWordHighlight
      ) {
        need = true;
        epochAtStart = self._previewUiEpoch;
      }

      if (need) {
        self.draw();
        self._uiAnimId = requestAnimationFrame(tick);
      } else {
        self.draw();
      }
    }
    this._uiAnimId = requestAnimationFrame(tick);
  }

  formatMoveValidationError(previewText, reason, scoreResult) {
    if (!reason) return previewText ? previewText + ': Invalid move.' : 'Invalid move.';
    var preview = previewText ? String(previewText).toUpperCase() : '';

    function dictRejectMsg(badWord, isCross) {
      var w = String(badWord || '').toUpperCase();
      if (!w) return 'Not in the dictionary (exact match required).';
      if (isCross || (w.length === 2 && preview && preview !== w)) {
        return (
          '"' + w + '" is not in the dictionary' +
          (preview && preview !== w ? ' (your new tiles are part of "' + preview + '")' : '') +
          '. Every crossing word must be a real dictionary word.'
        );
      }
      /* Full word on the board may include locked letters — don't imply the rack spelled it alone. */
      if (preview && preview !== w && w.indexOf(preview) < 0 && preview.indexOf(w) < 0) {
        return (
          '"' + w + '" is not in this game\'s dictionary (US Scrabble word list). ' +
          'The play forms that word on the board; try a different placement.'
        );
      }
      return (
        '"' + w + '" is not in this game\'s dictionary (US Scrabble word list). ' +
        'Exact match required — try another word or placement.'
      );
    }

    /* Prefer explicit invalid-word list from engine when present. */
    if (scoreResult && scoreResult.invalidWords && scoreResult.invalidWords.length) {
      var listed = scoreResult.invalidWords
        .map(function (w) {
          return '"' + String(w).toUpperCase() + '"';
        })
        .join(', ');
      if (scoreResult.invalidWords.length === 1) {
        var only = String(scoreResult.invalidWords[0]).toUpperCase();
        var cross =
          !!(preview && preview !== only && only.length <= 3 && preview.length > only.length);
        return dictRejectMsg(only, cross);
      }
      return (
        'Invalid words: ' + listed +
        (preview ? ' (main play "' + preview + '")' : '') +
        '. Only real dictionary words of 2+ letters are allowed (exact match).'
      );
    }

    var multi = reason.match(/^Invalid words:\s*(.+)\.$/);
    if (multi) {
      return (
        'Invalid words: ' + multi[1] +
        (preview ? ' (main play "' + preview + '")' : '') +
        '. Each formed word must be in the dictionary.'
      );
    }

    var m = reason.match(/^"([^"]+)" is not a valid word\./);
    if (m) {
      var badWord = String(m[1]).toUpperCase();
      return dictRejectMsg(badWord, badWord.length === 2 && !!(preview && preview !== badWord));
    }
    return preview ? preview + ': ' + reason : reason;
  }

  updatePendingPreview() {
    if (this.currentPlayer !== PLAYER.HUMAN || this.gameOver) return;
    var preview = this.getPendingWordPreview();
    if (!preview) {
      /* No pending tiles — clear any leftover highlight/toast UI. */
      this.resetPlayPreviewUi();
      return;
    }
    /* New placement attempt cancels any leftover celebrate toast. */
    if (this.scoreFx && this.pendingPlacements && this.pendingPlacements.size) {
      this.scoreFx = null;
    }
    if (!preview.inLine) {
      /* Tiles not in a line yet — drop highlights but keep tiles for editing. */
      this.resetPlayPreviewUi();
      this.setMessage('Trying: ' + preview.text + ' — line up tiles in one row or column.');
      this.draw();
      return;
    }
    var scoreResult = this.getPendingScorePreview();
    if (scoreResult && scoreResult.valid) {
      var wordLabel = preview.text || scoreResult.word;
      this.syncPlayWordHighlightFromScore(scoreResult);
      this.setMessage(this.formatPendingScoreMessage(wordLabel, scoreResult), 'success');
      this.draw();
      return;
    }
    /*
     * Invalid preview (e.g. LINED): clear highlights/toasts only.
     * Tiles stay so the player can edit. Full recall happens on SUBMIT failure
     * via abortInvalidPlayAttempt() so the board returns to last committed state.
     */
    this.resetPlayPreviewUi();
    if (scoreResult && !scoreResult.valid && scoreResult.reason) {
      this.setMessage(
        this.formatMoveValidationError(preview.text, scoreResult.reason, scoreResult),
        'error'
      );
      this.draw();
      return;
    }
    var valid = isValidWord(preview.text);
    this.setMessage(
      'Trying: ' + preview.text + (valid ? ' ✓ looks valid!' : ' — not in dictionary'),
      valid ? 'success' : 'error'
    );
    this.draw();
  }

  rackSlotX(i, gap) {
    var g = gap != null ? gap : this.rackTileGap;
    if (!Number.isFinite(g)) g = 6;
    var ts = Number.isFinite(this.tileSize) ? this.tileSize : 40;
    return g + i * (ts + g) + ts / 2;
  }

  countRackTiles(player) {
    var rack = this.racks && this.racks[player];
    if (!rack) return 0;
    var n = 0;
    for (var i = 0; i < rack.length; i++) {
      if (rack[i]) n++;
    }
    return n;
  }

  rackSlotAt(x) {
    for (let i = 0; i < RACK_SIZE; i++) {
      const cx = this.rackSlotX(i);
      if (Math.abs(x - cx) < this.tileSize / 2 + 4) return i;
    }
    return -1;
  }

  rackInsertSlotAt(x) {
    if (RACK_SIZE <= 0) return -1;
    if (x <= this.rackSlotX(0) - this.tileSize * 0.3) return 0;
    for (var i = 0; i < RACK_SIZE - 1; i++) {
      var mid = (this.rackSlotX(i) + this.rackSlotX(i + 1)) / 2;
      if (x < mid) return i;
    }
    return RACK_SIZE - 1;
  }

  /* ── Drawing ──────────────────────────────────────────────── */
  draw() {
    try {
      this.drawBoard();
      this.drawOpponentRack();
      this.drawRack();
      if (this.drag) this.drawDragGhost();
    } catch (err) {
      bootError('Draw error: ' + err.message);
    }
  }

  /**
   * Draw: visual cell → logical idx → display letter (painted for LTR/TTB).
   * Placement/validation still use this.board via getLetterAt.
   */
  drawBoard() {
    const { ctx, cellSize, tileSize } = this;
    const T = BOARD_THEME;
    const boardW = COLS * cellSize;
    const boardH = ROWS * cellSize;
    const gap = 1;

    ctx.clearRect(0, 0, boardW, boardH);
    ctx.fillStyle = T.frame;
    roundRect(ctx, 0, 0, boardW, boardH, 8);
    ctx.fill();

    for (let vr = 0; vr < ROWS; vr++) {
      for (let vc = 0; vc < COLS; vc++) {
        const idx = this.serverIdxFromVisualRowCol(vr, vc);
        const x = vc * cellSize;
        const y = vr * cellSize;
        const special = this.specials[idx];
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const inset = Math.max(0.5, (cellSize - tileSize) / 2);
        const sz = cellSize - inset * 2;

        var fill = (vr + vc) % 2 === 0 ? T.cellLight : T.cellDark;
        var stroke = T.gridLine;
        /* Fixed corners: P1 green BL, Blake/P2 amber TR — never swap by seat. */
        if (idx === START_P1_IDX || special === CELL_START_P1) {
          fill = T.startP1;
          stroke = T.startP1Edge;
        } else if (idx === START_P2_IDX || special === CELL_START_P2) {
          fill = T.startP2;
          stroke = T.startP2Edge;
        } else if (special === CELL_STAR) {
          fill = T.starFill;
          stroke = T.starGlow;
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        roundRect(ctx, x + inset, y + inset, sz, sz, 4);
        ctx.fill();
        ctx.stroke();

        if (special === CELL_STAR) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = T.starGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          drawStarShape(ctx, cx, cy, cellSize * 0.22, cellSize * 0.09, T.starIcon);
          ctx.restore();
        }

        if (this.isOpponentWordHighlighted(idx)) {
          ctx.save();
          ctx.fillStyle = T.opponentHighlightGlow;
          ctx.strokeStyle = T.opponentHighlight;
          ctx.lineWidth = 2;
          ctx.shadowColor = T.opponentHighlight;
          ctx.shadowBlur = Math.max(6, cellSize * 0.22);
          roundRect(ctx, x + inset - 2, y + inset - 2, sz + 4, sz + 4, 6);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        const isPending = this.pendingPlacements.has(idx);
        const letter = this.getDisplayLetterAt(idx);
        if (letter) {
          const owner = this.getOwnerAt(idx);
          var tileOpts = { owner, pending: isPending, linked: this.boardsLinked };
          if (isPending) {
            var pendingTile = this.pendingPlacements.get(idx);
            if (pendingTile && pendingTile.blankAs != null) tileOpts.blankAs = pendingTile.blankAs;
            if (this.playWordHighlight && this.playWordHighlight.pulseAt) {
              var placeT = Math.max(
                0,
                1 - (Date.now() - this.playWordHighlight.pulseAt) / PLACEMENT_PULSE_MS
              );
              /* Smoothstep then ease — softer settle on drop */
              var smooth = placeT * placeT * (3 - 2 * placeT);
              tileOpts.placePulse = smooth * smooth * (3 - 2 * smooth);
            }
            if (this.isPlayWordHighlighted(idx)) {
              tileOpts.playHighlight = true;
            }
          } else {
            var committedCell = this.board[idx];
            if (committedCell && committedCell.isBlank) tileOpts.blankAs = letter;
          }
          if (this.isOpponentWordHighlighted(idx)) {
            tileOpts.opponentHighlight = true;
          }
          if (this.drag && this.drag.fromBoard === idx) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            this.drawTile(ctx, x + (cellSize - tileSize) / 2, y + (cellSize - tileSize) / 2, tileSize, letter, tileOpts);
            ctx.restore();
          } else {
            this.drawTile(ctx, x + (cellSize - tileSize) / 2, y + (cellSize - tileSize) / 2, tileSize, letter, tileOpts);
          }
        }

        if (idx === START_P1_IDX || idx === START_P2_IDX ||
            special === CELL_START_P1 || special === CELL_START_P2) {
          this.drawStartCornerMarker(
            ctx,
            x,
            y,
            inset,
            sz,
            idx === START_P1_IDX || special === CELL_START_P1
              ? CELL_START_P1
              : CELL_START_P2,
            !!letter
          );
        }
      }
    }

    this.drawPlayWordHighlightRings();
    this.drawPendingScoreHint();
    this.drawScoreFx();
    this.drawBoardBannerFx();
  }

  /** Soft glowing rings around every formed-word cell (drawn above tiles). */
  drawPlayWordHighlightRings() {
    var cellSet = null;
    /* While placing, never let a stale celebrate toast drive highlights. */
    if (this.pendingPlacements && this.pendingPlacements.size > 0) {
      if (
        this.playWordHighlight &&
        this.playWordHighlight.cellSet &&
        (this.playWordHighlight.epoch == null ||
          this.playWordHighlight.epoch === this._previewUiEpoch)
      ) {
        cellSet = this.playWordHighlight.cellSet;
      }
    } else if (this.scoreFx && this.scoreFx.cellSet) {
      cellSet = this.scoreFx.cellSet;
    } else if (
      this.playWordHighlight &&
      this.playWordHighlight.cellSet &&
      (this.playWordHighlight.epoch == null ||
        this.playWordHighlight.epoch === this._previewUiEpoch)
    ) {
      cellSet = this.playWordHighlight.cellSet;
    }
    if (!cellSet) return;

    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var tileSize = this.tileSize;
    var T = BOARD_THEME;
    var now = Date.now();
    var pulse = 0;
    if (this.playWordHighlight && this.playWordHighlight.pulseAt) {
      pulse = Math.max(0, 1 - (now - this.playWordHighlight.pulseAt) / PLACEMENT_PULSE_MS);
    }
    if (this.scoreFx && !(this.pendingPlacements && this.pendingPlacements.size)) {
      var fxT = (now - this.scoreFx.startedAt) / PLAY_SCORE_FX_MS;
      pulse = Math.max(pulse, Math.max(0, 1 - fxT) * 0.9);
    }
    if (
      this.playWordHighlight &&
      this.playWordHighlight.submitFlash &&
      this.playWordHighlight.expiresAt &&
      !(this.pendingPlacements && this.pendingPlacements.size)
    ) {
      var hlDur = Math.max(1, this.playWordHighlight.expiresAt - this.playWordHighlight.pulseAt);
      var hlT = (now - this.playWordHighlight.pulseAt) / hlDur;
      pulse = Math.max(pulse, Math.max(0, 1 - hlT) * 0.85);
    }
    var shimmer = 0.55 + 0.45 * Math.sin(now / 260);
    var keys = Object.keys(cellSet);
    var i, idx, rc, x, y, pad, glow, letter;

    for (i = 0; i < keys.length; i++) {
      if (!cellSet[keys[i]]) continue;
      idx = Number(keys[i]);
      /* Skip empty cells — prevents leftover stacked highlights after failed plays. */
      letter = this.getDisplayLetterAt(idx);
      if (!letter) continue;
      rc = this.visualRowColFromServerIdx(idx);
      x = rc.vc * cellSize + (cellSize - tileSize) / 2;
      y = rc.vr * cellSize + (cellSize - tileSize) / 2;
      pad = 2.5 + pulse * 2;
      glow = Math.max(5, cellSize * (0.14 + pulse * 0.16 + shimmer * 0.04));

      ctx.save();
      ctx.strokeStyle = T.playHighlightRing;
      ctx.lineWidth = 2.2 + pulse * 1.6;
      ctx.globalAlpha = 0.72 + pulse * 0.28;
      ctx.shadowColor = T.playHighlight;
      ctx.shadowBlur = glow;
      roundRect(ctx, x - pad, y - pad, tileSize + pad * 2, tileSize + pad * 2, 7);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.12 + pulse * 0.1;
      ctx.fillStyle = T.playHighlightGlow;
      roundRect(ctx, x - pad, y - pad, tileSize + pad * 2, tileSize + pad * 2, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  drawStartCornerMarker(ctx, x, y, inset, sz, special, occupied) {
    /* Once a letter is on the start square, hide YOU/P1/P2 entirely. */
    if (occupied) return;

    var T = BOARD_THEME;
    var isP1 = special === CELL_START_P1;
    var myIdx = this.isOnlineMode() ? this.getOnlinePlayerIndex() : 0;
    var isYours = this.isOnlineMode()
      ? (isP1 && myIdx === 0) || (!isP1 && myIdx === 1)
      : isP1;
    var label = isYours ? 'YOU' : isP1 ? 'P1' : 'P2';
    var edge = isP1 ? T.startP1Edge : T.startP2Edge;
    var fill = isP1 ? T.startP1 : T.startP2;
    var textColor = isP1 ? '#14532d' : '#78350f';

    ctx.save();
    ctx.strokeStyle = edge;
    ctx.fillStyle = fill;
    ctx.lineWidth = Math.max(2.5, sz * 0.1);
    ctx.globalAlpha = 0.95;
    roundRect(ctx, x + inset - 1, y + inset - 1, sz + 2, sz + 2, 5);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    roundRect(ctx, x + inset, y + inset, sz, sz, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    var emptyFont = Math.max(7, Math.round(sz * 0.22));
    ctx.font = '800 ' + emptyFont + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + inset + sz / 2, y + inset + sz / 2);
    ctx.restore();
  }

  /**
   * Reconstruct a scoreResult for UI toasts after an opponent/AI play.
   * Uses board geometry + known total; infers bonuses from the remainder.
   */
  buildObservedPlayScoreResult(word, score, placementCells) {
    var main = String(word || '').toUpperCase();
    var placed = (placementCells || []).map(Number).filter(function (n) {
      return Number.isFinite(n);
    });
    var mainCells = this.findWordCellsOnBoard(main, placed);
    if (!mainCells.length && placed.length) mainCells = placed.slice();

    var seedSet = {};
    var si;
    for (si = 0; si < placed.length; si++) seedSet[placed[si]] = true;
    for (si = 0; si < mainCells.length; si++) seedSet[mainCells[si]] = true;

    var all = getAllWordsFromBoard(this.board, COLS, ROWS);
    var formed = [];
    var seen = {};
    var wi, cells, key, usesSeed, accepted;
    for (wi = 0; wi < all.length; wi++) {
      cells = all[wi].cells || [];
      usesSeed = cells.some(function (c) { return seedSet[c]; });
      if (!usesSeed) continue;
      if (placed.length) {
        var touchesPlaced = false;
        for (si = 0; si < cells.length; si++) {
          if (placed.indexOf(cells[si]) >= 0) {
            touchesPlaced = true;
            break;
          }
        }
        if (!touchesPlaced) continue;
      }
      accepted = String(all[wi].word || '').toUpperCase();
      if (!accepted || !isValidWord(accepted)) continue;
      /* Same dictionary gate as humans/AI — never toast invalid LTR like RFARE. */
      if (!this.resolveWordFromRun(this.board, cells, this.currentPlayer)) continue;
      key = accepted + ':' + cells.join(',');
      if (seen[key]) continue;
      seen[key] = true;
      formed.push({ word: accepted, cells: cells.slice() });
    }
    if (!formed.length && main && isValidWord(main)) {
      formed.push({ word: main, cells: mainCells.slice() });
    }

    var letterScore = 0;
    for (wi = 0; wi < formed.length; wi++) {
      letterScore += formed[wi].word.length * TILE_POINTS;
    }

    var total = Number(score) || 0;
    var rem = Math.max(0, total - letterScore);
    var linkBonus = 0;
    var bingoPoints = 0;
    var starsCaptured = 0;
    var starPoints = 0;
    /*
     * Prefer bingo for a +100-shaped remainder before attributing to stars.
     * Require evidence the rack was emptied (full rack of tiles, or a main word
     * at least RACK_SIZE letters). A bare rem===100 is NOT enough — that also
     * matches two stars or undercounted letter scores.
     */
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
      if (bingoShaped && likelyBingo && formed.length) {
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
      rem -= starPoints;
    }
    /* If letter estimate overshot, still show the official total. */
    if (letterScore > total) {
      letterScore = Math.max(main.length * TILE_POINTS, total - linkBonus - bingoPoints - starPoints);
    }

    return {
      valid: true,
      score: total,
      word: main,
      formedWords: formed,
      primaryWordCells: mainCells,
      letterScore: letterScore,
      linkBonus: linkBonus,
      bingo: bingoPoints > 0,
      bingoPoints: bingoPoints,
      starsCaptured: starsCaptured,
      starPoints: starPoints,
      starCells: placed.filter(function (idx) {
        return this.specials && this.specials[idx] === CELL_STAR;
      }, this),
    };
  }

  /** Apply authoritative bonus fields from a server play event onto a scoreResult. */
  mergePlayMsgBonuses(scoreResult, msg) {
    if (!scoreResult || !msg) return scoreResult;
    if (msg.bingo != null) scoreResult.bingo = !!msg.bingo;
    if (msg.bingoPoints != null) scoreResult.bingoPoints = msg.bingoPoints;
    if (msg.linkBonus != null) scoreResult.linkBonus = msg.linkBonus;
    if (msg.letterScore != null) scoreResult.letterScore = msg.letterScore;
    if (msg.starsCaptured != null) scoreResult.starsCaptured = msg.starsCaptured;
    if (msg.starPoints != null) scoreResult.starPoints = msg.starPoints;
    if (msg.score != null) scoreResult.score = msg.score;
    if (scoreResult.bingoPoints > 0) scoreResult.bingo = true;
    return scoreResult;
  }

  /** Build a scoreResult for either seat from the play broadcast (+ optional board cells). */
  scoreResultFromPlayMsg(msg, placementCells) {
    var observed = this.buildObservedPlayScoreResult(
      msg.word,
      msg.score,
      placementCells || []
    );
    return this.mergePlayMsgBonuses(observed, msg);
  }

  /** Celebratory toast + message for any seat's completed play. */
  showPlayScoreFeedback(who, word, score, placementCells, knownResult) {
    var result;
    if (knownResult && knownResult.valid) {
      result = knownResult;
      if ((!result.formedWords || !result.formedWords.length) && placementCells) {
        var observed = this.buildObservedPlayScoreResult(word, score, placementCells);
        result.formedWords = observed.formedWords;
        if (!result.primaryWordCells) result.primaryWordCells = observed.primaryWordCells;
        if (result.letterScore == null) result.letterScore = observed.letterScore;
        /* Preserve authoritative bingo from validateMove; only fill if missing. */
        if (result.bingo == null && result.bingoPoints == null) {
          result.bingo = observed.bingo;
          result.bingoPoints = observed.bingoPoints;
        }
        if (!result.linkBonus && observed.linkBonus) {
          result.linkBonus = observed.linkBonus;
        }
      }
    } else {
      result = this.buildObservedPlayScoreResult(word, score, placementCells);
    }
    if (result.bingoPoints > 0) result.bingo = true;
    this.startScoreFx(result, word, { whoLabel: who ? String(who) : '' });
    var breakdown = this.buildScoreBreakdown(result, word);
    var msg;
    var wordUp = String(word || '').toUpperCase();
    if (who) {
      msg = who + ' played ' + wordUp + ' for +' + score;
      if (breakdown && breakdown.summary) {
        msg += ' · ' + breakdown.summary;
      }
    } else {
      msg = this.formatPlaySuccessMessage('', result, word);
    }
    this.setMessage(msg, 'success');
  }

  /**
   * Place score toast in the least-crowded board area that does not cover
   * the played word. Prefers lower-right, then other corners, then center-top.
   */
  getToastRectAboveCells(cellIndices, boxW, boxH, opts) {
    opts = opts || {};
    var cellSize = this.cellSize || 24;
    var boardW = COLS * cellSize;
    var boardH = ROWS * cellSize;
    var margin = 4;
    var gap = Math.max(8, cellSize * 0.25);

    if (!Number.isFinite(boxW) || !Number.isFinite(boxH) || boxW <= 0 || boxH <= 0) {
      boxW = Math.min(boardW * 0.5, cellSize * 8);
      boxH = cellSize * 2.5;
    }
    boxW = Math.min(boxW, boardW - margin * 2);
    boxH = Math.min(boxH, boardH - margin * 2);

    /* Occupancy: committed + pending tiles. */
    var occupied = {};
    var oi;
    for (oi = 0; oi < this.board.length; oi++) {
      if (this.boardCellLetter(this.board[oi])) occupied[oi] = true;
    }
    if (this.pendingPlacements) {
      this.pendingPlacements.forEach(function (_, idx) {
        occupied[idx] = true;
      });
    }

    var playSet = {};
    var minVr = ROWS;
    var maxVr = -1;
    var minVc = COLS;
    var maxVc = -1;
    var hasPlay = false;
    var list = cellIndices || [];
    var i, idx, rc;
    for (i = 0; i < list.length; i++) {
      idx = Number(list[i]);
      if (!Number.isFinite(idx) || idx < 0) continue;
      playSet[idx] = true;
      occupied[idx] = true;
      rc = this.visualRowColFromServerIdx(idx);
      if (!rc || !Number.isFinite(rc.vr) || !Number.isFinite(rc.vc)) continue;
      hasPlay = true;
      if (rc.vr < minVr) minVr = rc.vr;
      if (rc.vr > maxVr) maxVr = rc.vr;
      if (rc.vc < minVc) minVc = rc.vc;
      if (rc.vc > maxVc) maxVc = rc.vc;
    }
    var playTop = hasPlay ? minVr * cellSize : boardH * 0.4;
    var playBottom = hasPlay ? (maxVr + 1) * cellSize : boardH * 0.5;
    var playLeft = hasPlay ? minVc * cellSize : boardW * 0.4;
    var playRight = hasPlay ? (maxVc + 1) * cellSize : boardW * 0.5;

    function clampBox(x, y) {
      var bx = x;
      var by = y;
      if (bx < margin) bx = margin;
      if (by < margin) by = margin;
      if (bx + boxW > boardW - margin) bx = boardW - margin - boxW;
      if (by + boxH > boardH - margin) by = boardH - margin - boxH;
      return { boxX: bx, boxY: by, cx: bx + boxW / 2, cy: by + boxH / 2 };
    }

    function overlapsPlay(bx, by) {
      if (!hasPlay) return false;
      return !(
        bx + boxW <= playLeft - gap ||
        bx >= playRight + gap ||
        by + boxH <= playTop - gap ||
        by >= playBottom + gap
      );
    }

    function crowdScore(bx, by) {
      var score = 0;
      var c0 = Math.max(0, Math.floor(bx / cellSize));
      var r0 = Math.max(0, Math.floor(by / cellSize));
      var c1 = Math.min(COLS - 1, Math.floor((bx + boxW - 1) / cellSize));
      var r1 = Math.min(ROWS - 1, Math.floor((by + boxH - 1) / cellSize));
      var r, c, id;
      for (r = r0; r <= r1; r++) {
        for (c = c0; c <= c1; c++) {
          id = r * COLS + c;
          if (occupied[id]) score += playSet[id] ? 40 : 8;
        }
      }
      /* Prefer open lower-right; slight bias away from dense mid-board. */
      score += (1 - (bx + boxW / 2) / boardW) * 1.5;
      score += (1 - (by + boxH / 2) / boardH) * 1.2;
      if (overlapsPlay(bx, by)) score += 500;
      /* Keep score toasts clear of celebrate banners (bingo / CONNECTION / exchange). */
      if (
        avoidBanner &&
        !(
          bx + boxW <= avoidBanner.x ||
          bx >= avoidBanner.x + avoidBanner.w ||
          by + boxH <= avoidBanner.y ||
          by >= avoidBanner.y + avoidBanner.h
        )
      ) {
        score += 280;
      }
      return score;
    }

    var avoidBanner = null;
    if (this.boardBannerFx && Date.now() < this.boardBannerFx.expiresAt) {
      avoidBanner = {
        x: boardW * 0.08,
        y: boardH * 0.08,
        w: boardW * 0.84,
        h: boardH * 0.34,
      };
    }

    var candidates = [];
    /* Preferred open corners / bands (user: lower-right when possible). */
    candidates.push({
      mode: 'lower-right',
      x: boardW - margin - boxW,
      y: boardH - margin - boxH,
    });
    candidates.push({
      mode: 'lower-left',
      x: margin,
      y: boardH - margin - boxH,
    });
    candidates.push({
      mode: 'upper-right',
      x: boardW - margin - boxW,
      y: margin + cellSize * 0.15,
    });
    candidates.push({
      mode: 'upper-left',
      x: margin,
      y: margin + cellSize * 0.15,
    });
    candidates.push({
      mode: 'center-top',
      x: (boardW - boxW) / 2,
      y: margin + cellSize * 0.2,
    });
    candidates.push({
      mode: 'center',
      x: (boardW - boxW) / 2,
      y: (boardH - boxH) / 2 - cellSize * 0.2,
    });
    if (hasPlay) {
      candidates.push({
        mode: 'above-play',
        x: (playLeft + playRight) / 2 - boxW / 2,
        y: playTop - gap - boxH,
      });
      candidates.push({
        mode: 'below-play',
        x: (playLeft + playRight) / 2 - boxW / 2,
        y: playBottom + gap,
      });
      candidates.push({
        mode: 'left-of-play',
        x: playLeft - gap - boxW,
        y: (playTop + playBottom) / 2 - boxH / 2,
      });
      candidates.push({
        mode: 'right-of-play',
        x: playRight + gap,
        y: (playTop + playBottom) / 2 - boxH / 2,
      });
    }

    var best = null;
    var bestScore = Infinity;
    var ci, cand, placed, sc;
    for (ci = 0; ci < candidates.length; ci++) {
      cand = candidates[ci];
      placed = clampBox(cand.x, cand.y);
      sc = crowdScore(placed.boxX, placed.boxY);
      /* Stable tie-break: earlier candidates (lower-right first) win ties. */
      sc += ci * 0.01;
      if (sc < bestScore) {
        bestScore = sc;
        best = {
          boxX: placed.boxX,
          boxY: placed.boxY,
          cx: placed.cx,
          cy: placed.cy,
          playTop: playTop,
          mode: cand.mode,
        };
      }
    }

    if (!best) {
      placed = clampBox((boardW - boxW) / 2, margin + cellSize * 0.2);
      best = {
        boxX: placed.boxX,
        boxY: placed.boxY,
        cx: placed.cx,
        cy: placed.cy,
        playTop: playTop,
        mode: 'center-top',
      };
    }
    return best;
  }

  collectBreakdownCellIndices(breakdown, fallbackIdx) {
    var cells = [];
    var seen = {};
    /* Prefer pending tiles for preview positioning — those are the covered word. */
    if (this.pendingPlacements && this.pendingPlacements.size) {
      this.pendingPlacements.forEach(function (_, idx) {
        cells.push(idx);
        seen[idx] = true;
      });
      return cells;
    }
    var wi, ci, c;
    if (breakdown && breakdown.words) {
      for (wi = 0; wi < breakdown.words.length; wi++) {
        var list = breakdown.words[wi].cells || [];
        for (ci = 0; ci < list.length; ci++) {
          c = Number(list[ci]);
          if (!Number.isFinite(c) || seen[c]) continue;
          seen[c] = true;
          cells.push(c);
        }
      }
    }
    if (!cells.length && fallbackIdx != null) cells.push(fallbackIdx);
    return cells;
  }

  drawPendingScoreHint() {
    if (this.currentPlayer !== PLAYER.HUMAN || this.gameOver || this.pendingPlacements.size === 0) return;
    if (this.scoreFx) return;

    var scoreResult = this.getPendingScorePreview();
    if (!scoreResult || !scoreResult.valid) return;

    var idx = this.getPendingScoreDisplayCell();
    if (idx == null) return;

    var preview = this.getPendingWordPreview();
    var mainLabel = (preview && preview.text) || scoreResult.word || '';
    var breakdown = this.buildScoreBreakdown(scoreResult, mainLabel);
    /* Dynamic placement — least-crowded area that leaves the play visible. */
    this.drawScoreBreakdownPopup(idx, breakdown, scoreResult, 1, 0, false, {});
  }

  /**
   * Board position for the celebratory score toast: above the played cluster.
   */
  getScoreFxCenter(fx) {
    var keys = Object.keys((fx && fx.cellSet) || {});
    var cells = [];
    var i;
    for (i = 0; i < keys.length; i++) {
      if (fx.cellSet[keys[i]]) cells.push(Number(keys[i]));
    }
    if (!cells.length && fx && fx.anchorIdx != null) cells.push(fx.anchorIdx);
    var rect = this.getToastRectAboveCells(cells, this.cellSize * 4, this.cellSize * 2);
    return { cx: rect.cx, cy: rect.cy, playTop: rect.playTop, cells: cells };
  }

  drawScoreFx() {
    if (!this.scoreFx) return;
    var fx = this.scoreFx;
    var now = Date.now();
    var t = Math.min(1, Math.max(0, (now - fx.startedAt) / PLAY_SCORE_FX_MS));
    /* Pop in (~10%), hold, fade last ~25% — ~3.6s total. */
    var alpha = t < 0.08 ? t / 0.08 : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
    var pop = t < 0.14 ? (1 - Math.pow(1 - t / 0.14, 3)) : 1;
    var scale = 0.86 + 0.14 * pop;
    var floatY = this.cellSize * 0.2 * Math.min(1, t / 0.9);
    this.drawStarCaptureBursts(fx, t, alpha);
    this.drawPogoScoreToast(fx, alpha, scale, floatY);
  }

  /**
   * Classic Pogo-style celebration: big +points, main word, breakdown.
   * Placed fully above the played tiles (or center-top if needed).
   */
  drawPogoScoreToast(fx, alpha, scale, floatY) {
    if (!fx || !fx.breakdown) return;
    var breakdown = fx.breakdown;
    var scoreResult = fx.scoreResult || { score: breakdown.total };
    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var boardW = COLS * cellSize;

    var whoLabel = fx.whoLabel ? String(fx.whoLabel) : '';
    var mainWord = fx.mainWord || (breakdown.words[0] && breakdown.words[0].word) || '';
    var wordLine = breakdown.summary || '';
    var parenAt = wordLine.lastIndexOf(' (');
    if (parenAt > 0) wordLine = wordLine.slice(0, parenAt);
    var totalLabel = '+' + (scoreResult.score != null ? scoreResult.score : breakdown.total);
    var badges = breakdown.badges ? breakdown.badges.slice() : [];

    var fontWho = Math.max(9, Math.round(cellSize * 0.24));
    var fontTotal = Math.max(22, Math.round(cellSize * 0.72));
    var fontWord = Math.max(14, Math.round(cellSize * 0.42));
    var fontBreak = Math.max(9, Math.round(cellSize * 0.26));
    var fontBadge = Math.max(8, Math.round(cellSize * 0.22));

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '800 ' + fontTotal + 'px "Segoe UI", system-ui, sans-serif';
    var totalW = ctx.measureText(totalLabel).width;
    ctx.font = '800 ' + fontWord + 'px "Segoe UI", system-ui, sans-serif';
    var mainW = mainWord ? ctx.measureText(mainWord).width : 0;
    ctx.font = '700 ' + fontBreak + 'px "Segoe UI", system-ui, sans-serif';
    var breakW = ctx.measureText(wordLine).width;
    ctx.font = '700 ' + fontWho + 'px "Segoe UI", system-ui, sans-serif';
    var whoText = whoLabel ? whoLabel + ' played' : '';
    var whoW = whoText ? ctx.measureText(whoText).width : 0;

    var badgeGap = 6;
    var badgePadX = 8;
    var badgeH = fontBadge + 8;
    var badgeWidths = [];
    var badgesW = 0;
    var bi;
    ctx.font = '800 ' + fontBadge + 'px "Segoe UI", system-ui, sans-serif';
    for (bi = 0; bi < badges.length; bi++) {
      badgeWidths[bi] = ctx.measureText(badges[bi].text).width + badgePadX * 2;
      badgesW += badgeWidths[bi] + (bi ? badgeGap : 0);
    }

    var padX = Math.max(14, cellSize * 0.35);
    var padY = Math.max(10, cellSize * 0.22);
    var lineGap = Math.max(4, Math.round(cellSize * 0.08));
    var contentW = Math.max(totalW, mainW, breakW, badgesW, whoW);
    var boxW = Math.min(boardW * 0.92, contentW + padX * 2);
    var linesH =
      (whoText ? fontWho + lineGap : 0) +
      fontTotal +
      lineGap +
      (mainWord ? fontWord + lineGap : 0) +
      fontBreak;
    if (badges.length) linesH += lineGap + badgeH;
    var boxH = padY * 2 + linesH;

    var cells = this.collectBreakdownCellIndices(breakdown, fx.anchorIdx);
    if ((!cells || !cells.length) && fx.cellSet) {
      cells = Object.keys(fx.cellSet).map(Number);
    }
    /* Post-submit: try above the play; auto-falls back to center-top if it would cover tiles. */
    /* Post-submit: least-crowded area that does not cover the play. */
    var rect = this.getToastRectAboveCells(cells, boxW, boxH, {});
    var boxX = rect.boxX;
    var boxY = Math.max(4, rect.boxY - (floatY || 0));
    var cx = boxX + boxW / 2;

    ctx.translate(cx, boxY + boxH / 2);
    ctx.scale(scale || 1, scale || 1);
    ctx.translate(-cx, -(boxY + boxH / 2));

    ctx.fillStyle = 'rgba(26, 18, 48, 0.88)';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 210, 63, 0.45)';
    ctx.shadowBlur = 18;
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    var yCursor = boxY + padY;
    if (whoText) {
      yCursor += fontWho / 2;
      ctx.fillStyle = 'rgba(255, 210, 63, 0.9)';
      ctx.font = '700 ' + fontWho + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(whoText, cx, yCursor);
      yCursor += fontWho / 2 + lineGap;
    }

    yCursor += fontTotal / 2;
    ctx.fillStyle = '#ffd23f';
    ctx.font = '800 ' + fontTotal + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(totalLabel, cx, yCursor);

    if (mainWord) {
      yCursor += fontTotal / 2 + lineGap + fontWord / 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 ' + fontWord + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(mainWord, cx, yCursor);
    }

    yCursor += (mainWord ? fontWord : fontTotal) / 2 + lineGap + fontBreak / 2;
    ctx.fillStyle = 'rgba(245, 240, 255, 0.92)';
    ctx.font = '700 ' + fontBreak + 'px "Segoe UI", system-ui, sans-serif';
    var breakDraw = wordLine;
    if (breakW > boxW - padX * 2) {
      while (breakDraw.length > 8 && ctx.measureText(breakDraw + '…').width > boxW - padX * 2) {
        breakDraw = breakDraw.slice(0, -1);
      }
      breakDraw += '…';
    }
    ctx.fillText(breakDraw, cx, yCursor);

    if (badges.length) {
      yCursor += fontBreak / 2 + lineGap + badgeH / 2;
      var bx = cx - badgesW / 2;
      for (bi = 0; bi < badges.length; bi++) {
        ctx.fillStyle = badges[bi].color;
        ctx.shadowColor = badges[bi].color;
        ctx.shadowBlur = 8;
        roundRect(ctx, bx, yCursor - badgeH / 2, badgeWidths[bi], badgeH, badgeH / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1a1030';
        ctx.font = '800 ' + fontBadge + 'px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(badges[bi].text, bx + badgeWidths[bi] / 2, yCursor);
        bx += badgeWidths[bi] + badgeGap;
      }
    }
    ctx.restore();
  }

  /** Floating "+75 Connect!" / "Bingo! +100" callouts after submit. */
  drawBonusCallouts(fx, t) {
    if (!fx || !fx.breakdown || !fx.breakdown.badges || !fx.breakdown.badges.length) return;
    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var center = this.getScoreFxCenter(fx);
    var cx = center.cx;
    var baseY = center.cy - cellSize * 0.2;

    var badges = fx.breakdown.badges;
    var bi, badge, delay, localT, life, alpha, y, scale, fontSize, textW, boxW, boxH;
    for (bi = 0; bi < badges.length; bi++) {
      badge = badges[bi];
      delay = 0.18 + bi * 0.1;
      localT = (t - delay) / (BONUS_CALLOUT_MS / PLAY_SCORE_FX_MS);
      if (localT < 0 || localT > 1) continue;
      life = localT < 0.18 ? localT / 0.18 : localT > 0.6 ? Math.max(0, 1 - (localT - 0.6) / 0.4) : 1;
      alpha = life * 0.95;
      scale = 0.9 + 0.18 * Math.sin(Math.min(1, localT / 0.22) * Math.PI * 0.5);
      y = baseY - cellSize * (0.55 + bi * 0.38) - cellSize * 0.4 * localT;

      fontSize = Math.max(11, Math.round(cellSize * 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 ' + fontSize + 'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      textW = ctx.measureText(badge.text).width;
      boxW = (textW + 16) * scale;
      boxH = (fontSize + 10) * scale;
      ctx.fillStyle = badge.color;
      ctx.shadowColor = badge.color;
      ctx.shadowBlur = 12;
      roundRect(ctx, cx - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1030';
      ctx.font = '800 ' + Math.round(fontSize * scale) + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(badge.text, cx, y);
      ctx.restore();
    }
  }

  drawStarCaptureBursts(fx, t, alpha) {
    if (!fx.starCells || !fx.starCells.length) return;
    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var T = BOARD_THEME;
    var si, idx, rc, cx, cy, burst, rays, ri, ang, len, spark, sparkAng, sparkR;
    for (si = 0; si < fx.starCells.length; si++) {
      idx = fx.starCells[si];
      rc = this.visualRowColFromServerIdx(idx);
      cx = rc.vc * cellSize + cellSize / 2;
      cy = rc.vr * cellSize + cellSize / 2;
      burst = Math.min(1, t * 1.8);
      ctx.save();
      ctx.globalAlpha = alpha * Math.max(0, 1 - burst * 0.25);
      ctx.fillStyle = T.starGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * (0.2 + burst * 0.5), 0, Math.PI * 2);
      ctx.fill();
      drawStarShape(
        ctx,
        cx,
        cy - burst * cellSize * 0.15,
        cellSize * (0.22 + burst * 0.22),
        cellSize * (0.09 + burst * 0.08),
        T.starBadge
      );
      rays = 10;
      ctx.strokeStyle = T.starBadge;
      ctx.lineWidth = Math.max(1.5, cellSize * 0.045);
      ctx.globalAlpha = alpha * Math.max(0, 1 - burst);
      for (ri = 0; ri < rays; ri++) {
        ang = (Math.PI * 2 * ri) / rays + t * 2.4;
        len = cellSize * (0.3 + burst * 0.7);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * cellSize * 0.1, cy + Math.sin(ang) * cellSize * 0.1);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
      /* sparkles */
      ctx.fillStyle = '#fff8d6';
      for (spark = 0; spark < 6; spark++) {
        sparkAng = (Math.PI * 2 * spark) / 6 + t * 3;
        sparkR = cellSize * (0.35 + burst * 0.55);
        ctx.globalAlpha = alpha * Math.max(0, 1 - burst) * 0.9;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(sparkAng) * sparkR,
          cy + Math.sin(sparkAng) * sparkR,
          Math.max(1.5, cellSize * 0.05),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawScoreBreakdownPopup(idx, breakdown, scoreResult, alpha, risePx, celebrate, opts) {
    if (!breakdown || idx == null) return;
    if (!scoreResult) scoreResult = { score: breakdown.total };
    opts = opts || {};
    var ctx = this.ctx;
    var cellSize = this.cellSize;
    var T = BOARD_THEME;
    var boardW = COLS * cellSize;

    /* Word line without paren bonuses when badges are shown separately */
    var wordLine = breakdown.summary || '';
    var parenAt = wordLine.lastIndexOf(' (');
    if (parenAt > 0 && breakdown.badges && breakdown.badges.length) {
      wordLine = wordLine.slice(0, parenAt);
    }
    var totalLabel = '+' + (scoreResult.score != null ? scoreResult.score : breakdown.total);
    var fontWord = Math.max(8, Math.round(cellSize * 0.26));
    var fontTotal = Math.max(10, Math.round(cellSize * 0.36));
    var fontBadge = Math.max(7, Math.round(cellSize * 0.2));

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '700 ' + fontWord + 'px "Segoe UI", system-ui, sans-serif';
    var wordW = ctx.measureText(wordLine).width;
    ctx.font = '800 ' + fontTotal + 'px "Segoe UI", system-ui, sans-serif';
    var totalW = ctx.measureText(totalLabel).width;

    var badges = breakdown.badges ? breakdown.badges.slice() : [];
    var badgePulse = celebrate ? 1 : 0.85 + 0.15 * Math.sin(Date.now() / 220);

    var badgeGap = 4;
    var badgePadX = 6;
    var badgeH = fontBadge + 7;
    var badgeWidths = [];
    var badgesW = 0;
    var bi;
    ctx.font = '800 ' + fontBadge + 'px "Segoe UI", system-ui, sans-serif';
    for (bi = 0; bi < badges.length; bi++) {
      badgeWidths[bi] = ctx.measureText(badges[bi].text).width + badgePadX * 2;
      badgesW += badgeWidths[bi] + (bi ? badgeGap : 0);
    }

    var padX = 8;
    var padY = 5;
    var lineGap = 3;
    var contentW = Math.max(wordW, totalW, badgesW);
    var boxW = Math.min(boardW * 0.94, contentW + padX * 2);
    var boxH = padY * 2 + fontTotal + lineGap + fontWord + (badges.length ? lineGap + badgeH : 0);

    var cells = this.collectBreakdownCellIndices(breakdown, idx);
    var rect = this.getToastRectAboveCells(cells, boxW, boxH, opts);
    var boxX = rect.boxX;
    var boxY = Math.max(4, rect.boxY - (risePx || 0));
    var cx = boxX + boxW / 2;

    ctx.fillStyle = celebrate ? 'rgba(45, 27, 78, 0.94)' : 'rgba(45, 27, 78, 0.9)';
    ctx.strokeStyle = celebrate ? T.playHighlight : '#ffd23f';
    ctx.lineWidth = celebrate ? 2.5 : 2;
    if (celebrate) {
      ctx.shadowColor = T.playHighlight;
      ctx.shadowBlur = 12;
    }
    roundRect(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    var yCursor = boxY + padY + fontTotal / 2;
    ctx.fillStyle = '#ffd23f';
    ctx.font = '800 ' + fontTotal + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(totalLabel, cx, yCursor);

    yCursor += fontTotal / 2 + lineGap + fontWord / 2;
    ctx.fillStyle = '#f5f0ff';
    ctx.font = '700 ' + fontWord + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(wordLine, cx, yCursor);

    if (badges.length) {
      yCursor += fontWord / 2 + lineGap + badgeH / 2;
      var bx = cx - badgesW / 2;
      for (bi = 0; bi < badges.length; bi++) {
        ctx.save();
        ctx.globalAlpha = (alpha == null ? 1 : alpha) * badgePulse;
        ctx.fillStyle = badges[bi].color;
        ctx.shadowColor = badges[bi].color;
        ctx.shadowBlur = celebrate ? 10 : 6;
        roundRect(ctx, bx, yCursor - badgeH / 2, badgeWidths[bi], badgeH, badgeH / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1a1030';
        ctx.font = '800 ' + fontBadge + 'px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(badges[bi].text, bx + badgeWidths[bi] / 2, yCursor);
        ctx.restore();
        bx += badgeWidths[bi] + badgeGap;
      }
    }
    ctx.restore();
  }

  drawOpponentRack() {
    if (!this.opponentRackCtx || !this.racks) return;

    var ctx = this.opponentRackCtx;
    var tileSize = this.tileSize;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.opponentRackCanvas.width / dpr;
    var h = this.opponentRackCanvas.height / dpr;
    var gap = this.opponentRackTileGap != null ? this.opponentRackTileGap : this.rackTileGap;
    ctx.clearRect(0, 0, w, h);

    var rack = this.racks[PLAYER.AI];
    if (!rack) return;

    var ty = 8;
    for (var i = 0; i < RACK_SIZE; i++) {
      if (!rack[i]) continue;
      var cx = this.rackSlotX(i, gap);
      this.drawTileBack(ctx, cx - tileSize / 2, ty, tileSize, PLAYER.AI);
    }
  }

  drawRack() {
    if (!this.racks) return;

    var rackCtx = this.rackCtx;
    var tileSize = this.tileSize;
    rackCtx.save();
    rackCtx.setTransform(1, 0, 0, 1, 0, 0);
    rackCtx.clearRect(0, 0, this.rackCanvas.width, this.rackCanvas.height);
    rackCtx.fillStyle = '#f0ebe3';
    rackCtx.fillRect(0, 0, this.rackCanvas.width, this.rackCanvas.height);
    rackCtx.restore();

    var rack = this.racks[PLAYER.HUMAN];
    if (!rack) return;

    for (var i = 0; i < RACK_SIZE; i++) {
      var tile = rack[i];
      var letter = tileLetter(tile);
      var cx = this.rackSlotX(i);
      var ty = 8;

      if (this.rackSelectedSlot === i && letter && !this.isRackSlotPending(i)) {
        rackCtx.save();
        rackCtx.strokeStyle = '#1a9e8f';
        rackCtx.lineWidth = 3;
        roundRect(rackCtx, cx - tileSize / 2 - 2, ty - 2, tileSize + 4, tileSize + 4, 6);
        rackCtx.stroke();
        rackCtx.restore();
      }

      if (this.exchangeMode && this.exchangeSlots[i] && letter && !this.isRackSlotPending(i)) {
        rackCtx.save();
        rackCtx.strokeStyle = '#e67e22';
        rackCtx.lineWidth = 3;
        roundRect(rackCtx, cx - tileSize / 2 - 2, ty - 2, tileSize + 4, tileSize + 4, 6);
        rackCtx.stroke();
        rackCtx.restore();
      }

      if (!letter) continue;
      if (this.isRackSlotPending(i)) continue;
      var rackOpts = { owner: PLAYER.HUMAN };
      var settle = this.rackSettleFx;
      if (settle && Date.now() < settle.expiresAt) {
        var settleT = Math.max(
          0,
          1 - (Date.now() - settle.startedAt) / RACK_SETTLE_MS
        );
        rackOpts.rackSettle = settleT * settleT * (3 - 2 * settleT);
      }
      if (this.drag && this.drag.fromRack === i) {
        rackCtx.save();
        rackCtx.globalAlpha = 0.35;
        this.drawTile(rackCtx, cx - tileSize / 2, ty, tileSize, letter, rackOpts);
        rackCtx.restore();
        continue;
      }
      this.drawTile(rackCtx, cx - tileSize / 2, ty, tileSize, letter, rackOpts);
    }
  }

  isRackSlotPending(slotIndex) {
    var rack = this.racks[PLAYER.HUMAN];
    var tile = rack && rack[slotIndex] ? rack[slotIndex] : null;
    var tileId = tile && tile.id ? tile.id : null;
    if (this.drag && this.drag.fromRack === slotIndex) return true;
    if (!this.pendingPlacements) return false;
    for (var p of this.pendingPlacements.values()) {
      if (!p) continue;
      if (p.rackIndex === slotIndex) return true;
      if (tileId && p.tileId && p.tileId === tileId) return true;
    }
    return false;
  }

  removeTileFromRack(player, rackIndex) {
    if (rackIndex >= 0 && this.racks[player]) {
      this.racks[player][rackIndex] = null;
    }
  }

  recoverOneMissingTile(letter) {
    if (!letter) return null;
    if (this.currentPlayer === PLAYER.HUMAN && !this.gameOver && this.racks[PLAYER.HUMAN]) {
      var rack = this.racks[PLAYER.HUMAN];
      for (var i = 0; i < RACK_SIZE; i++) {
        if (!rack[i]) {
          rack[i] = { letter: letter, id: uid() };
          return 'rack';
        }
      }
    }
    this.bag.push(letter);
    return 'bag';
  }

  auditRecoverMissingTiles(silent) {
    var found = countGameTiles(this);
    var recovered = [];
    var addedToBag = false;
    for (var L in EXPECTED_TILE_COUNTS) {
      if (!Object.prototype.hasOwnProperty.call(EXPECTED_TILE_COUNTS, L)) continue;
      var need = EXPECTED_TILE_COUNTS[L] - (found[L] || 0);
      for (var n = 0; n < need; n++) {
        var where = this.recoverOneMissingTile(L);
        if (where) {
          recovered.push(L);
          if (where === 'bag') addedToBag = true;
          found[L] = (found[L] || 0) + 1;
        }
      }
    }
    if (recovered.length) {
      if (addedToBag) this.bag = shuffle(this.bag);
      if (!silent) {
        this.setMessage(
          'Recovered missing tile' + (recovered.length > 1 ? 's' : '') + ': ' + recovered.join(', '),
          'success'
        );
      }
      this.save();
    }
    return recovered;
  }

  restoreTileToRack(player, rackIndex, letter) {
    if (!letter || !this.racks[player]) return false;
    var rack = this.racks[player];
    /* Blanks must return as '*', never as their chosen face letter. */
    var L = letter === '*' ? '*' : String(letter).toUpperCase();

    if (rackIndex >= 0 && rackIndex < RACK_SIZE) {
      if (!rack[rackIndex]) {
        rack[rackIndex] = { letter: L, id: uid() };
        return true;
      }
      if (String(rack[rackIndex].letter || '') === L) return true;
      /* Do not overwrite a different tile just because the slot is marked pending. */
    }

    for (var i = 0; i < RACK_SIZE; i++) {
      if (!rack[i]) {
        rack[i] = { letter: L, id: uid() };
        return true;
      }
    }

    console.warn('[QWERTY] restoreTileToRack: rack full, could not place', L);
    return false;
  }

  drawTile(ctx, x, y, size, letter, opts) {
    if (!opts) opts = {};
    if (!letter) return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return;
    var T = BOARD_THEME;
    var isBlank = letter === '*';
    var display = isBlank ? (opts.blankAs != null ? opts.blankAs : '?') : letter;
    var isHuman = opts.owner === PLAYER.HUMAN;
    var isAi = opts.owner === PLAYER.AI;
    var onBoard = isHuman || isAi;
    var useLinked = opts.linked && onBoard;

    var drawX = x;
    var drawY = y;
    var drawSize = size;
    var pulseScale = 1;
    var pulseLift = 0;
    if (opts.placePulse > 0) {
      var bounce = Math.sin(opts.placePulse * Math.PI);
      /* Slight overshoot then settle — less jumpy than the old bounce. */
      pulseScale = 1 + 0.11 * bounce;
      pulseLift = bounce * size * 0.07;
    }
    if (opts.rackSettle > 0) {
      var settle = Math.sin(opts.rackSettle * Math.PI);
      pulseScale = 1 + 0.09 * settle;
      pulseLift = settle * size * 0.06;
    }

    ctx.save();
    if (pulseScale !== 1 || pulseLift) {
      var cx = x + size / 2;
      var cy = y + size / 2;
      ctx.translate(cx, cy - pulseLift);
      ctx.scale(pulseScale, pulseScale);
      ctx.translate(-cx, -cy);
    }
    drawSize = size;
    drawX = x;
    drawY = y;

    ctx.shadowColor = 'rgba(26, 39, 68, 0.22)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    var grad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawSize);
    if (useLinked) {
      grad.addColorStop(0, T.tileLinkedTop);
      grad.addColorStop(1, T.tileLinkedBottom);
    } else if (isHuman) {
      grad.addColorStop(0, T.tileHumanTop);
      grad.addColorStop(1, T.tileHumanBottom);
    } else if (isAi) {
      grad.addColorStop(0, T.tileAiTop);
      grad.addColorStop(1, T.tileAiBottom);
    } else {
      grad.addColorStop(0, T.tileRackTop);
      grad.addColorStop(1, T.tileRackBottom);
    }

    ctx.fillStyle = grad;
    if (opts.pending) {
      ctx.strokeStyle = opts.playHighlight ? T.playHighlight : T.tileAiTop;
      ctx.lineWidth = opts.playHighlight ? 2.5 : 1.5;
      if (opts.placePulse > 0) {
        ctx.shadowColor = T.playHighlight;
        ctx.shadowBlur = 6 + opts.placePulse * 10;
      }
    } else {
      ctx.strokeStyle = T.tileEdge;
      ctx.lineWidth = 1;
    }

    if (opts.opponentHighlight) {
      ctx.strokeStyle = T.opponentHighlight;
      ctx.lineWidth = 3;
      ctx.shadowColor = T.opponentHighlight;
      ctx.shadowBlur = 8;
    }

    var r = Math.max(3, drawSize * 0.12);
    roundRect(ctx, drawX, drawY, drawSize, drawSize, r);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    if (useLinked) {
      ctx.fillStyle = T.tileLinkedText;
    } else {
      ctx.fillStyle = onBoard ? (isHuman ? T.tileHumanText : T.tileAiText) : T.tileRackText;
    }
    ctx.font = tileLetterFont(drawSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var letterX = drawX + drawSize / 2;
    var letterY = drawY + drawSize / 2;
    var letterText = display.toUpperCase();
    if (onBoard || useLinked) {
      ctx.lineWidth = Math.max(1, drawSize * 0.035);
      ctx.strokeStyle = 'rgba(45, 27, 78, 0.42)';
      ctx.strokeText(letterText, letterX, letterY);
    }
    ctx.fillText(letterText, letterX, letterY);

    ctx.restore();
  }

  drawTileBack(ctx, x, y, size, owner) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return;
    var T = BOARD_THEME;
    var isAi = owner === PLAYER.AI;
    ctx.save();
    ctx.shadowColor = 'rgba(26, 39, 68, 0.22)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    var grad;
    if (isAi) {
      grad = ctx.createLinearGradient(x, y, x, y + size);
      grad.addColorStop(0, T.tileAiTop);
      grad.addColorStop(1, T.tileAiBottom);
    } else {
      grad = ctx.createLinearGradient(x, y, x + size, y + size);
      grad.addColorStop(0, T.tileBackTop);
      grad.addColorStop(0.5, T.tileBackBottom);
      grad.addColorStop(1, T.tileBackTop);
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = isAi ? T.tileEdge : T.tileBackEdge;
    ctx.lineWidth = 1.5;

    var r = Math.max(3, size * 0.12);
    roundRect(ctx, x, y, size, size, r);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    var cx = x + size / 2;
    var cy = y + size / 2;
    var d = size * 0.2;
    ctx.strokeStyle = T.tileBackAccent;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - d * 0.6, cy);
    ctx.lineTo(cx + d * 0.6, cy);
    ctx.moveTo(cx, cy - d * 0.6);
    ctx.lineTo(cx, cy + d * 0.6);
    ctx.stroke();

    ctx.restore();
  }

  drawDragGhost() {
    var drag = this.drag;
    if (!drag || drag.clientX == null || drag.clientY == null) return;
    this._ensureDragOverlay();
    this._syncDragOverlaySize();
    var tileSize = this.tileSize;
    var overlayCtx = this._dragOverlayCtx;
    this._clearDragOverlay();
    overlayCtx.save();
    overlayCtx.globalAlpha = 0.92;
    this.drawTile(
      overlayCtx,
      drag.clientX - tileSize / 2,
      drag.clientY - tileSize / 2,
      tileSize,
      drag.letter,
      {
        pending: true,
        blankAs: drag.blankAs,
        owner: PLAYER.HUMAN,
        linked: this.boardsLinked && drag.fromBoard !== undefined,
      }
    );
    overlayCtx.restore();
  }

  /* ── Blank tile letter picker ─────────────────────────────── */
  setupExchangeNotice() {
    if (this._exchangeNoticeReady) return;
    var self = this;
    document.addEventListener('click', function (e) {
      var overlay = self.ui.exchangeNoticeOverlay;
      if (!overlay || overlay.hidden) return;
      var target = e.target;
      if (target && target.id === 'exchange-notice-ok') {
        e.preventDefault();
        self.hideExchangeNotice();
        return;
      }
      if (target === overlay) {
        self.hideExchangeNotice();
      }
    });
    this._exchangeNoticeReady = true;
  }

  ensureExchangeNoticeElements() {
    if (!this.ui.exchangeNoticeOverlay) {
      this.ui.exchangeNoticeOverlay = document.getElementById('exchange-notice-overlay');
    }
    if (!this.ui.exchangeNoticeTitle) {
      this.ui.exchangeNoticeTitle = document.getElementById('exchange-notice-title');
    }
    if (!this.ui.exchangeNoticeBody) {
      this.ui.exchangeNoticeBody = document.getElementById('exchange-notice-body');
    }
    if (!this.ui.exchangeNoticeHint) {
      this.ui.exchangeNoticeHint = document.getElementById('exchange-notice-hint');
    }
    if (!this.ui.exchangeNoticeOk) {
      this.ui.exchangeNoticeOk = document.getElementById('exchange-notice-ok');
    }
  }

  isExchangeNoticeOpen() {
    return this.ui.exchangeNoticeOverlay && !this.ui.exchangeNoticeOverlay.hidden;
  }

  openExchangeNotice(title, body, hint) {
    var self = this;
    this.ensureExchangeNoticeElements();
    if (!this.ui.exchangeNoticeOverlay) {
      return Promise.resolve();
    }
    if (this.ui.exchangeNoticeTitle) this.ui.exchangeNoticeTitle.textContent = title;
    if (this.ui.exchangeNoticeBody) this.ui.exchangeNoticeBody.textContent = body;
    if (this.ui.exchangeNoticeHint) {
      this.ui.exchangeNoticeHint.textContent = hint || 'No word was placed on the board this turn.';
    }
    return new Promise(function (resolve) {
      self._exchangeNoticeDismiss = resolve;
      self.ui.exchangeNoticeOverlay.hidden = false;
      self.ui.exchangeNoticeOverlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () {
        if (self.ui.exchangeNoticeOk) self.ui.exchangeNoticeOk.focus();
      });
    });
  }

  logExchangeToChat(player, count) {
    var isHuman = player === PLAYER.HUMAN;
    var who = isHuman ? 'You' : 'Computer';
    var tileWord = count === 1 ? 'tile' : 'tiles';
    var systemText = who + ' exchanged ' + count + ' letter ' + tileWord + ' (no word played).';
    this.addChatSystem(systemText);
    if (!isHuman) {
      this.addChatLine(
        CHAT_AI_NAME,
        'Exchanged ' + count + ' letter ' + tileWord + '. No word played this turn.',
        'opponent'
      );
    }
  }

  announceExchange(player, count) {
    this.logExchangeToChat(player, count);
    this.showExchangeBanner(player, count);
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve();
      }, BOARD_BANNER_MS);
    });
  }

  announceComputerTurnWithoutPlay(opts) {
    var options = opts || {};
    var isExchange = options.kind === 'exchange';
    var count = options.tileCount || 0;
    var self = this;

    if (isExchange) {
      return this.announceExchange(PLAYER.AI, count).then(function () {
        self.endTurn(0);
      });
    }

    var passText = 'Computer passed without playing a word.';
    this.addChatSystem(passText);
    this.addChatLine(CHAT_AI_NAME, 'Passed — no word played this turn.', 'opponent');
    return this.openExchangeNotice(
      'Computer Passed',
      passText,
      'No word was placed on the board this turn.'
    ).then(function () {
      self.endTurn(0);
    });
  }

  hideExchangeNotice() {
    if (!this.ui.exchangeNoticeOverlay) return;
    this.ui.exchangeNoticeOverlay.hidden = true;
    this.ui.exchangeNoticeOverlay.setAttribute('aria-hidden', 'true');
    var fn = this._exchangeNoticeDismiss;
    this._exchangeNoticeDismiss = null;
    if (fn) fn();
  }

  setupBlankPicker() {
    if (!this.ui.blankPickerGrid) return;
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var self = this;
    for (var i = 0; i < letters.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'blank-picker-letter';
      btn.textContent = letters[i];
      btn.setAttribute('data-letter', letters[i]);
      btn.addEventListener('click', function () {
        var letter = this.getAttribute('data-letter');
        if (self.blankPickerIdx != null) self.setBlankLetter(self.blankPickerIdx, letter);
        self.hideBlankPicker();
      });
      this.ui.blankPickerGrid.appendChild(btn);
    }
    if (this.ui.blankPickerCancel) {
      this.ui.blankPickerCancel.addEventListener('click', function () { self.hideBlankPicker(); });
    }
    if (this.ui.blankPicker) {
      this.ui.blankPicker.addEventListener('click', function (e) {
        if (e.target === self.ui.blankPicker) self.hideBlankPicker();
      });
    }
  }

  isBlankPickerOpen() {
    return this.ui.blankPicker && !this.ui.blankPicker.hidden;
  }

  showBlankPicker(idx) {
    if (!this.ui.blankPicker || !this.pendingPlacements.has(idx)) return;
    var p = this.pendingPlacements.get(idx);
    if (!p || p.letter !== '*') return;

    this.blankPickerIdx = idx;
    this.ui.blankPicker.hidden = false;
    this.ui.blankPicker.setAttribute('aria-hidden', 'false');

    var buttons = this.ui.blankPickerGrid.querySelectorAll('.blank-picker-letter');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.classList.toggle('selected', p.blankAs != null && btn.getAttribute('data-letter') === p.blankAs);
    }
  }

  hideBlankPicker() {
    if (!this.ui.blankPicker) return;
    this.ui.blankPicker.hidden = true;
    this.ui.blankPicker.setAttribute('aria-hidden', 'true');
    this.blankPickerIdx = null;
  }

  setBlankLetter(idx, letter) {
    if (!this.pendingPlacements.has(idx)) return;
    var p = this.pendingPlacements.get(idx);
    if (!p || p.letter !== '*') return;
    p.blankAs = String(letter).toUpperCase();
    this.pendingPlacements.set(idx, p);
    this.setMessage('Blank tile set to "' + p.blankAs + '". Tap it again to change.', 'success');
    this.updatePendingPreview();
    this.draw();
  }

  promptBlankLetterIfNeeded(idx) {
    if (!this.pendingPlacements.has(idx)) return;
    var p = this.pendingPlacements.get(idx);
    if (p && p.letter === '*' && p.blankAs == null) this.showBlankPicker(idx);
  }

  findUnsetBlankIdx() {
    var found = null;
    this.pendingPlacements.forEach(function (p, idx) {
      if (!found && p.letter === '*' && p.blankAs == null) found = idx;
    });
    return found;
  }

  setupTwoLetterModal() {
    if (!this.ui.twoLetterGrid) return;
    var self = this;
    var col, row, colEl, wordEl;
    for (col = 0; col < TWO_LETTER_COLUMNS.length; col++) {
      colEl = document.createElement('div');
      colEl.className = 'two-letter-col';
      for (row = 0; row < TWO_LETTER_COLUMNS[col].length; row++) {
        wordEl = document.createElement('span');
        wordEl.className = 'two-letter-word';
        wordEl.textContent = TWO_LETTER_COLUMNS[col][row].toUpperCase();
        colEl.appendChild(wordEl);
      }
      this.ui.twoLetterGrid.appendChild(colEl);
    }
    if (this.ui.twoLetterLink) {
      this.ui.twoLetterLink.addEventListener('click', function (e) {
        e.preventDefault();
        self.showTwoLetterModal();
      });
    }
    if (this.ui.twoLetterClose) {
      this.ui.twoLetterClose.addEventListener('click', function () { self.hideTwoLetterModal(); });
    }
    if (this.ui.twoLetterModal) {
      this.ui.twoLetterModal.addEventListener('click', function (e) {
        if (e.target === self.ui.twoLetterModal) self.hideTwoLetterModal();
      });
    }
  }

  isTwoLetterModalOpen() {
    return this.ui.twoLetterModal && !this.ui.twoLetterModal.hidden;
  }

  showTwoLetterModal() {
    if (!this.ui.twoLetterModal) return;
    this.ui.twoLetterModal.hidden = false;
    this.ui.twoLetterModal.setAttribute('aria-hidden', 'false');
  }

  hideTwoLetterModal() {
    if (!this.ui.twoLetterModal) return;
    this.ui.twoLetterModal.hidden = true;
    this.ui.twoLetterModal.setAttribute('aria-hidden', 'true');
  }

  setupRulesModal() {
    if (!this.ui.rulesModal) return;
    this.renderRulesContent();
    var self = this;
    var openRules = function (e) {
      if (e) e.preventDefault();
      self.showRulesModal();
    };
    if (this.ui.rulesLink) {
      this.ui.rulesLink.addEventListener('click', openRules);
    }
    if (this.ui.mainMenuRulesLink) {
      this.ui.mainMenuRulesLink.addEventListener('click', openRules);
    }
    if (this.ui.rulesClose) {
      this.ui.rulesClose.addEventListener('click', function () { self.hideRulesModal(); });
    }
    this.ui.rulesModal.addEventListener('click', function (e) {
      if (e.target === self.ui.rulesModal) self.hideRulesModal();
    });
  }

  renderRulesContent() {
    if (!this.ui.rulesBody) return;
    var intro = document.createElement('p');
    intro.textContent = GAME_RULES.intro;
    var list = document.createElement('ul');
    list.className = 'rules-list';
    for (var i = 0; i < GAME_RULES.bullets.length; i++) {
      var item = document.createElement('li');
      item.textContent = GAME_RULES.bullets[i];
      list.appendChild(item);
    }
    this.ui.rulesBody.replaceChildren(intro, list);
  }

  isRulesModalOpen() {
    return this.ui.rulesModal && !this.ui.rulesModal.hidden;
  }

  showRulesModal() {
    if (!this.ui.rulesModal) return;
    this.ui.rulesModal.hidden = false;
    this.ui.rulesModal.setAttribute('aria-hidden', 'false');
  }

  hideRulesModal() {
    if (!this.ui.rulesModal) return;
    this.ui.rulesModal.hidden = true;
    this.ui.rulesModal.setAttribute('aria-hidden', 'true');
  }

  setupChat() {
    var self = this;
    if (!this.ui.chatLog) return;
    if (this._chatReady) return;
    this._chatReady = true;

    if (this.ui.chatForm) {
      this.ui.chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.hideChatEmojiPicker();
        self.sendPlayerChat();
      });
    }

    if (this.ui.btnChatSend) {
      this.ui.btnChatSend.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.hideChatEmojiPicker();
        self.sendPlayerChat();
      });
    }

    if (this.ui.chatInput) {
      this.ui.chatInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        self.hideChatEmojiPicker();
        self.sendPlayerChat();
      });
    }

    this.setupChatEmojiPicker();
    this.setupMobileChatSheet();

    if (this.ui.btnMute) {
      this.ui.btnMute.addEventListener('click', function () {
        self.toggleChatMute();
      });
    }

    if (this.ui.btnBlock) {
      this.ui.btnBlock.addEventListener('click', function () {
        self.toggleChatBlock();
      });
    }

    this.addChatSystem('Welcome to the table! Say hello in chat.');
  }

  isCompactChatLayout() {
    try {
      return window.matchMedia('(max-width: 900px)').matches;
    } catch (_) {
      return false;
    }
  }

  setupMobileChatSheet() {
    var self = this;
    if (this.ui.btnMobileChat) {
      this.ui.btnMobileChat.addEventListener('click', function (e) {
        e.preventDefault();
        self.openMobileChat();
      });
    }
    if (this.ui.btnChatClose) {
      this.ui.btnChatClose.addEventListener('click', function (e) {
        e.preventDefault();
        self.closeMobileChat();
      });
    }
    if (this.ui.mobileChatBackdrop) {
      this.ui.mobileChatBackdrop.addEventListener('click', function () {
        self.closeMobileChat();
      });
      this.ui.mobileChatBackdrop.hidden = false;
      this.ui.mobileChatBackdrop.setAttribute('aria-hidden', 'true');
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.mobileChatOpen) {
        e.preventDefault();
        self.closeMobileChat();
      }
    });
    try {
      var mq = window.matchMedia('(max-width: 900px)');
      var onChange = function () {
        if (!mq.matches) self.closeMobileChat();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (_) {}

    this.setupMobileChatKeyboardAvoidance();
  }

  /**
   * Keep the mobile chat compose row above the soft keyboard.
   * Viewport uses interactive-widget=resizes-visual: layout stays put (board
   * does not reflow), visual viewport shrinks — we pin the sheet to that.
   */
  setupMobileChatKeyboardAvoidance() {
    if (this._mobileChatKeyboardReady) return;
    this._mobileChatKeyboardReady = true;
    var self = this;

    /* Chrome Android: expose env(keyboard-inset-height) when available. */
    try {
      if (navigator.virtualKeyboard && navigator.virtualKeyboard.overlaysContent != null) {
        navigator.virtualKeyboard.overlaysContent = true;
      }
    } catch (_) {}

    var sync = function () {
      self.syncMobileChatToViewport();
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', sync);
      window.visualViewport.addEventListener('scroll', sync);
    }
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', function () {
      setTimeout(sync, 200);
    });

    if (this.ui.chatInput) {
      this.ui.chatInput.addEventListener('focus', function () {
        self._chatInputFocused = true;
        document.body.classList.add('chat-keyboard-open');
        self.startMobileChatKeyboardWatch();
      });
      this.ui.chatInput.addEventListener('blur', function () {
        self._chatInputFocused = false;
        document.body.classList.remove('chat-keyboard-open');
        self.stopMobileChatKeyboardWatch();
        setTimeout(function () {
          if (!self._chatInputFocused) self.syncMobileChatToViewport();
        }, 160);
      });
    }
  }

  startMobileChatKeyboardWatch() {
    var self = this;
    this.stopMobileChatKeyboardWatch();
    var frames = 0;
    var tick = function () {
      self.syncMobileChatToViewport();
      frames += 1;
      /* Watch through the keyboard animation (~0.5–0.8s). */
      if (self._chatInputFocused && frames < 45) {
        self._mobileChatKbRaf = requestAnimationFrame(tick);
      } else {
        self._mobileChatKbRaf = null;
      }
    };
    this._mobileChatKbRaf = requestAnimationFrame(tick);
    /* Also poll — some WebViews fire visualViewport late. */
    this._mobileChatKbPoll = setInterval(function () {
      if (!self._chatInputFocused) {
        self.stopMobileChatKeyboardWatch();
        return;
      }
      self.syncMobileChatToViewport();
    }, 100);
    setTimeout(function () {
      if (self._mobileChatKbPoll) {
        clearInterval(self._mobileChatKbPoll);
        self._mobileChatKbPoll = null;
      }
    }, 1200);
  }

  stopMobileChatKeyboardWatch() {
    if (this._mobileChatKbRaf) {
      cancelAnimationFrame(this._mobileChatKbRaf);
      this._mobileChatKbRaf = null;
    }
    if (this._mobileChatKbPoll) {
      clearInterval(this._mobileChatKbPoll);
      this._mobileChatKbPoll = null;
    }
  }

  clearMobileChatViewportFit() {
    var panel = this.ui.chatPanel;
    if (!panel) return;
    panel.style.bottom = '';
    panel.style.top = '';
    panel.style.height = '';
    panel.style.maxHeight = '';
    panel.classList.remove('chat-panel--keyboard');
    document.documentElement.style.removeProperty('--qwerty-kb-inset');
    document.body.classList.remove('chat-keyboard-open');
    this.stopMobileChatKeyboardWatch();
  }

  /** Keyboard / chrome inset below the visual viewport (px). */
  getVisualViewportBottomInset() {
    var vv = window.visualViewport;
    var layoutH = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vv || !Number.isFinite(vv.height) || layoutH <= 0) return 0;
    /*
     * Distance from the bottom of the layout viewport to the bottom of the
     * visual viewport. That gap is the soft keyboard (and sometimes browser UI).
     */
    var inset = Math.round(layoutH - (vv.offsetTop + vv.height));
    if (!Number.isFinite(inset) || inset < 0) inset = 0;
    return inset;
  }

  syncMobileChatToViewport() {
    var panel = this.ui.chatPanel;
    if (!panel) return;

    if (!this.mobileChatOpen || !this.isCompactChatLayout()) {
      this.clearMobileChatViewportFit();
      return;
    }

    var vv = window.visualViewport;
    var layoutH = window.innerHeight || document.documentElement.clientHeight || 0;
    var visibleH = layoutH;
    var inset = this.getVisualViewportBottomInset();

    if (vv && Number.isFinite(vv.height)) {
      visibleH = Math.max(160, Math.round(vv.height));
    }

    /*
     * When focused, trust smaller insets too — some devices report the keyboard
     * gradually. When not focused, ignore URL-bar jitter under ~48px.
     */
    if (!this._chatInputFocused && inset < 48) inset = 0;

    /* CSS uses max(--qwerty-kb-inset, env(keyboard-inset-height)). */
    document.documentElement.style.setProperty('--qwerty-kb-inset', inset + 'px');
    panel.style.bottom = '';
    panel.style.top = 'auto';

    /* Fit the sheet inside the visible viewport so compose stays on-screen. */
    var maxH = Math.max(180, Math.min(Math.round(visibleH * 0.88), 560));
    panel.style.maxHeight = maxH + 'px';
    panel.style.height = maxH + 'px';
    panel.classList.toggle('chat-panel--keyboard', inset > 0 || !!this._chatInputFocused);

    if (this.ui.chatLog) {
      this.ui.chatLog.scrollTop = this.ui.chatLog.scrollHeight;
    }
  }

  openMobileChat() {
    if (!this.isCompactChatLayout()) return;
    var self = this;
    this.mobileChatOpen = true;
    document.body.classList.add('mobile-chat-open');
    if (this.ui.btnMobileChat) {
      this.ui.btnMobileChat.setAttribute('aria-expanded', 'true');
    }
    if (this.ui.mobileChatBackdrop) {
      this.ui.mobileChatBackdrop.setAttribute('aria-hidden', 'false');
    }
    if (this.ui.chatPanel) {
      this.ui.chatPanel.setAttribute('aria-modal', 'true');
    }
    this.clearMobileChatUnread();
    this.syncMobileChatToViewport();
    if (this.ui.chatLog) {
      this.ui.chatLog.scrollTop = this.ui.chatLog.scrollHeight;
    }
    var input = this.ui.chatInput;
    if (input) {
      setTimeout(function () {
        try {
          input.focus({ preventScroll: true });
        } catch (_) {
          try {
            input.focus();
          } catch (__) {}
        }
        self.syncMobileChatToViewport();
      }, 280);
    }
  }

  closeMobileChat() {
    if (!this.mobileChatOpen && !document.body.classList.contains('mobile-chat-open')) {
      return;
    }
    this.mobileChatOpen = false;
    document.body.classList.remove('mobile-chat-open');
    this.hideChatEmojiPicker();
    this.clearMobileChatViewportFit();
    if (this.ui.btnMobileChat) {
      this.ui.btnMobileChat.setAttribute('aria-expanded', 'false');
    }
    if (this.ui.mobileChatBackdrop) {
      this.ui.mobileChatBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (this.ui.chatPanel) {
      this.ui.chatPanel.removeAttribute('aria-modal');
    }
    if (this.ui.chatInput && document.activeElement === this.ui.chatInput) {
      try {
        this.ui.chatInput.blur();
      } catch (_) {}
    }
  }

  clearMobileChatUnread() {
    this.mobileChatUnread = 0;
    if (this.ui.mobileChatBadge) {
      this.ui.mobileChatBadge.hidden = true;
      this.ui.mobileChatBadge.textContent = '0';
    }
  }

  bumpMobileChatUnread() {
    if (!this.isCompactChatLayout() || this.mobileChatOpen) return;
    this.mobileChatUnread += 1;
    if (!this.ui.mobileChatBadge) return;
    var n = this.mobileChatUnread > 9 ? '9+' : String(this.mobileChatUnread);
    this.ui.mobileChatBadge.textContent = n;
    this.ui.mobileChatBadge.hidden = false;
  }

  setupChatEmojiPicker() {
    var self = this;
    var picker = this.ui.chatEmojiPicker;
    var btn = this.ui.btnChatEmoji;
    if (!picker || !btn) return;

    picker.innerHTML = '';
    CHAT_EMOJI_LIST.forEach(function (emoji) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'chat-emoji-option';
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-label', 'Insert ' + emoji);
      opt.textContent = emoji;
      opt.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.insertChatEmoji(emoji);
      });
      picker.appendChild(opt);
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.toggleChatEmojiPicker();
    });

    document.addEventListener('click', function (e) {
      if (!picker || picker.hidden) return;
      var t = e.target;
      if (picker.contains(t) || btn.contains(t)) return;
      self.hideChatEmojiPicker();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.hideChatEmojiPicker();
    });
  }

  toggleChatEmojiPicker() {
    if (!this.ui.chatEmojiPicker) return;
    if (this.ui.chatEmojiPicker.hidden) this.showChatEmojiPicker();
    else this.hideChatEmojiPicker();
  }

  showChatEmojiPicker() {
    if (!this.ui.chatEmojiPicker || !this.ui.btnChatEmoji) return;
    this.ui.chatEmojiPicker.hidden = false;
    this.ui.btnChatEmoji.setAttribute('aria-expanded', 'true');
  }

  hideChatEmojiPicker() {
    if (!this.ui.chatEmojiPicker || !this.ui.btnChatEmoji) return;
    this.ui.chatEmojiPicker.hidden = true;
    this.ui.btnChatEmoji.setAttribute('aria-expanded', 'false');
  }

  insertChatEmoji(emoji) {
    var input = this.ui.chatInput;
    if (!input || !emoji) return;
    var value = String(input.value || '');
    var start = input.selectionStart != null ? input.selectionStart : value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : value.length;
    var next = value.slice(0, start) + emoji + value.slice(end);
    if (next.length > 200) next = next.slice(0, 200);
    input.value = next;
    var caret = Math.min(start + emoji.length, next.length);
    try {
      input.focus();
      input.setSelectionRange(caret, caret);
    } catch (_) {}
    this.hideChatEmojiPicker();
  }

  resetChat(keepHistory) {
    this.chatMuted = false;
    this.chatBlocked = false;
    this.clearMobileChatUnread();
    this.updateChatModUI();
    if (!keepHistory && this.ui.chatLog) {
      this.ui.chatLog.innerHTML = '';
      this.addChatSystem('New game — good luck!');
    }
  }

  escapeChatHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  addChatLine(author, text, kind) {
    if (!this.ui.chatLog) return;
    var line = document.createElement('div');
    line.className = 'chat-line chat-line-' + (kind || 'system');
    if (kind === 'you' || kind === 'opponent') {
      line.innerHTML =
        '<span class="chat-author">' + this.escapeChatHtml(author) + ':</span> ' +
        this.escapeChatHtml(text);
    } else {
      line.className = 'chat-line chat-line-system';
      line.textContent = text;
    }
    this.ui.chatLog.appendChild(line);
    this.ui.chatLog.scrollTop = this.ui.chatLog.scrollHeight;
    /* Badge only for opponent chat while the mobile sheet is closed. */
    if (kind === 'opponent') {
      this.bumpMobileChatUnread();
    }
  }

  addChatSystem(text) {
    this.addChatLine('', text, 'system');
  }

  sendPlayerChat() {
    if (!this.ui.chatInput) {
      console.warn('[QWERTY] chat send ignored — missing #chat-input');
      return false;
    }
    var text = String(this.ui.chatInput.value || '').trim();
    if (!text) return false;
    if (this.chatBlocked) {
      this.addChatSystem('You blocked ' + CHAT_AI_NAME + '. Unblock to chat.');
      this.ui.chatInput.value = '';
      return false;
    }
    var author =
      (this.isOnlineMode() && this.onlineSelfName) || CHAT_PLAYER_NAME;
    this.addChatLine(author, text, 'you');
    this.ui.chatInput.value = '';
    if (this.isOnlineMode()) {
      try {
        if (typeof QWERTYOnline !== 'undefined' && QWERTYOnline.chat) {
          QWERTYOnline.chat(text);
        } else {
          console.warn('[QWERTY] chat send — online client unavailable');
        }
      } catch (err) {
        console.warn('[QWERTY] chat send failed', err);
      }
      return true;
    }
    if (!this.chatMuted && !this.chatBlocked && Math.random() < 0.35) {
      var self = this;
      setTimeout(function () {
        self.sendOpponentChat(AI_CHAT_LINES[Math.floor(Math.random() * AI_CHAT_LINES.length)]);
      }, 600 + Math.random() * 1200);
    }
    return true;
  }

  sendOpponentChat(text) {
    if (this.chatBlocked || this.chatMuted) return;
    this.addChatLine(CHAT_AI_NAME, text, 'opponent');
  }

  maybeOpponentChatOnMove(word) {
    if (this.chatBlocked || this.chatMuted) return;
    if (Math.random() > 0.28) return;
    var msg = AI_CHAT_LINES[Math.floor(Math.random() * AI_CHAT_LINES.length)];
    if (word && Math.random() < 0.4) {
      msg = '"' + word.toUpperCase() + '" — ' + msg;
    }
    this.sendOpponentChat(msg);
  }

  toggleChatMute() {
    this.chatMuted = !this.chatMuted;
    this.updateChatModUI();
    this.addChatSystem(
      this.chatMuted
        ? 'You muted ' + CHAT_AI_NAME + '.'
        : 'You unmuted ' + CHAT_AI_NAME + '.'
    );
  }

  toggleChatBlock() {
    this.chatBlocked = !this.chatBlocked;
    if (this.chatBlocked) this.chatMuted = true;
    this.updateChatModUI();
    this.addChatSystem(
      this.chatBlocked
        ? 'You blocked ' + CHAT_AI_NAME + '. Their messages are hidden.'
        : 'You unblocked ' + CHAT_AI_NAME + '.'
    );
  }

  updateChatModUI() {
    if (this.ui.btnMute) {
      this.ui.btnMute.textContent = this.chatMuted ? 'Unmute' : 'Mute';
      this.ui.btnMute.classList.toggle('active', this.chatMuted);
      this.ui.btnMute.disabled = this.chatBlocked;
    }
    if (this.ui.btnBlock) {
      this.ui.btnBlock.textContent = this.chatBlocked ? 'Unblock' : 'Block';
      this.ui.btnBlock.classList.toggle('active', this.chatBlocked);
    }
    if (this.ui.chatOpponentRow) {
      this.ui.chatOpponentRow.classList.toggle('blocked', this.chatBlocked);
      this.ui.chatOpponentRow.classList.toggle('muted', this.chatMuted && !this.chatBlocked);
    }
    if (this.ui.chatInput) {
      this.ui.chatInput.disabled = this.chatBlocked;
      this.ui.chatInput.placeholder = this.chatBlocked
        ? CHAT_AI_NAME + ' is blocked'
        : 'Say something…';
    }
  }

  /* ── Input ────────────────────────────────────────────────── */
  bindEvents() {
    var self = this;
    var lastResizeW = 0;
    var lastResizeH = 0;
    var resizeTimer = null;
    document.addEventListener(
      'pointerdown',
      function () {
        self.ensureAudioContext();
      },
      { once: true, capture: true }
    );
    function scheduleWindowResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var w = window.innerWidth;
        var h = window.innerHeight;
        /* Ignore tiny height-only jitter (mobile URL bar) — only reflow on real width changes. */
        var widthChanged = Math.abs(w - lastResizeW) >= 8;
        var heightChanged = Math.abs(h - lastResizeH) >= 48;
        if (!widthChanged && !heightChanged) return;
        if (!widthChanged && self.isCompactLayout()) {
          /* Height-only change on phone: keep locked board size. */
          lastResizeH = h;
          return;
        }
        lastResizeW = w;
        lastResizeH = h;
        if (widthChanged) {
          self._compactLayoutLock = null;
          self._compactChromeReserve = null;
        }
        self._needsWindowResize = true;
        if (self.isLayoutFrozen()) {
          return;
        }
        self._needsWindowResize = false;
        self.resize();
      }, 180);
    }
    window.addEventListener('resize', scheduleWindowResize);
    if (window.visualViewport) {
      /* Height-only visualViewport changes (URL bar) must not reflow the board. */
      window.visualViewport.addEventListener('resize', scheduleWindowResize);
    }

    if (this.ui.btnPlay) {
      this.ui.btnPlay.addEventListener('click', function (e) {
        e.preventDefault();
        self.submitWord();
      });
    }
    this.ui.btnRecall.addEventListener('click', () => this.recallTiles());
    this.ui.btnShuffle.addEventListener('click', () => this.shuffleRack());
    this.ui.btnPass.addEventListener('click', () => this.exchangeTiles());
    if (this.ui.btnCancelExchange) {
      this.ui.btnCancelExchange.addEventListener('click', () => this.cancelExchange());
    }
    this.ui.btnNew.addEventListener('click', () => {
      if (confirm('Start a new game? Current progress will be lost.')) this.newGame();
    });

    this.bindRackPointer();
    this.bindBoardPointer();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isGameOverDialogOpen()) {
          return;
        }
        if (this.ui.gameExitScreen && !this.ui.gameExitScreen.hidden) {
          return;
        }
        if (this.isBlankPickerOpen()) {
          this.hideBlankPicker();
          return;
        }
        if (this.isExchangeNoticeOpen()) {
          this.hideExchangeNotice();
          return;
        }
        if (this.isTwoLetterModalOpen()) {
          this.hideTwoLetterModal();
          return;
        }
        if (this.isRulesModalOpen()) {
          this.hideRulesModal();
          return;
        }
        if (this.exchangeMode) {
          this.cancelExchange();
          return;
        } else {
          this.recallTiles();
        }
        return;
      }
      if (this.isBlankPickerOpen()) return;
      if (this.isTwoLetterModalOpen()) return;
      if (this.isRulesModalOpen()) return;
      if (this.isGameOverDialogOpen()) return;
      if (this.ui.chatInput && document.activeElement === this.ui.chatInput) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        self.submitWord();
      }
    });
  }

  bindRackPointer() {
    var self = this;
    var canvas = this.rackCanvas;
    var press = null;
    var TAP_PX = 10;

    var canvasPos = function (clientX, clientY) {
      return canvasClientPos(canvas, clientX, clientY);
    };

    var clearPressListeners = function () {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      press = null;
    };

    var onStart = function (e) {
      if (self.gameOver || self.drag) return;
      e.preventDefault();
      var src = e.touches ? e.touches[0] : e;
      var pos = canvasPos(src.clientX, src.clientY);
      var slot = self.rackSlotAt(pos.x);
      if (slot < 0 || !self.racks[PLAYER.HUMAN][slot] || self.isRackSlotPending(slot)) return;

      press = {
        slot: slot,
        letter: self.racks[PLAYER.HUMAN][slot].letter,
        tileId: self.racks[PLAYER.HUMAN][slot].id || null,
        startX: src.clientX,
        startY: src.clientY,
        dragged: false,
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    };

    var onMove = function (e) {
      if (!press || press.dragged) return;
      if (self.exchangeMode) return;
      e.preventDefault();
      var src = e.touches ? e.touches[0] : e;
      var dx = src.clientX - press.startX;
      var dy = src.clientY - press.startY;
      if (dx * dx + dy * dy < TAP_PX * TAP_PX) return;

      press.dragged = true;
      self.clearRackSelection();
      var pos = canvasPos(src.clientX, src.clientY);
      self.startDrag({
        letter: press.letter,
        fromRack: press.slot,
        tileId: press.tileId,
        x: pos.x,
        y: pos.y,
        clientX: src.clientX,
        clientY: src.clientY,
        origin: 'rack',
      });
      clearPressListeners();
    };

    var onEnd = function (e) {
      if (!press) return;
      e.preventDefault();
      if (!press.dragged) {
        var slot = press.slot;
        clearPressListeners();
        self.handleRackTap(slot);
        return;
      }
      clearPressListeners();
    };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('touchstart', onStart, { passive: false });
  }

  bindBoardPointer() {
    var self = this;
    var canvas = this.canvas;
    var press = null;
    var TAP_PX = 10;

    var canvasPos = function (clientX, clientY) {
      return canvasClientPos(canvas, clientX, clientY);
    };

    var clearPressListeners = function () {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      press = null;
    };

    var onStart = function (e) {
      if (self.gameOver || self.currentPlayer !== PLAYER.HUMAN || self.drag) return;
      e.preventDefault();
      var src = e.touches ? e.touches[0] : e;
      var pos = canvasPos(src.clientX, src.clientY);
      var idx = self.cellAt(pos.x, pos.y);
      if (idx < 0 || !self.pendingPlacements.has(idx)) return;

      press = {
        idx: idx,
        startX: src.clientX,
        startY: src.clientY,
        dragged: false,
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    };

    var onMove = function (e) {
      if (!press || press.dragged) return;
      e.preventDefault();
      var src = e.touches ? e.touches[0] : e;
      var dx = src.clientX - press.startX;
      var dy = src.clientY - press.startY;
      if (dx * dx + dy * dy < TAP_PX * TAP_PX) return;

      press.dragged = true;
      var idx = press.idx;
      var p = self.pendingPlacements.get(idx);
      if (!p) { clearPressListeners(); return; }

      self.pendingPlacements.delete(idx);
      var pos = canvasPos(src.clientX, src.clientY);
      self.startDrag({
        letter: p.letter,
        fromBoard: idx,
        fromRack: p.rackIndex,
        tileId: p.tileId || null,
        blankAs: p.blankAs,
        x: pos.x,
        y: pos.y,
        clientX: src.clientX,
        clientY: src.clientY,
        origin: 'board',
      });
      clearPressListeners();
    };

    var onEnd = function (e) {
      if (!press) return;
      e.preventDefault();
      if (!press.dragged) {
        var idx = press.idx;
        clearPressListeners();
        var pending = self.pendingPlacements.get(idx);
        if (pending && pending.letter === '*' && pending.blankAs == null) {
          self.showBlankPicker(idx);
        } else {
          self.returnPendingTileToRack(idx);
        }
        return;
      }
      clearPressListeners();
    };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('touchstart', onStart, { passive: false });
  }

  unbindGlobalDrag() {
    var h = this._dragHandlers;
    if (!h) return;
    document.removeEventListener('mousemove', h.move);
    document.removeEventListener('mouseup', h.end);
    document.removeEventListener('touchmove', h.move);
    document.removeEventListener('touchend', h.end);
    document.removeEventListener('touchcancel', h.end);
    document.removeEventListener('pointercancel', h.end);
    this._dragHandlers = null;
  }

  bindGlobalDrag() {
    this.unbindGlobalDrag();
    var self = this;

    const onMove = (e) => {
      if (!this.drag) return;
      e.preventDefault();
      const src = e.touches ? e.touches[0] : e;
      this.drag.clientX = src.clientX;
      this.drag.clientY = src.clientY;

      const boardRect = this.canvas.getBoundingClientRect();
      const rackDropRect = this.getRackDropRect();
      const rackRect = this.rackCanvas.getBoundingClientRect();
      const dpr = canvasDpr();
      const scaleX = this.canvas.width / dpr / boardRect.width;
      const scaleY = this.canvas.height / dpr / boardRect.height;

      if (
        src.clientX >= boardRect.left &&
        src.clientX <= boardRect.right &&
        src.clientY >= boardRect.top &&
        src.clientY <= boardRect.bottom
      ) {
        this.drag.onRack = false;
        this.drag.x = (src.clientX - boardRect.left) * scaleX;
        this.drag.y = (src.clientY - boardRect.top) * scaleY;
      } else if (this._pointInRect(src.clientX, src.clientY, rackDropRect)) {
        this.drag.onRack = true;
        const rScaleX = this.rackCanvas.width / dpr / rackRect.width;
        const rScaleY = this.rackCanvas.height / dpr / rackRect.height;
        this.drag.x = (src.clientX - rackRect.left) * rScaleX;
        this.drag.y = (src.clientY - rackRect.top) * rScaleY;
      }

      this.draw();
    };

    const finishPointer = (e) => {
      if (!self.drag) return;
      if (e && e.cancelable) e.preventDefault();
      var src = e && (e.changedTouches ? e.changedTouches[0] : e);
      if (src) {
        self.drag.clientX = src.clientX;
        self.drag.clientY = src.clientY;
      }
      self.unbindGlobalDrag();
      self.finishDrag();
    };

    this._dragHandlers = {
      move: onMove,
      end: finishPointer,
      cancel: finishPointer,
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', finishPointer);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', finishPointer);
    document.addEventListener('touchcancel', finishPointer);
    document.addEventListener('pointercancel', finishPointer);
  }

  startDrag(info) {
    this._cancelLayoutRestore();
    this.unbindGlobalDrag();
    this.drag = { ...info, onRack: info.origin === 'rack' };
    this.canvas.classList.add('dragging');
    this.rackCanvas.classList.add('dragging');
    this.bindGlobalDrag();
    this.draw();
  }

  _applyDragDrop(drag) {
    var self = this;
    const boardRect = self.canvas.getBoundingClientRect();
    const rackDropRect = self.getRackDropRect();
    const rackRect = self.rackCanvas.getBoundingClientRect();
    const { clientX, clientY } = drag;
    const dpr = canvasDpr();

    if (self._pointInRect(clientX, clientY, rackDropRect)) {
      var rScaleX = self.rackCanvas.width / dpr / rackRect.width;
      var rackLocalX = (clientX - rackRect.left) * rScaleX;
      var targetSlot = drag.fromRack >= 0
        ? self.rackInsertSlotAt(rackLocalX)
        : self.rackSlotAt(rackLocalX);

      if (drag.fromBoard !== undefined) {
        if (self.isOnlineMode()) {
          /* Drag start already removed this cell from pending; rack still holds the tile. */
          if (self.pendingPlacements.has(drag.fromBoard)) {
            self.releasePendingToRack(drag.fromBoard);
          }
        } else if (!self.restoreTileToRack(PLAYER.HUMAN, drag.fromRack, drag.letter)) {
          self.pendingPlacements.set(drag.fromBoard, {
            letter: drag.letter,
            rackIndex: drag.fromRack,
            tileId: drag.tileId || null,
            blankAs: drag.blankAs,
          });
        } else {
          self.save();
        }
      } else if (drag.fromRack >= 0 && targetSlot >= 0 && !self.exchangeMode) {
        if (self.isRackSlotPending(targetSlot)) {
          targetSlot = self.rackSlotAt(rackLocalX);
        }
        if (targetSlot >= 0 && !self.isRackSlotPending(targetSlot)) {
          self.insertRackTile(drag.fromRack, targetSlot);
        }
        self.clearRackSelection();
      }

      self.updatePendingPreview();
      return;
    }

    if (
      clientX >= boardRect.left &&
      clientX <= boardRect.right &&
      clientY >= boardRect.top &&
      clientY <= boardRect.bottom
    ) {
      if (self.currentPlayer !== PLAYER.HUMAN) {
        return;
      }
      const scaleX = self.canvas.width / dpr / boardRect.width;
      const scaleY = self.canvas.height / dpr / boardRect.height;
      const dropX = (clientX - boardRect.left) * scaleX;
      const dropY = (clientY - boardRect.top) * scaleY;
      const idx = self.cellAt(dropX, dropY);

      if (self.canDropPendingAt(idx, drag)) {
        self.placePendingFromDrag(drag, idx);
        if (drag.letter === '*') self.promptBlankLetterIfNeeded(idx);
      } else if (drag.fromBoard !== undefined) {
        self.pendingPlacements.set(drag.fromBoard, {
          letter: drag.letter,
          rackIndex: drag.fromRack,
          tileId: drag.tileId || null,
          blankAs: drag.blankAs,
        });
      }
    } else if (drag.fromBoard !== undefined) {
      if (self.isOnlineMode()) {
        if (self.pendingPlacements.has(drag.fromBoard)) {
          self.releasePendingToRack(drag.fromBoard);
        }
      } else if (!self.restoreTileToRack(PLAYER.HUMAN, drag.fromRack, drag.letter)) {
        self.pendingPlacements.set(drag.fromBoard, {
          letter: drag.letter,
          rackIndex: drag.fromRack,
          tileId: drag.tileId || null,
          blankAs: drag.blankAs,
        });
      } else {
        self.save();
      }
    }

    if (!self.isOnlineMode()) {
      self.auditRecoverMissingTiles(true);
    }
    self.updatePendingPreview();
    if (self.pendingPlacements.size) {
      self.bumpPlacementPulse();
    } else {
      self.resetPlayPreviewUi();
    }
  }

  finishDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.unbindGlobalDrag();
    this.canvas.classList.remove('dragging');
    this.rackCanvas.classList.remove('dragging');
    this.freezeLayoutBriefly(480);
    this._applyDragDrop(drag);
    this.draw();
    this._clearDragOverlay();
    this._flushWindowResizeIfNeeded();
  }

  /* ── Game actions ─────────────────────────────────────────── */

  /**
   * Cancel an in-flight drag without running finishDrag / re-placing on the board.
   * Board-origin drags remove the tile from pendingPlacements at drag start — that
   * tile must be returned via the same restore path as recall, or it can be left
   * stranded (or put back by a later mouseup).
   * @returns {{letter:string,rackIndex:number,tileId:*,blankAs:*}|null}
   */
  cancelInFlightDrag() {
    var drag = this.drag;
    if (!drag) return null;
    this.drag = null;
    this.unbindGlobalDrag();
    if (this.canvas) this.canvas.classList.remove('dragging');
    if (this.rackCanvas) this.rackCanvas.classList.remove('dragging');
    if (typeof this._clearDragOverlay === 'function') this._clearDragOverlay();
    /* Rack-origin drag: tile still sits in the rack slot — nothing to restore. */
    if (drag.fromBoard === undefined) return null;
    return {
      letter: drag.letter,
      rackIndex: drag.fromRack != null ? drag.fromRack : -1,
      tileId: drag.tileId || null,
      blankAs: drag.blankAs != null ? drag.blankAs : null,
    };
  }

  /**
   * Snapshot every uncommitted player tile (pending + in-flight board drag)
   * WITHOUT removing them from the board yet. Caller must restore to rack first.
   */
  collectPendingTilesForRecall() {
    var toRestore = [];
    var seen = {};
    function pushTile(p) {
      if (!p || !p.letter) return;
      var key =
        String(p.tileId || '') +
        '|' +
        String(p.rackIndex != null ? p.rackIndex : -1) +
        '|' +
        String(p.letter).toUpperCase() +
        '|' +
        String(p.blankAs != null ? p.blankAs : '');
      if (seen[key]) return;
      seen[key] = true;
      toRestore.push({
        letter: String(p.letter).toUpperCase(),
        rackIndex: p.rackIndex != null ? p.rackIndex : -1,
        tileId: p.tileId || null,
        blankAs: p.blankAs != null ? p.blankAs : null,
      });
    }

    /* Board-drag tiles are already off pending — capture before cancel loses them. */
    if (this.drag && this.drag.fromBoard !== undefined && this.drag.letter) {
      pushTile({
        letter: this.drag.letter,
        rackIndex: this.drag.fromRack != null ? this.drag.fromRack : -1,
        tileId: this.drag.tileId || null,
        blankAs: this.drag.blankAs != null ? this.drag.blankAs : null,
      });
    }

    if (this.pendingPlacements && this.pendingPlacements.size) {
      this.pendingPlacements.forEach(function (p) {
        pushTile(p);
      });
    }
    return toRestore;
  }

  /** Remove uncommitted tiles from the board only after they are safe on the rack. */
  clearPendingFromBoard() {
    var inflight = this.cancelInFlightDrag();
    if (inflight && inflight.letter) {
      /* Should already be accounted for in the restore list; ignore return. */
    }
    if (this.pendingPlacements) this.pendingPlacements.clear();
    this.lastPendingCell = null;
  }

  /**
   * Guaranteed rack placement for a recalled tile. Never sends the tile to the bag.
   * Always restores the physical tile letter (blanks → '*', never blankAs).
   * Online: if the letter is already on the rack, do not duplicate.
   */
  forceRecalledTileOntoRack(p) {
    var rack = this.racks[PLAYER.HUMAN];
    if (!rack || !p || !p.letter) return false;
    /* Physical identity: blanks stay '*'; blankAs is display-only on the board. */
    var letter = p.letter === '*' ? '*' : String(p.letter).toUpperCase();
    var i;

    if (p.tileId) {
      var byId = findRackSlotByTileId(rack, p.tileId);
      if (byId >= 0 && rack[byId]) {
        /* Same physical tile — keep it; repair letter if a prior bug face-wrote blankAs. */
        if (String(rack[byId].letter || '') !== letter) {
          rack[byId].letter = letter;
        }
        return true;
      }
    }

    if (p.rackIndex >= 0 && p.rackIndex < RACK_SIZE && !rack[p.rackIndex]) {
      rack[p.rackIndex] = { letter: letter, id: p.tileId || uid() };
      return true;
    }

    /* Prefer original slot when it already holds this letter. */
    if (
      p.rackIndex >= 0 &&
      p.rackIndex < RACK_SIZE &&
      rack[p.rackIndex] &&
      String(rack[p.rackIndex].letter || '') === letter
    ) {
      if (p.tileId && !rack[p.rackIndex].id) rack[p.rackIndex].id = p.tileId;
      return true;
    }

    for (i = 0; i < RACK_SIZE; i++) {
      if (!rack[i]) {
        rack[i] = { letter: letter, id: p.tileId || uid() };
        return true;
      }
    }

    /* Online keeps tiles on the rack while pending — letter should already be here. */
    if (this.isOnlineMode()) {
      for (i = 0; i < RACK_SIZE; i++) {
        if (rack[i] && String(rack[i].letter || '') === letter) {
          return true;
        }
      }
    }

    /*
     * Last resort: only overwrite the remembered slot when it holds a phantom
     * auto-recovered blank that stole the hole (legacy blank-count bug).
     * Never replace an unrelated letter with a different one.
     */
    var slot = p.rackIndex >= 0 && p.rackIndex < RACK_SIZE ? p.rackIndex : -1;
    if (
      slot >= 0 &&
      rack[slot] &&
      letter !== '*' &&
      String(rack[slot].letter || '') === '*'
    ) {
      rack[slot] = { letter: letter, id: p.tileId || uid() };
      console.warn(
        '[QWERTY] forceRecalledTileOntoRack replaced phantom blank in slot',
        slot,
        'with',
        letter
      );
      return true;
    }

    console.warn(
      '[QWERTY] forceRecalledTileOntoRack: rack full, could not place',
      letter,
      'without overwriting another letter'
    );
    return false;
  }

  /** True if at least one rack slot holds this letter. */
  rackHasLetter(letter) {
    var rack = this.racks[PLAYER.HUMAN];
    var want = String(letter || '').toUpperCase();
    if (!rack || !want) return false;
    for (var i = 0; i < RACK_SIZE; i++) {
      if (rack[i] && String(rack[i].letter || '').toUpperCase() === want) return true;
    }
    return false;
  }

  /**
   * Put every recalled tile on the rack. Returns how many were ensured.
   * Never drops a tile into the bag.
   */
  restoreRecalledTilesToRack(toRestore) {
    var player = PLAYER.HUMAN;
    if (!this.racks[player] || !toRestore || !toRestore.length) return 0;

    var list = toRestore.slice().sort(function (a, b) {
      var ai = a.rackIndex != null ? a.rackIndex : -1;
      var bi = b.rackIndex != null ? b.rackIndex : -1;
      return ai - bi;
    });

    var ensured = 0;
    var i, p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p || !p.letter) continue;
      if (this.forceRecalledTileOntoRack(p)) ensured++;
    }
    return ensured;
  }

  /**
   * Safety: every recalled letter must still exist on the rack after restore.
   * Re-forces any missing letters. Returns list of letters that were missing.
   */
  assertRecalledTilesOnRack(toRestore) {
    if (!toRestore || !toRestore.length) return [];
    var missing = [];
    var need = {};
    var i, L, have, rack, r;
    for (i = 0; i < toRestore.length; i++) {
      if (!toRestore[i] || !toRestore[i].letter) continue;
      L = String(toRestore[i].letter).toUpperCase();
      need[L] = (need[L] || 0) + 1;
    }
    rack = this.racks[PLAYER.HUMAN] || [];
    have = {};
    for (r = 0; r < rack.length; r++) {
      if (!rack[r] || !rack[r].letter) continue;
      L = String(rack[r].letter).toUpperCase();
      have[L] = (have[L] || 0) + 1;
    }
    for (L in need) {
      if (!Object.prototype.hasOwnProperty.call(need, L)) continue;
      while ((have[L] || 0) < need[L]) {
        missing.push(L);
        this.forceRecalledTileOntoRack({ letter: L, rackIndex: -1, tileId: null });
        have[L] = (have[L] || 0) + 1;
      }
    }
    return missing;
  }

  /** @deprecated Use collectPendingTilesForRecall + clearPendingFromBoard. */
  collectAndClearPendingForRecall() {
    var toRestore = this.collectPendingTilesForRecall();
    this.clearPendingFromBoard();
    return toRestore;
  }

  recallTiles() {
    this.hideBlankPicker();
    var toRestore = this.collectPendingTilesForRecall();
    var n = toRestore.length;

    console.info(
      '[QWERTY] Recalling ' + n + ' tiles from board to rack',
      toRestore
        .map(function (t) {
          return t.letter;
        })
        .join('')
    );

    this.clearRackSelection();
    this.clearExchangeMode();
    this.resetPlayPreviewUi();
    /* Keep bingo/CONNECTION banners — recall only clears local preview UI. */
    this.opponentWordHighlight = null;

    if (!n) {
      /*
       * Stuck rack-origin drag hides a slot via isRackSlotPending even with empty
       * pending — cancel it so the tile reappears. Board-origin drags are already
       * included in collectPendingTilesForRecall when letter is set.
       */
      if (this.drag) {
        var stuck = this.cancelInFlightDrag();
        if (stuck && stuck.letter) {
          this.restoreRecalledTilesToRack([stuck]);
          this.assertRecalledTilesOnRack([stuck]);
          this.setMessage('Recalled 1 tile to rack.', 'success');
          if (!this.isOnlineMode()) this.save();
          this.updatePendingPreview();
          this.updateUI();
          this.draw();
          return;
        }
        this.setMessage('No unsubmitted tiles to recall. Submitted words stay on the board.');
        this.updatePendingPreview();
        this.updateUI();
        this.draw();
        return;
      }
      this.setMessage('No unsubmitted tiles to recall. Submitted words stay on the board.');
      this.updatePendingPreview();
      this.updateUI();
      this.draw();
      return;
    }

    /* 1) Ensure every tile is on the rack BEFORE removing from the board. */
    this.restoreRecalledTilesToRack(toRestore);
    var missing = this.assertRecalledTilesOnRack(toRestore);
    if (missing.length) {
      console.warn(
        '[QWERTY] recall safety repair — re-added missing letter(s):',
        missing.join(',')
      );
    }

    /* 2) Only now clear pending / cancel drag so tiles never vanish. */
    this.clearPendingFromBoard();

    /* 3) Final safety pass after clear (pending no longer hides rack slots). */
    missing = this.assertRecalledTilesOnRack(toRestore);
    if (missing.length) {
      console.error(
        '[QWERTY] recall still missing after clear — forced:',
        missing.join(',')
      );
    }

    this.setMessage(
      'Recalled ' + n + ' tile' + (n === 1 ? '' : 's') + ' to rack.',
      'success'
    );
    this.startRackSettle(toRestore);
    if (!this.isOnlineMode()) this.save();
    this.updatePendingPreview();
    this.updateUI();
    this.draw();
  }

  releasePendingToRack(cellIdx) {
    if (!this.pendingPlacements.has(cellIdx)) return false;
    var p = this.pendingPlacements.get(cellIdx);
    this.pendingPlacements.delete(cellIdx);
    if (this.lastPendingCell === cellIdx) {
      this.lastPendingCell = this.getPendingScoreDisplayCell();
    }
    this.hideBlankPicker();
    this.restoreRecalledTilesToRack([{
      letter: p.letter,
      rackIndex: p.rackIndex,
      tileId: p.tileId || null,
      blankAs: p.blankAs != null ? p.blankAs : null,
    }]);
    if (!this.isOnlineMode()) this.save();
    return true;
  }

  returnPendingTileToRack(cellIdx) {
    if (!this.pendingPlacements.has(cellIdx)) return;
    this.releasePendingToRack(cellIdx);
    this.setMessage('Tile returned to rack.', 'success');
    this.updatePendingPreview();
    this.draw();
  }

  shuffleRack() {
    if (this.gameOver) return;
    var rack = this.racks[PLAYER.HUMAN];
    this.clearRackSelection();
    this.clearExchangeMode();
    var used = new Set();
    for (var p of this.pendingPlacements.values()) {
      if (p.rackIndex >= 0) used.add(p.rackIndex);
    }
    var indices = [];
    var tiles = [];
    for (var i = 0; i < RACK_SIZE; i++) {
      if (!used.has(i) && rack[i]) {
        indices.push(i);
        tiles.push(rack[i]);
      }
    }
    for (var j = tiles.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = tiles[j]; tiles[j] = tiles[k]; tiles[k] = tmp;
    }
    for (var n = 0; n < indices.length; n++) {
      rack[indices[n]] = tiles[n];
    }
    this.setMessage('Rack shuffled.', 'success');
    this.updatePendingPreview();
    this.draw();
  }

  cancelExchange() {
    if (!this.exchangeMode) return;
    this.clearExchangeMode();
    this.setMessage('Exchange cancelled.');
    this.updateUI();
    this.draw();
  }

  exchangeTiles() {
    if (this.gameOver || this.currentPlayer !== PLAYER.HUMAN) return;
    if (this.bag.length === 0) {
      this.setMessage('No tiles left in the bag to exchange.', 'error');
      return;
    }

    if (!this.exchangeMode) {
      if (this.pendingPlacements.size > 0) {
        var nPending = this.pendingPlacements.size;
        if (!confirm(
          'You have ' + nPending + ' tile' + (nPending > 1 ? 's' : '') +
          ' on the board. Return them to your rack before exchanging?'
        )) {
          return;
        }
        this.recallTiles();
      }
      this.clearRackSelection();
      this.exchangeMode = true;
      this.exchangeSlots = {};
      this.pauseTurnTimerForExchange();
      this.setMessage('Tap tiles to exchange, then Confirm or Cancel');
      this.updateUI();
      this.draw();
      return;
    }

    var slots = this.getExchangeSlotList();
    if (slots.length === 0) {
      return;
    }

    if (slots.length > this.bag.length) {
      this.setMessage(
        'Only ' + this.bag.length + ' tile' + (this.bag.length > 1 ? 's' : '') +
        ' left in the bag — exchange fewer tiles or play a word.',
        'error'
      );
      return;
    }

    this.playSfx('exchange');

    if (this.isOnlineMode()) {
      try {
        QWERTYOnline.exchange(slots);
        this.clearExchangeMode();
        this.setMessage('Sending exchange…');
      } catch (err) {
        this.setMessage(err.message || 'Not connected.', 'error');
      }
      return;
    }

    this.performExchange(PLAYER.HUMAN, slots);
    this.clearExchangeMode();
    var self = this;
    var count = slots.length;
    this.announceExchange(PLAYER.HUMAN, count).then(function () {
      self.endTurn(0);
    });
  }

  performExchange(player, slots) {
    if (!slots.length || this.bag.length === 0) return;
    var rack = this.racks[player];
    var i, slot, tile;
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      tile = rack[slot];
      if (tile) this.bag.push(tile.letter);
      rack[slot] = null;
    }
    this.bag = shuffle(this.bag);
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      if (this.bag.length) {
        rack[slot] = { letter: this.bag.pop(), id: uid() };
      }
    }
  }

  countBadRackTiles(letters) {
    var vowels = 0;
    var counts = {};
    var hasU = false;
    var i, L;
    for (i = 0; i < letters.length; i++) {
      L = String(letters[i].letter).toUpperCase();
      if ('AEIOU'.indexOf(L) >= 0) vowels++;
      if (L === 'U') hasU = true;
      counts[L] = (counts[L] || 0) + 1;
    }
    var bad = Math.max(0, vowels - 3);
    for (L in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, L)) continue;
      if (counts[L] >= 3) bad += counts[L] - 1;
      if (L === 'Q' && !hasU) bad += 2;
    }
    return bad;
  }

  getWorstRackSlotsForExchange(player, maxCount) {
    var rack = this.racks[player];
    if (!rack || maxCount <= 0) return [];
    var letterCounts = {};
    var hasU = false;
    var scores = [];
    var i, tile, L;
    for (i = 0; i < rack.length; i++) {
      tile = rack[i];
      if (!tile) continue;
      L = String(tile.letter).toUpperCase();
      letterCounts[L] = (letterCounts[L] || 0) + 1;
      if (L === 'U') hasU = true;
    }
    for (i = 0; i < rack.length; i++) {
      tile = rack[i];
      if (!tile) continue;
      L = String(tile.letter).toUpperCase();
      var bad = 0;
      if ('AEIOU'.indexOf(L) >= 0) bad += 2;
      if (letterCounts[L] > 1) bad += letterCounts[L];
      if (L === 'Q' && !hasU) bad += 5;
      scores.push({ slot: i, bad: bad });
    }
    scores.sort(function (a, b) { return b.bad - a.bad; });
    var slots = [];
    for (i = 0; i < scores.length && slots.length < maxCount; i++) {
      if (scores[i].bad > 0) slots.push(scores[i].slot);
    }
    if (!slots.length && scores.length) slots.push(scores[0].slot);
    return slots;
  }

  shouldAIExchangeInsteadOfMove(move, letters) {
    var cfg = this.getDifficultyConfig();
    if (this.bag.length === 0 || !move) return false;
    if (move.starsCaptured > 0 || (move.linkBonus && move.linkBonus > 0)) return false;
    if (!this.playerHasBoardTiles(PLAYER.AI) && move.score >= 10) return false;

    var bad = this.countBadRackTiles(letters);
    if (bad < 2) return false;

    if (cfg.mode === 'hard') {
      return move.score <= 25;
    }
    if (cfg.mode === 'medium') {
      return move.score <= 18 && Math.random() < 0.35;
    }
    return move.score <= 15 && Math.random() < 0.45;
  }

  tryAIExchange(bestMove) {
    if (this.bag.length === 0) return false;
    var letters = this.getAIRackLetters();
    if (!letters.length) return false;

    var slots;
    if (!bestMove) {
      slots = this.getWorstRackSlotsForExchange(
        PLAYER.AI,
        Math.min(7, letters.length, this.bag.length)
      );
    } else if (!this.shouldAIExchangeInsteadOfMove(bestMove, letters)) {
      return false;
    } else {
      var count = Math.min(
        4,
        Math.max(2, this.countBadRackTiles(letters)),
        letters.length,
        this.bag.length
      );
      slots = this.getWorstRackSlotsForExchange(PLAYER.AI, count);
    }

    if (!slots.length) return false;

    this.performExchange(PLAYER.AI, slots);
    this.save();
    this.draw();
    this.announceComputerTurnWithoutPlay({ kind: 'exchange', tileCount: slots.length });
    return true;
  }

  submitWord() {
    this.clearExchangeMode();
    if (this.pendingPlacements.size === 0) {
      this.setMessage('Drag tiles onto the board first.', 'error');
      return;
    }

    if (this.isOnlineMode()) {
      if (this._onlineAwaitingServer) return;
      if (!this._onlineStateReady) {
        this.showOnlineAlert('Still syncing with the server — wait a moment and try again.', 'error');
        return;
      }
      if (this.currentPlayer !== PLAYER.HUMAN) {
        this.showOnlineAlert('Not your turn.', 'error');
        return;
      }
    }

    var unsetBlank = this.findUnsetBlankIdx();
    if (unsetBlank != null) {
      this.showBlankPicker(unsetBlank);
      this.setMessage('Choose a letter for your blank tile before playing.', 'error');
      return;
    }

    if (this.isOnlineMode()) {
      this.resolveOnlinePlacementTileIds();
      var indices = [];
      this.pendingPlacements.forEach(function (_, idx) { indices.push(idx); });
      var rows = indices.map(function (i) { return Math.floor(i / COLS); });
      var cols = indices.map(function (i) { return i % COLS; });
      var sameRow = rows.every(function (r) { return r === rows[0]; });
      var sameCol = cols.every(function (c) { return c === cols[0]; });
      var visualFull = (sameRow || sameCol)
        ? this.pendingVisualFullWord(indices, sameRow)
        : { text: '', cells: [] };
      var submitOpts = {};
      if (
        visualFull.text &&
        visualFull.text.length >= 2 &&
        visualFull.cells &&
        visualFull.cells.length >= 2
      ) {
        submitOpts.intendedWord = visualFull.text;
        submitOpts.wordCells = visualFull.cells;
      }
      var engineResult = this.validateOnlineMoveWithEngine(this.pendingPlacements, submitOpts);
      if (!engineResult.valid) {
        var preview = this.getPendingWordPreview();
        var failMsg = this.formatMoveValidationError(
          (preview && preview.text) || visualFull.text || '',
          engineResult.reason,
          engineResult
        );
        /* Submit rejected → full abort: highlights + recall pending tiles. */
        this.abortInvalidPlayAttempt(failMsg);
        this.showOnlineAlert(failMsg, 'error');
        return;
      }
      var placementList = this.normalizedPlacementsForEngine(this.pendingPlacements);
      var orderedCells = (visualFull.cells && visualFull.cells.length)
        ? visualFull.cells
        : this.orderedCellsForSubmittedWord(engineResult);
      var spelled = visualFull.text || this.spellServerCellsWithPending(orderedCells);
      var wordMeta = {
        word: spelled || engineResult.word,
        cells: orderedCells,
      };
      try {
        this._onlineAwaitingServer = true;
        this._pendingUiScoreResult = this.enrichScoreResultFormedWords(engineResult, this.pendingPlacements);
        this._pendingUiScoreLabel = wordMeta.word || engineResult.word;
        this.updateUI();
        QWERTYOnline.play(placementList, wordMeta);
        this.setMessage('Sending move to server…');
        this.draw();
      } catch (err) {
        this._onlineAwaitingServer = false;
        this._pendingUiScoreResult = null;
        this.updateUI();
        this.showOnlineAlert(err.message || 'Not connected to server.', 'error');
      }
      return;
    }

    const result = this.enrichScoreResultFormedWords(
      this.validateMove(this.pendingPlacements, this.currentPlayer),
      this.pendingPlacements
    );
    if (!result.valid) {
      var offlinePreview = this.getPendingWordPreview();
      var offlineFail = this.formatMoveValidationError(
        (offlinePreview && offlinePreview.text) || '',
        result.reason,
        result
      );
      /* Submit rejected → full abort: highlights + recall pending tiles. */
      this.abortInvalidPlayAttempt(offlineFail);
      this.setMessage(offlineFail, 'error');
      return;
    }

    const usedRackIndices = [...this.pendingPlacements.values()]
      .map((p) => p.rackIndex)
      .filter((i) => i >= 0);

    var wasLinked = this.boardsLinked;
    var playLabel = result.word;
    var placedCells = Array.from(this.pendingPlacements.keys());
    this.startScoreFx(result, playLabel);
    this.commitPlacements(this.pendingPlacements, this.currentPlayer);
    this.markBoardsLinked(this.pendingPlacements, this.currentPlayer);
    this.pendingPlacements.clear();
    this.openingPlayed[this.currentPlayer] = true;
    /* Keep formed words lit for 5s (same path as online / AI — desktop + mobile). */
    this.highlightOpponentLastWord(playLabel, placedCells);
    this.draw();

    const turnScore = result.score;
    const starsGot = result.starsCaptured;
    this.stars[this.currentPlayer] += starsGot;
    this.scores[this.currentPlayer] += turnScore;
    this.setLastWordPlayed(this.currentPlayer, result.word, turnScore);

    var successMsg = this.formatPlaySuccessMessage('', result, playLabel);
    if (!wasLinked && this.boardsLinked) {
      successMsg += ' · Boards connected — build off each other\'s words!';
    }

    this.refillRack(this.currentPlayer, usedRackIndices);
    this.firstMovePlayed = true;

    this.setMessage(successMsg, 'success');
    this.save();
    this._skipLayoutSync = true;
    if (this.checkGameOver()) {
      this._skipLayoutSync = false;
      return;
    }

    this.stopTurnTimer();
    this.currentPlayer = PLAYER.AI;
    this.updateUI();
    this.draw();
    this.save();
    this._skipLayoutSync = false;
    if (!this.gameOver) {
      this.scheduleRunAI(700);
    }
  }

  endTurn(_score, msg) {
    if (this.isOnlineMode()) {
      if (msg) this.setMessage(msg);
      return;
    }
    if (msg) this.setMessage(msg);
    this.currentPlayer = 1 - this.currentPlayer;
    this.save();
    if (this.gameOver) {
      this.stopTurnTimer();
    } else if (this.currentPlayer === PLAYER.HUMAN) {
      this.startTurnTimer();
    } else {
      this.stopTurnTimer();
    }
    this.updateUI();
    this.draw();

    if (this.currentPlayer === PLAYER.AI && !this.gameOver && !this.isOnlineMode()) {
      this.scheduleRunAI(700);
    }
  }

  commitPlacements(placements, owner) {
    var who = Number(owner);
    for (const [idx, p] of placements) {
      this.board[idx] = {
        letter: p.blankAs != null ? p.blankAs : p.letter,
        owner: who,
        isBlank: p.letter === '*',
      };
    }
  }

  refillRack(player, usedRackIndices) {
    var rack = this.racks[player];
    var i, ri;
    for (i = 0; i < usedRackIndices.length; i++) {
      ri = usedRackIndices[i];
      if (ri >= 0) rack[ri] = null;
    }
    var remaining = [];
    for (i = 0; i < rack.length; i++) {
      if (rack[i]) remaining.push(rack[i]);
    }
    while (remaining.length < RACK_SIZE && this.bag.length) {
      remaining.push({ letter: this.bag.pop(), id: uid() });
    }
    for (i = 0; i < RACK_SIZE; i++) {
      rack[i] = i < remaining.length ? remaining[i] : null;
    }
  }

  refillRackAfterAI(usedRackIndices) {
    this.refillRack(PLAYER.AI, usedRackIndices);
  }

  resolveValidWord(w, player) {
    var upper = w.toUpperCase();
    if (isValidWord(upper)) return upper;
    return null;
  }

  wordFromBoardCells(board, cells) {
    var i, out = '';
    for (i = 0; i < cells.length; i++) {
      var cell = board[cells[i]];
      if (cell && cell.letter) out += cell.letter;
    }
    return out.toUpperCase();
  }

  isVerticalWordCells(cells) {
    if (!cells || cells.length < 2) return false;
    var col = cells[0] % COLS;
    var i;
    for (i = 1; i < cells.length; i++) {
      if (cells[i] % COLS !== col) return false;
    }
    return true;
  }

  isHorizontalWordCells(cells) {
    if (!cells || cells.length < 2) return false;
    var row = Math.floor(cells[0] / COLS);
    var i;
    for (i = 1; i < cells.length; i++) {
      if (Math.floor(cells[i] / COLS) !== row) return false;
    }
    return true;
  }

  resolveWordFromRun(board, cells, player) {
    if (!cells || cells.length < 2) return null;
    var horizontal = this.isHorizontalWordCells(cells);
    var vertical = this.isVerticalWordCells(cells);
    var ascCells;
    if (horizontal) {
      ascCells = cells.slice().sort(function (a, b) {
        return (a % COLS) - (b % COLS);
      });
    } else if (vertical) {
      ascCells = cells.slice().sort(function (a, b) {
        return Math.floor(a / COLS) - Math.floor(b / COLS);
      });
    } else {
      return null;
    }

    /*
     * Humans and AI share this path. Every formed run must pass the exact same
     * isValidWord check on left-to-right / top-to-bottom board spelling.
     * No reverse readings, no left-tile-to-end anagrams (SBURTHEN↛BURTHENS,
     * RFARE↛FARER, TPEWS↛SWEPT).
     */
    var ascWord = this.wordFromBoardCells(board, ascCells);
    return this.resolveValidWord(ascWord, player);
  }

  cornerLetterMatchesWord(cornerCh, word) {
    if (!cornerCh || !word) return false;
    var ch = String(cornerCh).toUpperCase();
    var w = String(word).toUpperCase();
    return ch === w.charAt(0) || ch === w.charAt(w.length - 1);
  }

  /** Board used for move validation — never display-normalized. */
  getValidationBoard() {
    return this.board;
  }

  /* ── Validation & scoring ─────────────────────────────────── */
  validateMove(placements, player, opts) {
    if (!opts) opts = {};
    var board = this.getValidationBoard();
    const indices = [...placements.keys()];
    if (indices.length === 0) return { valid: false, reason: 'No tiles placed.' };

    for (var pi = 0; pi < indices.length; pi++) {
      var pp = placements.get(indices[pi]);
      if (pp.letter === '*' && pp.blankAs == null) {
        return { valid: false, reason: 'Choose a letter for each blank tile.' };
      }
    }

    // Must be in a straight line
    const cols = indices.map((i) => i % COLS);
    const rows = indices.map((i) => Math.floor(i / COLS));
    const sameRow = rows.every((r) => r === rows[0]);
    const sameCol = cols.every((c) => c === cols[0]);
    if (!sameRow && !sameCol) {
      return { valid: false, reason: 'Tiles must be in one row or column.' };
    }

    // Fill gaps in line
    if (sameRow) {
      const r = rows[0];
      const minC = Math.min(...cols);
      const maxC = Math.max(...cols);
      for (let c = minC; c <= maxC; c++) {
        const idx = r * COLS + c;
        if (!placements.has(idx) && !this.boardCellLetter(board[idx])) {
          return { valid: false, reason: 'No gaps allowed within a word.' };
        }
      }
    } else {
      const c = cols[0];
      const minR = Math.min(...rows);
      const maxR = Math.max(...rows);
      for (let r = minR; r <= maxR; r++) {
        const idx = r * COLS + c;
        if (!placements.has(idx) && !this.boardCellLetter(board[idx])) {
          return { valid: false, reason: 'No gaps allowed within a word.' };
        }
      }
    }

    var rack = this.racks[player];
    var usedRack = {};
    for (var ri = 0; ri < indices.length; ri++) {
      var plR = placements.get(indices[ri]);
      var rackSlot = resolvePlacementRackSlot(rack, plR);
      if (rackSlot < 0) continue;
      if (usedRack[rackSlot]) {
        return { valid: false, reason: 'Each rack tile can only be used once.' };
      }
      usedRack[rackSlot] = true;
      var rackTile = rack && rack[rackSlot];
      if (!rackTile) {
        return { valid: false, reason: 'Invalid rack tile.' };
      }
      if (String(rackTile.letter).toUpperCase() !== String(plR.letter).toUpperCase()) {
        return { valid: false, reason: 'Tile mismatch with rack.' };
      }
    }

    // Build temp board
    const tempBoard = board.map((cell, i) => {
      if (placements.has(i)) {
        const p = placements.get(i);
        return { letter: (p.blankAs != null ? p.blankAs : p.letter).toUpperCase(), owner: player };
      }
      if (!cell) return null;
      var letter = this.boardCellLetter(cell);
      if (!letter) return null;
      return { letter: letter, owner: cell.owner };
    });

    const startIdx = this.getOpeningStartIdx(player);
    const needsOpening = !this.playerHasBoardTiles(player);

    if (!opts.preview) {
      if (needsOpening) {
        var coversCorner = false;
        for (var ci = 0; ci < indices.length; ci++) {
          if (Number(indices[ci]) === Number(startIdx)) { coversCorner = true; break; }
        }
        if (!coversCorner) {
          var cornerHint;
          if (startIdx === START_P2_IDX) {
            cornerHint =
              'First word must cover your start square (top-right, amber) — at least one tile on start.';
          } else {
            cornerHint =
              'First word must cover your start square (bottom-left, green) — at least one tile on start.';
          }
          return {
            valid: false,
            reason: player === PLAYER.HUMAN ? cornerHint : 'Opening word must cover the corner.',
          };
        }
      } else if (!this.boardsLinked) {
          if (!this.placementTouchesOwner(placements, player)) {
            return {
              valid: false,
              reason: 'Must extend from your own tiles until you connect to your opponent\'s words.',
            };
          }
      } else if (!this.placementTouchesBoard(placements)) {
          return {
            valid: false,
            reason: 'New tiles must connect to words already on the board.',
          };
      }
    }

    // All words valid — score full length of each newly formed word × 10
    const words = getAllWordsFromBoard(tempBoard, COLS, ROWS);
    const newWordCells = new Set(indices);
    let mainWordScore = 0;
    let connections = 0;
    let starsCaptured = 0;
    let primaryWord = '';
    var oppSeen = {};

    for (var pi of placements.keys()) {
      if (this.specials[pi] === CELL_STAR) starsCaptured++;
    }

    var formedWords = [];
    for (const { word, cells } of words) {
      const w = word.toUpperCase();
      const usesNew = cells.some((c) => newWordCells.has(c));
      if (!usesNew) continue;
      /* Belt-and-suspenders: full run must be an exact dictionary word (LTR/TTB). */
      if (!isValidWord(w)) {
        return { valid: false, reason: `"${w}" is not a valid word.` };
      }
      var accepted = this.resolveWordFromRun(tempBoard, cells, player);
      if (!accepted || accepted !== w) {
        return { valid: false, reason: `"${w}" is not a valid word.` };
      }

      formedWords.push({ word: accepted, cells: cells.slice() });
      if (accepted.length >= primaryWord.length) primaryWord = accepted;

      /* Full word length × 10 for each newly formed word. */
      mainWordScore += letterValue('A') * accepted.length;
      for (const c of cells) {
        if (!placements.has(c) && board[c] && this.cellOwner(board[c]) !== player) {
          if (!oppSeen[c]) {
            oppSeen[c] = true;
            connections++;
          }
        }
      }
    }

    if (!primaryWord) {
      return { valid: false, reason: 'Must form at least one new word.' };
    }

    /* Opening already required ≥1 tile on start; no first/last-letter demand. */

    var placedCount = placements.size;
    var rackRemaining = this.countRackTiles(player);
    /*
     * Bingo = emptied the rack this turn.
     * Offline human: pending tiles are already removed from the rack, so an empty
     * rack means every remaining tile was played — do NOT compare placedCount to
     * remaining (that falsely bingo'd when e.g. 4 of 8 were placed).
     * Online / AI: tiles stay on the rack until commit, so placed === rack count.
     */
    var emptiedRack;
    if (player === PLAYER.HUMAN && !this.isOnlineMode()) {
      emptiedRack = placedCount > 0 && rackRemaining === 0;
    } else {
      emptiedRack = placedCount > 0 && placedCount === rackRemaining;
    }
    var bingo = emptiedRack;
    var bingoPoints = bingo ? BINGO_BONUS : 0;
    var starPoints = starsCaptured * STAR_BONUS;
    /* +75 only on the first connection to opponent words. */
    var linkBonus = connections > 0 && !this.boardsLinked ? LINK_BONUS : 0;
    const score = mainWordScore + starPoints + linkBonus + bingoPoints;

    return {
      valid: true,
      score,
      starsCaptured,
      starPoints,
      connections,
      bonusConnections: connections,
      linkBonus,
      letterScore: mainWordScore,
      bingo: bingo,
      bingoPoints: bingoPoints,
      word: primaryWord,
      formedWords: formedWords,
    };
  }

  adjacentIndices(idx) {
    const c = idx % COLS;
    const r = Math.floor(idx / COLS);
    const out = [];
    if (c > 0) out.push(idx - 1);
    if (c < COLS - 1) out.push(idx + 1);
    if (r > 0) out.push(idx - COLS);
    if (r < ROWS - 1) out.push(idx + COLS);
    return out;
  }

  placementTouchesOwner(placements, player) {
    var board = this.getValidationBoard();
    for (const idx of placements.keys()) {
      for (const n of this.adjacentIndices(idx)) {
        const existing = board[n];
        if (existing && !placements.has(n) && this.cellOwner(existing) === player) return true;
      }
    }
    return false;
  }

  placementTouchesOpponent(placements, player) {
    var board = this.getValidationBoard();
    for (const idx of placements.keys()) {
      for (const n of this.adjacentIndices(idx)) {
        const existing = board[n];
        if (existing && !placements.has(n) && this.cellOwner(existing) !== player) return true;
      }
    }
    return false;
  }

  placementTouchesBoard(placements) {
    var board = this.getValidationBoard();
    for (const idx of placements.keys()) {
      for (const n of this.adjacentIndices(idx)) {
        if (board[n] && !placements.has(n)) return true;
      }
    }
    return false;
  }

  playerHasBoardTiles(player) {
    for (var i = 0; i < this.board.length; i++) {
      if (this.board[i] && this.cellOwner(this.board[i]) === player) return true;
    }
    return false;
  }

  cellOwner(cell) {
    if (!cell || cell.owner == null) return null;
    return Number(cell.owner);
  }

  normalizeBoardOwners() {
    for (var i = 0; i < this.board.length; i++) {
      var cell = this.board[i];
      if (!cell) continue;
      if (typeof cell === 'string') {
        this.board[i] = { letter: String(cell).toUpperCase(), owner: PLAYER.HUMAN };
        continue;
      }
      if (cell.letter != null) cell.letter = String(cell.letter).toUpperCase();
      if (cell.owner != null) cell.owner = Number(cell.owner);
    }
  }

  boardCellLetter(cell) {
    if (!cell) return null;
    if (typeof cell === 'string') {
      var s = String(cell).trim();
      return s ? s.toUpperCase() : null;
    }
    if (cell.letter == null || cell.letter === '') return null;
    return String(cell.letter).toUpperCase();
  }

  getAIRackLetters() {
    var rack = this.racks[PLAYER.AI];
    if (!rack) return [];
    var out = [];
    for (var i = 0; i < rack.length; i++) {
      var t = rack[i];
      if (!t) continue;
      var letter = tileLetter(t);
      if (!letter) continue;
      out.push({ letter: letter, i: i });
    }
    return out;
  }

  ensureAIRackFilled() {
    var rack = this.racks[PLAYER.AI];
    if (!rack) return;
    var i, needs = 0;
    for (i = 0; i < RACK_SIZE; i++) {
      if (!rack[i] || !tileLetter(rack[i])) needs++;
    }
    if (needs > 0 && this.bag.length > 0) {
      this.refillRack(PLAYER.AI, []);
    }
  }

  repairStaleAIState() {
    this.syncOpeningPlayedFromBoard();
  }

  repairBoardOwners() {
    var i, cell, n, owners, o, r;
    for (i = 0; i < this.board.length; i++) {
      cell = this.board[i];
      if (!cell || typeof cell === 'string') continue;
      if (!this.boardCellLetter(cell)) continue;
      o = this.cellOwner(cell);
      if (o === PLAYER.HUMAN || o === PLAYER.AI) continue;

      owners = [];
      for (n of this.adjacentIndices(i)) {
        if (!this.board[n]) continue;
        var no = this.cellOwner(this.board[n]);
        if (no === PLAYER.HUMAN || no === PLAYER.AI) owners.push(no);
      }
      if (owners.length) {
        cell.owner = owners[0];
      } else if (i === START_P1_IDX) {
        cell.owner = PLAYER.HUMAN;
      } else if (i === START_P2_IDX) {
        cell.owner = PLAYER.AI;
      } else {
        r = Math.floor(i / COLS);
        cell.owner = r < Math.floor(ROWS / 2) ? PLAYER.AI : PLAYER.HUMAN;
      }
    }
  }

  syncOpeningPlayedFromBoard() {
    this.openingPlayed[PLAYER.HUMAN] = this.playerHasBoardTiles(PLAYER.HUMAN);
    this.openingPlayed[PLAYER.AI] = this.playerHasBoardTiles(PLAYER.AI);
  }

  inferBoardsLinked() {
    for (let i = 0; i < this.board.length; i++) {
      if (!this.board[i] || this.cellOwner(this.board[i]) !== PLAYER.HUMAN) continue;
      for (const n of this.adjacentIndices(i)) {
        if (this.board[n] && this.cellOwner(this.board[n]) === PLAYER.AI) return true;
      }
    }
    return false;
  }

  markBoardsLinked(placements, player) {
    if (this.boardsLinked) return;
    if (this.placementTouchesOpponent(placements, player)) {
      this.boardsLinked = true;
      this.draw();
    }
  }

  getWinnerHeadline() {
    var human = this.scores[PLAYER.HUMAN];
    var ai = this.scores[PLAYER.AI];
    if (human > ai) return 'YOU WON!';
    if (ai > human) return 'YOU LOST!';
    return 'IT\'S A TIE!';
  }

  getWinnerSubtext() {
    var human = this.scores[PLAYER.HUMAN];
    var ai = this.scores[PLAYER.AI];
    if (human >= WIN_SCORE && human > ai) {
      return 'You reached ' + WIN_SCORE + ' points first!';
    }
    if (ai >= WIN_SCORE && ai > human) {
      return 'Your opponent reached ' + WIN_SCORE + ' points first.';
    }
    if (human >= WIN_SCORE && ai >= WIN_SCORE && human === ai) {
      return 'Both players reached ' + WIN_SCORE + ' points with the same score.';
    }
    if (human > ai) {
      return 'No one could think of a word to play but you scored more than your opponent.';
    }
    if (ai > human) {
      return 'No one could think of a word to play and your opponent scored more.';
    }
    return 'Both players finished with the same score.';
  }

  getWinnerMessage() {
    var human = this.scores[PLAYER.HUMAN];
    var ai = this.scores[PLAYER.AI];
    var opp = this.isOnlineMode() ? this.onlineOpponentName : 'Computer';
    if (human >= WIN_SCORE && ai >= WIN_SCORE) {
      if (human > ai) return 'You win!';
      if (ai > human) return opp + ' wins!';
      return 'It\'s a tie!';
    }
    if (human >= WIN_SCORE) return 'You win!';
    if (ai >= WIN_SCORE) return opp + ' wins!';
    if (human > ai) return 'You win!';
    if (ai > human) return opp + ' wins!';
    return 'It\'s a tie!';
  }

  declareWinner() {
    return this.finalizeWinner({});
  }

  finalizeWinner(opts) {
    if (!opts) opts = {};
    if (this.gameOver) return true;
    if (this.gameOverDialogDismissed) return true;
    this.cancelPendingAI();
    this.gameOver = true;
    this.stopTurnTimer();
    var aiLeft = this.countRackTiles(PLAYER.AI);
    var humanLeft = this.countRackTiles(PLAYER.HUMAN);
    var countMsg = ' Final tiles — You: ' + humanLeft + ', Computer: ' + aiLeft + '.';
    var gameOverMsg = 'Game over — ' + this.getWinnerMessage() + countMsg;
    if (opts.skipPostGame) {
      this.setMessage(gameOverMsg, 'success');
    } else {
      this.pendingGameOverMessage = gameOverMsg;
    }
    this.updateUI();
    this.save();
    this.draw();
    if (!opts.skipPostGame) {
      this.gameOverDialogDismissed = false;
      this.schedulePostGameFlow();
    }
    return true;
  }

  checkGameOver() {
    if (this.scores[PLAYER.HUMAN] >= WIN_SCORE || this.scores[PLAYER.AI] >= WIN_SCORE) {
      return this.declareWinner();
    }

    const humanEmpty = !this.racks[PLAYER.HUMAN].some(Boolean) && this.bag.length === 0;
    const aiEmpty = !this.racks[PLAYER.AI].some(Boolean) && this.bag.length === 0;
    if (!humanEmpty && !aiEmpty) return false;

    return this.declareWinner();
  }

  /* ── Simple AI ────────────────────────────────────────────── */
  async runAI() {
    if (this.isOnlineMode()) return;
    if (this.gameOver || this.currentPlayer !== PLAYER.AI) return;
    var runGen = this.aiRunGeneration;
    this.stopTurnTimer();
    this.syncOpeningPlayedFromBoard();
    this.repairBoardOwners();
    this.repairStaleAIState();
    this.ensureAIRackFilled();
    _rackWordCache = {};
    this.withStableScroll(() => {
      this.setMessage('Computer is thinking…');
    });

    await new Promise((r) => setTimeout(r, this.getAIThinkDelay()));

    if (runGen !== this.aiRunGeneration || this.gameOver || this.currentPlayer !== PLAYER.AI) return;

    const move = this.findBestAIMove();
    if (!move) {
      if (this.tryAIExchange(null)) return;
      this.announceComputerTurnWithoutPlay({ kind: 'pass' });
      return;
    }

    if (this.tryAIExchange(move)) return;

    /* Re-validate at commit so AI never lands an invalid cross (same path as human). */
    var commitCheck = this.validateMove(move.placements, PLAYER.AI);
    if (!commitCheck || !commitCheck.valid) {
      if (this.tryAIExchange(null)) return;
      this.announceComputerTurnWithoutPlay({ kind: 'pass' });
      return;
    }

    this.commitPlacements(move.placements, PLAYER.AI);
    this.markBoardsLinked(move.placements, PLAYER.AI);
    this.openingPlayed[PLAYER.AI] = true;
    this.stars[PLAYER.AI] += commitCheck.starsCaptured || 0;
    this.scores[PLAYER.AI] += commitCheck.score;
    this.setLastWordPlayed(PLAYER.AI, commitCheck.word, commitCheck.score);
    this.highlightOpponentLastWord(commitCheck.word, Array.from(move.placements.keys()));
    this.refillRackAfterAI(move.usedRackIndices);
    this.firstMovePlayed = true;

    this.maybeOpponentChatOnMove(commitCheck.word);
    this.save();

    var aiKnown = {
      valid: true,
      score: commitCheck.score,
      word: commitCheck.word,
      linkBonus: commitCheck.linkBonus || 0,
      starsCaptured: commitCheck.starsCaptured || 0,
      starPoints: commitCheck.starPoints || 0,
      letterScore: commitCheck.letterScore,
      bingo: !!commitCheck.bingo,
      bingoPoints: commitCheck.bingoPoints || 0,
      formedWords: commitCheck.formedWords || [],
    };
    this.withStableScroll(() => {
      this.showPlayScoreFeedback(
        'Computer',
        commitCheck.word,
        commitCheck.score,
        Array.from(move.placements.keys()),
        aiKnown
      );
      this.updateUI();
      this.draw();
    });

    if (this.checkGameOver()) {
      return;
    }

    this.currentPlayer = PLAYER.HUMAN;
    this.save();
    this.withStableScroll(() => {
      this.startTurnTimer();
      this.updateUI();
      this.draw();
    });
  }

  findBestAIMove() {
    const letters = this.getAIRackLetters();
    if (!letters.length) return null;

    var cfg = this.getDifficultyConfig();

    /* Easy: sometimes passes or "misses" an obvious spot. */
    if (cfg.passChance > 0 && Math.random() < cfg.passChance) return null;

    var moves = this.collectAllValidAIMoves(letters);
    if (!moves.length) {
      if (cfg.allowFallbackOpening) {
        return this.findAnyOpeningMove(letters);
      }
      return null;
    }

    return this.selectMoveByDifficulty(moves);
  }

  collectAllValidAIMoves(letters) {
    this.repairBoardOwners();
    var cfg = this.getDifficultyConfig();
    var moves = [];
    var seen = {};
    var self = this;

    function pushMove(cand, result) {
      if (!result || !result.valid || !cand) return;
      /* Every formed word already passed isValidWord inside validateMove. */
      var formed = result.formedWords || [];
      var fi;
      for (fi = 0; fi < formed.length; fi++) {
        if (!formed[fi] || !isValidWord(formed[fi].word)) return;
      }
      var key = cand.word + ':' + Array.from(cand.placements.keys()).sort(function (a, b) {
        return a - b;
      }).join(',');
      if (seen[key]) return;
      seen[key] = true;
      moves.push({
        placements: cand.placements,
        score: result.score,
        starsCaptured: result.starsCaptured,
        usedRackIndices: cand.usedRackIndices,
        word: result.word || cand.word,
        connections: result.connections || 0,
        linkBonus: result.linkBonus || 0,
        bingo: !!result.bingo,
        bingoPoints: result.bingoPoints || 0,
        letterScore: result.letterScore,
        starPoints: result.starPoints,
        formedWords: formed,
      });
    }

    var needsOpening = !this.playerHasBoardTiles(PLAYER.AI);
    var words = this.collectWordsForDifficulty(letters, needsOpening);
    var wi, word, used, cand, result, placements, pi;

    if (needsOpening) {
      for (wi = 0; wi < words.length; wi++) {
        word = words[wi];
        used = this.matchWordToRack(word, letters);
        if (!used) continue;
        cand = this.buildOpeningAtCorner(word, used, 'H');
        if (cand) pushMove(cand, this.validateMove(cand.placements, PLAYER.AI));
        cand = this.buildOpeningAtCorner(word, used, 'V');
        if (cand) pushMove(cand, this.validateMove(cand.placements, PLAYER.AI));
      }
    } else {
      for (wi = 0; wi < words.length; wi++) {
        word = words[wi];
        placements = this.tryPlaceWord(word, letters, PLAYER.AI);
        for (pi = 0; pi < placements.length; pi++) {
          pushMove(placements[pi], this.validateMove(placements[pi].placements, PLAYER.AI));
        }
      }
    }

    moves.sort(function (a, b) {
      return aiMoveSortValue(b, cfg) - aiMoveSortValue(a, cfg);
    });
    return moves;
  }

  collectWordsForDifficulty(letters, isOpening) {
    var cfg = this.getDifficultyConfig();
    var seen = {};
    var list = [];
    var add = function (w) {
      w = String(w).toUpperCase();
      if (seen[w] || w.length < 2 || !isValidWord(w)) return;
      seen[w] = true;
      list.push(w);
    };

    var i, len, bucket, word, maxLen = cfg.maxWordLenSearch || 8;
    var perLen = cfg.wordsPerLength || 200;

    for (i = 0; i < TWO_LETTER_WORDS.length; i++) add(TWO_LETTER_WORDS[i]);

    if (cfg.preferCommon) {
      var common = getEasyCommonSet();
      for (word in common) {
        if (!Object.prototype.hasOwnProperty.call(common, word)) continue;
        if (word.length <= maxLen && matchWordToRackStatic(word, letters)) add(word);
      }
    }

    var rackWords = this.filterWordsByRack(letters);
    for (i = 0; i < rackWords.length; i++) {
      if (rackWords[i].length <= maxLen) add(rackWords[i]);
    }

    var rackSet = {};
    for (i = 0; i < letters.length; i++) {
      rackSet[String(letters[i].letter).toUpperCase()] = true;
    }
    rackSet['*'] = true;

    for (len = 2; len <= maxLen; len++) {
      bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      var count = 0;
      for (i = 0; i < bucket.length; i++) {
        word = bucket[i].toUpperCase();
        if (seen[word]) continue;
        var usesRack = false;
        var ci;
        for (ci = 0; ci < word.length; ci++) {
          if (rackSet[word.charAt(ci)]) { usesRack = true; break; }
        }
        if (!usesRack) continue;
        add(word);
        count++;
        if (count >= perLen) break;
      }
    }

    return list;
  }

  selectMoveByDifficulty(moves) {
    if (!moves.length) return null;
    var cfg = this.getDifficultyConfig();
    var pool = moves.slice();

    if (cfg.maxWordLength || cfg.maxScore) {
      var filtered = pool.filter(function (m) {
        if (cfg.maxWordLength && m.word.length > cfg.maxWordLength) return false;
        if (cfg.maxScore && m.score > cfg.maxScore) return false;
        return true;
      });
      if (filtered.length) pool = filtered;
      else pool = moves.slice(Math.max(0, Math.floor(moves.length / 2)));
    }

    if (cfg.preferCommon) {
      var commonSet = getEasyCommonSet();
      var commonMoves = pool.filter(function (m) { return commonSet[m.word]; });
      if (commonMoves.length && Math.random() < 0.72) pool = commonMoves;
    }

    pool.sort(function (a, b) {
      return aiMoveSortValue(b, cfg) - aiMoveSortValue(a, cfg);
    });

    if (cfg.excludeTopFraction && pool.length > 2) {
      var drop = Math.max(1, Math.ceil(pool.length * cfg.excludeTopFraction));
      pool = pool.slice(drop);
    }

    if (!pool.length) pool = moves.slice();

    if (cfg.mode === 'hard') {
      var topN = Math.min(cfg.topCandidates || 2, pool.length);
      var elite = pool.slice(0, topN);
      if (Math.random() < (cfg.optimalPlayChance || 0.97)) return elite[0];
      return elite[Math.floor(Math.random() * elite.length)];
    }

    if (Math.random() < (cfg.weakPickChance || 0)) {
      var weakStart = Math.floor(pool.length / 2);
      var weak = pool.slice(weakStart);
      if (weak.length) return weak[Math.floor(Math.random() * weak.length)];
    }

    if (cfg.mode === 'medium' && pool.length > 1) {
      var band = Math.min(4, pool.length);
      return pool[Math.floor(Math.random() * band)];
    }

    if (cfg.mode === 'easy') {
      var easyBand = Math.min(6, pool.length);
      return pool[Math.floor(Math.random() * easyBand)];
    }

    return pool[0];
  }

  findBestExtensionMove(letters) {
    var words = this.collectExtensionWords(letters);
    var best = null;
    var wi, word, placements, pi, cand, result;

    for (wi = 0; wi < words.length; wi++) {
      word = words[wi];
      placements = this.tryPlaceWord(word, letters, PLAYER.AI);
      for (pi = 0; pi < placements.length; pi++) {
        cand = placements[pi];
        result = this.validateMove(cand.placements, PLAYER.AI);
        if (result.valid && (!best || result.score > best.score)) {
          best = {
            placements: cand.placements,
            score: result.score,
            starsCaptured: result.starsCaptured,
            usedRackIndices: cand.usedRackIndices,
            word: cand.word,
          };
        }
      }
    }

    return best;
  }

  collectExtensionWords(letters) {
    var seen = {};
    var list = [];
    var add = function (w) {
      w = String(w).toUpperCase();
      if (seen[w] || w.length < 2 || !isValidWord(w)) return;
      seen[w] = true;
      list.push(w);
    };

    var i, len, bucket, word;
    for (i = 0; i < TWO_LETTER_WORDS.length; i++) add(TWO_LETTER_WORDS[i]);

    var rackWords = this.filterWordsByRack(letters);
    for (i = 0; i < rackWords.length; i++) add(rackWords[i]);

    var rackSet = {};
    for (i = 0; i < letters.length; i++) {
      rackSet[String(letters[i].letter).toUpperCase()] = true;
    }
    rackSet['*'] = true;

    for (len = 2; len <= 8; len++) {
      bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      var count = 0;
      for (i = 0; i < bucket.length; i++) {
        word = bucket[i].toUpperCase();
        if (seen[word]) continue;
        var usesRack = false;
        var ci;
        for (ci = 0; ci < word.length; ci++) {
          if (rackSet[word.charAt(ci)]) { usesRack = true; break; }
        }
        if (!usesRack) continue;
        add(word);
        count++;
        if (count >= 350) break;
      }
    }

    return list;
  }

  findAnyOpeningMove(letters) {
    var best = null;
    var seen = {};
    var words = this.collectOpeningWords(letters);
    var len, bucket, i, wi, word, used, cand, result;

    for (len = 2; len <= Math.min(8, letters.length); len++) {
      bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      for (i = 0; i < bucket.length; i++) {
        word = bucket[i].toUpperCase();
        if (seen[word]) continue;
        if (!matchWordToRackStatic(word, letters)) continue;
        seen[word] = true;
        words.push(word);
      }
    }

    for (wi = 0; wi < words.length; wi++) {
      word = words[wi];
      used = this.matchWordToRack(word, letters);
      if (!used) continue;

      cand = this.buildOpeningAtCorner(word, used, 'H');
      if (cand) {
        result = this.validateMove(cand.placements, PLAYER.AI);
        if (result.valid && (!best || result.score > best.score)) {
          best = {
            placements: cand.placements,
            score: result.score,
            starsCaptured: result.starsCaptured,
            usedRackIndices: cand.usedRackIndices,
            word: cand.word,
          };
        }
      }

      cand = this.buildOpeningAtCorner(word, used, 'V');
      if (cand) {
        result = this.validateMove(cand.placements, PLAYER.AI);
        if (result.valid && (!best || result.score > best.score)) {
          best = {
            placements: cand.placements,
            score: result.score,
            starsCaptured: result.starsCaptured,
            usedRackIndices: cand.usedRackIndices,
            word: cand.word,
          };
        }
      }
    }

    return best;
  }

  buildOpeningAtCorner(word, used, dir) {
    var right = COLS - 1;
    var top = 0;
    var len = word.length;
    var indices = [];
    var i;

    if (dir === 'H') {
      var hStart = right - len + 1;
      if (hStart < 0) return null;
      for (i = hStart; i <= right; i++) indices.push(top * COLS + i);
    } else {
      if (len > ROWS) return null;
      for (i = 0; i < len; i++) indices.push(i * COLS + right);
    }

    return this.buildOpeningPlacement(word, indices, used);
  }

  bruteForceOpening(letters) {
    var words = this.collectOpeningWords(letters);
    var best = null;
    var wi, word, used, len, right, top, hStart, c, r, hIndices, vIndices, cand, result;

    right = COLS - 1;
    top = 0;

    for (wi = 0; wi < words.length; wi++) {
      word = words[wi];
      used = this.matchWordToRack(word, letters);
      if (!used) continue;
      len = word.length;

      hStart = right - len + 1;
      if (hStart >= 0) {
        hIndices = [];
        for (c = hStart; c <= right; c++) hIndices.push(top * COLS + c);
        cand = this.buildOpeningPlacement(word, hIndices, used);
        if (cand) {
          result = this.validateMove(cand.placements, PLAYER.AI);
          if (result.valid && (!best || result.score > best.score)) {
            best = {
              placements: cand.placements,
              score: result.score,
              starsCaptured: result.starsCaptured,
              usedRackIndices: cand.usedRackIndices,
              word: cand.word,
            };
          }
        }
      }

      if (len <= ROWS) {
        vIndices = [];
        for (r = 0; r < len; r++) vIndices.push(r * COLS + right);
        cand = this.buildOpeningPlacement(word, vIndices, used);
        if (cand) {
          result = this.validateMove(cand.placements, PLAYER.AI);
          if (result.valid && (!best || result.score > best.score)) {
            best = {
              placements: cand.placements,
              score: result.score,
              starsCaptured: result.starsCaptured,
              usedRackIndices: cand.usedRackIndices,
              word: cand.word,
            };
          }
        }
      }
    }

    return best;
  }

  buildOpeningPlacement(word, indices, used) {
    if (indices.length !== word.length) return null;
    var hasCorner = false;
    for (var hi = 0; hi < indices.length; hi++) {
      if (Number(indices[hi]) === Number(START_P2_IDX)) hasCorner = true;
    }
    if (!hasCorner) return null;
    var i;
    for (i = 0; i < indices.length; i++) {
      if (this.board[indices[i]]) return null;
    }
    var placements = new Map();
    var rackPtr = 0;
    for (i = 0; i < indices.length; i++) {
      placements.set(indices[i], {
        letter: used[rackPtr].letter,
        rackIndex: used[rackPtr].i,
        blankAs: used[rackPtr].letter === '*' ? word.charAt(i) : undefined,
      });
      rackPtr++;
    }
    return {
      placements: placements,
      usedRackIndices: used.map(function (u) { return u.i; }),
      word: word,
    };
  }

  collectOpeningWords(letters) {
    var seen = {};
    var list = [];
    var add = function (w) {
      w = String(w).toUpperCase();
      if (seen[w] || w.length < 2 || !isValidWord(w)) return;
      if (!matchWordToRackStatic(w, letters)) return;
      seen[w] = true;
      list.push(w);
    };

    var rackWords = this.filterWordsByRack(letters);
    var i;
    for (i = 0; i < rackWords.length; i++) add(rackWords[i]);
    for (i = 0; i < TWO_LETTER_WORDS.length; i++) add(TWO_LETTER_WORDS[i]);

    return list.sort(function (a, b) { return b.length - a.length; });
  }

  findOpeningMove(letters) {
    return this.bruteForceOpening(letters);
  }

  lastResortOpening(letters) {
    var best = null;
    var i, j, k, word, used, cand, result;
    var seen = {};

    for (i = 0; i < letters.length; i++) {
      for (j = 0; j < letters.length; j++) {
        if (i === j) continue;
        for (k = 0; k < 2; k++) {
          word = (k === 0
            ? String(letters[i].letter).toUpperCase() + String(letters[j].letter).toUpperCase()
            : String(letters[j].letter).toUpperCase() + String(letters[i].letter).toUpperCase());
          if (seen[word] || word.indexOf('*') >= 0) continue;
          seen[word] = true;
          if (!isValidWord(word)) continue;
          used = this.matchWordToRack(word, letters);
          if (!used) continue;

          cand = this.buildOpeningPlacement(word, [COLS - 1 - 1, COLS - 1], used);
          if (cand) {
            result = this.validateMove(cand.placements, PLAYER.AI);
            if (result.valid && (!best || result.score > best.score)) {
              best = {
                placements: cand.placements,
                score: result.score,
                starsCaptured: result.starsCaptured,
                usedRackIndices: cand.usedRackIndices,
                word: cand.word,
              };
            }
          }

          cand = this.buildOpeningPlacement(word, [COLS - 1, COLS - 1 + COLS], used);
          if (cand) {
            result = this.validateMove(cand.placements, PLAYER.AI);
            if (result.valid && (!best || result.score > best.score)) {
              best = {
                placements: cand.placements,
                score: result.score,
                starsCaptured: result.starsCaptured,
                usedRackIndices: cand.usedRackIndices,
                word: cand.word,
              };
            }
          }
        }
      }
    }

    return best;
  }

  generateAIPlacements(letters, needsOpening) {
    const out = [];
    var seen = {};
    var add = function (cand) {
      if (!cand || !cand.placements || cand.placements.size === 0) return;
      var key = cand.word + ':' + [...cand.placements.keys()].sort(function (a, b) { return a - b; }).join(',');
      if (seen[key]) return;
      seen[key] = true;
      out.push(cand);
    };

    if (needsOpening) {
      var rackWords = this.filterWordsByRack(letters);
      var ri;
      for (ri = 0; ri < rackWords.length; ri++) {
        add(this.tryFirstMove(rackWords[ri], letters));
      }
      for (ri = 0; ri < TWO_LETTER_WORDS.length; ri++) {
        add(this.tryFirstMove(TWO_LETTER_WORDS[ri].toUpperCase(), letters));
      }
    }

    var extWords = this.getAIExtensionWords(letters);
    var wj;
    for (wj = 0; wj < extWords.length; wj++) {
      var placed = this.tryPlaceWord(extWords[wj], letters);
      for (var pi = 0; pi < placed.length; pi++) {
        add(placed[pi]);
      }
    }

    return out;
  }

  getAIExtensionWords(letters, limit) {
    limit = limit || 1200;
    var rackSet = {};
    var li;
    for (li = 0; li < letters.length; li++) {
      rackSet[String(letters[li].letter).toUpperCase()] = true;
    }
    rackSet['*'] = true;
    var words = [];
    var seen = {};
    var len;
    for (len = 8; len >= 2; len--) {
      var bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      var i;
      for (i = 0; i < bucket.length; i++) {
        var word = bucket[i].toUpperCase();
        if (seen[word]) continue;
        var usesRack = false;
        var ci;
        for (ci = 0; ci < word.length; ci++) {
          if (rackSet[word.charAt(ci)]) {
            usesRack = true;
            break;
          }
        }
        if (!usesRack) continue;
        seen[word] = true;
        words.push(word);
        if (words.length >= limit) return words;
      }
    }
    return words;
  }

  filterWordsByRack(letters) {
    const rackLetters = letters.map((l) => l.letter.toUpperCase());
    var cacheKey = rackLetters.slice().sort().join('');
    if (_rackWordCache[cacheKey]) return _rackWordCache[cacheKey];

    const canForm = (word) => {
      const pool = [...rackLetters];
      for (const ch of word) {
        const idx = pool.indexOf(ch);
        if (idx >= 0) pool.splice(idx, 1);
        else if (pool.includes('*')) pool.splice(pool.indexOf('*'), 1);
        else return false;
      }
      return true;
    };

    const words = [];
    var maxLen = Math.min(8, rackLetters.length);
    for (var len = maxLen; len >= 2; len--) {
      var bucket = AI_WORDS_BY_LENGTH[len];
      if (!bucket) continue;
      for (var i = 0; i < bucket.length; i++) {
        var word = bucket[i].toUpperCase();
        if (canForm(word)) words.push(word);
      }
      if (words.length >= 400) break;
    }
    var result = words.sort((a, b) => b.length - a.length).slice(0, 300);
    _rackWordCache[cacheKey] = result;
    return result;
  }

  getAnchorCells(forPlayer) {
    var player = forPlayer != null ? forPlayer : PLAYER.AI;
    var startIdx = player === PLAYER.HUMAN ? START_P1_IDX : START_P2_IDX;

    if (!this.playerHasBoardTiles(player)) {
      var territoryAnchors = this.getTerritoryAnchors(player);
      if (territoryAnchors.length) return territoryAnchors;
      return [startIdx];
    }

    const anchors = new Set();
    for (let i = 0; i < this.board.length; i++) {
      if (this.board[i]) continue;
      for (const n of this.adjacentIndices(i)) {
        if (!this.board[n]) continue;
        if (this.boardsLinked) {
          anchors.add(i);
          break;
        }
        var owner = this.cellOwner(this.board[n]);
        if (owner === player) {
          anchors.add(i);
          break;
        }
      }
    }

    var anchorList = [...anchors];
    if (anchorList.length === 0) {
      return [startIdx];
    }
    return anchorList;
  }

  getTerritoryAnchors(player) {
    var startIdx = player === PLAYER.HUMAN ? START_P1_IDX : START_P2_IDX;
    var startR = Math.floor(startIdx / COLS);
    var startC = startIdx % COLS;
    var anchors = new Set();
    var i, r, c, n, inTerritory;

    for (i = 0; i < this.board.length; i++) {
      if (!this.board[i] || !this.boardCellLetter(this.board[i])) continue;
      r = Math.floor(i / COLS);
      c = i % COLS;
      if (player === PLAYER.AI) {
        inTerritory = r <= startR && c >= startC;
      } else {
        inTerritory = r >= startR && c <= startC;
      }
      if (!inTerritory) continue;
      for (n of this.adjacentIndices(i)) {
        if (!this.board[n]) anchors.add(n);
      }
    }
    return [...anchors];
  }

  tryFirstMove(word, letters) {
    const startIdx = START_P2_IDX;
    const used = this.matchWordToRack(word, letters);
    if (!used) return null;

    const attempt = (indices) => {
      if (indices.length !== word.length) return null;
      if (!indices.includes(startIdx)) return null;
      for (var ai = 0; ai < indices.length; ai++) {
        if (this.board[indices[ai]]) return null;
      }
      const placements = new Map();
      let rackPtr = 0;
      indices.forEach((idx, k) => {
        placements.set(idx, {
          letter: used[rackPtr].letter,
          rackIndex: used[rackPtr].i,
          blankAs: used[rackPtr].letter === '*' ? word[k] : undefined,
        });
        rackPtr++;
      });
      return {
        placements,
        usedRackIndices: used.map((u) => u.i),
        word,
      };
    };

    const len = word.length;
    const top = 0;
    const right = COLS - 1;

    const horiz = [];
    for (let c = right - len + 1; c <= right; c++) {
      if (c >= 0) horiz.push(top * COLS + c);
    }
    const fromHoriz = attempt(horiz);
    if (fromHoriz) return fromHoriz;

    const vert = [];
    for (let r = 0; r < len; r++) {
      if (r < ROWS) vert.push(r * COLS + right);
    }
    return attempt(vert);
  }

  tryPlaceWord(word, letters, forPlayer) {
    const results = [];
    const player = forPlayer != null ? forPlayer : PLAYER.AI;
    const anchors = this.getAnchorCells(player);

    for (const anchor of anchors) {
      for (const dir of ['H', 'V']) {
        for (let offset = 0; offset < word.length; offset++) {
          const indices = [];
          let ok = true;
          for (let k = 0; k < word.length; k++) {
            let c, r;
            if (dir === 'H') {
              c = (anchor % COLS) - offset + k;
              r = Math.floor(anchor / COLS);
            } else {
              c = anchor % COLS;
              r = Math.floor(anchor / COLS) - offset + k;
            }
            if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { ok = false; break; }
            const idx = r * COLS + c;
            if (this.board[idx]) {
              var boardLetter = this.boardCellLetter(this.board[idx]);
              if (boardLetter !== word[k]) { ok = false; break; }
            }
            indices.push(idx);
          }
          if (!ok) continue;

          const needed = indices
            .map((idx, k) => (!this.board[idx] ? word[k] : null))
            .filter(Boolean)
            .join('');
          const used = this.matchWordToRack(needed, letters);
          if (!used) continue;

          const placements = new Map();
          let rackPtr = 0;
          for (let k = 0; k < word.length; k++) {
            const idx = indices[k];
            if (this.board[idx]) continue;
            const u = used[rackPtr++];
            placements.set(idx, {
              letter: u.letter,
              rackIndex: u.i,
              blankAs: u.letter === '*' ? word[k] : undefined,
            });
          }
          if (placements.size === 0) continue;
          results.push({
            placements,
            usedRackIndices: [...placements.values()].map((p) => p.rackIndex),
            word,
          });
        }
      }
    }
    return results;
  }

  matchWordToRack(word, letters) {
    return matchWordToRackStatic(word, letters);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

  try {
    function bootGame() {
      try {
        document.body.dataset.qwertyBuild = QWERTY_BUILD;
        if (typeof console !== 'undefined' && console.info) {
          console.info('QWERTY build ' + QWERTY_BUILD);
        }
        new Game();
      } catch (err) {
        bootError('Game failed to start: ' + (err && err.message ? err.message : err));
        var menu = document.getElementById('main-menu');
        if (menu) {
          menu.hidden = false;
          menu.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('menu-visible');
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootGame);
    } else {
      bootGame();
    }
  } catch (err) {
    bootError('Game failed to start: ' + err.message);
  }
})();
