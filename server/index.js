'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const engine = require('../game-engine.js');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3001;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Legacy shared lobby code — discouraged; Create no longer uses it. */
const DEFAULT_ROOM_CODE = 'MAIN';
/** Canonical public site for share links (remote playtesting). */
const PRODUCTION_PUBLIC_URL = 'https://qwerty-game.onrender.com';
const PUBLIC_BASE_URL = String(
  process.env.PUBLIC_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ''
).replace(/\/$/, '');
const ROOM_TTL_MS = 60 * 60 * 1000;
const RECONNECT_GRACE_MS = 2 * 60 * 1000;

/** Cached public URL from a local ngrok agent (http://127.0.0.1:4040). */
var cachedNgrokUrl = null;
var ngrokFetchedAt = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function loadDictionary() {
  const dictPath = path.join(ROOT, 'dictionary.js');
  const src = fs.readFileSync(dictPath, 'utf8');
  const sandbox = { window: {} };
  const vm = require('vm');
  vm.runInNewContext(src, sandbox, { filename: 'dictionary.js' });
  const list = sandbox.window.QWERTY_WORD_LIST;
  if (!list || !list.length) throw new Error('Failed to load dictionary.js');
  engine.initDictionary(list);
  console.log('Dictionary loaded (' + list.length + ' words)');
}

function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Normalize a player-chosen room code (4–6 chars from CODE_CHARS). */
function normalizeRoomCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length < 4 || code.length > 6) return null;
  /* MAIN is the default lobby; allow its I even though CODE_CHARS omits I/O/0/1. */
  if (code === DEFAULT_ROOM_CODE) return code;
  for (let i = 0; i < code.length; i++) {
    if (CODE_CHARS.indexOf(code[i]) < 0) return null;
  }
  return code;
}

/** Normalize a non-blank code; blank returns null (no more silent MAIN default). */
function resolveRoomCode(raw, opts) {
  const allowDefault = opts && opts.allowDefault === true;
  if (raw == null || String(raw).trim() === '') {
    return allowDefault ? DEFAULT_ROOM_CODE : null;
  }
  return normalizeRoomCode(raw);
}

function logRoomCount(action, code) {
  console.log('[rooms]', action, code || '', '(' + rooms.size + ' active)');
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  console.warn('[ws] dropped message (socket not open):', msg && msg.type);
  return false;
}

function sanitizeName(name, seatFallback) {
  const s = String(name || '').trim().slice(0, 20);
  if (s) return s;
  if (seatFallback === 0) return 'Deb';
  if (seatFallback === 1) return 'Blake';
  return 'Player';
}

/** @type {Map<string, object>} */
const rooms = new Map();

function getRoomBySocket(ws) {
  for (const room of rooms.values()) {
    if (room.host === ws || room.guest === ws) return room;
  }
  return null;
}

function clearReconnectTimer(room, playerIdx) {
  var key = playerIdx === 0 ? 'hostReconnectTimer' : 'guestReconnectTimer';
  if (room[key]) {
    clearTimeout(room[key]);
    room[key] = null;
  }
}

function scheduleReconnectTimeout(room, playerIdx) {
  clearReconnectTimer(room, playerIdx);
  var key = playerIdx === 0 ? 'hostReconnectTimer' : 'guestReconnectTimer';
  room[key] = setTimeout(function () {
    room[key] = null;
    var stillOut = playerIdx === 0 ? !room.host : !room.guest;
    if (!stillOut || !rooms.has(room.code)) return;
    broadcastRoom(room, { type: 'opponent_left', playerIndex: playerIdx }, null);
    destroyRoom(room.code);
  }, RECONNECT_GRACE_MS);
}

function playerIndex(room, ws) {
  if (room.host === ws) return 0;
  if (room.guest === ws) return 1;
  return -1;
}

function broadcastRoom(room, msg, exceptWs) {
  [room.host, room.guest].forEach(function (sock) {
    if (sock && sock !== exceptWs) send(sock, msg);
  });
}

