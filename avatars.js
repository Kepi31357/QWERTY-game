/**
 * QWERTY avatar catalog + local persistence (UI only — no game logic).
 */
(function (global) {
  'use strict';

  var AVATAR_KEY = 'qwerty-avatar-id';
  var DEFAULT_ID = 'maya';
  var COMPUTER_ID = 'computer';

  function svg(body, gid) {
    return (
      '<svg class="avatar-art" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><clipPath id="' +
      gid +
      '-clip"><circle cx="48" cy="48" r="46"/></clipPath></defs>' +
      '<g clip-path="url(#' +
      gid +
      '-clip)">' +
      body +
      '</g>' +
      '<circle cx="48" cy="48" r="45" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>' +
      '</svg>'
    );
  }

  function face(opts) {
    var skin = opts.skin;
    var hair = opts.hair;
    var shirt = opts.shirt;
    var shirt2 = opts.shirt2 || shirt;
    var lips = opts.lips || '#c46b6b';
    var eye = opts.eye || '#1f1633';
    var brow = opts.brow || hair;
    var parts = [];

    parts.push(
      '<rect width="96" height="96" fill="' + (opts.bg || '#e8eef8') + '"/>'
    );
    /* shoulders / shirt */
    parts.push(
      '<path d="M8 96c6-22 22-34 40-34s34 12 40 34" fill="' + shirt + '"/>'
    );
    if (opts.collar) {
      parts.push(
        '<path d="M34 68l14 10 14-10c-6 8-22 8-28 0z" fill="' + shirt2 + '"/>'
      );
    }
    /* neck */
    parts.push('<ellipse cx="48" cy="62" rx="10" ry="8" fill="' + skin + '"/>');
    /* head */
    parts.push('<circle cx="48" cy="40" r="20" fill="' + skin + '"/>');

    /* hair back / styles */
    if (opts.hairStyle === 'afro') {
      parts.push(
        '<circle cx="48" cy="34" r="24" fill="' + hair + '"/>',
        '<circle cx="48" cy="40" r="18" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'long') {
      parts.push(
        '<path d="M24 38c2-18 12-28 24-28s22 10 24 28v28c-8 4-16 6-24 6s-16-2-24-6V38z" fill="' +
          hair +
          '"/>',
        '<circle cx="48" cy="40" r="18" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'bob') {
      parts.push(
        '<path d="M26 36c2-16 10-24 22-24s20 8 22 24v16c-6 8-14 12-22 12s-16-4-22-12V36z" fill="' +
          hair +
          '"/>',
        '<circle cx="48" cy="40" r="18" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'short') {
      parts.push(
        '<path d="M28 36c1-14 9-22 20-22s19 8 20 22c-4-6-12-10-20-10s-16 4-20 10z" fill="' +
          hair +
          '"/>'
      );
    } else if (opts.hairStyle === 'curly') {
      parts.push(
        '<circle cx="30" cy="28" r="8" fill="' + hair + '"/>',
        '<circle cx="48" cy="22" r="9" fill="' + hair + '"/>',
        '<circle cx="66" cy="28" r="8" fill="' + hair + '"/>',
        '<circle cx="36" cy="20" r="7" fill="' + hair + '"/>',
        '<circle cx="60" cy="20" r="7" fill="' + hair + '"/>',
        '<path d="M28 36c1-12 9-20 20-20s19 8 20 20" fill="' + hair + '"/>'
      );
    } else if (opts.hairStyle === 'bald') {
      /* subtle crown highlight */
      parts.push(
        '<path d="M34 24c4-4 10-6 14-6s10 2 14 6" fill="none" stroke="' +
          skin +
          '" stroke-width="3" opacity="0.35"/>'
      );
    } else if (opts.hairStyle === 'hijab') {
      parts.push(
        '<path d="M18 44c4-24 16-36 30-36s26 12 30 36v40H18V44z" fill="' +
          hair +
          '"/>',
        '<path d="M28 44c3-14 10-22 20-22s17 8 20 22" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'ponytail') {
      parts.push(
        '<ellipse cx="72" cy="48" rx="8" ry="16" fill="' + hair + '"/>',
        '<path d="M28 34c1-14 9-22 20-22s19 8 20 22c-4-6-12-10-20-10s-16 4-20 10z" fill="' +
          hair +
          '"/>'
      );
    } else if (opts.hairStyle === 'side') {
      parts.push(
        '<path d="M30 34c2-14 10-22 18-22 10 0 18 10 20 24-8-2-14-4-20-4-8 0-14 2-18 2z" fill="' +
          hair +
          '"/>',
        '<path d="M62 40c4 8 6 18 4 28h-8c2-10 2-20 4-28z" fill="' + hair + '"/>'
      );
    } else {
      /* buzz / crop */
      parts.push(
        '<path d="M30 34c2-12 10-18 18-18s16 6 18 18c-5-4-11-6-18-6s-13 2-18 6z" fill="' +
          hair +
          '"/>'
      );
    }

    /* ears */
    if (opts.hairStyle !== 'hijab') {
      parts.push(
        '<ellipse cx="28" cy="42" rx="4" ry="6" fill="' + skin + '"/>',
        '<ellipse cx="68" cy="42" rx="4" ry="6" fill="' + skin + '"/>'
      );
    }

    /* brows */
    parts.push(
      '<path d="M36 34c3-2 7-2 10 0" fill="none" stroke="' +
        brow +
        '" stroke-width="2" stroke-linecap="round"/>',
      '<path d="M50 34c3-2 7-2 10 0" fill="none" stroke="' +
        brow +
        '" stroke-width="2" stroke-linecap="round"/>'
    );

    /* eyes */
    parts.push(
      '<circle cx="40" cy="40" r="2.6" fill="' + eye + '"/>',
      '<circle cx="56" cy="40" r="2.6" fill="' + eye + '"/>',
      '<circle cx="39.3" cy="39.2" r="0.8" fill="#fff" opacity="0.85"/>',
      '<circle cx="55.3" cy="39.2" r="0.8" fill="#fff" opacity="0.85"/>'
    );

    if (opts.glasses) {
      parts.push(
        '<rect x="32" y="35" width="14" height="10" rx="3" fill="none" stroke="#3d3d3d" stroke-width="2"/>',
        '<rect x="50" y="35" width="14" height="10" rx="3" fill="none" stroke="#3d3d3d" stroke-width="2"/>',
        '<path d="M46 40h4" stroke="#3d3d3d" stroke-width="2"/>'
      );
    }

    /* nose / smile */
    parts.push(
      '<path d="M48 42v5" fill="none" stroke="' +
        skin +
        '" stroke-width="2" opacity="0.45" stroke-linecap="round"/>',
      '<path d="M41 50c3.5 4 10.5 4 14 0" fill="none" stroke="' +
        lips +
        '" stroke-width="2.2" stroke-linecap="round"/>'
    );

    if (opts.blush) {
      parts.push(
        '<ellipse cx="34" cy="46" rx="4" ry="2.5" fill="#f0a0a0" opacity="0.35"/>',
        '<ellipse cx="62" cy="46" rx="4" ry="2.5" fill="#f0a0a0" opacity="0.35"/>'
      );
    }

    if (opts.beard) {
      parts.push(
        '<path d="M34 48c2 12 8 16 14 16s12-4 14-16c-4 4-10 6-14 6s-10-2-14-6z" fill="' +
          opts.beard +
          '"/>'
      );
    }

    if (opts.hat) {
      parts.push(
        '<ellipse cx="48" cy="22" rx="22" ry="8" fill="' + opts.hat + '"/>',
        '<rect x="30" y="10" width="36" height="14" rx="4" fill="' + opts.hat + '"/>'
      );
    }

    return parts.join('');
  }

  var CATALOG = [
    {
      id: 'maya',
      label: 'Maya',
      age: '20s',
      svg: function () {
        return svg(
          face({
            skin: '#6b3f2a',
            hair: '#1a1210',
            hairStyle: 'afro',
            shirt: '#7c3aed',
            shirt2: '#5b21b6',
            collar: true,
            bg: '#ede9fe',
            lips: '#a84d5a',
            blush: true,
          }),
          'maya'
        );
      },
    },
    {
      id: 'jordan',
      label: 'Jordan',
      age: '20s',
      svg: function () {
        return svg(
          face({
            skin: '#f0c8a0',
            hair: '#d4a017',
            hairStyle: 'short',
            shirt: '#0d9488',
            shirt2: '#0f766e',
            collar: true,
            bg: '#ccfbf1',
            lips: '#c4786a',
          }),
          'jordan'
        );
      },
    },
    {
      id: 'sofia',
      label: 'Sofia',
      age: '30s',
      svg: function () {
        return svg(
          face({
            skin: '#c68642',
            hair: '#3b2218',
            hairStyle: 'long',
            shirt: '#f97316',
            shirt2: '#ea580c',
            collar: true,
            bg: '#ffedd5',
            lips: '#b54a4a',
            blush: true,
          }),
          'sofia'
        );
      },
    },
    {
      id: 'kenji',
      label: 'Kenji',
      age: '30s',
      svg: function () {
        return svg(
          face({
            skin: '#e0b089',
            hair: '#1c1c1c',
            hairStyle: 'side',
            shirt: '#2563eb',
            shirt2: '#1d4ed8',
            collar: true,
            bg: '#dbeafe',
            lips: '#b07060',
          }),
          'kenji'
        );
      },
    },
    {
      id: 'riley',
      label: 'Riley',
      age: '40s',
      svg: function () {
        return svg(
          face({
            skin: '#f5d0b0',
            hair: '#c23b22',
            hairStyle: 'bob',
            shirt: '#16a34a',
            shirt2: '#15803d',
            collar: true,
            bg: '#dcfce7',
            lips: '#c45c5c',
            blush: true,
          }),
          'riley'
        );
      },
    },
    {
      id: 'marcus',
      label: 'Marcus',
      age: '50s',
      svg: function () {
        return svg(
          face({
            skin: '#5c3317',
            hair: '#2a1a12',
            hairStyle: 'bald',
            shirt: '#ca8a04',
            shirt2: '#a16207',
            collar: true,
            glasses: true,
            bg: '#fef9c3',
            lips: '#8a4a42',
            brow: '#1a1210',
          }),
          'marcus'
        );
      },
    },
    {
      id: 'amira',
      label: 'Amira',
      age: '20s',
      svg: function () {
        return svg(
          face({
            skin: '#c49a6c',
            hair: '#0f766e',
            hairStyle: 'hijab',
            shirt: '#1e3a5f',
            shirt2: '#172554',
            collar: true,
            bg: '#ecfeff',
            lips: '#b85c5c',
            blush: true,
          }),
          'amira'
        );
      },
    },
    {
      id: 'finn',
      label: 'Finn',
      age: '30s',
      svg: function () {
        return svg(
          face({
            skin: '#f3c7a5',
            hair: '#c2410c',
            hairStyle: 'curly',
            shirt: '#166534',
            shirt2: '#14532d',
            collar: true,
            bg: '#dcfce7',
            lips: '#c07060',
            beard: '#9a3412',
          }),
          'finn'
        );
      },
    },
    {
      id: 'nova',
      label: 'Nova',
      age: '20s',
      svg: function () {
        return svg(
          face({
            skin: '#f0c090',
            hair: '#38bdf8',
            hairStyle: 'bob',
            shirt: '#111827',
            shirt2: '#374151',
            collar: true,
            bg: '#e0f2fe',
            lips: '#d46a6a',
            blush: true,
          }),
          'nova'
        );
      },
    },
    {
      id: 'harold',
      label: 'Harold',
      age: '70s',
      svg: function () {
        return svg(
          face({
            skin: '#e8c4a0',
            hair: '#d1d5db',
            hairStyle: 'short',
            shirt: '#7c2d12',
            shirt2: '#9a3412',
            collar: true,
            glasses: true,
            beard: '#e5e7eb',
            bg: '#f3f4f6',
            lips: '#b07060',
            brow: '#9ca3af',
          }),
          'harold'
        );
      },
    },
    {
      id: 'elena',
      label: 'Elena',
      age: '70s',
      svg: function () {
        return svg(
          face({
            skin: '#8d5524',
            hair: '#e5e7eb',
            hairStyle: 'curly',
            shirt: '#a78bfa',
            shirt2: '#7c3aed',
            collar: true,
            bg: '#f5f3ff',
            lips: '#a85a5a',
            brow: '#d1d5db',
            blush: true,
          }),
          'elena'
        );
      },
    },
    {
      id: 'priya',
      label: 'Priya',
      age: '40s',
      svg: function () {
        return svg(
          face({
            skin: '#b66e3a',
            hair: '#1f120c',
            hairStyle: 'ponytail',
            shirt: '#db2777',
            shirt2: '#be185d',
            collar: true,
            bg: '#fce7f3',
            lips: '#b04555',
            blush: true,
          }),
          'priya'
        );
      },
    },
    {
      id: 'owen',
      label: 'Owen',
      age: '60s',
      svg: function () {
        return svg(
          face({
            skin: '#f5d5b8',
            hair: '#6b7280',
            hairStyle: 'buzz',
            shirt: '#1d4ed8',
            shirt2: '#1e40af',
            collar: true,
            hat: '#1e3a8a',
            bg: '#dbeafe',
            lips: '#b87868',
            brow: '#4b5563',
          }),
          'owen'
        );
      },
    },
    {
      id: 'grace',
      label: 'Grace',
      age: '90s',
      svg: function () {
        return svg(
          face({
            skin: '#f2d2b6',
            hair: '#f9fafb',
            hairStyle: 'bob',
            shirt: '#9f1239',
            shirt2: '#881337',
            collar: true,
            glasses: true,
            bg: '#ffe4e6',
            lips: '#c06a6a',
            brow: '#e5e7eb',
            blush: true,
          }),
          'grace'
        );
      },
    },
  ];

  var COMPUTER = {
    id: COMPUTER_ID,
    label: 'Computer',
    svg: function () {
      return svg(
        [
          '<rect width="96" height="96" fill="#dbeafe"/>',
          '<path d="M10 96c6-20 20-32 38-32s32 12 38 32" fill="#3b82f6"/>',
          '<rect x="28" y="30" width="40" height="34" rx="6" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>',
          '<rect x="34" y="36" width="28" height="18" rx="2" fill="#38bdf8"/>',
          '<circle cx="40" cy="42" r="2" fill="#0f172a"/>',
          '<circle cx="56" cy="42" r="2" fill="#0f172a"/>',
          '<path d="M42 50h12" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>',
          '<rect x="44" y="64" width="8" height="8" fill="#94a3b8"/>',
          '<rect x="36" y="70" width="24" height="4" rx="2" fill="#64748b"/>',
        ].join(''),
        'computer'
      );
    },
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

  function getMarkup(id) {
    var entry = BY_ID[id] || BY_ID[DEFAULT_ID];
    return entry.svg();
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

  global.QWERTYAvatars = {
    KEY: AVATAR_KEY,
    DEFAULT_ID: DEFAULT_ID,
    COMPUTER_ID: COMPUTER_ID,
    listSelectable: listSelectable,
    isValidId: isValidId,
    loadStoredAvatarId: loadStoredAvatarId,
    saveStoredAvatarId: saveStoredAvatarId,
    getMarkup: getMarkup,
    paint: paint,
  };
})(typeof window !== 'undefined' ? window : globalThis);
