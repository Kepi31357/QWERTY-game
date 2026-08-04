# Avatars (DiceBear)

Player faces are generated on the fly from the [DiceBear](https://www.dicebear.com/) HTTP API. No PNG/SVG files are required in this folder.

## How it works

- Style for people: `avataaars` (`https://api.dicebear.com/9.x/avataaars/svg?seed=…`)
- Computer opponent: `bottts`
- Each catalog entry in `avatars.js` has a stable **seed** (usually the display name) so the same player always gets the same face
- Expressions stay friendly: mouths `smile` / `twinkle` / `default`, calm eyes & brows (no angry / sad / scream)
- Clothes colors lean purple / orange to match QWERTY
- **Gender presentation** (`feminine` / `masculine` / `neutral`) sets `facialHairProbability`
- Hijab looks use DiceBear’s `top=hijab` option

## Adding a new face

Append an entry to `PERSON_DEFS` in `avatars.js`:

```js
{ id: 'alex', label: 'Alex', age: '20s', presentation: 'neutral' },
```

Optional fields:

- `seed` — override the DiceBear seed (defaults to `label`)
- `top` — e.g. `'hijab'` for head covering

Saved selections use the avatar **id** in `localStorage` (`qwerty-avatar-id`), so keep existing ids stable.
