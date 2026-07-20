'use strict';

var fs = require('fs');
var path = require('path');
var p = path.join(__dirname, '..', 'game.js');
var s = fs.readFileSync(p, 'utf8');
var start = s.indexOf('  ensureAudioContext() {');
var end = s.indexOf('  setupSoundToggle() {');
if (start < 0 || end < 0) {
  console.error('markers missing', start, end);
  process.exit(1);
}

var repl = fs.readFileSync(path.join(__dirname, 'sfx-methods.js.txt'), 'utf8');
if (repl.slice(-1) !== '\n') repl += '\n';
s = s.slice(0, start) + repl + s.slice(end);

s = s.replace(
  'function () {\n        self.ensureAudioContext();\n      },\n      { once: true, capture: true }',
  'function () {\n        self.ensureAudioContext();\n        self.preloadSfx();\n      },\n      { once: true, capture: true }'
);

s = s.replace(
  "if (self.soundEnabled) {\n        self.ensureAudioContext();\n        self.playSfx('submit');\n      }",
  "if (self.soundEnabled) {\n        self.ensureAudioContext();\n        self.preloadSfx();\n        self.playSfx('submit');\n      }"
);

if (s.indexOf('playSfxSynth') < 0 || s.indexOf("SFX_BASE + kind + '.mp3'") < 0) {
  console.error('patch incomplete');
  process.exit(1);
}

fs.writeFileSync(p, s);
console.log('patched game.js OK');