function broadcastState(room, event, extra) {
  const base = Object.assign({ type: 'state_update', event: event || '' }, extra || {});
  [room.host, room.guest].forEach(function (sock, idx) {
    if (!sock) return;
    const payload = Object.assign({}, base, {
      state: engine.getClientView(room.state, idx),
      playerIndex: idx,
    });
    attachRoomNames(payload, room, idx);
    send(sock, payload);
  });
}

/** Attach host/guest + self/opponent names so both clients refresh roster labels. */
function attachRoomNames(payload, room, idx) {
  if (!payload || !room) return payload;
  var hostName = room.hostName || 'Deb';
  var guestName = room.guestName || 'Blake';
  payload.hostName = hostName;
  payload.guestName = guestName;
  payload.selfName = idx === 0 ? hostName : guestName;
  payload.opponentName = idx === 0 ? guestName : hostName;
  return payload;
}

function resetRematchVotes(room) {
  room.rematchVotes = [false, false];
}

function buildGameStartMessage(room, idx) {
  return attachRoomNames({
    type: 'game_start',
    playerIndex: idx,
    state: engine.getClientView(room.state, idx),
  }, room, idx);
}

function buildHostOpponentJoinedMessage(room) {
  return attachRoomNames({
    type: 'opponent_joined',
    playerIndex: 0,
    state: room.state ? engine.getClientView(room.state, 0) : null,
  }, room, 0);
}

function deliverHostGameStart(room) {
  if (!room || !room.host || !room.state) return false;
  var ok = send(room.host, buildGameStartMessage(room, 0));
  send(room.host, buildHostOpponentJoinedMessage(room));
  return ok;
}

function deliverGuestGameStart(room) {
  if (!room || !room.guest || !room.state) return false;
  return send(room.guest, buildGameStartMessage(room, 1));
}

function scheduleGuestGameStartRetries(room) {
  [250, 750, 1500, 3000].forEach(function (delay) {
    setTimeout(function () {
      if (!rooms.has(room.code) || !room.started || !room.state) return;
      if (!room.guest || room.guest.readyState !== room.guest.OPEN) {
        console.warn('[startGame] guest socket still not open for room', room.code);
        return;
      }
      console.log('[startGame] retrying guest delivery for room', room.code);
      deliverGuestGameStart(room);
    }, delay);
  });
}

function scheduleHostGameStartRetries(room) {
  [250, 750, 1500, 3000].forEach(function (delay) {
    setTimeout(function () {
      if (!rooms.has(room.code) || !room.started || !room.state) return;
      if (!room.host || room.host.readyState !== room.host.OPEN) {
        console.warn('[startGame] host socket still not open for room', room.code);
        return;
      }
      console.log('[startGame] retrying host delivery for room', room.code);
      deliverHostGameStart(room);
    }, delay);
  });
}

function startGame(room) {
  try {
    resetRematchVotes(room);
    room.state = engine.createInitialState();
    room.state.turnEndsAt = Date.now() + engine.TURN_MS;
    room.started = true;
    room.turnTimer = setTimeout(function () {
      handleTurnTimeout(room);
    }, engine.TURN_MS);

    var hostOk = deliverHostGameStart(room);
    var guestOk = deliverGuestGameStart(room);
    if (!hostOk) {
      console.warn('[startGame] host socket not open for room', room.code, '— scheduling retries');
      scheduleHostGameStartRetries(room);
    }
    if (!guestOk) {
      console.warn('[startGame] guest socket not open for room', room.code, '— scheduling retries');
      scheduleGuestGameStartRetries(room);
    }
  } catch (err) {
    console.error('[startGame] failed for room', room && room.code, err);
    [room.host, room.guest].forEach(function (sock) {
      if (!sock) return;
      send(sock, {
        type: 'error',
        message: 'Could not start game — please refresh and try again.',
      });
    });
  }
}

