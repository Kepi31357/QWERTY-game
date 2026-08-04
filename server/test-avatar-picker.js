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

var store = {};
var ctx = {
  window: {},
  localStorage: {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
  },
};
ctx.globalThis = ctx;
vm.runInNewContext(avatarSrc, ctx);
var A = ctx.window.QWERTYAvatars;
assert(!!A, 'QWERTYAvatars exported');
var list = A.listSelectable();
assert(list.length >= 40, 'catalog has at least 40 selectable avatars (got ' + list.length + ')');
assert(A.isValidId('maya') && A.isValidId('claire') && A.isValidId('grace'), 'legacy + new ids valid');
assert(!A.isValidId('computer'), 'computer id not selectable');

assert(A.STYLE === 'avataaars', 'people style is avataaars');
assert(A.COMPUTER_STYLE === 'bottts', 'computer style is bottts');
assert(typeof A.getUrl === 'function', 'getUrl exported');

var mayaUrl = A.getUrl('maya');
assert(
  mayaUrl.indexOf('https://api.dicebear.com/9.x/avataaars/svg?') === 0,
  'maya URL uses DiceBear 9.x avataaars'
);
assert(mayaUrl.indexOf('seed=Maya') >= 0, 'maya URL seeded by name');
assert(mayaUrl.indexOf('mouth=smile') >= 0, 'friendly mouths enabled');
assert(mayaUrl.indexOf('screamOpen') < 0 && mayaUrl.indexOf('grimace') < 0, 'distressed mouths excluded');
assert(mayaUrl.indexOf('eyes=happy') >= 0, 'friendly eyes enabled');
assert(mayaUrl.indexOf('eyebrows=default') >= 0, 'calm eyebrows enabled');
assert(mayaUrl.indexOf('clothesColor=7c3aed') >= 0, 'purple/orange clothes palette');
assert(mayaUrl.indexOf('facialHairProbability=0') >= 0, 'feminine faces disable facial hair');

var marcusUrl = A.getUrl('marcus');
assert(marcusUrl.indexOf('facialHairProbability=35') >= 0, 'masculine faces allow facial hair');

var amiraUrl = A.getUrl('amira');
assert(amiraUrl.indexOf('top=hijab') >= 0, 'hijab presentation uses DiceBear top=hijab');

var computerUrl = A.getUrl('computer');
assert(computerUrl.indexOf('/bottts/svg?') >= 0, 'computer uses bottts style');

var markup = A.getMarkup('maya');
assert(markup.indexOf('<img class="avatar-art"') === 0, 'markup is DiceBear img tag');
assert(markup.indexOf('api.dicebear.com') >= 0, 'markup points at DiceBear CDN');

assert(A.loadStoredAvatarId() === A.DEFAULT_ID, 'default avatar when storage empty');
A.saveStoredAvatarId('claire');
assert(store[A.KEY] === 'claire', 'saveStoredAvatarId persists id');

assert(htmlSrc.indexOf('id="avatar-picker-overlay"') >= 0, 'picker modal overlay present');
assert(htmlSrc.indexOf('id="btn-open-avatar-picker"') >= 0, 'Choose Avatar button present');
assert(htmlSrc.indexOf('id="btn-avatar-picker-select"') >= 0, 'Select button present');
assert(htmlSrc.indexOf('id="btn-avatar-picker-cancel"') >= 0, 'Cancel button present');
assert(htmlSrc.indexOf('id="avatar-chooser"') >= 0, 'compact chooser on main menu');

assert(cssSrc.indexOf('.avatar-picker-overlay') >= 0, 'modal overlay styles');
assert(cssSrc.indexOf('minmax(96px') >= 0 || cssSrc.indexOf('minmax(84px') >= 0, 'large avatar grid cells');
assert(gameSrc.indexOf('openAvatarPicker') >= 0 && gameSrc.indexOf('closeAvatarPicker') >= 0, 'open/close picker API');
assert(gameSrc.indexOf('_avatarPickerDraftId') >= 0, 'draft selection before confirm');

console.log('Summary: avatar picker checks passed (' + list.length + ' DiceBear avatars)');
