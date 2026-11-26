# Power cards — drop-in design

Framework-free card design: live text, rarity tiers (silver / cyan / gold), Navy Arcade look, dartboard art, holo tilt on
mouse and touch, gyro tilt on phones, and an optional reveal animation. The original "Classic" look is kept as a fallback.

```
src/power-card.css   Classic look + shared mechanics (tilt layers, reveal stage, fonts)
src/looks.css        Arcade (final), Premium; tones; card backs
src/power-card.js    renderCard, renderBack, attachTilt, createGyro
src/reveal.js        optional reveal animation (needs GSAP)
src/icons.js         icon set (game-icons.net, CC BY 3.0)
src/fonts/           Bebas Neue + Barlow Condensed (OFL)
demo/                working example + sample cards + gsap.min.js
CLAUDE_PROMPT.md     paste-ready prompt for Claude Code to port this into your project
LICENSES.md          credits you need to keep
```

Demo: `cd power-cards && python3 -m http.server 8000`, open http://localhost:8000/demo/ .
(Use a server. Gyro needs a phone and HTTPS, or localhost.)

## Options
`renderCard(card, { look: "arcade"|"classic"|"premium", tone: "navy"|"slate"|"graphite"|"green" })`
`renderBack({ variant: "board"|"emblem"|"lattice", tone })`  ·  `playReveal(card, { look, tone, back, gsap })`
Defaults: arcade, navy, board. Card `when` text is written without "Play"; the renderer adds it.
`board: "even"|"odd"|"double"|"triple"` on a card shows the lit dartboard instead of its icon.