function handleRematch(room, ws) {
  if (!room.guest) {
    send(ws, { type: 'error', message: 'Waiting for an opponent to join.' });
    return;
  }
  if (!room.state || !room.state.gameOver) {
    send(ws, { type: 'error', message: 'The game is not finished yet.' });
    return;
  }
  const pi = playerIndex(room, ws);
  if (pi < 0) {
    send(ws, { type: 'error', message: 'Not connected to this game room.' });
    return;
  }
  if (!room.rematchVotes) resetRematchVotes(room);
  room.rematchVotes[pi] = true;

  broadcastRoom(room, {
    type: 'rematch_status',
    votes: room.rematchVotes.slice(),
    player: pi,
  }, null);

  if (room.rematchVotes[0] && room.rematchVotes[1]) {
    console.log('[rematch] starting new game in room', room.code);
    startGame(room);
  }
}

function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function scheduleTurnTimer(room) {
  clearTurnTimer(room);
  if (!room.state || room.state.gameOver) return;
  room.state.turnEndsAt = Date.now() + engine.TURN_MS;
  room.turnTimer = setTimeout(function () {
    handleTurnTimeout(room);
  }, engine.TURN_MS);
}

function handleTurnTimeout(room) {
  if (!room.state || room.state.gameOver) return;
  const timedOut = room.state.currentPlayer;
  engine.advanceTurn(room.state);
  scheduleTurnTimer(room);
  broadcastState(room, 'turn_timeout', {
    message: 'Player ' + timedOut + ' ran out of time.',
    timedOutPlayer: timedOut,
  });
}

function destroyRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearTurnTimer(room);
  clearReconnectTimer(room, 0);
  clearReconnectTimer(room, 1);
  rooms.delete(code);
  logRoomCount('destroyed', code);
}

/** Intentional leave — free the socket so the same tab can create/join another room. */
function handleLeaveRoom(ws) {
  const room = getRoomBySocket(ws);
  if (!room) {
    send(ws, { type: 'left_room' });
    return;
  }
  const idx = playerIndex(room, ws);
  const code = room.code;
  if (idx === 0) room.host = null;
  else if (idx === 1) room.guest = null;
  ws.roomCode = null;
  broadcastRoom(room, { type: 'opponent_left', playerIndex: idx }, ws);
  destroyRoom(code);
  send(ws, { type: 'left_room', code: code });
}

function handleDisconnect(ws) {
  const room = getRoomBySocket(ws);
  if (!room) return;
  const idx = playerIndex(room, ws);
  if (idx < 0) return;

  if (idx === 0) {
    room.host = null;
  } else {
    room.guest = null;
  }
  ws.roomCode = null;

  if (room.started && room.state && !room.state.gameOver) {
    broadcastRoom(room, {
      type: 'opponent_disconnected',
      playerIndex: idx,
      graceMs: RECONNECT_GRACE_MS,
    }, null);
    scheduleReconnectTimeout(room, idx);
    return;
  }

  broadcastRoom(room, { type: 'opponent_left', playerIndex: idx }, ws);
  destroyRoom(room.code);
}

function rejectMove(room, ws, reason) {
  const pi = playerIndex(room, ws);
  const payload = { type: 'move_rejected', reason: reason };
  if (room && room.state && pi >= 0) {
    payload.state = engine.getClientView(room.state, pi);
  }
  send(ws, payload);
}

