# Prompt to paste into Claude (Claude Code) in your project

Copy everything below the line.

---

I have a darts-tournament web app with power cards. I want to restyle my existing cards to use the design in the
`power-cards/` folder (a framework-free reference implementation: CSS + ES modules). Please do the work in my project,
step by step, and show me a short plan before you change files.

## What the reference gives you
- `src/power-card.css` — the **Classic** (original) design and shared card mechanics (3D tilt layers, reveal stage, fonts).
  `src/looks.css` — the **final "Arcade" design** (Navy tones, ribbon type badge, dartboard art, card backs). Load both,
  `power-card.css` first. All classes are prefixed `pc-` / `pc2-`, so nothing clashes with my CSS.
  Card size comes from `--pc-w` (fixed 5:7 aspect ratio, everything inside scales with it).
  Tiers: `.pc-r-common / .pc-r-uncommon / .pc-r-rare` (silver / cyan / brushed gold).
- `src/power-card.js` — `renderCard(card, {index,total,look,tone})` builds one card element (text escaped; defaults are
  `look:"arcade"`, `tone:"navy"`); `renderBack({variant,tone})` builds a card back (`"board"` default, also `"emblem"`, `"lattice"`);
  `attachTilt()` = mouse-hover / finger-drag tilt with holo glare + foil; `createGyro({onChange,onMessage})` = gyroscope tilt on phones.
- `src/reveal.js` (optional) — `playReveal(card, {index,total,look,tone,back,gsap})`: rise, spin with wobble, land face-up, hold, particle poof. Needs GSAP.
- `src/icons.js` — game-icons.net icons (CC BY 3.0, see LICENSES.md). `src/fonts/` — Bebas Neue + Barlow Condensed.
- `demo/index.html` — working example (open through a local web server; ES modules don't load from file://).

**Design decisions already made (keep them):** Arcade look, Navy tone, dartboard card back (variant "board"). Tones
`graphite | slate | green` and looks `premium | classic` exist as alternatives only. **Keep `classic` working** — it's my fallback
if I dislike the new look: switching is just `look:"classic"` in the options.

## Card data shape the renderer expects
`{ name, rarity: "common"|"uncommon"|"rare", kind, icon, effect, when, limit, board? }`
- `kind` = short badge text: REPLAY / GAMBLE / RESTRICT (any short word works; icons for those three are built in).
- `icon` = a key in `icons.js`.
- `when` = when it can be played, written WITHOUT the word "Play" — the renderer prints "Play " + lowercased text
  (e.g. `"Before your opponent's turn."` → "Play before your opponent's turn.").
- `limit` = what it can't do / conditions.
- `board` (optional) = `"even" | "odd" | "double" | "triple"` shows a lit dartboard instead of the icon (used for parity and ×2/×3 cards).
  Without it the icon is shown in a medallion.

## What I want you to do
1. Read my project first: how cards are stored (model/JSON/DB), how they are rendered (templates or JS framework), and how
   static files are served. Tell me what you found.
2. Map my existing card fields onto the shape above. Don't invent game rules: if I lack `when` / `limit` / `kind` / `rarity`,
   add those fields with empty or sensible defaults and list which cards still need them filled in.
3. Copy `src/` into my static assets (keep `fonts/` next to the CSS) and include both CSS files globally.
4. Replace my current card markup with the new design. If I render server-side (e.g. Jinja), either render cards client-side from a
   JSON endpoint using `renderCard()`, or port `renderCard()` into a template macro producing *identical* markup and class names.
   If I use a framework (React/Vue/…), make a Card component with the same DOM and classes instead of copying innerHTML.
5. Call `attachTilt()` once on page load. Add the gyro button exactly like `demo/index.html`: hidden unless `gyro.supported`,
   toggled by a user tap (iOS only asks for motion permission from a tap), with the message shown when sensors are blocked.
   Remind me that motion sensors need HTTPS (localhost is fine for testing).
6. If I say yes, hook `playReveal()` to wherever a card is drawn or played.
7. Make the look a single config value (e.g. `CARD_LOOK = "arcade"`) so I can flip to `"classic"` or later let an admin choose it.
8. Add the icon credit line from LICENSES.md to the page footer.

## Rules
- Don't change game logic, scoring, or the stored card data beyond adding the missing fields.
- Keep the card text live (real text, not an image) so rules can be edited later.
- Keep the 5:7 aspect ratio and the `pc-` / `pc2-` class names. Change colours through the CSS variables in `looks.css`
  (`--pc2-*`, tone classes) and the tier classes rather than editing rules everywhere.
- Respect `prefers-reduced-motion` (the reference already does).

## Check your work
- Cards render with correct text for all my existing cards, in all three tiers, in the Arcade look; `look:"classic"` still works.
- Hover tilt works with a mouse; on a phone, dragging up/down tilts a card and sideways drag still scrolls a carousel.
- The gyro button shows only on touch devices; on a real phone over HTTPS the card follows the phone's tilt.
- The reveal shows the dartboard back, then the card face.
- No console errors; nothing else on the site changed visually.
