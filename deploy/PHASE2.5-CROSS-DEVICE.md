# QWERTY Phase 2.5 — Play on different devices

Phase 2 added friend-code multiplayer. **Phase 2.5** makes it work when Deb and Blake are on **separate phones, tablets, or computers** — not just two tabs on one PC.

Human vs human gameplay is unchanged (same server, same friend codes). Phase 2.5 adds **network sharing**, **host UI**, and **optional cloud deploy**.

---

## Quick start — same home Wi‑Fi (Deb + Blake)

### Deb (host)

1. Double-click **`OPEN ONLINE GAME.bat`**
2. Browser opens → **Create Game**
3. Copy the **friend code** and **Copy link** (or read the IP from the black server window)
4. **Keep the server window open** while playing

### Blake (guest, another device on same Wi‑Fi)

**Option A — bat file (Windows PC/laptop)**  
1. Double-click **`JOIN FRIEND GAME.bat`**
2. Enter Deb’s IP (example: `192.168.1.5`)
3. Enter the friend code if needed → **Join Game**

**Option B — phone/tablet**  
1. Connect to the **same Wi‑Fi** as Deb
2. Open the link Deb copied (or `http://DEB-IP:3001/?guest&code=XXXXXX` in Safari/Chrome)
3. Tap **Join Game**

Both players need the **same friend code**. The host creates it; the guest joins with it.

---

## Quick start — different homes (internet)

### Fast playtest (Ngrok, no deploy)

See **`NGROK.md`** or double-click **`OPEN WITH NGROK.bat`**. Exposes your local `3001` server with a public HTTPS link (WebSockets included).

### Always-on host (Railway / Render)

Deploy the Node server to a public host. Both players use the **same public URL** + friend code (no IP typing).

### 1. Deploy server (Railway example)

1. Push this project to GitHub (or zip upload)
2. [railway.app](https://railway.app) → New Project → Deploy from repo
3. Set **Start Command**: `node server/index.js`
4. Set **Root Directory** to the project folder (where `server/` lives)
5. Add variable: `PUBLIC_BASE_URL` = your Railway public URL (e.g. `https://qwerty-production.up.railway.app`)
6. Railway assigns `PORT` automatically — do not hardcode 3001 in production

### 2. Play

1. Deb opens `https://your-app.up.railway.app/`
2. **Create Game** → share code + link with Blake
3. Blake opens the same URL (or the copied link) → **Join Game**

The server serves both the game files and WebSocket on one origin — no extra client config.

### Render / Fly.io

Same idea: run `node server/index.js`, set `PUBLIC_BASE_URL`, expose HTTPS. See `render.yaml` in the project root for a Render template.

---

## Local testing (two tabs, one PC)

Use **`OPEN LOCAL TWO-TAB TEST.bat`** — opens host + guest tabs automatically (old `OPEN ONLINE GAME.bat` behavior).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blake can’t connect on Wi‑Fi | Same Wi‑Fi? Windows Firewall allowed port 3001? (`OPEN ONLINE GAME.bat` tries to add a rule) |
| `127.0.0.1` link sent to friend | Use the **network IP** or **Copy link** from host screen — `127.0.0.1` only works on Deb’s PC |
| Works at home, not across town | Deploy server (section above) — home IP is not reachable from the internet |
| Guest sees wrong corner | Hard refresh both players (`Ctrl+F5`) — guest board is rotated so start is bottom-left |

---

## Files added/changed in Phase 2.5

| File | Role |
|------|------|
| `server/index.js` | `/api/host-info`, LAN URLs, `PUBLIC_BASE_URL` |
| `game.js` | Share link UI, `?guest` / `?code` URL params, copy button |
| `OPEN ONLINE GAME.bat` | Host-only browser, firewall rule |
| `JOIN FRIEND GAME.bat` | Opens `?guest` join flow |
| `OPEN LOCAL TWO-TAB TEST.bat` | Same-PC two-tab testing |

---

## What’s next (Phase 3)

- Optional accounts and saved stats across devices
- Public matchmaking (play strangers without a code)
- Tournaments / leaderboards

Phase 2.5 does **not** require accounts — friend codes only.
