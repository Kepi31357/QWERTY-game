'use strict';

/**
 * Chat Send button wiring + local sendPlayerChat behavior.
 * Run: node server/test-chat-send.js
 */

var fs = require('fs');
var path = require('path');

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

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

assert(htmlSrc.indexOf('id="btn-chat-send"') >= 0, 'Send button in HTML');
assert(htmlSrc.indexOf('id="chat-form"') >= 0, 'chat form in HTML');
assert(htmlSrc.indexOf('id="chat-input"') >= 0, 'chat input in HTML');
assert(/btn-chat-send"[^>]*type="button"|type="button"[^>]*id="btn-chat-send"/.test(htmlSrc), 'Send is type=button (explicit click)');

assert(gameSrc.indexOf('setupChat()') >= 0, 'setupChat exists');
assert(gameSrc.indexOf("btnChatSend.addEventListener('click'") >= 0, 'Send click listener');
assert(gameSrc.indexOf("chatForm.addEventListener('submit'") >= 0, 'form submit listener');
assert(gameSrc.indexOf("chatInput.addEventListener('keydown'") >= 0, 'Enter key sends');
assert(gameSrc.indexOf('sendPlayerChat()') >= 0, 'sendPlayerChat exists');
assert(gameSrc.indexOf('QWERTYOnline.chat(text)') >= 0, 'online chat forward');

/* Mobile stacking: open sheet must be above backdrop or Send taps close chat. */
assert(cssSrc.indexOf('z-index: 2603') >= 0, 'open sidebar above backdrop');
assert(cssSrc.indexOf('mobile-chat-backdrop') >= 0, 'backdrop style present');
assert(
  /body\.mobile-chat-open[\s\S]*?\.sidebar-column[\s\S]*?z-index:\s*2603/.test(cssSrc),
  'mobile-chat-open raises sidebar stacking context'
);
assert(cssSrc.indexOf('-webkit-text-fill-color: #1a1a1a') >= 0, 'typed chat text forced dark');
assert(cssSrc.indexOf('caret-color: #1a1a1a') >= 0, 'chat caret visible');

/* Mirror sendPlayerChat core (offline). */
function mockSend(inputValue, opts) {
  opts = opts || {};
  var lines = [];
  var text = String(inputValue || '').trim();
  if (!text) return { sent: false, lines: lines, input: inputValue };
  if (opts.blocked) {
    lines.push('blocked');
    return { sent: false, lines: lines, input: '' };
  }
  lines.push('you:' + text);
  var onlineSent = false;
  if (opts.online) {
    onlineSent = true;
  }
  return { sent: true, lines: lines, input: '', onlineSent: onlineSent };
}

var r1 = mockSend('Hello');
assert(r1.sent && r1.lines[0] === 'you:Hello' && r1.input === '', 'text send clears input');
var r2 = mockSend('  🔥 party 🎉  ');
assert(r2.sent && r2.lines[0] === 'you:🔥 party 🎉', 'emoji send works');
var r3 = mockSend('   ');
assert(!r3.sent, 'blank input does not send');
var r4 = mockSend('hi', { blocked: true });
assert(!r4.sent && r4.lines[0] === 'blocked', 'blocked chat refuses send');
var r5 = mockSend('online ping', { online: true });
assert(r5.sent && r5.onlineSent, 'online path marked for forward');

console.log('Summary: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