function handlePlay(room, ws, data) {
  try {
    if (!room.started || !room.state) {
      send(ws, { type: 'error', message: 'Game has not started.' });
      return;
    }
    const pi = playerIndex(room, ws);
    if (pi < 0) {
      send(ws, { type: 'error', message: 'Not connected to this game room.' });
      return;
    }
    if (room.state.currentPlayer !== pi) {
      rejectMove(room, ws, 'Not your turn.');
      return;
    }
    if (room.state.gameOver) {
      rejectMove(room, ws, 'Game is over.');
      return;
    }

    const placements = data.placements;
    if (!placements || !placements.length) {
      rejectMove(room, ws, 'No tiles placed.');
      return;
    }

    const playOpts = {};
    if (data.word) playOpts.intendedWord = String(data.word).toUpperCase();
    if (data.cells && data.cells.length) {
      playOpts.wordCells = data.cells.map(function (c) { return Number(c); });
    }

    const result = engine.applyPlay(room.state, placements, pi, playOpts);
    if (!result.valid) {
      console.log('[play] rejected player', pi, ':', result.reason);
      rejectMove(room, ws, result.reason);
      return;
    }

    console.log('[play] accepted player', pi, ':', result.word, '+' + result.score);

    engine.checkGameOver(room.state);
    if (!room.state.gameOver) {
      engine.advanceTurn(room.state);
      scheduleTurnTimer(room);
    } else {
      clearTurnTimer(room);
      resetRematchVotes(room);
    }

    var placedIdxs = placements.map(function (p) {
      if (p == null) return null;
      if (typeof p === 'number') return Number(p);
      return Number(p.idx != null ? p.idx : p.index);
    }).filter(function (n) {
      return Number.isFinite(n) && n >= 0;
    });

    broadcastState(room, 'play', {
      word: result.word,
      score: result.score,
      player: pi,
      bingo: !!result.bingo,
      bingoPoints: result.bingoPoints || 0,
      linkBonus: result.linkBonus || 0,
      letterScore: result.letterScore != null ? result.letterScore : null,
      starsCaptured: result.starsCaptured || 0,
      starPoints: result.starPoints || 0,
      /* Indices of newly placed tiles — clients highlight for 5s. */
      placements: placedIdxs,
      cells: data.cells && data.cells.length
        ? data.cells.map(function (c) { return Number(c); }).filter(function (n) {
            return Number.isFinite(n);
          })
        : placedIdxs,
    });
  } catch (err) {
    console.error('[play] error:', err);
    rejectMove(room, ws, 'Server error processing move.');
  }
}

function handleExchange(room, ws, data) {
  if (!room.started || !room.state) {
    send(ws, { type: 'error', message: 'Game has not started.' });
    return;
  }
  const pi = playerIndex(room, ws);
  if (pi < 0) return;
  if (room.state.currentPlayer !== pi) {
    rejectMove(room, ws, 'Not your turn.');
    return;
  }
  if (room.state.gameOver) {
    rejectMove(room, ws, 'Game is over.');
    return;
  }

  const slots = data.slots;
  const result = engine.applyExchange(room.state, pi, slots);
  if (!result.valid) {
    rejectMove(room, ws, result.reason);
    return;
  }

  engine.advanceTurn(room.state);
  scheduleTurnTimer(room);
  broadcastState(room, 'exchange', { player: pi, count: result.exchanged });
}

