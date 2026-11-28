// Power card — render + holo tilt (pointer) + gyro tilt (phones). Plain ES module, no dependencies.
import { svg, ICONS } from "./icons.js";

export const RARITY = {
  common:   { label: "COMMON",   foil: 0 },
  uncommon: { label: "UNCOMMON", foil: 0.28 },
  rare:     { label: "RARE",     foil: 0.5 },
  legendary:{ label: "LEGENDARY",foil: 0.65 },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

function boardSvg(cls = "pc-board", cy = 95) {
  // classic keeps its original (slightly low) centre; the new looks pass cy = 85 so the bull sits exactly behind the icon
  let s = `<svg class="${cls}" viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor">`;
  [26, 52, 78, 104, 130, 156].forEach((r) => (s += `<circle cx="150" cy="${cy}" r="${r}" stroke-width="1.4"/>`));
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 + 9) * Math.PI) / 180;
    s += `<line x1="150" y1="${cy}" x2="${150 + 160 * Math.cos(a)}" y2="${cy + 160 * Math.sin(a)}" stroke-width="1"/>`;
  }
  return s + `</svg>`;
}

// Real dartboard number order, clockwise from the top. Used to light the right wedges for "even" / "odd".
const DART_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
/** Dartboard art. mode: "even" | "odd" | "double" | "triple"  (lit parts use the tier colour). */
function dartboardArt(mode) {
  const P = (r, d) => [(r * Math.cos((d * Math.PI) / 180)).toFixed(2), (r * Math.sin((d * Math.PI) / 180)).toFixed(2)];
  const sector = (r1, r2, a1, a2) => {
    const [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1);
    return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
  };
  let s = `<svg class="pc2-dboard" data-mode="${mode}" viewBox="-104 -104 208 208" aria-hidden="true"><circle r="103" class="rim"/>`;
  DART_ORDER.forEach((n, i) => {
    const c = -90 + i * 18, a1 = c - 9, a2 = c + 9;
    const lit = mode === "even" ? n % 2 === 0 : mode === "odd" ? n % 2 === 1 : false;
    const t = lit || mode === "triple" ? "lit" : "dim", d = lit || mode === "double" ? "lit" : "dim";
    const w = `w ${lit ? "lit" : "dim"}${i % 2 ? " alt" : ""}`;
    s += `<path class="${w}" d="${sector(16, 58, a1, a2)}"/><path class="${w}" d="${sector(66, 88, a1, a2)}"/>`;
    s += `<path class="r ${t}" d="${sector(58, 66, a1, a2)}"/><path class="r ${d}" d="${sector(88, 100, a1, a2)}"/>`;
  });
  return s + `<circle r="16" class="bull1"/><circle r="7" class="bull2"/></svg>`;
}

function dartboardBack() {
  const P = (r, d) => [(r * Math.cos((d * Math.PI) / 180)).toFixed(2), (r * Math.sin((d * Math.PI) / 180)).toFixed(2)];
  const sector = (r1, r2, a1, a2) => {
    const [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1);
    return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
  };
  let s = `<svg class="pc-bk-svg" viewBox="-104 -104 208 208" aria-hidden="true"><circle r="102" class="rim"/>`;
  for (let i = 0; i < 20; i++) {
    const a1 = -99 + i * 18, a2 = a1 + 18, k = i % 2;
    s += `<path class="w bw${k}" d="${sector(16, 58, a1, a2)}"/><path class="w bw${k}" d="${sector(66, 88, a1, a2)}"/>`;
    s += `<path class="r rw${k}" d="${sector(58, 66, a1, a2)}"/><path class="r rw${k}" d="${sector(88, 100, a1, a2)}"/>`;
  }
  return s + `<circle r="16" class="bull1"/><circle r="7" class="bull2"/></svg>`;
}
/**
 * Card back (dartboard). Fills its container (width 100%, 5:7).
 * color: any CSS hex (e.g. "#17488f") - sets the back's base colour, independent of the front. Default navy.
 */
export function renderBack({ color } = {}) {
  const el = document.createElement("div");
  el.className = "pc-bk pc-v2 pc-tone-navy pc-bk-board";
  el.innerHTML = `<div class="pc-bk-in">${dartboardBack()}</div>`;
  if (color) {
    const c = rgb(color);
    el.style.setProperty("--pc2-b1", color);
    el.style.setProperty("--pc2-b2", hex(mix(c, [0, 0, 0], 0.68)));
  }
  return el;
}

