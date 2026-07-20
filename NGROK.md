# Share QWERTY outside your Wi‑Fi (Ngrok)

Use this for **quick playtests with remote friends**. Your PC runs the game server; Ngrok gives you a public HTTPS link. Real-time play (WebSockets) works on that same link — no extra client config.

For an always-on public server later, see `deploy/PHASE2.5-CROSS-DEVICE.md` (Railway / Render).

---

## 1. Install Ngrok (one-time)

1. Create a free account: [https://ngrok.com/signup](https://ngrok.com/signup)
2. Install the CLI:
   - **Windows:** [Download](https://ngrok.com/download) or `winget install ngrok.ngrok`
3. Copy your authtoken from the ngrok dashboard, then in a terminal run:

```bat
ngrok config add-authtoken YOUR_TOKEN_HERE
```

4. Confirm it works:

```bat
ngrok version
```

You also need **Node.js** (same as normal online play) and the usual `OPEN ONLINE GAME.bat` dependencies.

---

## 2. Easiest path — double-click helper

1. Double-click **`OPEN WITH NGROK.bat`**
2. Wait until the browser opens an `https://….ngrok-free.app` (or similar) page
3. Click **Create Game**
4. Use **Copy link** (or share the friend code + the ngrok URL)
5. Remote friend opens that link → **Join Game**
6. Keep the black server window **open** while you play

That’s it. The helper starts Ngrok on port **3001**, sets `PUBLIC_BASE_URL` so share links are correct, and opens the public URL so WebSockets use `wss://` on the same host.

---

## 3. Manual commands (if you prefer two terminals)

**Terminal A — game server**

```bat
cd /d "C:\Users\Owner\OneDrive\Desktop\QWERTY APP"
OPEN ONLINE GAME.bat
```

Or:

```bat
cd server
set PORT=3001
node index.js
```

**Terminal B — expose it**

```bat
ngrok http 3001
```

Ngrok prints a **Forwarding** HTTPS URL, for example:

```text
https://a1b2c3d4.ngrok-free.app  ->  http://localhost:3001
```

Then:

1. Open that **https://…** URL in your browser (not `http://127.0.0.1:3001`)
2. **Create Game** → share **Copy link** / friend code with your friend
3. Friend opens the same ngrok link (with `?guest&code=…` if you copied it)

While Ngrok is running, the server also auto-detects the tunnel via `http://127.0.0.1:4040` and fills **Copy link** even if you started the server first.

Optional (so share links work before you open the ngrok URL yourself):

```bat
set PUBLIC_BASE_URL=https://a1b2c3d4.ngrok-free.app
node server/index.js
```

---

## 4. Real-time play notes

| Topic | What to know |
|--------|----------------|
| WebSockets | HTTP and WS share one port (`3001`). Ngrok tunnels both. Client uses `wss://` when the page is `https://`. |
| Extra config | **None** — do not set `QWERTY_WS_URL` unless you know you need a split host. |
| Who opens what | **Host and guest should use the ngrok HTTPS URL**, not `127.0.0.1`. |
| Free Ngrok interstitial | First visit may show an ngrok “Visit Site” warning — click through once. |
| Firewall | Not needed for remote friends (they hit Ngrok’s servers, not your LAN IP). |
| Keep alive | Leave **both** the Node server window and Ngrok running. |

Inspector UI while tunneling: [http://127.0.0.1:4040](http://127.0.0.1:4040)

---

## 5. Quick checklist for Deb (host)

- [ ] `ngrok config add-authtoken …` done once  
- [ ] `OPEN WITH NGROK.bat` (or server + `ngrok http 3001`)  
- [ ] Browser is on the **https://…ngrok…** URL  
- [ ] Create Game → send **Copy link** to friend  
- [ ] Windows stay open until the game ends  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ngrok` not found | Install CLI and reopen the terminal; or use full path to `ngrok.exe` |
| Authtoken error | Run `ngrok config add-authtoken YOUR_TOKEN` from the dashboard |
| Friend can’t connect | They must use the **ngrok** link, not your `192.168…` Wi‑Fi IP |
| Copy link still shows LAN IP | Open the game via the **ngrok https** URL, or set `PUBLIC_BASE_URL`, or wait a few seconds for auto-detect |
| WebSocket fails | Hard-refresh on the ngrok URL (`Ctrl+F5`). Avoid mixing localhost host + ngrok guest |
| Port in use | Run `STOP ONLINE SERVER.bat`, then try again |

---

## Related

- Same Wi‑Fi only: `OPEN ONLINE GAME.bat` + `JOIN FRIEND GAME.bat`  
- Same PC two tabs: `OPEN LOCAL TWO-TAB TEST.bat`  
- Cloud deploy: `deploy/PHASE2.5-CROSS-DEVICE.md`
