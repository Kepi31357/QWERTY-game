# Avatar images (optional)

Drop PNG or SVG files here to replace or add faces without editing the SVG generator.

## How to add images

1. Add a file named after the avatar id, e.g. `maya.png` or `claire.svg`.
2. Register it in `avatars.js` under `IMAGE_OVERRIDES`:

```js
var IMAGE_OVERRIDES = {
  maya: 'avatars/maya.png',
  claire: 'avatars/claire.png',
};
```

3. If the id is **new**, also add a catalog entry in `PERSON_DEFS` (label/age; `face` can be a simple placeholder until art is ready):

```js
{ id: 'claire', label: 'Claire', age: '30s', face: { skin: '#f0c8a0', hair: '#c4a574', hairStyle: 'long', shirt: '#7c3aed', collar: true, bg: '#ede9fe' } },
```

When `IMAGE_OVERRIDES[id]` is set, that image is used everywhere (board, chat, picker). Otherwise the built-in SVG face is used.

Keep images roughly square (e.g. 256×256). They are clipped to a circle by CSS.