const KIND_ICON = { REPLAY: "cycle", GAMBLE: "clover", RESTRICT: "padlock" };
const FOIL_V2 = { arcade: { uncommon: 0.42, rare: 0.8, legendary: 0.8 }, premium: { uncommon: 0.16, rare: 0.34, legendary: 0.34 } };
// arcade / premium / classic have no own legendary design yet: they show it as "rare" (gold) with the LEGENDARY label
const vis = (tier) => (tier === "legendary" ? "rare" : tier);

/** Arcade / premium markup. Center of the dartboard is the center of the icon. */
// "flat" look: solid colours, rarity colour only on the card edge, art slot takes an image (card.image = URL / data URL)
function renderCardFlat(card, { index, total }) {
  const tier = RARITY[card.rarity] ? card.rarity : "common";
  const el = document.createElement("div");
  el.className = `pc-card pc-look-flat pc-r-${tier}`;
  el.style.setProperty("--pc-foil", tier === "legendary" ? 0.6 : tier === "rare" ? 0.5 : tier === "uncommon" ? 0.9 : 0);
  const kindKey = String(card.kind || "").toUpperCase();
  const art = card.board ? dartboardArt(card.board)
    : `<div class="pc2-orb">${card.glyph ? `<span class="pc2-glyph">${esc(card.glyph)}</span>` : svg(card.icon)}</div>`;
  el.innerHTML = `
   <div class="pcf-frame">
     <div class="pcf-title">${esc(card.name)}</div>
     <div class="pcf-artwrap">
       <div class="pcf-art">${art}</div>
       <div class="pcf-kind">${svg(KIND_ICON[kindKey] || "dart")}${esc(card.kind)}</div>
     </div>
     <div class="pcf-body">
       <div class="pcf-when">Play ${esc(card.when.charAt(0).toLowerCase() + card.when.slice(1))}</div>
       <p class="pcf-effect">${esc(card.effect)}</p>
       <div class="pcf-limit">${svg("cancel")}<span>${esc(card.limit)}</span></div>
     </div>
     <div class="pcf-foot"><span>${RARITY[tier].label}</span><span>${pad(index + 1)} / ${pad(total)}</span></div>
   </div>
   <div class="pc-foil"></div><div class="pc-sheen"></div><div class="pc-glare"></div>`;
  return el;
}

function renderCardV2(card, { index, total, look, tone }) {
  const tier = RARITY[card.rarity] ? card.rarity : "common";
  const el = document.createElement("div");
  el.className = `pc-card pc-v2 pc-look-${look} pc-tone-${tone} pc-r-${vis(tier)}`;
  el.style.setProperty("--pc-foil", (FOIL_V2[look] || FOIL_V2.arcade)[tier] ?? 0);
  const orb = card.glyph ? `<span class="pc2-glyph">${esc(card.glyph)}</span>` : svg(card.icon);
  const kindKey = String(card.kind || "").toUpperCase();
  const gem = look === "premium" ? `<span class="pc2-gem"></span>` : svg("bullseye", "pc2-gem");
  el.innerHTML = `
   <div class="pc2-frame">
     <div class="pc2-head"><span class="pc2-name">${esc(card.name)}</span>${gem}</div>
     <div class="pc2-artwrap">
       <div class="pc2-art">${card.board ? dartboardArt(card.board) : `<div class="pc2-orb">${orb}</div>`}</div>
       <div class="pc2-kindwrap"><span class="pc2-kind">${svg(KIND_ICON[kindKey] || "dart")}${esc(card.kind)}</span></div>
     </div>
     <div class="pc2-body">
       <div class="pc2-rule pc2-when"><span>Play ${esc(card.when.charAt(0).toLowerCase() + card.when.slice(1))}</span></div>
       <p class="pc2-effect">${esc(card.effect)}</p>
       <div class="pc2-rule pc2-limit">${svg("cancel")}<span>${esc(card.limit)}</span></div>
     </div>
     <div class="pc2-foot"><span class="pc2-tier">${svg("bullseye")}${RARITY[tier].label}</span><span>${pad(index + 1)} / ${pad(total)}</span></div>
   </div>
   <div class="pc-foil"></div><div class="pc-sheen"></div><div class="pc-glare"></div>`;
  return el;
}

