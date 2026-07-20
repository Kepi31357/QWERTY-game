# QWERTY — Deploy zip checklist

Use this when packaging the game for **itch.io**, **Netlify**, **Cloudflare Pages**, **GitHub Pages**, or any static host.

Current build stamp (check after updates): look for `QWERTY build` in the browser console or `QWERTY_BUILD` in `game.js`.

---

## Files to include in the zip

These must sit at the **root** of the zip (not inside a subfolder):

| File | Required | Notes |
|------|----------|--------|
| `index.html` | Yes | Entry point — hosts look for this at zip root |
| `game.js` | Yes | Main game logic |
| `styles.css` | Yes | Layout and theme |
| `utils.js` | Yes | Word/dictionary utilities |
| `dictionary.js` | Yes | Word list data |
| `favicon.svg` | Recommended | Tab icon |

### Optional (only if you add them later)

| File | Notes |
|------|--------|
| `*.mp3` or other audio | Include if referenced by `game.js` |
| `robots.txt` | Only if you want crawler rules on your own domain |
| Custom domain verification files | Per host (e.g. Netlify `_redirects`) |

---

## Files to exclude

Do **not** upload these — they are for local development on Windows only:

| File | Reason |
|------|--------|
| `OPEN GAME.bat` | Local launcher |
| `serve.ps1` | Local dev server |
| `server-port.txt` | Local port cache |
| `deploy/` | Publishing docs (optional to exclude from zip) |
| `.git/` | Version control |
| Editor folders (`.cursor/`, `.vscode/`) | Not needed in production |

---

## Pre-pack checklist

- [ ] Play the game locally via **OPEN GAME.bat** and confirm it works.
- [ ] Hard-refresh and confirm console shows the latest build (e.g. `QWERTY build 82`).
- [ ] Test: new game, drag tiles, submit word, recall, exchange, save/continue.
- [ ] Test in a second browser (or private window) to verify clean load.
- [ ] Capture **3–5 screenshots** for itch.io or your website.
- [ ] Create **cover art** (~630×500 px) for itch.io if publishing there.

---

## Build the zip (Windows)

### Option A — File Explorer

1. Select only the **include** files listed above (not the whole project folder).
2. Right-click → **Send to** → **Compressed (zipped) folder**.
3. Name it e.g. `qwerty-word-game.zip`.
4. Open the zip and confirm `index.html` is at the top level (not `QWERTY APP/index.html`).

### Option B — PowerShell (from project folder)

```powershell
Compress-Archive -Path index.html, game.js, styles.css, utils.js, dictionary.js, favicon.svg -DestinationPath qwerty-word-game.zip -Force
```

---

## itch.io upload checklist

- [ ] Create account at [itch.io](https://itch.io) → **Dashboard** → **Create new project**.
- [ ] Set **Kind of project** to **HTML**.
- [ ] Enable **This file will be played in the browser**.
- [ ] Upload `qwerty-word-game.zip`.
- [ ] Paste description from `deploy/itch-io-description.txt`.
- [ ] Add tags, cover image, and screenshots.
- [ ] Set viewport size; click **Run game** and test embedded play.
- [ ] Publish when satisfied.

### itch.io embed tips

- If the game is clipped, increase **Viewport width/height** in project settings.
- If scrollbars appear, try landscape orientation and ~1280×800 viewport.
- The `file://` redirect in `index.html` only runs locally — it does **not** affect itch.io.

---

## Custom domain + static host checklist (when ready)

1. **Buy domain** from registrar (Namecheap, Cloudflare, Google Domains, etc.).
2. **Choose host** (e.g. Netlify, Cloudflare Pages, GitHub Pages).
3. Upload the same zip contents (or connect a Git repo with those files).
4. Point DNS to the host (A/CNAME records per host docs).
5. Enable **HTTPS** (usually automatic).
6. Test `https://yourdomain.com` — game should load without `OPEN GAME.bat`.
7. Optional: add link between itch.io page and your domain.

---

## Post-deploy smoke test

- [ ] Game loads without console errors (except harmless missing favicon on some hosts before first deploy).
- [ ] Main menu → Start game works.
- [ ] Tiles drag to board and back to rack.
- [ ] Submit, recall, and timer work.
- [ ] Refresh page — Continue game works (localStorage).
- [ ] Mobile or narrow window — layout usable (optional but recommended).

---

## Quick reference: local vs hosted

| | Local (`OPEN GAME.bat`) | Hosted (itch.io / domain) |
|--|-------------------------|---------------------------|
| Server | `serve.ps1` on `127.0.0.1` | Host CDN / itch.io |
| URL | `http://127.0.0.1:PORT/` | `https://yoursite...` |
| Saves | Browser localStorage | Same — per browser, per origin |
