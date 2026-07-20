'use strict';

/**
 * Copy dropped sound assets from publicsounds/ (or cwd args) into public/sounds/
 * with the filenames the game expects.
 *
 * Run: node scripts/install-sound-drops.js
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DROP = path.join(ROOT, 'publicsounds');
var OUT = path.join(ROOT, 'public', 'sounds');

var TARGETS = [
  {
    dest: 'introduction3.mp3',
    match: [/introduction\s*3/i, /introduction3/i],
  },
  {
    dest: 'connection.mp3',
    match: [/^connection(\.mp3)+$/i],
    preferDrop: true,
  },
  {
    dest: 'wordplayed.mp3',
    match: [/wordplayed/i, /word[-_ ]?played/i],
  },
  {
    dest: 'swoosh.mp3',
    match: [/swoosh/i],
  },
  {
    dest: 'rackemptiedbonus.mp3',
    match: [/rackemptiedbonus/i, /rack[-_ ]?emptied/i],
  },
  {
    dest: 'end.mp3',
    match: [/^end(\.mp3)+$/i],
    preferDrop: true,
  },
];

function listCandidates() {
  var dirs = [
    { dir: DROP, drop: true },
    { dir: OUT, drop: false },
    { dir: ROOT, drop: false },
  ];
  var files = [];
  dirs.forEach(function (entry) {
    if (!fs.existsSync(entry.dir)) return;
    fs.readdirSync(entry.dir).forEach(function (name) {
      var full = path.join(entry.dir, name);
      try {
        if (fs.statSync(full).isFile() && /\.mp3/i.test(name)) {
          files.push({ name: name, full: full, drop: entry.drop });
        }
      } catch (_) {}
    });
  });
  return files;
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

var candidates = listCandidates();
var missing = [];
var installed = [];

TARGETS.forEach(function (t) {
  var destPath = path.join(OUT, t.dest);
  var found = null;
  var pool = t.preferDrop
    ? candidates.filter(function (c) { return c.drop; }).concat(candidates)
    : candidates;
  for (var i = 0; i < pool.length; i++) {
    var c = pool[i];
    for (var m = 0; m < t.match.length; m++) {
      if (t.match[m].test(c.name)) {
        found = c;
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    if (!fs.existsSync(destPath)) missing.push(t.dest);
    else installed.push(t.dest + ' (already present)');
    return;
  }
  if (path.resolve(found.full) !== path.resolve(destPath)) {
    fs.copyFileSync(found.full, destPath);
  }
  installed.push(t.dest + ' <- ' + found.name + (found.drop ? ' [drop]' : ''));
});

installed.forEach(function (line) {
  console.log('OK  ' + line);
});
if (missing.length) {
  console.log('');
  console.log('MISSING — drop these into publicsounds/ then re-run:');
  missing.forEach(function (m) {
    console.log('  - ' + m);
  });
  console.log('  (tile place sound: swoosh.mp3)');
  process.exitCode = 1;
} else {
  console.log('All required sound drops are installed in public/sounds/');
}