// ---------- colour customisation ----------
const rgb = (h) => { h = String(h).replace("#", ""); if (h.length === 3) h = [...h].map((x) => x + x).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const W = [255, 255, 255], K = [0, 0, 0];

/**
 * applyColors(cardEl, look, { body, accent, glow, glowK })  - every key optional (missing = the look's default)
 *   body   = card body colour (hex)        accent = edge / rarity colour (hex)
 *   glow   = glow colour (hex)             glowK  = glow strength, 0 (off) .. 1.5 (default 1)
 * Also available as renderCard(card, { look, colors }).
 */
export function applyColors(el, look, { body, accent, glow, glowK } = {}) {
  const set = (k, v) => el.style.setProperty(k, v);
  if (body) {
    const c = rgb(body), dark = mix(c, K, 0.65), panel = mix(c, K, 0.85).map(Math.round);
    if (look === "flat") {
      set("--pcf-frame", body); set("--pcf-plate", hex(mix(c, W, 0.07))); set("--pcf-art", hex(mix(c, K, 0.45)));
    } else if (look === "classic") {
      set("--pc-body-1", body); set("--pc-body-2", hex(dark)); set("--pc-panel", `rgba(${panel},.62)`);
      set("--pc-art-1", hex(mix(c, W, 0.25))); set("--pc-art-2", hex(mix(c, K, 0.45))); set("--pc-ink2", hex(mix(c, W, 0.7)));
    } else {
      set("--pc2-b1", body); set("--pc2-b2", hex(dark)); set("--pc2-panel", `rgba(${panel},.6)`);
      set("--pc2-art1", hex(mix(c, W, 0.22))); set("--pc2-art2", hex(mix(c, K, 0.5))); set("--pc2-ink2", hex(mix(c, W, 0.72)));
    }
  }
  if (accent) {
    const c = rgb(accent), L = (t) => hex(mix(c, W, t)), D = (t) => hex(mix(c, K, t));
    set("--pc-accent", accent); set("--pc-frame-1", L(0.45)); set("--pc-frame-2", D(0.4));
    [L(0.72), L(0.2), D(0.4), L(0.55), D(0.55), L(0.1), L(0.62), D(0.2)].forEach((v, i) => set(`--pc-r${i + 1}`, v));
    [L(0.78), accent, D(0.4), L(0.4), L(0.7)].forEach((v, i) => set(`--pc-t${i + 1}`, v));
  }
  if (glow) {
    const c = rgb(glow);
    set("--pc-glow", c.join(",")); set("--pc-glow-deep", mix(c, K, 0.4).map(Math.round).join(","));
    set("--pc-glow-mid", c.join(",")); set("--pc-glow-hi", mix(c, W, 0.5).map(Math.round).join(","));
  }
  if (glowK != null) set("--pc-gk", String(glowK));
  return el;
}

/**
 * Build one card element.
 * card = { name, rarity: "common"|"uncommon"|"rare"|"legendary", kind, icon, effect, when, limit, glyph? }
 *   glyph (optional, new looks only): big text in the art circle instead of an icon, e.g. "×3", "EVEN".
 * opts.look = "flat" (default) | "classic" (original, kept as fallback) | "premium"
 * opts.look also "flat" (solid colours, rarity on the edge, card.image for artwork)
 * opts.colors = { body, accent, glow, glowK }  custom colours for this card (see applyColors)
 * card.board (optional, new looks): "even" | "odd" | "double" | "triple" draws a dartboard as the art instead of an icon
 * Text is escaped, so it is safe to pass user-edited strings.
 */
// Default design chosen in the playground. Used when renderCard gets no colors/options.
export const PRESET = {
  look: "flat",
  back: "#17488f",
  colors: {
    flat: {
      all: { patGlow: 0, patK: 0.01 },
      common: { patK: 0.05, body: "#39393c" },
      uncommon: { glowK: 0, accent: "#2796ce", patK: 0.03, patGlow: 0.11, body: "#3f4669" },
      rare: { body: "#3a1d4f", accent: "#c768e8", glow: "#d66bff" },
      legendary: { body: "#5e5f16", accent: "#e6b32e", glow: "#ffcd50" },
    },
  },
  options: {
    flat: { edgeW: 0.25, kindColor: "fill", cost: true, costIcon: "none", iconOverImage: false, costPos: "in-left", costColor: "neutral", costShape: "orb", artLine: "thick", artInset: 10, showRarity: false, patternK: 0.16, patternColor: "rarity", textureK: 0.16, artDrop: 3, patternIcon: "mix", patternSeed: 2, texture: "rock", pattern: false, titleBar: 0, costHolo: true, costSize: 0.87 },
    arcade: { cost: true },
  },
};

export function presetFor(look, rarity) {
  const c = PRESET.colors[look] || {};
  const m = { ...(c.all || {}), ...(c[rarity] || {}) };
  const { patK, patGlow, ...colors } = m;
  const options = { ...(PRESET.options[look] || {}) };
  if (patK != null) options.patternK = patK;
  if (patGlow != null) options.patternGlow = patGlow;
  return { colors, options };
}

export function renderCard(card, { index = 0, total = 1, look = PRESET.look, colors, options } = {}) {
  const el = renderCardBase(card, { index, total, look, tone: "navy" });
  const d = presetFor(look, card.rarity);
  applyColors(el, look, colors || d.colors);
  applyOptions(el, card, options || d.options);
  return el;
}

// ---------- subtle texture + scattered icon pattern ----------
const FILTERS = {
  stone: '<feTurbulence type="fractalNoise" baseFrequency=".014 .02" numOctaves="5" seed="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="2" intercept="-.5"/><feFuncG type="linear" slope="2" intercept="-.5"/><feFuncB type="linear" slope="2" intercept="-.5"/></feComponentTransfer>',
  granite: '<feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="9"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="3.2" intercept="-1.1"/><feFuncG type="linear" slope="3.2" intercept="-1.1"/><feFuncB type="linear" slope="3.2" intercept="-1.1"/></feComponentTransfer>',
  sandstone: '<feTurbulence type="fractalNoise" baseFrequency=".01 .3" numOctaves="4" seed="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.9" intercept="-.45"/><feFuncG type="linear" slope="1.9" intercept="-.45"/><feFuncB type="linear" slope="1.9" intercept="-.45"/></feComponentTransfer>',
  rock: '<feTurbulence type="turbulence" baseFrequency=".02 .026" numOctaves="5" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="-2.6" intercept="1.5"/><feFuncG type="linear" slope="-2.6" intercept="1.5"/><feFuncB type="linear" slope="-2.6" intercept="1.5"/></feComponentTransfer>',
};
const textureUrl = (kind) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420'><filter id='f' x='0' y='0' width='300' height='420' filterUnits='userSpaceOnUse'>${FILTERS[kind]}</filter><rect width='300' height='420' filter='url(#f)'/></svg>`)}")`;
const SCATTER = [[28,30,50,-18],[205,22,44,14],[120,70,36,32],[252,92,52,-30],[48,128,58,22],[170,150,40,-12],[262,200,36,40],[92,215,50,-26],[210,255,56,10],[30,300,44,28],[150,320,38,-34],[250,350,48,16],[82,385,46,-8],[190,390,36,24]];
const PK_DEFAULT = { common: 0.07, uncommon: 0.11, rare: 0.09, legendary: 0.09 };   // uncommon needs a little more to look as visible as common
const MIX = ["dart", "dartboard", "bullseye"];
function patternUrl(pick) {
  const g = SCATTER.map(([x, y, s, r], i) => {
    const body = ICONS[pick(i)] || ICONS.dart;
    return `<g transform='translate(${x} ${y}) rotate(${r} ${s / 2} ${s / 2}) scale(${(s / 512).toFixed(4)})' fill='black'>${body}</g>`;
  }).join("");
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420' width='300' height='420'>${g}</svg>`)}")`;
}
function seeded(str, seed) {                         // small deterministic random: same card + seed = same mix
  let h = 2166136261 ^ seed; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/**
 * Optional switches (all default to the look's own style):
 *   cost: true            show card.cost (a number) in the top-right corner;   costIcon: icon key ("bolt" default)
 *   iconOverImage: true   keep the icon / dartboard on top of card.image (otherwise the image replaces it)
 *   artLine: "off" | "thin" | "thick"   outline around the art window: off = neutral, thin/thick = rarity colour
 *   kindShow: false       hide the power-type badge (REPLAY / GAMBLE / RESTRICT)
 *   kindShape: "ribbon" | "plate" | "pill"          kindColor: "fill" (rarity) | "outline" (rarity) | "neutral"
 *   costIcon: "none" shows the number only    costColor: "neutral" (no rarity colour)    costShape: "orb" (3D circle; default is a ring pill)
 *   costPos: "in-right" (default) | "in-left" | "out-right" | "out-left"   (in-* stays inside the card: use for print)
 *   texture: "stone" | "granite" | "sandstone" | "rock"   textureK: 0..1 visibility (default .3)
 *   pattern: false        turn off the scattered icons (card.icon, on by default)    patternK: 0..1 visibility (defaults: common .07, uncommon .11, rare .09)    patternGlow: 0..1 glow behind the icons (default 0)    patternColor: "rarity" (default neutral)    patternIcon: "card" (default) | "dart" | "dartboard" | "bullseye" | "mix" (random per icon)    patternSeed: number (changes the random mix)
 *   titleBar: 0..1        (flat) make the title rectangle solid/darker, above the texture; titleLine:true adds a rarity outline; titleHolo:false keeps holo/glare off the bar (default: holo still covers it)
 *   costSize: number      scale of the cost badge, 1 = default (try 0.7 - 1.5)
 *   costHolo: true        let the holo/glare cover the cost badge too (also covers the title bar, so titleHolo:false is ignored)
 *   showRarity: false     hide the rarity line at the bottom (the text box grows into the space)
 *   artDrop: number       move the art window lower, in px on a 750 px wide card (0 = default)
 *   artInset: number      extra space left and right of the art window, in px on a 750 px wide card (0 = default)
 *   showNumber: true      show the "01 / 10" counter (hidden by default)
 *   fontTitle: "Bebas Neue" (default) | "Anton" | "Oswald"       fontBody: "Barlow Condensed" (default) | "Roboto Condensed" | "Oswald"
 *   edgeW: number         width of the card's rarity-coloured edge in em (0 = no edge)
 * Artwork: card.image = URL or data URL.
 */
export function applyOptions(el, card, o = {}) {
  const art = el.querySelector(".pc2-art,.pcf-art,.pc-art");
  if (card.image && art) {
    const img = document.createElement("img");
    img.className = "pc-artimg"; img.alt = ""; img.src = card.image;
    if (o.iconOverImage) { art.querySelector(".pc-board")?.remove(); art.prepend(img); } else art.replaceChildren(img);
  }
  if (o.cost && card.cost != null) {
    const c = document.createElement("div");
    c.className = "pc-cost"; c.dataset.pos = o.costPos || "in-right"; el.dataset.costpos = c.dataset.pos;
    c.innerHTML = `${o.costIcon === "none" ? "" : svg(o.costIcon || "bolt")}<span>${esc(card.cost)}</span>`;
    if (o.costIcon === "none") c.dataset.noicon = "1";
    if (o.costShape === "orb") c.dataset.shape = "orb";
    if (o.costColor === "neutral") c.dataset.color = "neutral";
    if (o.costSize != null) el.style.setProperty("--pc-cs", String(o.costSize));
    el.append(c); el.classList.add("pc-has-cost");
  }
  if (o.artLine) {
    el.dataset.artline = o.artLine;
    el.style.setProperty("--pc-ringw", o.artLine === "thick" ? ".3em" : ".12em");
    el.style.setProperty("--pc-ringc", o.artLine === "off" ? "rgba(0,0,0,.7)" : "var(--pc-accent)");
  }
  if (o.kindShow === false) el.dataset.kshow = "0";
  if (o.kindShape && o.kindShape !== "default") el.dataset.kshape = o.kindShape;
  if (o.kindColor && o.kindColor !== "default") el.dataset.kcolor = o.kindColor;
  if (o.edgeW != null) { el.style.setProperty("--pc-edge-w", o.edgeW + "em"); el.style.setProperty("--pc-edge-n", String(o.edgeW)); }
  const foil = el.querySelector(".pc-foil");
  if (o.texture && FILTERS[o.texture]) {
    const t = document.createElement("div"); t.className = "pc-tex";
    t.style.backgroundImage = textureUrl(o.texture); t.style.opacity = o.textureK ?? 0.3;
    foil ? foil.before(t) : el.append(t);
  }
  if (o.pattern !== false) {                       // scattered icons: on by default, very faint, never over the art window
    const tier = PK_DEFAULT[card.rarity] ? card.rarity : "common";
    let pick;
    if (o.patternIcon === "mix") { const rnd = seeded(card.name, o.patternSeed || 0); const list = SCATTER.map(() => MIX[Math.floor(rnd() * 3)]); pick = (i) => list[i]; }
    else { const one = o.patternIcon && o.patternIcon !== "card" ? o.patternIcon : card.icon; pick = () => one; }
    const m = patternUrl(pick);
    const layer = (color, opacity) => {
      const d = document.createElement("div"); d.className = "pc-pat";
      d.style.setProperty("-webkit-mask-image", m); d.style.maskImage = m; d.style.background = color; d.style.opacity = opacity; return d;
    };
    const glowK = o.patternGlow || 0;
    if (glowK > 0) { const gw = document.createElement("div"); gw.className = "pc-patglow"; gw.append(layer("rgb(var(--pc-glow))", Math.min(1, glowK))); foil ? foil.before(gw) : el.append(gw); }
    const pt = layer(o.patternColor === "rarity" ? "var(--pc-accent)" : "#eef3fa", o.patternK ?? PK_DEFAULT[tier]);
    foil ? foil.before(pt) : el.append(pt);
  }
  if (!o.showNumber) el.dataset.nonum = "1";
  if (o.costHolo && o.cost) el.dataset.costholo = "1";
  if (o.showRarity === false) el.dataset.nofoot = "1";
  if (o.titleBar != null || o.titleLine) { el.dataset.tbar = o.titleLine ? "line" : "solid"; el.style.setProperty("--pc-tb", String(o.titleBar ?? 0)); if (o.titleHolo === false && !o.costHolo) el.dataset.tnoholo = "1"; }
  if (o.artDrop) el.style.setProperty("--pc-ad", (o.artDrop / 34.0909).toFixed(3) + "em");
  if (o.artInset) el.style.setProperty("--pc-ai", (o.artInset / 34.0909).toFixed(3) + "em");
  if (o.fontTitle) { el.style.setProperty("--pc-ft", `"${o.fontTitle}"`); el.style.setProperty("--pc-ts", { Anton: 0.9, Oswald: 0.78 }[o.fontTitle] ?? 1); }
  if (o.fontBody) el.style.setProperty("--pc-fb", `"${o.fontBody}"`);
  return el;
}

function renderCardBase(card, { index, total, look, tone }) {
  if (look === "flat") return renderCardFlat(card, { index, total });
  if (look === "arcade" || look === "premium") return renderCardV2(card, { index, total, look, tone });
  const tier = RARITY[card.rarity] ? card.rarity : "common";
  const el = document.createElement("div");
  el.className = `pc-card pc-look-classic pc-r-${vis(tier)}`;
  el.style.setProperty("--pc-foil", RARITY[tier].foil);
  el.innerHTML = `
   <div class="pc-in">
     <div class="pc-head"><span class="pc-name">${esc(card.name)}</span><span class="pc-kind">${svg("dart")}${esc(card.kind)}</span></div>
     <div class="pc-art">${boardSvg()}<div class="pc-orb">${svg(card.icon)}</div></div>
     <div class="pc-body">
       <p class="pc-effect">${esc(card.effect)}</p>
       <div class="pc-rule"><b>${svg("stopwatch")}WHEN</b><span>${esc(card.when)}</span></div>
       <div class="pc-rule pc-limit"><b>${svg("padlock")}LIMIT</b><span>${esc(card.limit)}</span></div>
     </div>
     <div class="pc-foot"><span class="pc-tier">${svg("bullseye")}${RARITY[tier].label}</span><span>${pad(index + 1)} / ${pad(total)}</span></div>
   </div>
   <div class="pc-foil"></div><div class="pc-sheen"></div><div class="pc-glare"></div>`;
  return el;
}

/* ------------------------------------------------------------------ tilt helpers */
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/** px, py in 0..1 (0.5 = centre). Drives the card rotation, glare position and foil. */
export function setTilt(card, px, py) {
  card.style.setProperty("--pc-rx", ((0.5 - py) * 22).toFixed(1) + "deg");
  card.style.setProperty("--pc-ry", ((px - 0.5) * 26).toFixed(1) + "deg");
  card.style.setProperty("--pc-mx", (px * 100).toFixed(1) + "%");
  card.style.setProperty("--pc-my", (py * 100).toFixed(1) + "%");
  card.style.setProperty("--pc-hover", "1");
}
export function resetTilt(card) {
  card.style.setProperty("--pc-rx", "0deg");
  card.style.setProperty("--pc-ry", "0deg");
  card.style.setProperty("--pc-hover", "0");
}

/** Mouse hover (desktop) and finger drag (touch). Call once. Returns a cleanup function. */
export function attachTilt(root = document) {
  let hot = null, raf = 0;
  const onMove = (e) => {
    const c = e.target.closest && e.target.closest(".pc-card");
    if (hot && hot !== c) resetTilt(hot);
    hot = c;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setTilt(c, clamp(px, 0, 1), clamp(py, 0, 1)));
  };
  const onOut = (e) => {
    const c = e.target.closest && e.target.closest(".pc-card");
    if (c && !c.contains(e.relatedTarget)) resetTilt(c);
  };
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerout", onOut);
  return () => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerout", onOut); if (hot) resetTilt(hot); };
}

/* ------------------------------------------------------------------ gyro (phones) */
// phone lean from the gravity vector (no gimbal flips when the phone is held upright)
const DEG = Math.PI / 180;
const lean = (beta, gamma) => {
  const b = beta * DEG, g = gamma * DEG;
  return { x: Math.asin(clamp(Math.cos(b) * Math.sin(g), -1, 1)) / DEG, y: Math.asin(clamp(-Math.sin(b), -1, 1)) / DEG };
};

// default target: the reveal card if the overlay is open, else the card nearest the screen centre
function defaultActiveCard() {
  const staged = document.querySelector(".pc-stage:not([hidden]) .pc-card");
  if (staged) return staged;
  const mid = innerWidth / 2;
  let best = null, bd = Infinity;
  document.querySelectorAll(".pc-card").forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const d = Math.abs(r.left + r.width / 2 - mid);
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

/**
 * Gyro tilt controller.
 *   const gyro = createGyro({ onChange: on => ..., onMessage: text => ... });
 *   if (gyro.supported) button.hidden = false;
 *   button.onclick = () => gyro.toggle();      // MUST run from a user tap (iOS asks for permission)
 * Needs a phone/tablet, a secure page (HTTPS or localhost) and a browser that exposes motion sensors.
 */
export function createGyro({ getActiveCard = defaultActiveCard, onChange = () => {}, onMessage = () => {} } = {}) {
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
  const st = { on: false, base: null, s: null, got: false, pointing: false, card: null, timer: 0 };

  const onOrient = (e) => {
    if (e.beta == null || e.gamma == null) return;
    st.got = true;
    if (st.pointing) return;                                   // a finger on the card wins
    const l = lean(e.beta, e.gamma);
    if (!st.base) { st.base = { x: l.x, y: l.y }; st.s = { x: l.x, y: l.y }; } // first reading = neutral hold angle
    st.s.x += (l.x - st.s.x) * 0.14; st.s.y += (l.y - st.s.y) * 0.14;           // smoothing
    st.base.x += (st.s.x - st.base.x) * 0.004; st.base.y += (st.s.y - st.base.y) * 0.004; // slowly follow how you hold it
    const px = clamp(0.5 + (st.s.x - st.base.x) / 50, 0, 1), py = clamp(0.5 + (st.s.y - st.base.y) / 50, 0, 1);
    const c = getActiveCard();
    if (!c) return;
    if (st.card && st.card !== c) resetTilt(st.card);
    st.card = c;
    setTilt(c, px, py);
  };
  const down = (e) => { if (e.pointerType !== "mouse") st.pointing = true; };
  const up = () => { st.pointing = false; };

  function stop() {
    clearTimeout(st.timer);
    st.on = false;
    window.removeEventListener("deviceorientation", onOrient);
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
    if (st.card) resetTilt(st.card);
    st.card = null;
    onChange(false);
  }

  async function start() {
    onMessage("");
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {        // iOS 13+: only from a tap
      try {
        if ((await D.requestPermission()) !== "granted") {
          onMessage("Motion access was denied. On iPhone: Settings › Safari › Motion & Orientation Access.");
          return;
        }
      } catch { onMessage("This page can't ask for motion access here."); return; }
    }
    Object.assign(st, { on: true, base: null, got: false });
    window.addEventListener("deviceorientation", onOrient);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    onChange(true);
    st.timer = setTimeout(() => {                                // no events = sensors blocked
      if (st.on && !st.got) { stop(); onMessage("No motion data arrived. Motion sensors need HTTPS and a browser/webview that allows them."); }
    }, 1500);
  }

  return { supported, get on() { return st.on; }, start, stop, toggle: () => (st.on ? stop() : start()) };
}
