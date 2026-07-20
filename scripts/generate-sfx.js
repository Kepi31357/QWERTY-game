'use strict';

/**
 * Generate short game SFX into public/sounds/*.mp3
 * (PCM WAV payloads — server sniffs RIFF and serves audio/wav.
 *  Replace with real MP3s anytime; Content-Type then follows .mp3.)
 *
 * Run: node scripts/generate-sfx.js
 */

var fs = require('fs');
var path = require('path');

var OUT = path.join(__dirname, '..', 'public', 'sounds');
var SAMPLE_RATE = 22050;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function writeWav(samples) {
  var dataSize = samples.length * 2;
  var buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (var i = 0; i < samples.length; i++) {
    var s = clamp(Math.round(samples[i] * 32767), -32768, 32767);
    buf.writeInt16LE(s, 44 + i * 2);
  }
  return buf;
}

function alloc(seconds) {
  return new Float32Array(Math.max(1, Math.floor(SAMPLE_RATE * seconds)));
}

function env(i, n, attack, release) {
  var a = Math.max(1, Math.floor(n * (attack || 0.02)));
  var r = Math.max(1, Math.floor(n * (release || 0.2)));
  if (i < a) return i / a;
  if (i > n - r) return Math.max(0, (n - i) / r);
  return 1;
}

function tone(freq, seconds, vol, type) {
  var out = alloc(seconds);
  var n = out.length;
  for (var i = 0; i < n; i++) {
    var t = i / SAMPLE_RATE;
    var phase = 2 * Math.PI * freq * t;
    var wave;
    if (type === 'square') wave = Math.sin(phase) > 0 ? 1 : -1;
    else if (type === 'triangle') {
      wave = 2 * Math.abs(2 * ((t * freq) % 1) - 1) - 1;
    } else if (type === 'saw') {
      wave = 2 * ((t * freq) % 1) - 1;
    } else {
      wave = Math.sin(phase);
    }
    out[i] = wave * (vol || 0.35) * env(i, n, 0.04, 0.35);
  }
  return out;
}

function sweep(freq0, freq1, seconds, vol, type) {
  var out = alloc(seconds);
  var n = out.length;
  for (var i = 0; i < n; i++) {
    var t = i / SAMPLE_RATE;
    var f = freq0 + (freq1 - freq0) * (i / (n - 1 || 1));
    var phase = 2 * Math.PI * f * t;
    var wave = type === 'square' ? (Math.sin(phase) > 0 ? 1 : -1) : Math.sin(phase);
    out[i] = wave * (vol || 0.3) * env(i, n, 0.03, 0.4);
  }
  return out;
}

function mix() {
  var parts = Array.prototype.slice.call(arguments);
  var len = 0;
  for (var p = 0; p < parts.length; p++) len = Math.max(len, parts[p].length);
  var out = new Float32Array(len);
  for (p = 0; p < parts.length; p++) {
    var src = parts[p];
    for (var i = 0; i < src.length; i++) out[i] += src[i];
  }
  var peak = 0.0001;
  for (i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  var scale = peak > 0.9 ? 0.9 / peak : 1;
  for (i = 0; i < out.length; i++) out[i] *= scale;
  return out;
}

function delay(src, seconds) {
  var pad = Math.floor(SAMPLE_RATE * seconds);
  var out = new Float32Array(pad + src.length);
  out.set(src, pad);
  return out;
}

var recipes = {
  submit: function () {
    return mix(tone(523.25, 0.09, 0.32), delay(tone(659.25, 0.11, 0.28), 0.06));
  },
  error: function () {
    return mix(sweep(220, 110, 0.18, 0.28, 'saw'), delay(sweep(160, 90, 0.12, 0.16, 'square'), 0.04));
  },
  bingo: function () {
    return mix(
      tone(659.25, 0.08, 0.3),
      delay(tone(830.61, 0.08, 0.3), 0.06),
      delay(tone(1046.5, 0.1, 0.32, 'triangle'), 0.12),
      delay(tone(1318.51, 0.16, 0.28), 0.2)
    );
  },
  connection: function () {
    return mix(
      tone(392, 0.11, 0.3, 'triangle'),
      delay(tone(587.33, 0.13, 0.32), 0.08),
      delay(tone(784, 0.16, 0.28), 0.18)
    );
  },
  exchange: function () {
    return mix(sweep(420, 560, 0.1, 0.26, 'triangle'), delay(sweep(560, 380, 0.11, 0.22, 'triangle'), 0.07));
  },
  win: function () {
    return mix(
      tone(523.25, 0.11, 0.3),
      tone(659.25, 0.11, 0.18, 'triangle'),
      delay(tone(783.99, 0.12, 0.32), 0.1),
      delay(tone(987.77, 0.12, 0.2, 'triangle'), 0.1),
      delay(tone(1046.5, 0.15, 0.34), 0.2),
      delay(tone(1318.51, 0.22, 0.28), 0.32),
      delay(tone(1567.98, 0.2, 0.18, 'triangle'), 0.4)
    );
  },
  lose: function () {
    return mix(
      tone(349.23, 0.15, 0.28, 'triangle'),
      delay(tone(293.66, 0.17, 0.26), 0.12),
      delay(tone(246.94, 0.2, 0.24), 0.26),
      delay(tone(196, 0.28, 0.22, 'triangle'), 0.42)
    );
  },
  tick: function () {
    return sweep(1100, 750, 0.07, 0.36, 'square');
  },
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

Object.keys(recipes).forEach(function (name) {
  var samples = recipes[name]();
  var wav = writeWav(samples);
  var dest = path.join(OUT, name + '.mp3');
  fs.writeFileSync(dest, wav);
  console.log('wrote', dest, '(' + wav.length + ' bytes)');
});

console.log('Done. Files are WAV payloads named .mp3 (browser-safe via server MIME sniff).');
