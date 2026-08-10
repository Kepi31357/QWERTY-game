'use strict';

/**
 * Live WebSocket multi-room isolation + MAIN default.
 * Spawns a temporary server on an ephemeral port.
 * Run: node server/test-multi-room-ws.js
 */

var path = require('path');
var { spawn } = require('child_process');
var WebSocket = require('ws');

var fail = 0;
function assert(cond, msg) {
  if (!cond) {
    fail++;
    console.error('FAIL', msg);
  } else {
    console.log('OK', msg);
  }
}

function onceMessage(ws, type, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () {
      cleanup();
      reject(new Error('timeout waiting for ' + type));
    }, timeoutMs || 8000);
    function onMsg(raw) {
      var msg;
      try {
        msg = JSON.parse(raw);
      } catch (_) {
        return;
      }
      if (msg.type === type) {
        cleanup();
        resolve(msg);
      }
    }
    function cleanup() {
      clearTimeout(t);
      ws.off('message', onMsg);
    }
    ws.on('message', onMsg);
  });
}

function connect(port) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket('ws://127.0.0.1:' + port);
    ws.once('open', function () {
      resolve(ws);
    });
    ws.once('error', reject);
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

function waitReady(proc, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var buf = '';
    var t = setTimeout(function () {
      reject(new Error('server did not become ready'));
    }, timeoutMs || 15000);
    function onData(chunk) {
      buf += chunk.toString();
      if (/QWERTY game server is running/i.test(buf) || /listening/i.test(buf)) {
        clearTimeout(t);
        proc.stdout.off('data', onData);
        proc.stderr.off('data', onData);
        resolve();
      }
    }
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
  });
}

async function main() {
  var port = 3100 + Math.floor(Math.random() * 400);
  var root = path.join(__dirname, '..');
  var proc = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    cwd: root,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      QWERTY_OPEN_BROWSER: '0',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitReady(proc);

    /* --- Blank create mints a unique private code (never MAIN) --- */
    var hostAuto = await connect(port);
    await onceMessage(hostAuto, 'hello');
    send(hostAuto, { type: 'create_room', nickname: 'DebAuto' });
    var createdAuto = await onceMessage(hostAuto, 'room_created');
    assert(createdAuto.code && createdAuto.code !== 'MAIN', 'blank create mints private code');
    assert(createdAuto.code.length >= 4, 'auto code length ok');
    assert(createdAuto.defaultRoom !== true, 'auto room is not default MAIN');

    var guestAuto = await connect(port);
    await onceMessage(guestAuto, 'hello');
    send(guestAuto, { type: 'join_room', nickname: 'BlakeAuto', code: createdAuto.code });
    var joinedAuto = await onceMessage(guestAuto, 'joined');
    assert(joinedAuto.code === createdAuto.code, 'guest joins auto-minted room');
    assert(joinedAuto.state && joinedAuto.state.board, 'auto room guest receives state');

    /* MAIN create is rejected */
    var hostMain = await connect(port);
    await onceMessage(hostMain, 'hello');
    send(hostMain, { type: 'create_room', nickname: 'DebMain', code: 'MAIN' });
    var mainErr = await onceMessage(hostMain, 'error');
    assert(mainErr && /unique room code|MAIN/i.test(mainErr.message || ''), 'create MAIN rejected');

    /* Blank join is rejected */
    var guestBlank = await connect(port);
    await onceMessage(guestBlank, 'hello');
    send(guestBlank, { type: 'join_room', nickname: 'BlakeBlank' });
    var blankErr = await onceMessage(guestBlank, 'error');
    assert(blankErr && /room code/i.test(blankErr.message || ''), 'blank join rejected');

    /* --- Private rooms coexist --- */
    var hostA = await connect(port);
    await onceMessage(hostA, 'hello');
    send(hostA, { type: 'create_room', nickname: 'HostA', code: 'TESTA' });
    var createdA = await onceMessage(hostA, 'room_created');
    assert(createdA.code === 'TESTA', 'custom room TESTA created');

    var hostB = await connect(port);
    await onceMessage(hostB, 'hello');
    send(hostB, { type: 'create_room', nickname: 'HostB', code: 'TESTB' });
    var createdB = await onceMessage(hostB, 'room_created');
    assert(createdB.code === 'TESTB', 'custom room TESTB created');

    var guestA = await connect(port);
    await onceMessage(guestA, 'hello');
    send(guestA, { type: 'join_room', nickname: 'GuestA', code: 'TESTA' });
    var joinedA = await onceMessage(guestA, 'joined');
    assert(joinedA.code === 'TESTA', 'guest joins TESTA');

    var guestB = await connect(port);
    await onceMessage(guestB, 'hello');
    send(guestB, { type: 'join_room', nickname: 'GuestB', code: 'TESTB' });
    var joinedB = await onceMessage(guestB, 'joined');
    assert(joinedB.code === 'TESTB', 'guest joins TESTB');

    var scoreA0 = joinedA.state.scores[0];
    var scoreB0 = joinedB.state.scores[0];
    assert(scoreA0 === 0 && scoreB0 === 0, 'both rooms start at zero');

    /* Chat in A must not appear on B */
    var chatOnB = new Promise(function (resolve) {
      var t = setTimeout(function () {
        resolve(null);
      }, 600);
      guestB.on('message', function (raw) {
        var msg = JSON.parse(raw);
        if (msg.type === 'chat' && msg.text === 'hello-from-A') {
          clearTimeout(t);
          resolve(msg);
        }
      });
    });
    send(guestA, { type: 'chat', text: 'hello-from-A' });
    var leaked = await chatOnB;
    assert(!leaked, 'chat in TESTA does not reach TESTB');

    /* Resign in A must not end B */
    var resignA = onceMessage(guestA, 'state_update', 5000);
    send(guestA, { type: 'resign' });
    var endA = await resignA;
    assert(endA && endA.event === 'resign', 'TESTA receives resign state_update');
    assert(endA.state && endA.state.gameOver === true, 'TESTA marked game over');

    send(guestB, { type: 'request_state' });
    var stateB = await onceMessage(guestB, 'game_start', 5000);
    assert(stateB && stateB.state && stateB.state.gameOver !== true, 'TESTB still in progress after TESTA resign');

    /* Another blank create → different private code */
    var hostExtra = await connect(port);
    await onceMessage(hostExtra, 'hello');
    send(hostExtra, { type: 'create_room', nickname: 'Extra' });
    var createdExtra = await onceMessage(hostExtra, 'room_created');
    assert(createdExtra.code !== 'MAIN', 'second blank create is not MAIN');
    assert(createdExtra.code !== createdAuto.code, 'second blank create is a different code');
    assert(createdExtra.code.length >= 4, 'private code length ok');

    [hostAuto, guestAuto, hostMain, guestBlank, hostA, guestA, hostB, guestB, hostExtra].forEach(function (ws) {
      try {
        ws.close();
      } catch (_) {}
    });
  } finally {
    try {
      proc.kill('SIGTERM');
    } catch (_) {}
  }

  if (fail) {
    console.error('\n' + fail + ' failure(s)');
    process.exit(1);
  }
  console.log('\nAll multi-room WebSocket checks passed.');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
