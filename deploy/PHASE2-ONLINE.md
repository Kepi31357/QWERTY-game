# QWERTY Phase 2 — Online multiplayer

Friend-code 1v1 over WebSocket with server-side move validation.

**Cross-device play (Phase 2.5):** see [PHASE2.5-CROSS-DEVICE.md](./PHASE2.5-CROSS-DEVICE.md).

## Quick start (Windows) — same PC test

1. Install [Node.js LTS](https://nodejs.org/) if you have not already.
2. Double-click **`OPEN LOCAL TWO-TAB TEST.bat`**.
3. **Tab A:** Main menu → **Create Game** → copy the 6-letter code.
4. **Tab B:** **Join Game** → paste code.
5. Play — host uses green corner (bottom-left), guest sees board rotated so their start is also bottom-left.

## Quick start — different devices (same Wi‑Fi)

1. **Host:** **`OPEN ONLINE GAME.bat`** → Create Game → share code + **Copy link**.
2. **Guest:** **`JOIN FRIEND GAME.bat`** or open the copied link on their device → Join Game.

## Architecture

| File | Role |
|------|------|
| `game-engine.js` | Shared rules: validate moves, scoring, state |
| `server/index.js` | HTTP static files + WebSocket rooms |
| `online.js` | Browser WebSocket client |
| `game.js` | UI; online mode sends moves to server |

## Deploy notes

- Host the **client** on itch.io / static CDN.
- Host the **server** on Railway, Render, Fly.io, etc.
- Set `window.QWERTY_WS_URL = 'wss://your-api.example.com'` before loading `online.js`.
