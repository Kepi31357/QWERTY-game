# QWERTY online guest/host board — task breakdown

## Current build target

- Stamp: **224**
- Design spike: `docs/design-spike-per-viewer-layout.md` (Option 2 — flip + readable paint)

## Build 224 — LIMP/EMIT validation (logical spelling for submit)

- [x] Preview/submit spell from logical board (not display paint) — fixes TIML/PMIE
- [x] Dictionary exact match on full formed words (main + crosses via resolveWordFromRun)
- [x] Clearer invalid-word errors (`invalidWords` + formatMoveValidationError)
- [x] `server/test-limp-emit.js`

## Build 223 — guest 180° visual map (logical fixed)

- [x] `viewerNeedsFlip(1)` → 180° `getVisualPosition` / `visualToLogical`
- [x] Host identity; validation uses logical board only
- [x] Guest display paint restores LTR/TTB (display-only)
- [x] `server/test-guest-visual-223.js` — ALOES/RADIO no reversal after paint

## Build 222 — rendering identity helpers (superseded for guest view)

- [x] `viewerNeedsFlip` always false; identity visual↔logical
- [x] No readable paint / display letter remaps
- [x] P2 reverse placements remapped to LTR/TTB on commit (QUIRT not TRIUQ)
- [x] Starts: P1 BL green, P2 TR amber (same for both players)
- [x] `server/test-fixed-camera.js` (RADIO, WEAN, QUIRT, OIL)

## Build 220 — relax opening start-letter rule

- [x] Opening valid if ≥1 placed tile covers player start (P1 BL / P2 TR)
- [x] No first-vs-last letter demand (HITTER with H on start H+V)
- [x] `alignP2` keeps reverse physical placements (no tile scramble)
- [x] `server/test-hitter-start.js` + updated `test-p2-normalize.js`

## Build 219 — guest 180° flip + readable display paint

- [x] Guest (`viewerPlayerId === 1`) 180° `getVisualPosition` / `visualToLogical`
- [x] Host identity; logical board fixed (row0=top, col0=left) for validation
- [x] `applyReadableViewPaint` from acceptedRuns + board-scan (atomic runs)
- [x] **Bug fix:** `letterFromOriginal(board, idx)` two-arg so paint actually runs
- [x] `rebuildOnlineDisplayBoard` uses `buildViewerDisplayBoard` (not null display)
- [x] Legend/start copy for flipped guest BL; P1 green / P2 amber colors kept
- [x] `server/test-guest-flip-bl.js`, `test-xif-reject.js`, updated flip tests
- [x] Engine keep 218 P2 LTR/TTB storage — no unsafe `!intentValid && reverse → accept`
- [x] Reject invalid intended words (XIF); do not remap to reverse (FIX)
- [x] Tests: `test-xif-reject`, `test-guest-flip-bl`, row-glow WOR reject, shared/toots/guest-display

## Build 218 — shared fixed board (superseded for view; storage kept)

- [x] P2 words store LTR / top-to-bottom (not toward-corner reverse)
- [x] Opening: P1 H first/V last on BL; P2 H last/V first on TR

## Hard constraints

1. Logical board always row0=top, col0=left for everyone (validation/scoring).
2. Guest visual is 180°; display paint is display-only (never mutates logical board).
3. Do not re-introduce unsafe reverse-intent remap for invalid words (XIF≠FIX).
4. Ctrl+F5 + NEW GAME after this change.
