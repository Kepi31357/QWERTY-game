# Avatars (DiceBear)

Player faces are generated on the fly from the [DiceBear](https://www.dicebear.com/) HTTP API. No PNG/SVG files are required in this folder.

## How it works

- Style for people: `lorelei` (`https://api.dicebear.com/9.x/lorelei/svg?seed=…`)
- Computer opponent: `bottts`
- Each catalog entry in `avatars.js` has a stable **seed** (usually the display name) so the same player always gets the same face
- Mouths are restricted to Lorelei’s **happy01–happy18** variants (no sad / distressed expressions)
- **Gender presentation** (`feminine` / `masculine` / `neutral`) sets `beardProbability` so feminine and neutral names never get beards

## Adding a new face

Append an entry to `PERSON_DEFS` in `avatars.js`:

```js
{ id: 'alex', label: 'Alex', age: '20s', presentation: 'neutral' },
```

Optional fields:

- `seed` — override the DiceBear seed (defaults to `label`)

Saved selections use the avatar **id** in `localStorage` (`qwerty-avatar-id`), so keep existing ids stable.
