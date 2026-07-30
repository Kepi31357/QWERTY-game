/**
 * QWERTY avatar catalog + local persistence (UI only — no game logic).
 *
 * Add more faces:
 *  1) Append an object to PERSON_DEFS (id, label, age, face options), or
 *  2) Drop a PNG/SVG in /avatars and map it in IMAGE_OVERRIDES (see avatars/README.md).
 */
(function (global) {
  'use strict';

  var AVATAR_KEY = 'qwerty-avatar-id';
  var DEFAULT_ID = 'maya';
  var COMPUTER_ID = 'computer';

  /**
   * Optional file-based overrides. Keys = avatar id, values = path under site root.
   * Example: { maya: 'avatars/maya.png' }
   */
  var IMAGE_OVERRIDES = {
    /* Drop files in /avatars and map them here. */
  };

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
    parts.push(
      '<path d="M8 96c6-22 22-34 40-34s34 12 40 34" fill="' + shirt + '"/>'
    );
    if (opts.collar) {
      parts.push(
        '<path d="M34 68l14 10 14-10c-6 8-22 8-28 0z" fill="' + shirt2 + '"/>'
      );
    }
    parts.push('<ellipse cx="48" cy="62" rx="10" ry="8" fill="' + skin + '"/>');
    parts.push('<circle cx="48" cy="40" r="20" fill="' + skin + '"/>');

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
    } else if (opts.hairStyle === 'bun') {
      parts.push(
        '<circle cx="48" cy="16" r="9" fill="' + hair + '"/>',
        '<path d="M28 36c1-14 9-22 20-22s19 8 20 22c-4-6-12-10-20-10s-16 4-20 10z" fill="' +
          hair +
          '"/>'
      );
    } else if (opts.hairStyle === 'bangs') {
      parts.push(
        '<path d="M24 40c2-20 12-30 24-30s22 10 24 30v10c-8 2-16 4-24 4s-16-2-24-4V40z" fill="' +
          hair +
          '"/>',
        '<path d="M30 34h36c-2 6-10 10-18 10s-16-4-18-10z" fill="' + hair + '"/>',
        '<circle cx="48" cy="42" r="17" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'locs') {
      parts.push(
        '<path d="M22 30c4-16 14-24 26-24s22 8 26 24" fill="' + hair + '"/>',
        '<rect x="22" y="30" width="5" height="34" rx="2" fill="' + hair + '"/>',
        '<rect x="30" y="28" width="5" height="38" rx="2" fill="' + hair + '"/>',
        '<rect x="38" y="26" width="5" height="40" rx="2" fill="' + hair + '"/>',
        '<rect x="53" y="26" width="5" height="40" rx="2" fill="' + hair + '"/>',
        '<rect x="61" y="28" width="5" height="38" rx="2" fill="' + hair + '"/>',
        '<rect x="69" y="30" width="5" height="34" rx="2" fill="' + hair + '"/>',
        '<circle cx="48" cy="40" r="17" fill="' + skin + '"/>'
      );
    } else if (opts.hairStyle === 'waves') {
      parts.push(
        '<path d="M22 38c4-20 14-30 26-30s22 10 26 30v22c-6 6-16 10-26 10s-20-4-26-10V38z" fill="' +
          hair +
          '"/>',
        '<circle cx="48" cy="40" r="17" fill="' + skin + '"/>'
      );
    } else {
      /* buzz / crop */
      parts.push(
        '<path d="M30 34c2-12 10-18 18-18s16 6 18 18c-5-4-11-6-18-6s-13 2-18 6z" fill="' +
          hair +
          '"/>'
      );
    }

    if (opts.hairStyle !== 'hijab') {
      parts.push(
        '<ellipse cx="28" cy="42" rx="4" ry="6" fill="' + skin + '"/>',
        '<ellipse cx="68" cy="42" rx="4" ry="6" fill="' + skin + '"/>'
      );
    }

    parts.push(
      '<path d="M36 34c3-2 7-2 10 0" fill="none" stroke="' +
        brow +
        '" stroke-width="2" stroke-linecap="round"/>',
      '<path d="M50 34c3-2 7-2 10 0" fill="none" stroke="' +
        brow +
        '" stroke-width="2" stroke-linecap="round"/>'
    );

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

  /**
   * Catalog definitions — append new people here.
   * Existing ids (maya, jordan, …) must stay valid for saved selections.
   */
  var PERSON_DEFS = [
    /* —— original set (keep ids) —— */
    { id: 'maya', label: 'Maya', age: '20s', face: { skin: '#6b3f2a', hair: '#1a1210', hairStyle: 'afro', shirt: '#7c3aed', shirt2: '#5b21b6', collar: true, bg: '#ede9fe', lips: '#a84d5a', blush: true } },
    { id: 'jordan', label: 'Jordan', age: '20s', face: { skin: '#f0c8a0', hair: '#d4a017', hairStyle: 'short', shirt: '#0d9488', shirt2: '#0f766e', collar: true, bg: '#ccfbf1', lips: '#c4786a' } },
    { id: 'sofia', label: 'Sofia', age: '30s', face: { skin: '#c68642', hair: '#3b2218', hairStyle: 'long', shirt: '#f97316', shirt2: '#ea580c', collar: true, bg: '#ffedd5', lips: '#b54a4a', blush: true } },
    { id: 'kenji', label: 'Kenji', age: '30s', face: { skin: '#e0b089', hair: '#1c1c1c', hairStyle: 'side', shirt: '#2563eb', shirt2: '#1d4ed8', collar: true, bg: '#dbeafe', lips: '#b07060' } },
    { id: 'riley', label: 'Riley', age: '40s', face: { skin: '#f5d0b0', hair: '#c23b22', hairStyle: 'bob', shirt: '#16a34a', shirt2: '#15803d', collar: true, bg: '#dcfce7', lips: '#c45c5c', blush: true } },
    { id: 'marcus', label: 'Marcus', age: '50s', face: { skin: '#5c3317', hair: '#2a1a12', hairStyle: 'bald', shirt: '#ca8a04', shirt2: '#a16207', collar: true, glasses: true, bg: '#fef9c3', lips: '#8a4a42', brow: '#1a1210' } },
    { id: 'amira', label: 'Amira', age: '20s', face: { skin: '#c49a6c', hair: '#0f766e', hairStyle: 'hijab', shirt: '#1e3a5f', shirt2: '#172554', collar: true, bg: '#ecfeff', lips: '#b85c5c', blush: true } },
    { id: 'finn', label: 'Finn', age: '30s', face: { skin: '#f3c7a5', hair: '#c2410c', hairStyle: 'curly', shirt: '#166534', shirt2: '#14532d', collar: true, bg: '#dcfce7', lips: '#c07060', beard: '#9a3412' } },
    { id: 'nova', label: 'Nova', age: '20s', face: { skin: '#f0c090', hair: '#38bdf8', hairStyle: 'bob', shirt: '#111827', shirt2: '#374151', collar: true, bg: '#e0f2fe', lips: '#d46a6a', blush: true } },
    { id: 'harold', label: 'Harold', age: '70s', face: { skin: '#e8c4a0', hair: '#d1d5db', hairStyle: 'short', shirt: '#7c2d12', shirt2: '#9a3412', collar: true, glasses: true, beard: '#e5e7eb', bg: '#f3f4f6', lips: '#b07060', brow: '#9ca3af' } },
    { id: 'elena', label: 'Elena', age: '70s', face: { skin: '#8d5524', hair: '#e5e7eb', hairStyle: 'curly', shirt: '#a78bfa', shirt2: '#7c3aed', collar: true, bg: '#f5f3ff', lips: '#a85a5a', brow: '#d1d5db', blush: true } },
    { id: 'priya', label: 'Priya', age: '40s', face: { skin: '#b66e3a', hair: '#1f120c', hairStyle: 'ponytail', shirt: '#db2777', shirt2: '#be185d', collar: true, bg: '#fce7f3', lips: '#b04555', blush: true } },
    { id: 'owen', label: 'Owen', age: '60s', face: { skin: '#f5d5b8', hair: '#6b7280', hairStyle: 'buzz', shirt: '#1d4ed8', shirt2: '#1e40af', collar: true, hat: '#1e3a8a', bg: '#dbeafe', lips: '#b87868', brow: '#4b5563' } },
    { id: 'grace', label: 'Grace', age: '90s', face: { skin: '#f2d2b6', hair: '#f9fafb', hairStyle: 'bob', shirt: '#9f1239', shirt2: '#881337', collar: true, glasses: true, bg: '#ffe4e6', lips: '#c06a6a', brow: '#e5e7eb', blush: true } },

    /* —— white / light-skinned women —— */
    { id: 'claire', label: 'Claire', age: '30s', face: { skin: '#f6d7b8', hair: '#c4a574', hairStyle: 'long', shirt: '#be185d', shirt2: '#9d174d', collar: true, bg: '#fce7f3', lips: '#c45c6a', blush: true } },
    { id: 'hannah', label: 'Hannah', age: '20s', face: { skin: '#f8e0c8', hair: '#f5d76e', hairStyle: 'bangs', shirt: '#7c3aed', shirt2: '#6d28d9', collar: true, bg: '#ede9fe', lips: '#d47878', blush: true } },
    { id: 'emily', label: 'Emily', age: '40s', face: { skin: '#f0c9a8', hair: '#5c3a21', hairStyle: 'waves', shirt: '#0ea5e9', shirt2: '#0284c7', collar: true, bg: '#e0f2fe', lips: '#c06060', blush: true } },
    { id: 'sarah', label: 'Sarah', age: '50s', face: { skin: '#f3d0b0', hair: '#b45309', hairStyle: 'bob', shirt: '#059669', shirt2: '#047857', collar: true, glasses: true, bg: '#d1fae5', lips: '#b85a5a', blush: true } },
    { id: 'betty', label: 'Betty', age: '70s', face: { skin: '#f5d8bc', hair: '#e5e7eb', hairStyle: 'bun', shirt: '#c2410c', shirt2: '#9a3412', collar: true, glasses: true, bg: '#ffedd5', lips: '#c07070', brow: '#d1d5db', blush: true } },
    { id: 'olivia', label: 'Olivia', age: '20s', face: { skin: '#fae2cc', hair: '#1f2937', hairStyle: 'long', shirt: '#ec4899', shirt2: '#db2777', collar: true, bg: '#fdf2f8', lips: '#d46a7a', blush: true } },
    { id: 'whitney', label: 'Whitney', age: '30s', face: { skin: '#f7d4b5', hair: '#dc2626', hairStyle: 'ponytail', shirt: '#4f46e5', shirt2: '#4338ca', collar: true, bg: '#e0e7ff', lips: '#c85858', blush: true } },
    { id: 'irene', label: 'Irene', age: '80s', face: { skin: '#f0d0b4', hair: '#f3f4f6', hairStyle: 'short', shirt: '#831843', shirt2: '#9f1239', collar: true, glasses: true, bg: '#fce7f3', lips: '#b86868', brow: '#e5e7eb', blush: true } },

    /* —— white / light-skinned men —— */
    { id: 'blake', label: 'Blake', age: '20s', face: { skin: '#f5d0ae', hair: '#1e293b', hairStyle: 'short', shirt: '#2563eb', shirt2: '#1d4ed8', collar: true, bg: '#dbeafe', lips: '#b87868' } },
    { id: 'ethan', label: 'Ethan', age: '30s', face: { skin: '#f2c8a0', hair: '#92400e', hairStyle: 'side', shirt: '#b45309', shirt2: '#92400e', collar: true, bg: '#fef3c7', lips: '#b07060', beard: '#78350f' } },
    { id: 'greg', label: 'Greg', age: '50s', face: { skin: '#ecc9a5', hair: '#9ca3af', hairStyle: 'buzz', shirt: '#1f2937', shirt2: '#374151', collar: true, glasses: true, bg: '#f3f4f6', lips: '#a86858', brow: '#6b7280' } },
    { id: 'walter', label: 'Walter', age: '70s', face: { skin: '#e8c4a0', hair: '#f9fafb', hairStyle: 'bald', shirt: '#1e40af', shirt2: '#1e3a8a', collar: true, glasses: true, beard: '#e5e7eb', bg: '#eff6ff', lips: '#a87060', brow: '#d1d5db' } },
    { id: 'nate', label: 'Nate', age: '40s', face: { skin: '#f4d2b4', hair: '#334155', hairStyle: 'short', shirt: '#dc2626', shirt2: '#b91c1c', collar: true, bg: '#fee2e2', lips: '#b07060' } },

    /* —— Black / deep skin tones —— */
    { id: 'aisha', label: 'Aisha', age: '20s', face: { skin: '#4a2c1a', hair: '#111111', hairStyle: 'locs', shirt: '#db2777', shirt2: '#be185d', collar: true, bg: '#fce7f3', lips: '#8a4050', blush: true } },
    { id: 'jamal', label: 'Jamal', age: '30s', face: { skin: '#3b2414', hair: '#0a0a0a', hairStyle: 'short', shirt: '#16a34a', shirt2: '#15803d', collar: true, bg: '#dcfce7', lips: '#7a3a3a' } },
    { id: 'keisha', label: 'Keisha', age: '40s', face: { skin: '#5c3317', hair: '#1a1210', hairStyle: 'afro', shirt: '#7c3aed', shirt2: '#6d28d9', collar: true, bg: '#ede9fe', lips: '#8a4550', blush: true } },
    { id: 'darnell', label: 'Darnell', age: '50s', face: { skin: '#2f1b10', hair: '#4b5563', hairStyle: 'bald', shirt: '#b45309', shirt2: '#92400e', collar: true, glasses: true, beard: '#374151', bg: '#fef3c7', lips: '#6a3838', brow: '#1f2937' } },
    { id: 'nia', label: 'Nia', age: '30s', face: { skin: '#6b3f2a', hair: '#111111', hairStyle: 'bun', shirt: '#0d9488', shirt2: '#0f766e', collar: true, bg: '#ccfbf1', lips: '#9a4a55', blush: true } },
    { id: 'tyrone', label: 'Tyrone', age: '60s', face: { skin: '#4a2818', hair: '#d1d5db', hairStyle: 'short', shirt: '#1d4ed8', shirt2: '#1e40af', collar: true, glasses: true, beard: '#9ca3af', bg: '#dbeafe', lips: '#7a4040', brow: '#9ca3af' } },

    /* —— East / Southeast / South Asian —— */
    { id: 'yuki', label: 'Yuki', age: '20s', face: { skin: '#f0c9a0', hair: '#111111', hairStyle: 'bangs', shirt: '#ec4899', shirt2: '#db2777', collar: true, bg: '#fdf2f8', lips: '#c06070', blush: true } },
    { id: 'hiro', label: 'Hiro', age: '40s', face: { skin: '#e8b890', hair: '#1a1a1a', hairStyle: 'side', shirt: '#0f766e', shirt2: '#115e59', collar: true, glasses: true, bg: '#ccfbf1', lips: '#a86858' } },
    { id: 'mei', label: 'Mei', age: '50s', face: { skin: '#e0b089', hair: '#374151', hairStyle: 'bob', shirt: '#dc2626', shirt2: '#b91c1c', collar: true, bg: '#fee2e2', lips: '#b06060', brow: '#4b5563', blush: true } },
    { id: 'arjun', label: 'Arjun', age: '30s', face: { skin: '#c68642', hair: '#1a120c', hairStyle: 'short', shirt: '#7c2d12', shirt2: '#9a3412', collar: true, bg: '#ffedd5', lips: '#8a4a42', beard: '#1f120c' } },
    { id: 'ananya', label: 'Ananya', age: '20s', face: { skin: '#d4a574', hair: '#1f120c', hairStyle: 'long', shirt: '#a21caf', shirt2: '#86198f', collar: true, bg: '#fae8ff', lips: '#b04555', blush: true } },
    { id: 'suresh', label: 'Suresh', age: '60s', face: { skin: '#b66e3a', hair: '#9ca3af', hairStyle: 'bald', shirt: '#1e3a8a', shirt2: '#172554', collar: true, glasses: true, bg: '#dbeafe', lips: '#8a4a42', brow: '#6b7280' } },
    { id: 'lin', label: 'Lin', age: '30s', face: { skin: '#e8c09a', hair: '#0f172a', hairStyle: 'ponytail', shirt: '#ea580c', shirt2: '#c2410c', collar: true, bg: '#ffedd5', lips: '#b85858', blush: true } },

    /* —— Latine / Mediterranean / MENA —— */
    { id: 'lucia', label: 'Lucia', age: '20s', face: { skin: '#d4a06a', hair: '#1c1917', hairStyle: 'waves', shirt: '#e11d48', shirt2: '#be123c', collar: true, bg: '#ffe4e6', lips: '#b04550', blush: true } },
    { id: 'carlos', label: 'Carlos', age: '40s', face: { skin: '#c68642', hair: '#1c1917', hairStyle: 'short', shirt: '#15803d', shirt2: '#166534', collar: true, bg: '#dcfce7', lips: '#8a4a42', beard: '#292524' } },
    { id: 'rosa', label: 'Rosa', age: '60s', face: { skin: '#c49a6c', hair: '#e5e7eb', hairStyle: 'bun', shirt: '#7e22ce', shirt2: '#6b21a8', collar: true, glasses: true, bg: '#f3e8ff', lips: '#a85a5a', brow: '#d1d5db', blush: true } },
    { id: 'diego', label: 'Diego', age: '20s', face: { skin: '#b87a45', hair: '#0c0a09', hairStyle: 'curly', shirt: '#0369a1', shirt2: '#075985', collar: true, bg: '#e0f2fe', lips: '#8a4a42' } },
    { id: 'leila', label: 'Leila', age: '30s', face: { skin: '#c49a6c', hair: '#312e81', hairStyle: 'hijab', shirt: '#0f766e', shirt2: '#115e59', collar: true, bg: '#ecfeff', lips: '#b85c5c', blush: true } },
    { id: 'omar', label: 'Omar', age: '40s', face: { skin: '#b8885a', hair: '#1c1917', hairStyle: 'short', shirt: '#b45309', shirt2: '#92400e', collar: true, beard: '#1c1917', bg: '#fef3c7', lips: '#8a4a42' } },

    /* —— broader ages / styles —— */
    { id: 'zoe', label: 'Zoe', age: '20s', face: { skin: '#8d5524', hair: '#1a1210', hairStyle: 'afro', shirt: '#f59e0b', shirt2: '#d97706', collar: true, bg: '#fef3c7', lips: '#9a4a50', blush: true } },
    { id: 'sam', label: 'Sam', age: '30s', face: { skin: '#e8b890', hair: '#64748b', hairStyle: 'buzz', shirt: '#334155', shirt2: '#1e293b', collar: true, bg: '#f1f5f9', lips: '#a87060' } },
    { id: 'ruby', label: 'Ruby', age: '50s', face: { skin: '#f0c8a0', hair: '#991b1b', hairStyle: 'bob', shirt: '#be123c', shirt2: '#9f1239', collar: true, glasses: true, bg: '#ffe4e6', lips: '#c06060', blush: true } },
    { id: 'arthur', label: 'Arthur', age: '80s', face: { skin: '#e8c4a0', hair: '#f3f4f6', hairStyle: 'short', shirt: '#365314', shirt2: '#3f6212', collar: true, glasses: true, beard: '#e5e7eb', hat: '#3f6212', bg: '#ecfccb', lips: '#a87060', brow: '#d1d5db' } },
    { id: 'mina', label: 'Mina', age: '40s', face: { skin: '#a67c52', hair: '#0f766e', hairStyle: 'hijab', shirt: '#312e81', shirt2: '#1e1b4b', collar: true, bg: '#e0e7ff', lips: '#b85c5c', blush: true } },
    { id: 'kai', label: 'Kai', age: '20s', face: { skin: '#d4a574', hair: '#0c4a6e', hairStyle: 'curly', shirt: '#0284c7', shirt2: '#0369a1', collar: true, bg: '#e0f2fe', lips: '#a86858' } },
    { id: 'pearl', label: 'Pearl', age: '90s', face: { skin: '#f2d2b6', hair: '#ffffff', hairStyle: 'waves', shirt: '#6b21a8', shirt2: '#581c87', collar: true, glasses: true, bg: '#f3e8ff', lips: '#c06a6a', brow: '#e5e7eb', blush: true } },
    { id: 'devon', label: 'Devon', age: '30s', face: { skin: '#6b3f2a', hair: '#1a1210', hairStyle: 'locs', shirt: '#ea580c', shirt2: '#c2410c', collar: true, bg: '#ffedd5', lips: '#8a4550' } },
    { id: 'chloe', label: 'Chloe', age: '20s', face: { skin: '#f8e0c8', hair: '#fbbf24', hairStyle: 'ponytail', shirt: '#14b8a6', shirt2: '#0d9488', collar: true, bg: '#ccfbf1', lips: '#d47878', blush: true } },
    { id: 'ivan', label: 'Ivan', age: '50s', face: { skin: '#f0c9a8', hair: '#cbd5e1', hairStyle: 'buzz', shirt: '#334155', shirt2: '#1e293b', collar: true, beard: '#94a3b8', bg: '#f1f5f9', lips: '#a87060', brow: '#94a3b8' } },
    { id: 'fatima', label: 'Fatima', age: '50s', face: { skin: '#c49a6c', hair: '#9f1239', hairStyle: 'hijab', shirt: '#1e293b', shirt2: '#0f172a', collar: true, bg: '#f8fafc', lips: '#b85c5c', blush: true } },
    { id: 'tomas', label: 'Tomas', age: '60s', face: { skin: '#c68642', hair: '#e5e7eb', hairStyle: 'side', shirt: '#9a3412', shirt2: '#7c2d12', collar: true, glasses: true, beard: '#d1d5db', bg: '#ffedd5', lips: '#8a4a42', brow: '#d1d5db' } },
  ];

  function buildCatalog() {
    var list = [];
    for (var i = 0; i < PERSON_DEFS.length; i++) {
      (function (def) {
        var faceOpts = {};
        var srcFace = def.face || {};
        for (var k in srcFace) {
          if (Object.prototype.hasOwnProperty.call(srcFace, k)) faceOpts[k] = srcFace[k];
        }
        list.push({
          id: def.id,
          label: def.label,
          age: def.age || '',
          src: IMAGE_OVERRIDES[def.id] || def.src || null,
          svg: function () {
            return svg(face(faceOpts), def.id);
          },
        });
      })(PERSON_DEFS[i]);
    }
    return list;
  }

  var CATALOG = buildCatalog();

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

  function getById(id) {
    return BY_ID[id] || BY_ID[DEFAULT_ID];
  }

  function getMarkup(id) {
    var entry = getById(id);
    if (entry.src) {
      return (
        '<img class="avatar-art" src="' +
        entry.src +
        '" alt="" width="96" height="96" decoding="async"/>'
      );
    }
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

  function getLabel(id) {
    var entry = getById(id);
    return entry.label || id;
  }

  global.QWERTYAvatars = {
    KEY: AVATAR_KEY,
    DEFAULT_ID: DEFAULT_ID,
    COMPUTER_ID: COMPUTER_ID,
    IMAGE_OVERRIDES: IMAGE_OVERRIDES,
    listSelectable: listSelectable,
    isValidId: isValidId,
    loadStoredAvatarId: loadStoredAvatarId,
    saveStoredAvatarId: saveStoredAvatarId,
    getMarkup: getMarkup,
    getLabel: getLabel,
    getById: getById,
    paint: paint,
  };
})(typeof window !== 'undefined' ? window : globalThis);
