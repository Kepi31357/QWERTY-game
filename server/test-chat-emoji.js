'use strict';

/**
 * Chat emoji picker wiring + live emoji send/receive over WebSocket.
 * Run: node server/test-chat-emoji.js
 */

var fs = require('fs');
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

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

assert(htmlSrc.indexOf('btn-chat-emoji') >= 0, 'emoji button in HTML');
assert(htmlSrc.indexOf('chat-emoji-picker') >= 0, 'emoji picker panel in HTML');
assert(htmlSrc.indexOf('type="submit"') >= 0 && htmlSrc.indexOf('btn-chat-send') >= 0, 'Send is submit');
assert(cssSrc.indexOf('.chat-emoji-picker') >= 0, 'emoji picker CSS');
assert(cssSrc.indexOf('.chat-emoji-btn') >= 0, 'emoji button CSS');
assert(gameSrc.indexOf('CHAT_EMOJI_LIST') >= 0, 'emoji list defined');
assert(gameSrc.indexOf('insertChatEmoji') >= 0, 'insertChatEmoji helper');
assert(gameSrc.indexOf('setupChatEmojiPicker') >= 0, 'setupChatEmojiPicker wired');
assert(gameSrc.indexOf("'🎉'") >= 0 && gameSrc.indexOf("'🔥'") >= 0, 'common emojis included');

/* Local insert logic mirror (same as game.js) */
function insertEmoji(value, start, end, emoji, maxLen) {
  var next = value.slice(0, start) + emoji + value.slice(end);
  if (next.length > maxLen) next = next.slice(0, maxLen);
  return next;
}
assert(insertEmoji('Hi ', 3, 3, '🔥', 200) === 'Hi 🔥', 'insert at caret');
assert(insertEmoji('abc', 1, 2, '✅', 200) === 'a✅c', 'replace selection');
assert(insertEmoji('x'.repeat(199), 199, 199, '🎉', 200).length === 200, 'respects maxlength');

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
      if (/QWERTY game server is running/i.test(buf)) {
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

async function liveEmojiRoundTrip() {
  var port = 3200 + Math.floor(Math.random() * 400);
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
    var host = await connect(port);
    await onceMessage(host, 'hello');
    send(host, { type: 'create_room', nickname: 'Deb', code: 'PARTY' });
    var created = await Promise.race([
      onceMessage(host, 'room_created'),
      onceMessage(host, 'error').then(function (err) {
        throw new Error('create_room failed: ' + (err.message || JSON.stringify(err)));
      }),
    ]);
    assert(created.code === 'PARTY', 'emoji test room created');

    var guest = await connect(port);
    await onceMessage(guest, 'hello');
    send(guest, { type: 'join_room', nickname: 'Blake', code: 'PARTY' });
    await onceMessage(guest, 'joined');

    var emojiText = 'Nice bingo! 🎉🔥✅';
    var recv = onceMessage(guest, 'chat', 5000);
    send(host, { type: 'chat', text: emojiText });
    var chatMsg = await recv;
    assert(chatMsg.text === emojiText, 'guest receives emoji chat intact');
    assert(chatMsg.from === 0, 'chat from host seat');

    var recvHost = onceMessage(host, 'chat', 5000);
    send(guest, { type: 'chat', text: '👍 GG' });
    var reply = await recvHost;
    assert(reply.text === '👍 GG', 'host receives emoji reply intact');

    host.close();
    guest.close();
  } finally {
    try {
      proc.kill('SIGTERM');
    } catch (_) {}
  }
}

liveEmojiRoundTrip()
  .then(function () {
    if (fail) {
      console.error('\n' + fail + ' failure(s)');
      process.exit(1);
    }
    console.log('\nAll chat emoji checks passed.');
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
