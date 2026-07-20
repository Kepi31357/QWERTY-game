# Design spike: BL-for-both + zero reversed words + safe adjacency

**Date:** 2026-07-10  
**Build context:** 203 = shared camera (zero reversed words; Blake start = top-right)  
**Goal of spike:** Find an architecture where:

1. Each player’s **own start is the lower-left corner of their board view** (Blake never “starts” at upper-right in his UI; Deb never at upper-right in hers).
2. **Zero reversed words** — every word reads left→right / top→bottom for that viewer (own and opponent).
3. **Adjacency stays truthful** — a tile that looks next to a letter really is next to that letter for validation.
4. **Same words** — if Deb played `BIRTH`, Blake also sees the word `BIRTH` (not `HTRIB` / `SPUORG`).

---

## 1. What “same letters and words” can mean

| Interpretation | Meaning | Compatible with BL-for-both? |
|----------------|---------|------------------------------|
| **A. Same cell ↔ letter** | Cell that holds `H` for Deb holds `H` for Blake after a pure 180° view map | Yes for positions; **no** for LTR/TTB reading of the same cells |
| **B. Same spellings** | Both see the word `BIRTH` readable LTR/TTB in their frame | Yes only if we **reletter the display** or change how moves are validated |
| **C. Identical screens** | Both see the exact same pixels/grid | Yes = shared camera; then only one physical BL exists → one player’s start is TR |

Pogo-style play needs **B** (same readable words) + per-viewer BL, not **C**.

Current build 203 is **C** (shared camera): correct readings, wrong seat for Blake’s “home corner.”

---

## 2. Impossibility result (strict grid model)

**Assumptions (what the app uses today):**

- One server letter per cell.
- Guest view = 180° position map (isometry → adjacency preserved).
- Display letter at a cell is what the player uses to plan crosswords.
- Validation uses server letters at those cells.

**Lemma:** A 180° map sends Deb’s BL start to Blake’s visual TR. Deb’s vertical `BIRTH` with `H` on BL reads **TTB = `BIRTH`** for Deb and **TTB = `HTRIB`** for Blake on the same cells.

**Corollary:** To show `BIRTH` TTB for Blake on that column you must **move letters between cells on the display** (or draw glyphs that don’t match the hit cell). Then “the letter I see here” ≠ server letter → planned crosswords fail or score wrong.

**L-shape (GROUPS + GETTER sharing `G`):** after the flip, making *both* arms read LTR and TTB with a shared first letter requires `G` in two different visual roles (left end of H and top of V) at once — unsatisfiable on one letter per cell.

**Conclusion:** Under a single shared letter-per-cell grid + display-faithful interaction + 180° BL mapping, **requirements 1–3 cannot all hold** for all positions (especially opponent L-shapes).

This is geometry, not an implementation bug.

---

## 3. Architecture options

### Option 0 — Shared camera (build 203) ✅ shipping

- Zero reversed words; adjacency perfect; same cell↔letter.
- Blake’s start square is **top-right** on the grid (both see it there).
- **Fails** requirement 1 as stated (“never start upper-right”).

### Option 1 — Restore 180° flip + toward-corner + paint

- BL-for-both; Blake’s own words mostly correct via storage; paint fixes many opponent reverses.
- L-shapes / painted hubs can still reverse or desync from server.
- **Fails** hard “zero reversed including L-shapes” + safe adjacency together.

### Option 2 — Flip isometry + **word-oriented submit** (viable path to both goals)

**Idea:** Keep 180° view so each home is visual BL. Allow display paint so words read LTR/TTB. Change the move protocol so the client submits **word + ordered cells + rack tiles**, and the server checks:

- Ordered server cells (after un-flip) spell that word using server letters + new tiles.
- Geometry / dictionary / turn rules.

Interaction for **new** tiles stays index-based (flip preserves adjacency).  
For **existing** letters, the client sends the intended reading order (visual LTR/TTB cell order for the word being played). Server does not assume “ascending row = word order”; it uses the submitted order (or `acceptedRuns` order for locked words).

**Paint** then only affects what is drawn; validation is “does this path spell `WORD`?” not “does the user correctly identify the glyph on this pixel?”

**Risks:** bigger rules/UX change; previews must use the same path logic; need excellent tests for crosswords through painted opponent words.

**Fits:** BL-for-both + readable words + adjacency of *placements* + same spellings.

### Option 3 — Dual logical boards on server

Server stores canonical + precomputed P2 view board (letters already LTR/TTB in P2 coordinates). Sync sends the viewer’s board. Moves transform P2 → canonical with an explicit mapping table (not only 180°), updated when words are committed (component layout).

**Risks:** mapping table complexity; easy to desync; heavy to build.  
**Fits:** same goals as Option 2 if the mapping is always an adjacency-preserving embedding.

### Option 4 — Viewport chrome only (not recommended)

Keep shared camera; scroll/rotate chrome so TR sits near Blake’s rack.  
Start square remains the grid’s upper-right — **fails** “never start upper-right corner square.”

---

## 4. Recommended direction

| Priority | Choice |
|----------|--------|
| Must have BL-for-both **and** zero reversed **and** safe plays | **Option 2** (flip + word-oriented submit + display paint) |
| Must ship with minimal risk | Stay on **Option 0** (203) and soften copy/UX |
| Nostalgia BL without promising zero L-shape reverses | **Option 1** |

**Spike recommendation:** pursue **Option 2** as the only path that can satisfy the written product goal without lying about adjacency.

### Option 2 shape (implementation sketch)

1. **Restore** `shouldFlipOnlineBoard()` for guest (visual BL = `START_P2`).
2. **Restore** P2 toward-corner / opening rules for *storage* so Blake’s own openings read correctly after flip with less paint.
3. **Keep** `acceptedRuns` as the spelling source of truth for committed words.
4. **Paint** display clone aggressively for LTR/TTB (maximizer / per-run reverse); drawing uses display letters.
5. **Change online submit payload** to include:
   - `word` (primary)
   - `cells` in **viewer reading order** (or server cells + `ascending: false`)
   - rack tile ids  
6. **Server `validateMove`:** build candidate spelling from cells in the given order; compare to dictionary; don’t require ascending-row order to equal the word.
7. **Client preview:** same ordered-cell spelling as server.
8. **Tests:** GROUPS+GETTER on guest reads both words; play through painted `G` still validates; Deb view unchanged.

### Out of scope for first slice

- Dual server boards (Option 3)
- Changing win score / timer / chat

---

## 5. Decision needed before coding Option 2

Confirm:

1. **OK to change submit/validate** so word order is explicit (not implied by ascending indices)?  
2. **OK that glyphs may be painted** (display ≠ raw server order) as long as submitted paths spell the right word?  
3. Prefer Option 2 now, or stay on 203 until after more playtesting?

---

**Spike status:** Option 2 implemented in **build 204**.

| Item | Status |
|------|--------|
| Constraint analysis | Done |
| Options compared | Done |
| Recommended architecture | **Option 2** |
| Code prototype | **Done — build 204** |