function handleMessage(ws, raw) {
  let data;
  try {
    data = JSON.parse(String(raw));
  } catch (_) {
    send(ws, { type: 'error', message: 'Invalid JSON.' });
    return;
  }

  const type = data.type;

  if (type === 'ping') {
    send(ws, { type: 'pong' });
    return;
  }

  if (type === 'leave_room') {
    handleLeaveRoom(ws);
    return;
  }

  if (type === 'create_room') {
    if (getRoomBySocket(ws)) {
      send(ws, { type: 'error', message: 'Already in a room. Leave it first.' });
      return;
    }
    let code;
    let autoGenerated = false;
    if (data.code != null && String(data.code).trim() !== '') {
      code = normalizeRoomCode(data.code);
      if (!code) {
        send(ws, {
          type: 'error',
          message: 'Invalid room code. Use 4–6 characters (A–Z, 2–9; no I/O/0/1).',
        });
        return;
      }
      if (code === DEFAULT_ROOM_CODE) {
        send(ws, {
          type: 'error',
          message:
            'Please pick a unique room code instead of MAIN so other players don’t join your game by accident.',
        });
        return;
      }
      if (rooms.has(code)) {
        send(ws, {
          type: 'error',
          message: 'Room code "' + code + '" is already in use. Join it or pick another.',
        });
        return;
      }
    } else {
      /* Blank create → always mint a private unique code (never MAIN). */
      do {
        code = makeRoomCode();
      } while (rooms.has(code));
      autoGenerated = true;
    }

    const room = {
      code: code,
      host: ws,
      guest: null,
      hostName: sanitizeName(data.nickname, 0),
      guestName: '',
      started: false,
      state: null,
      rematchVotes: [false, false],
      createdAt: Date.now(),
    };
    rooms.set(code, room);
    ws.roomCode = code;
    logRoomCount('created', code);
    var createMsg = buildRoomShareMessage(code);
    if (autoGenerated) {
      createMsg =
        'Your private room is ' +
        code +
        '. Share this code (or Copy link) with your friend — same code = same game.';
    }
    send(ws, {
      type: 'room_created',
      code: code,
      playerIndex: 0,
      selfName: room.hostName,
      hostName: room.hostName,
      guestName: '',
      opponentName: '',
      defaultRoom: false,
      autoGenerated: autoGenerated,
      message: createMsg,
      hostInfo: getHostInfo(),
    });
    return;
  }

  if (type === 'join_room') {
    if (getRoomBySocket(ws)) {
      send(ws, { type: 'error', message: 'Already in a room. Leave it first.' });
      return;
    }
    const code = resolveRoomCode(data.code);
    if (!code) {
      send(ws, {
        type: 'error',
        message: 'Enter the room code your friend shared (4–6 characters).',
      });
      return;
    }
    if (code === DEFAULT_ROOM_CODE) {
      send(ws, {
        type: 'error',
        message:
          'MAIN is no longer used. Ask your friend for their unique room code, or Create your own.',
      });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      send(ws, { type: 'error', message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (Date.now() - room.createdAt > ROOM_TTL_MS) {
      destroyRoom(code);
      send(ws, { type: 'error', message: 'Room expired. Ask host to create a new one.' });
      return;
    }

    const nick = sanitizeName(data.nickname, data.role === 'host' ? 0 : 1);
    const wantHost =
      data.role === 'host' ||
      (!data.role && !room.host && room.started && room.hostName && nick === room.hostName);

    /* Host reconnect after drop (grace window). */
    if (wantHost && room.started && room.state && !room.host) {
      room.host = ws;
      room.hostName = nick || room.hostName || 'Deb';
      ws.roomCode = code;
      clearReconnectTimer(room, 0);
      logRoomCount('host-rejoined', code);
      send(ws, attachRoomNames({
        type: 'rejoined',
        code: code,
        playerIndex: 0,
        state: engine.getClientView(room.state, 0),
      }, room, 0));
      broadcastRoom(room, attachRoomNames({
        type: 'opponent_reconnected',
        playerIndex: 0,
      }, room, 1), ws);
      return;
    }

    if (room.guest) {
      if (room.guest.readyState === 1) {
        send(ws, { type: 'error', message: 'Room is full.' });
        return;
      }
      room.guest = null;
    }
    if (room.host && room.host.readyState !== 1 && !room.started) {
      /* Stale waiting host socket — allow reclaim only via create, not join. */
    }

    ws.roomCode = code;

    if (room.started && room.state && room.guestName) {
      room.guest = ws;
      room.guestName = nick;
      clearReconnectTimer(room, 1);
      logRoomCount('guest-rejoined', code);
      send(ws, attachRoomNames({
        type: 'rejoined',
        code: code,
        playerIndex: 1,
        state: engine.getClientView(room.state, 1),
      }, room, 1));
      broadcastRoom(room, attachRoomNames({
        type: 'opponent_reconnected',
        playerIndex: 1,
      }, room, 0), ws);
      return;
    }

    room.guest = ws;
    room.guestName = nick;

    startGame(room);
    logRoomCount('joined', code);

    send(ws, attachRoomNames({
      type: 'joined',
      code: code,
      playerIndex: 1,
      state: room.state ? engine.getClientView(room.state, 1) : null,
    }, room, 1));
    return;
  }

  if (type === 'request_state') {
    const room = getRoomBySocket(ws);
    if (!room || !room.started || !room.state) {
      send(ws, { type: 'error', message: 'Game not ready yet.' });
      return;
    }
    const pi = playerIndex(room, ws);
    if (pi < 0) {
      send(ws, { type: 'error', message: 'Not connected to this game room.' });
      return;
    }
    send(ws, buildGameStartMessage(room, pi));
    if (pi === 0 && room.guest) {
      send(ws, buildHostOpponentJoinedMessage(room));
    }
    return;
  }

  const room = getRoomBySocket(ws);
  if (!room) {
    send(ws, { type: 'error', message: 'Not in a room.' });
    return;
  }

  if (type === 'play') {
    handlePlay(room, ws, data);
    return;
  }

  if (type === 'exchange') {
    handleExchange(room, ws, data);
    return;
  }

  if (type === 'chat') {
    const pi = playerIndex(room, ws);
    const name = pi === 0 ? room.hostName : room.guestName;
    broadcastRoom(room, {
      type: 'chat',
      from: pi,
      name: name,
      text: String(data.text || '').trim().slice(0, 200),
    }, null);
    return;
  }

  if (type === 'resign') {
    if (!room.state) return;
    room.state.gameOver = true;
    const pi = playerIndex(room, ws);
    room.state.winner = 1 - pi;
    clearTurnTimer(room);
    resetRematchVotes(room);
    broadcastState(room, 'resign', { resigned: pi });
    return;
  }

  if (type === 'rematch') {
    handleRematch(room, ws);
    return;
  }

  send(ws, { type: 'error', message: 'Unknown message type: ' + type });
}

function serveApi(req, res, urlPath) {
  if (urlPath === '/api/host-info') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(getHostInfo()));
    return true;
  }
  return false;
}

function resolveStaticPath(urlPath) {
  const rel = String(urlPath || '').replace(/^\/+/, '');
  const fromPublic = path.normalize(path.join(PUBLIC_DIR, rel));
  if (
    fromPublic.startsWith(PUBLIC_DIR) &&
    fs.existsSync(fromPublic) &&
    fs.statSync(fromPublic).isFile()
  ) {
    return fromPublic;
  }
  const fromRoot = path.normalize(path.join(ROOT, rel));
  if (!fromRoot.startsWith(ROOT)) return null;
  return fromRoot;
}

function mimeFor(filePath, data) {
  if (
    data &&
    data.length >= 12 &&
    data.slice(0, 4).toString('ascii') === 'RIFF' &&
    data.slice(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (data && data.length >= 3 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (data && data.length >= 3 && data.slice(0, 3).toString('ascii') === 'ID3') {
    return 'audio/mpeg';
  }
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  var query = '';
  var qAt = req.url.indexOf('?');
  if (qAt >= 0) query = req.url.slice(qAt);
  if (serveApi(req, res, urlPath)) return;
  /* Join / room deep links always open the game, not the marketing landing page. */
  if (
    urlPath === '/' &&
    (/[?&]code=/i.test(query) || /(?:^|[?&])guest(?:&|$|=)/i.test(query))
  ) {
    res.writeHead(302, { Location: '/play.html' + query });
    res.end();
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/play' || urlPath === '/game') urlPath = '/play.html';
  if (urlPath === '/favicon.ico') urlPath = '/images/favicon.png';

  const filePath = resolveStaticPath(urlPath);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeFor(filePath, data),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  });
}

loadDictionary();

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server: server });

wss.on('connection', function (ws) {
  ws.on('message', function (raw) {
    handleMessage(ws, raw);
  });
  ws.on('close', function () {
    handleDisconnect(ws);
  });
  send(ws, { type: 'hello', build: 'phase2.5-1', hostInfo: getHostInfo() });
});

function isVpnInterface(name) {
  return /nord|vpn|tap|tun|hyper-v|vmware|virtual|bluetooth|loopback|wireguard|hamachi|zerotier/i.test(name);
}

function isHomeLanIp(addr) {
  if (/^192\.168\./.test(addr)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true;
  if (/^10\./.test(addr)) {
    if (/^10\.5\.0\./.test(addr)) return false;
    if (/^10\.8\./.test(addr)) return false;
    return true;
  }
  return false;
}

function lanIpSortValue(addr) {
  if (/^192\.168\./.test(addr)) return 0;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return 1;
  if (/^10\./.test(addr)) return 2;
  return 3;
}

function localNetworkUrls() {
  const entries = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (name) {
    if (isVpnInterface(name)) return;
    ifaces[name].forEach(function (iface) {
      if ((iface.family !== 'IPv4' && iface.family !== 4) || iface.internal) return;
      if (!isHomeLanIp(iface.address)) return;
      entries.push({
        name: name,
        address: iface.address,
        url: 'http://' + iface.address + ':' + PORT + '/',
      });
    });
  });
  entries.sort(function (a, b) {
    return lanIpSortValue(a.address) - lanIpSortValue(b.address);
  });
  return entries.map(function (e) { return e.url; });
}

function getLanIpFromEnv() {
  var ip = String(process.env.QWERTY_LAN_IP || '').trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  if (ip === '127.0.0.1' || !isHomeLanIp(ip)) return null;
  return ip;
}

function urlFromLanIp(ip) {
  return 'http://' + ip + ':' + PORT + '/';
}

function getPreferredLanUrl() {
  const urls = localNetworkUrls();
  if (urls.length) return urls[0];
  var envIp = getLanIpFromEnv();
  if (envIp) return urlFromLanIp(envIp);
  return null;
}

/**
 * Resolve a public base URL for internet sharing.
 * Order: PUBLIC_BASE_URL / RENDER_EXTERNAL_URL → ngrok → Render production fallback.
 */
function getPublicBaseUrl() {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  refreshNgrokUrlFromAgent();
  if (cachedNgrokUrl) return cachedNgrokUrl;
  /* On Render (or when explicitly deployed), always expose the public site URL. */
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return PRODUCTION_PUBLIC_URL;
  }
  return null;
}

