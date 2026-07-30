/**
 * Avatar catalog + spacious picker wiring (static checks).
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var assert = function (cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  OK  ' + msg);
};

var avatarSrc = fs.readFileSync(path.join(root, 'avatars.js'), 'utf8');
var htmlSrc = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

var ctx = { window: {}, localStorage: { getItem: function () { return null; }, setItem: function () {} } };
ctx.globalThis = ctx;
vm.runInNewContext(avatarSrc, ctx);
var A = ctx.window.QWERTYAvatars;
assert(!!A, 'QWERTYAvatars exported');
var list = A.listSelectable();
assert(list.length >= 40, 'catalog has at least 40 selectable avatars (got ' + list.length + ')');
assert(A.isValidId('maya') && A.isValidId('claire') && A.isValidId('grace'), 'legacy + new ids valid');
assert(!A.isValidId('computer'), 'computer id not selectable');
assert(typeof A.IMAGE_OVERRIDES === 'object', 'IMAGE_OVERRIDES map present for drop-in files');
assert(fs.existsSync(path.join(root, 'avatars', 'README.md')), 'avatars/README.md documents drop-in images');

assert(htmlSrc.indexOf('id="avatar-picker-overlay"') >= 0, 'picker modal overlay present');
assert(htmlSrc.indexOf('id="btn-open-avatar-picker"') >= 0, 'Choose Avatar button present');
assert(htmlSrc.indexOf('id="btn-avatar-picker-select"') >= 0, 'Select button present');
assert(htmlSrc.indexOf('id="btn-avatar-picker-cancel"') >= 0, 'Cancel button present');
assert(htmlSrc.indexOf('id="avatar-chooser"') >= 0, 'compact chooser on main menu');

assert(cssSrc.indexOf('.avatar-picker-overlay') >= 0, 'modal overlay styles');
assert(cssSrc.indexOf('minmax(96px') >= 0 || cssSrc.indexOf('minmax(84px') >= 0, 'large avatar grid cells');
assert(gameSrc.indexOf('openAvatarPicker') >= 0 && gameSrc.indexOf('closeAvatarPicker') >= 0, 'open/close picker API');
assert(gameSrc.indexOf('_avatarPickerDraftId') >= 0, 'draft selection before confirm');

console.log('Summary: avatar picker checks passed (' + list.length + ' avatars)');
