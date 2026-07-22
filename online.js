/**
 * QWERTY Phase 2.5 — WebSocket client for friend-code 1v1 (cross-device).
 */
(function (root) {
  'use strict';

  var ws = null;
  var handlers = {};
  var reconnectTimer = null;
  var pingInterval = null;
  var lastJoinCode = null;
  var lastJoinNickname = null;
  var lastJoinRole = null; /* 'host' | 'guest' | null */
  var reconnectAttempts = 0;
  var MAX_RECONNECT_ATTEMPTS = 10;
  var SESSION_KEY = 'qwerty_online_session';

  function saveStoredSession(code, nickname, role) {
    lastJoinCode = String(code || '').trim().toUpperCase();
    lastJoinNickname = nickname || 'Player';
    lastJoinRole = role === 'host' || role === 'guest' ? role : lastJoinRole;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          code: lastJoinCode,
          nickname: lastJoinNickname,
          role: lastJoinRole || undefined,
        })
      );
    } catch (_) {}
  }

  function loadStoredSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.code) {
        lastJoinCode = String(data.code).trim().toUpperCase();
        lastJoinNickname = data.nickname || 'Player';
        lastJoinRole = data.role === 'host' || data.role === 'guest' ? data.role : null;
        return {
          code: lastJoinCode,
          nickname: lastJoinNickname,
          role: lastJoinRole,
        };
      }
    } catch (_) {}
    return null;
  }

  function clearStoredSession() {
    lastJoinCode = null;
    lastJoinNickname = null;
    lastJoinRole = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  loadStoredSession();

  /**
   * WebSocket URL for real-time play.
   * Same-origin by default — works for LAN, ngrok (wss:// when page is https://),
   * and cloud deploys. Override only with window.QWERTY_WS_URL if needed.
   */
  function wsUrl() {
    if (root.QWERTY_WS_URL) return root.QWERTY_WS_URL;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var host = location.hostname || '127.0.0.1';
    var port = root.QWERTY_WS_PORT || 3001;
    if (location.port && location.port !== String(port)) {
      return proto + '//' + host + ':' + port;
    }
    if (!location.port && (host === '127.0.0.1' || host === 'localhost')) {
      return proto + '//' + host + ':' + port;
    }
    /* ngrok / Railway / etc.: page and socket share location.host */
    return proto + '//' + location.host;
  }

  function on(type, fn) {
    handlers[type] = fn;
  }

  function emit(type, data) {
    if (handlers[type]) handlers[type](data);
  }

  function scheduleReconnect() {
    if (reconnectTimer || !lastJoinCode) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectAttempts++;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect()
        .then(function () {
          reconnectAttempts = 0;
          joinRoom(lastJoinCode, lastJoinNickname || 'Player', lastJoinRole);
        })
        .catch(function () {
          scheduleReconnect();
        });
    }, 2500);
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
  }

  function stopPing() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function startPing() {
    stopPing();
    pingInterval = setInterval(function () {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          send({ type: 'ping' });
        } catch (_) {}
      }
    }, 25000);
  }

  function isConnected() {
    return !!(ws && ws.readyState === WebSocket.OPEN);
  }

  function connect() {
    return new Promise(function (resolve, reject) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (ws && ws.readyState === WebSocket.CONNECTING) {
        var waitAttempts = 0;
        var waitId = setInterval(function () {
          waitAttempts++;
          if (ws && ws.readyState === WebSocket.OPEN) {
            clearInterval(waitId);
            resolve();
          } else if (!ws || ws.readyState === WebSocket.CLOSED || waitAttempts > 100) {
            clearInterval(waitId);
            reject(new Error('Could not connect to game server at ' + wsUrl()));
          }
        }, 50);
        return;
      }

      if (ws) {
        try {
          ws.onopen = null;
          ws.onerror = null;
          ws.onclose = null;
          ws.onmessage = null;
          ws.close();
        } catch (_) {}
        ws = null;
      }

      var url = wsUrl();
      var settled = false;

      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }

      ws.onopen = function () {
        clearReconnect();
        startPing();
        if (settled) return;
        settled = true;
        resolve();
      };

      ws.onerror = function () {
        /* wait for onclose or onopen — transient errors are common during connect */
      };

      ws.onclose = function () {
        stopPing();
        emit('disconnected', {});
        scheduleReconnect();
        if (!settled) {
          settled = true;
          reject(new Error('Could not connect to game server at ' + url));
        }
      };

      ws.onmessage = function (ev) {
        var msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        if (msg.type) emit(msg.type, msg);
      };
    });
  }

  function send(msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server');
    }
    ws.send(JSON.stringify(msg));
  }

  var DEFAULT_ROOM_CODE = 'MAIN';

  function createRoom(nickname, code) {
    var msg = { type: 'create_room', nickname: nickname };
    if (code) msg.code = String(code).trim().toUpperCase();
    send(msg);
  }

  function joinRoom(code, nickname, role) {
    var resolved = code && String(code).trim() ? String(code).trim().toUpperCase() : DEFAULT_ROOM_CODE;
    saveStoredSession(resolved, nickname || 'Player', role || 'guest');
    var msg = {
      type: 'join_room',
      code: lastJoinCode,
      nickname: lastJoinNickname,
    };
    if (lastJoinRole) msg.role = lastJoinRole;
    send(msg);
  }

  function leaveRoom() {
    clearStoredSession();
    clearReconnect();
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        send({ type: 'leave_room' });
      } catch (_) {}
    }
  }

  function requestState() {
    send({ type: 'request_state' });
  }

  function play(placements, meta) {
    var payload = { type: 'play', placements: placements };
    if (meta) {
      if (meta.word) payload.word = meta.word;
      if (meta.cells && meta.cells.length) payload.cells = meta.cells;
    }
    send(payload);
  }

  function exchange(slots) {
    send({ type: 'exchange', slots: slots });
  }

  function chat(text) {
    send({ type: 'chat', text: text });
  }

  function resign() {
    send({ type: 'resign' });
  }

  function requestRematch() {
    send({ type: 'rematch' });
  }

  function disconnect() {
    clearReconnect();
    clearStoredSession();
    stopPing();
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  root.QWERTYOnline = {
    connect: connect,
    on: on,
    isConnected: isConnected,
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    requestState: requestState,
    play: play,
    exchange: exchange,
    chat: chat,
    resign: resign,
    requestRematch: requestRematch,
    disconnect: disconnect,
    getStoredSession: loadStoredSession,
    clearStoredSession: clearStoredSession,
    saveStoredSession: saveStoredSession,
    wsUrl: wsUrl,
    DEFAULT_ROOM_CODE: DEFAULT_ROOM_CODE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