function isPrivateOrLocalHostUrl(url) {
  if (!url || typeof url !== 'string') return true;
  return /127\.0\.0\.1|localhost|:\s*$|\/\/10\.\d+\.\d+\.\d+|\/\/192\.168\.\d+\.\d+|\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/i.test(
    url
  );
}

/** Poll ngrok's local inspector API when a tunnel is running beside this server. */
function refreshNgrokUrlFromAgent() {
  var now = Date.now();
  if (now - ngrokFetchedAt < 4000) return;
  ngrokFetchedAt = now;
  var req = http.get(
    {
      hostname: '127.0.0.1',
      port: 4040,
      path: '/api/tunnels',
      timeout: 600,
    },
    function (res) {
      var body = '';
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        try {
          var data = JSON.parse(body);
          var tunnels = data.tunnels || [];
          var httpsTunnel = null;
          var anyTunnel = null;
          var i;
          for (i = 0; i < tunnels.length; i++) {
            var u = tunnels[i] && tunnels[i].public_url;
            if (!u) continue;
            if (!anyTunnel) anyTunnel = u;
            if (String(u).indexOf('https://') === 0) {
              httpsTunnel = u;
              break;
            }
          }
          var picked = httpsTunnel || anyTunnel || null;
          cachedNgrokUrl = picked ? String(picked).replace(/\/$/, '') : null;
        } catch (_) {
          cachedNgrokUrl = null;
        }
      });
    }
  );
  req.on('error', function () {
    cachedNgrokUrl = null;
  });
  req.on('timeout', function () {
    req.destroy();
    cachedNgrokUrl = null;
  });
}

