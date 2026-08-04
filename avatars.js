/**
 * QWERTY avatar catalog + local persistence (UI only — no game logic).
 *
 * Avatars are generated via the DiceBear HTTP API (no local image files).
 * Same id/seed always yields the same face. Gender presentation is controlled
 * so feminine/neutral names never get facial hair.
 *
 * API: https://api.dicebear.com/9.x/[style]/svg?seed=...
 */
(function (global) {
  'use strict';

  var AVATAR_KEY = 'qwerty-avatar-id';
  var DEFAULT_ID = 'maya';
  var COMPUTER_ID = 'computer';

  /** People style — diverse cartoon half-body, good for games. */
  var STYLE = 'avataaars';
  /** Computer opponent style. */
  var COMPUTER_STYLE = 'bottts';
  var API_VERSION = '9.x';
  var API_BASE = 'https://api.dicebear.com/' + API_VERSION + '/';
  /** Requested SVG size (scales cleanly in CSS at board / picker sizes). */
  var AVATAR_SIZE = 160;

  /**
   * Catalog — keep existing ids valid for saved localStorage selections.
   * presentation: 'feminine' | 'masculine' | 'neutral'
   * Optional: top (DiceBear hair/hat), seed (defaults to label).
   */
  var PERSON_DEFS = [
    /* —— original set (keep ids) —— */
    { id: 'maya', label: 'Maya', age: '20s', presentation: 'feminine' },
    { id: 'jordan', label: 'Jordan', age: '20s', presentation: 'neutral' },
    { id: 'sofia', label: 'Sofia', age: '30s', presentation: 'feminine' },
    { id: 'kenji', label: 'Kenji', age: '30s', presentation: 'masculine' },
    { id: 'riley', label: 'Riley', age: '40s', presentation: 'neutral' },
    { id: 'marcus', label: 'Marcus', age: '50s', presentation: 'masculine' },
    { id: 'amira', label: 'Amira', age: '20s', presentation: 'feminine', top: 'hijab' },
    { id: 'finn', label: 'Finn', age: '30s', presentation: 'masculine' },
    { id: 'nova', label: 'Nova', age: '20s', presentation: 'feminine' },
    { id: 'harold', label: 'Harold', age: '70s', presentation: 'masculine' },
    { id: 'elena', label: 'Elena', age: '70s', presentation: 'feminine' },
    { id: 'priya', label: 'Priya', age: '40s', presentation: 'feminine' },
    { id: 'owen', label: 'Owen', age: '60s', presentation: 'masculine' },
    { id: 'grace', label: 'Grace', age: '90s', presentation: 'feminine' },

    /* —— white / light-skinned women —— */
    { id: 'claire', label: 'Claire', age: '30s', presentation: 'feminine' },
    { id: 'hannah', label: 'Hannah', age: '20s', presentation: 'feminine' },
    { id: 'emily', label: 'Emily', age: '40s', presentation: 'feminine' },
    { id: 'sarah', label: 'Sarah', age: '50s', presentation: 'feminine' },
    { id: 'betty', label: 'Betty', age: '70s', presentation: 'feminine' },
    { id: 'olivia', label: 'Olivia', age: '20s', presentation: 'feminine' },
    { id: 'whitney', label: 'Whitney', age: '30s', presentation: 'feminine' },
    { id: 'irene', label: 'Irene', age: '80s', presentation: 'feminine' },

    /* —— white / light-skinned men —— */
    { id: 'blake', label: 'Blake', age: '20s', presentation: 'masculine' },
    { id: 'ethan', label: 'Ethan', age: '30s', presentation: 'masculine' },
    { id: 'greg', label: 'Greg', age: '50s', presentation: 'masculine' },
    { id: 'walter', label: 'Walter', age: '70s', presentation: 'masculine' },
    { id: 'nate', label: 'Nate', age: '40s', presentation: 'masculine' },

    /* —— Black / deep skin tones —— */
    { id: 'aisha', label: 'Aisha', age: '20s', presentation: 'feminine' },
    { id: 'jamal', label: 'Jamal', age: '30s', presentation: 'masculine' },
    { id: 'keisha', label: 'Keisha', age: '40s', presentation: 'feminine' },
    { id: 'darnell', label: 'Darnell', age: '50s', presentation: 'masculine' },
    { id: 'nia', label: 'Nia', age: '30s', presentation: 'feminine' },
    { id: 'tyrone', label: 'Tyrone', age: '60s', presentation: 'masculine' },

    /* —— East / Southeast / South Asian —— */
    { id: 'yuki', label: 'Yuki', age: '20s', presentation: 'feminine' },
    { id: 'hiro', label: 'Hiro', age: '40s', presentation: 'masculine' },
    { id: 'mei', label: 'Mei', age: '50s', presentation: 'feminine' },
    { id: 'arjun', label: 'Arjun', age: '30s', presentation: 'masculine' },
    { id: 'ananya', label: 'Ananya', age: '20s', presentation: 'feminine' },
    { id: 'suresh', label: 'Suresh', age: '60s', presentation: 'masculine' },
    { id: 'lin', label: 'Lin', age: '30s', presentation: 'feminine' },

    /* —— Latine / Mediterranean / MENA —— */
    { id: 'lucia', label: 'Lucia', age: '20s', presentation: 'feminine' },
    { id: 'carlos', label: 'Carlos', age: '40s', presentation: 'masculine' },
    { id: 'rosa', label: 'Rosa', age: '60s', presentation: 'feminine' },
    { id: 'diego', label: 'Diego', age: '20s', presentation: 'masculine' },
    { id: 'leila', label: 'Leila', age: '30s', presentation: 'feminine', top: 'hijab' },
    { id: 'omar', label: 'Omar', age: '40s', presentation: 'masculine' },

    /* —— broader ages / styles —— */
    { id: 'zoe', label: 'Zoe', age: '20s', presentation: 'feminine' },
    { id: 'sam', label: 'Sam', age: '30s', presentation: 'neutral' },
    { id: 'ruby', label: 'Ruby', age: '50s', presentation: 'feminine' },
    { id: 'arthur', label: 'Arthur', age: '80s', presentation: 'masculine' },
    { id: 'mina', label: 'Mina', age: '40s', presentation: 'feminine', top: 'hijab' },
    { id: 'kai', label: 'Kai', age: '20s', presentation: 'neutral' },
    { id: 'pearl', label: 'Pearl', age: '90s', presentation: 'feminine' },
    { id: 'devon', label: 'Devon', age: '30s', presentation: 'neutral' },
    { id: 'chloe', label: 'Chloe', age: '20s', presentation: 'feminine' },
    { id: 'ivan', label: 'Ivan', age: '50s', presentation: 'masculine' },
    { id: 'fatima', label: 'Fatima', age: '50s', presentation: 'feminine', top: 'hijab' },
    { id: 'tomas', label: 'Tomas', age: '60s', presentation: 'masculine' },
  ];

  /** Soft backgrounds so faces read well on board / picker circles. */
  var BG_BY_PRESENTATION = {
    feminine: 'ffd5dc',
    masculine: 'b6e3f4',
    neutral: 'c0aede',
  };

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  /**
   * Build a DiceBear SVG URL for a catalog entry or ad-hoc options.
   * @param {{ style?: string, seed: string, presentation?: string, top?: string }} opts
   */
  function buildUrl(opts) {
    var style = opts.style || STYLE;
    var seed = opts.seed || 'player';
    var presentation = opts.presentation || 'neutral';
    var parts = [];
    parts.push('seed=' + encodeURIComponent(seed));
    parts.push('size=' + AVATAR_SIZE);

    var bg = BG_BY_PRESENTATION[presentation] || BG_BY_PRESENTATION.neutral;
    parts.push('backgroundColor=' + encodeURIComponent(bg));

    if (style === STYLE) {
      if (presentation === 'feminine' || presentation === 'neutral') {
        /* Avoid beards / stubble on feminine & neutral presentations. */
        parts.push('facialHairProbability=0');
      } else {
        parts.push('facialHairProbability=40');
      }
      if (opts.top) {
        parts.push('top=' + encodeURIComponent(opts.top));
      }
    }

    return API_BASE + style + '/svg?' + parts.join('&');
  }

  function buildCatalog() {
    var list = [];
    for (var i = 0; i < PERSON_DEFS.length; i++) {
      var def = PERSON_DEFS[i];
      var seed = def.seed || def.label || def.id;
      var presentation = def.presentation || 'neutral';
      list.push({
        id: def.id,
        label: def.label,
        age: def.age || '',
        presentation: presentation,
        seed: seed,
        top: def.top || null,
        url: buildUrl({
          seed: seed,
          presentation: presentation,
          top: def.top,
        }),
      });
    }
    return list;
  }

  var CATALOG = buildCatalog();

  var COMPUTER = {
    id: COMPUTER_ID,
    label: 'Computer',
    age: '',
    presentation: 'neutral',
    seed: 'QWERTY-Computer',
    url: buildUrl({
      style: COMPUTER_STYLE,
      seed: 'QWERTY-Computer',
      presentation: 'neutral',
    }),
  };

  var BY_ID = {};
  CATALOG.forEach(function (a) {
    BY_ID[a.id] = a;
  });
  BY_ID[COMPUTER_ID] = COMPUTER;

  function isValidId(id) {
    return !!(id && BY_ID[id] && id !== COMPUTER_ID);
  }

  function loadStoredAvatarId() {
    try {
      var id = localStorage.getItem(AVATAR_KEY);
      if (isValidId(id)) return id;
    } catch (_) {}
    return DEFAULT_ID;
  }

  function saveStoredAvatarId(id) {
    if (!isValidId(id)) return;
    try {
      localStorage.setItem(AVATAR_KEY, id);
    } catch (_) {}
  }

  function getById(id) {
    return BY_ID[id] || BY_ID[DEFAULT_ID];
  }

  function getUrl(id) {
    return getById(id).url;
  }

  function getMarkup(id) {
    var entry = getById(id);
    return (
      '<img class="avatar-art" src="' +
      escapeAttr(entry.url) +
      '" alt="" width="' +
      AVATAR_SIZE +
      '" height="' +
      AVATAR_SIZE +
      '" decoding="async" loading="lazy" referrerpolicy="no-referrer"/>'
    );
  }

  function paint(container, id) {
    if (!container) return;
    var avatar = container.classList && container.classList.contains('avatar')
      ? container
      : container.querySelector('.avatar');
    if (!avatar) return;
    avatar.innerHTML = getMarkup(id);
    avatar.setAttribute('data-avatar-id', id);
  }

  function listSelectable() {
    return CATALOG.slice();
  }

  function getLabel(id) {
    var entry = getById(id);
    return entry.label || id;
  }

  global.QWERTYAvatars = {
    KEY: AVATAR_KEY,
    DEFAULT_ID: DEFAULT_ID,
    COMPUTER_ID: COMPUTER_ID,
    STYLE: STYLE,
    COMPUTER_STYLE: COMPUTER_STYLE,
    API_BASE: API_BASE,
    listSelectable: listSelectable,
    isValidId: isValidId,
    loadStoredAvatarId: loadStoredAvatarId,
    saveStoredAvatarId: saveStoredAvatarId,
    getMarkup: getMarkup,
    getUrl: getUrl,
    getLabel: getLabel,
    getById: getById,
    buildUrl: buildUrl,
    paint: paint,
  };
})(typeof window !== 'undefined' ? window : globalThis);
