---
name: verify
description: How to run and end-to-end verify this game (static HTML+JS, no build step) with a local server and Playwright.
---

# Verifying WWE-Game

Static browser game — no build, no deps. All scripts are classic `<script src>` globals
(`player`, `match`, `DB` are readable from `page.evaluate`, including top-level `let`).

## Launch

1. Serve the repo root over HTTP (localStorage is unreliable on `file://`). Any static
   server on any port works; a 15-line `http.createServer` script is enough.
2. Drive with Playwright chromium (`npm i playwright` in a scratch dir — browsers are
   already installed on this machine). Phone-ish viewport 420x900 matches how the owner
   plays (on a phone).

## Gotchas that cost time

- Fresh profile → nickname modal first: fill `#nickname-input`, click `#nickname-confirm-btn`.
- Main-menu store button is labeled **GET CARDS**, not STORE. Exhibition is `.dash-exhibition`.
- `#game-notification` is a full-screen overlay; click it to skip. It REPLACES a pending
  notification by firing the old one's callback immediately.
- Ability popups (`#ability-popup`) block the round flow — click through them.
- Hand cards live in `#player-hand-area` wrappers with `data-uid`; `renderHand()` rebuilds
  the DOM on every click, so re-query, never reuse element handles.
- Round flow: select cards → `#btn-confirm-play` → optional popups → clash (click
  `#arena-area` to skip) → ~1.4s spotlight → next round. "Selecting" state = arena has
  exactly 1 child (the VS badge) and hand is rendered.
- Forfeit path: `#header-back-btn` on match screen → `#confirm-modal-yes-btn`.
- Test money/picks: CODES button on main menu, code `baciclau` (+1M coins, +100 picks).
- A useful match-state read: `{ match.rule, match.used, player.deck, player.picks,
  player.wins, player.losses }` via `page.evaluate`.

## Mobile checks

The owner plays on a phone. Test with `isMobile: true, hasTouch: true` contexts at
360x640, 390x844, 412x915. Key invariant: `window.innerWidth` must stay equal to the
device width on every screen — if it inflates (e.g. 360→508), mobile auto-zoom-out has
kicked in (content wider than the layout viewport), which disables the `max-width:480px`
mobile stylesheet and wrecks layout. Also assert the three auto-scaled screens
(main-menu, opp-select-screen, match-screen) have `scrollHeight == clientHeight` (no
internal scroll). Watch out: unconditional `!important` desktop rules silently beat the
mobile media query's values — scope desktop-only tweaks under `@media (min-width: 481px)`.

## Flows worth driving

- Full match to the end (checks exactly ONE win/loss recorded, lands on draft board).
- Forfeit DURING round resolution (~250ms after SEND TO THE RING) — regression for the
  double-endMatch race; assert losses +1 exactly, picks unchanged, screen = opp-select.
- Draft board pull + store pack buy (coins -cost, inventory +count).
- Watch `pageerror`/console errors throughout — the game has no error UI.