function getHostInfo() {
  var lan = localNetworkUrls();
  var envIp = getLanIpFromEnv();
  if (envIp && !lan.some(function (u) { return u.indexOf('://' + envIp + ':') >= 0; })) {
    lan.unshift(urlFromLanIp(envIp));
  }
  var publicBase = getPublicBaseUrl();
  if (publicBase && isPrivateOrLocalHostUrl(publicBase)) {
    publicBase = null;
  }
  const publicUrl = publicBase ? publicBase + '/' : null;
  const preferredLanUrl = getPreferredLanUrl();
  var viaNgrok = !!(publicBase && /ngrok/i.test(publicBase));
  var viaRender = !!(publicBase && /onrender\.com/i.test(publicBase));
  return {
    port: PORT,
    localUrl: 'http://127.0.0.1:' + PORT + '/',
    lanUrls: lan,
    preferredLanUrl: preferredLanUrl,
    publicUrl: publicUrl,
    productionUrl: PRODUCTION_PUBLIC_URL + '/',
    viaNgrok: viaNgrok,
    viaRender: viaRender,
    shareHint: publicUrl
      ? 'Share the public Copy link + your unique room code with friends anywhere.'
      : preferredLanUrl
        ? 'Local Wi‑Fi only. For friends anywhere, play at ' + PRODUCTION_PUBLIC_URL + ' instead.'
        : 'Open ' + PRODUCTION_PUBLIC_URL + ' to share a public link that works anywhere.',
  };
}

