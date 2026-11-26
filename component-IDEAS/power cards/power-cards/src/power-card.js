// Power card — render + holo tilt (pointer) + gyro tilt (phones). Plain ES module, no dependencies.
import { svg } from "./icons.js";

export const RARITY = {
  common:   { label: "COMMON",   foil: 0 },
  uncommon: { label: "UNCOMMON", foil: 0.28 },
  rare:     { label: "RARE",     foil: 0.5 },
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
function ringsBack() {
  let s = `<svg class="pc-bk-svg" viewBox="0 0 250 350" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  [30, 60, 90, 120, 150, 180].forEach((r) => (s += `<circle cx="125" cy="175" r="${r}" fill="none" stroke="currentColor" stroke-width="1.3"/>`));
  for (let i = 0; i < 20; i++) { const a = (i * 18 * Math.PI) / 180; s += `<line x1="125" y1="175" x2="${125 + 230 * Math.cos(a)}" y2="${175 + 230 * Math.sin(a)}" stroke="currentColor" stroke-width=".9"/>`; }
  return s + `</svg>`;
}

/**
 * Card back. variant: "board" (full dartboard) | "emblem" (rings + bullseye medal) | "lattice" (diamond pattern + medal)
 *                     | "classic" (the original gold back, used with the classic look)
 * Fills its container (width 100%, 5:7). tone as for renderCard.
 */
export function renderBack({ variant = "board", tone = "navy" } = {}) {
  const el = document.createElement("div");
  if (variant === "classic") {
    el.className = "pc-back-in";
    let s = "";
    [30, 60, 90, 120, 150, 180].forEach((r) => (s += `<circle cx="125" cy="175" r="${r}" fill="none" stroke="currentColor" stroke-width="1.3"/>`));
    for (let i = 0; i < 20; i++) { const a = (i * 18 * Math.PI) / 180; s += `<line x1="125" y1="175" x2="${125 + 230 * Math.cos(a)}" y2="${175 + 230 * Math.sin(a)}" stroke="currentColor" stroke-width=".9"/>`; }
    el.innerHTML = `<svg class="pc-rings" viewBox="0 0 250 350" preserveAspectRatio="xMidYMid slice">${s}</svg><div class="pc-bull">${svg("bullseye")}</div>`;
    return el;
  }
  el.className = `pc-bk pc-v2 pc-tone-${tone} pc-bk-${variant}`;
  const inner = variant === "board" ? dartboardBack()
    : variant === "emblem" ? `${ringsBack()}<div class="pc-bk-medal">${svg("bullseye")}</div><div class="pc-bk-word">POWER CARD</div>`
    : `<div class="pc-bk-diamond">${svg("bullseye")}</div>`;
  el.innerHTML = `<div class="pc-bk-in">${inner}</div>`;
  return el;
}

const KIND_ICON = { REPLAY: "cycle", GAMBLE: "clover", RESTRICT: "padlock" };
const FOIL_V2 = { arcade: { uncommon: 0.42, rare: 0.8 }, premium: { uncommon: 0.16, rare: 0.34 } };

/** Arcade / premium markup. Center of the dartboard is the center of the icon. */
function renderCardV2(card, { index, total, look, tone }) {
  const tier = RARITY[card.rarity] ? card.rarity : "common";
  const el = document.createElement("div");
  el.className = `pc-card pc-v2 pc-look-${look} pc-tone-${tone} pc-r-${tier}`;
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

/**
 * Build one card element.
 * card = { name, rarity: "common"|"uncommon"|"rare", kind, icon, effect, when, limit, glyph? }
 *   glyph (optional, new looks only): big text in the art circle instead of an icon, e.g. "×3", "EVEN".
 * opts.look = "arcade" (default, final design) | "classic" (original, kept as fallback) | "premium"
 * opts.tone = "graphite" | "slate" (blue-grey mix) | "navy" | "green"   (new looks only)
 * card.board (optional, new looks): "even" | "odd" | "double" | "triple" draws a dartboard as the art instead of an icon
 * Text is escaped, so it is safe to pass user-edited strings.
 */
export function renderCard(card, { index = 0, total = 1, look = "arcade", tone = "navy" } = {}) {
  if (look === "arcade" || look === "premium") return renderCardV2(card, { index, total, look, tone });
  const tier = RARITY[card.rarity] ? card.rarity : "common";
  const el = document.createElement("div");
  el.className = `pc-card pc-r-${tier}`;
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