function buildRoomShareMessage(code) {
  var info = getHostInfo();
  /* Prefer real publicUrl (Render/ngrok). Never invent a production link for a local-only room. */
  var base = info.publicUrl || info.preferredLanUrl;
  if (base) {
    var where = info.publicUrl
      ? ' (public internet — works anywhere)'
      : ' (same Wi-Fi only)';
    return (
      'Send Blake: ' +
      base.replace(/\/+$/, '') +
      '/play.html?guest&code=' +
      code +
      where
    );
  }
  return (
    'Room ' +
    code +
    ' — Blake must open http://YOUR-WIFI-IP:' +
    PORT +
    '/play.html?guest&code=' +
    code +
    ' from the server window. NOT 127.0.0.1. Off Wi‑Fi? See NGROK.md.'
  );
}

function openLocalBrowser() {
  if (process.env.QWERTY_OPEN_BROWSER === '0') return;
  var url = 'http://127.0.0.1:' + PORT + '/';
  if (process.platform === 'win32') {
    exec('start "" "' + url + '"');
  } else {
    exec('xdg-open "' + url + '"');
  }
}

server.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    console.error('');
    console.error('ERROR: Port ' + PORT + ' is already in use.');
    console.error('Run STOP ONLINE SERVER.bat, then OPEN ONLINE GAME.bat again.');
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('QWERTY game server is running.');
  console.log('  This computer:  http://127.0.0.1:' + PORT + '/');
  openLocalBrowser();
  refreshNgrokUrlFromAgent();
  setInterval(refreshNgrokUrlFromAgent, 8000);
  const lan = localNetworkUrls();
  if (lan.length) {
    console.log('');
    console.log('  Phone / tablet on same Wi-Fi — share this link:');
    console.log('    ' + lan[0]);
    if (lan.length > 1) {
      console.log('  Other addresses on this PC (try if the first fails):');
      lan.slice(1).forEach(function (url) {
        console.log('    ' + url);
      });
    }
    console.log('');
    console.log('  If phone says "site can\'t be reached":');
    console.log('    1) Run FIX PHONE ACCESS.bat (allows Windows Firewall)');
    console.log('    2) Turn OFF VPN (NordVPN etc.) on this PC while hosting');
    console.log('    3) Phone must use Wi-Fi — not cellular data');
  }
  console.log('');
  console.log('  Same computer: open a second tab or use OPEN LOCAL TWO-TAB TEST.bat');
  console.log('  Different device (same Wi-Fi): friend runs JOIN FRIEND GAME.bat');
  console.log('  Different homes (quick test): OPEN WITH NGROK.bat — see NGROK.md');
  console.log('  Different homes (always-on): deploy — see deploy/PHASE2.5-CROSS-DEVICE.md');
  if (PUBLIC_BASE_URL) {
    console.log('');
    console.log('  Public URL (PUBLIC_BASE_URL): ' + PUBLIC_BASE_URL + '/');
  }
  console.log('');
});
