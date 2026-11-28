// Optional reveal animation: card rises from the bottom, spins with a wobble, lands face-up (holo/gyro work while
// it is on screen), holds, then poofs into particles. Needs GSAP (https://gsap.com) — pass it in or load it globally.
import { renderCard, renderBack } from "./power-card.js";
import { svg } from "./icons.js";

const TIER = {
  common:   { spins: 1, spinTime: 1.8, sparks: 40,  glow: "170,195,225" },
  uncommon: { spins: 2, spinTime: 2.2, sparks: 70,  glow: "70,225,255" },
  rare:     { spins: 3, spinTime: 2.8, sparks: 120, glow: "214,107,255" },
  legendary:{ spins: 4, spinTime: 3.2, sparks: 200, glow: "255,205,80" },
};

let ui = null;
function ensureStage() {
  if (ui) return ui;
  const stage = document.createElement("div");
  stage.className = "pc-stage"; stage.hidden = true;
  stage.innerHTML = `
    <div class="pc-glow"></div>
    <div class="pc-wrap"><div class="pc-spin">
      <div class="pc-face pc-back"></div>
      <div class="pc-face pc-front"></div>
    </div></div>
    <canvas class="pc-fx"></canvas>
    <div class="pc-stage-hint">TAP TO CONTINUE</div>`;
  document.body.appendChild(stage);
  ui = { stage, wrap: stage.querySelector(".pc-wrap"), spin: stage.querySelector(".pc-spin"), glow: stage.querySelector(".pc-glow"),
         fx: stage.querySelector(".pc-fx"), front: stage.querySelector(".pc-front"), backFace: stage.querySelector(".pc-back"), tl: null };
  return ui;
}

function puff(fx, cx, cy, radius, rgb, nSparks) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  fx.width = innerWidth * dpr; fx.height = innerHeight * dpr;
  const ctx = fx.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = (a, b) => a + Math.random() * (b - a), ps = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * radius * 0.7, v = rnd(40, 220);
    ps.push({ k: "s", x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 1.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      size: rnd(radius * 0.18, radius * 0.4), grow: rnd(1.2, 2.2), life: rnd(0.7, 1.3), t: 0, tint: Math.random() > 0.7 });
  }
  for (let i = 0; i < nSparks; i++) {
    const a = rnd(0, 6.283), v = rnd(150, 680);
    ps.push({ k: "p", x: cx + rnd(-radius, radius) * 0.5, y: cy + rnd(-radius, radius) * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
      size: rnd(1.5, 4.5), life: rnd(0.6, 1.5), t: 0 });
  }
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of ps) {
      p.t += dt; const k = p.t / p.life; if (k >= 1) continue; alive++;
      const d = Math.exp(-(p.k === "s" ? 2.6 : 1.4) * dt);
      p.vx *= d; p.vy = p.vy * d + (p.k === "s" ? -20 : 520) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === "s") {
        const s = p.size * (1 + (p.grow - 1) * k), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        const c = p.tint ? rgb : "225,235,255", al = (1 - k) * (1 - k) * 0.5;
        g.addColorStop(0, `rgba(${c},${al})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill();
      } else {
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${rgb},${1 - k})`; ctx.shadowColor = `rgba(${rgb},.9)`; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    if (alive) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(last);
}

/**
 * playReveal(cardData, { index, total, hold = 3.6, gsap = window.gsap, onDone, look, colors, options, backColor })
 * Tap the overlay to skip the wait and poof early. Returns { kill() }.
 */
export function playReveal(card, { index = 0, total = 1, hold = 3.6, gsap = globalThis.gsap, onDone, look = "flat", colors, options, backColor } = {}) {
  if (!gsap) throw new Error("playReveal needs GSAP: load it globally or pass { gsap }.");
  const u = ensureStage(), T = TIER[card.rarity] || TIER.common;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  u.tl && u.tl.kill();

  const h = Math.min(innerHeight * 0.66, innerWidth * 0.84 * 1.4), w = h / 1.4;
  u.wrap.style.width = w + "px"; u.wrap.style.height = h + "px";
  const big = renderCard(card, { index, total, look, colors, options });
  u.backFace.className = "pc-face pc-back pc-back-v2";
  u.backFace.replaceChildren(renderBack({ color: backColor }));
  big.style.setProperty("--pc-w", w + "px");
  u.front.replaceChildren(big);
  u.glow.style.background = `radial-gradient(circle,rgba(${T.glow},.7) 0%,rgba(${T.glow},.25) 40%,transparent 70%)`;
  u.fx.getContext("2d").clearRect(0, 0, u.fx.width, u.fx.height);
  u.stage.hidden = false;
  gsap.set(u.wrap, { y: innerHeight * 0.75, scale: 0.8, rotationZ: 0, opacity: 1, filter: "blur(0px)", pointerEvents: "none" });
  gsap.set(u.spin, { rotationY: 0 }); gsap.set(u.glow, { opacity: 0 }); gsap.set(u.stage, { opacity: 1 });

  const tl = (u.tl = gsap.timeline({ onComplete: () => { u.stage.hidden = true; onDone && onDone(); } }));
  if (reduced) {                                                // no spin / particles
    gsap.set(u.spin, { rotationY: 180 }); gsap.set(u.wrap, { y: 0, scale: 1 });
    tl.from(u.stage, { opacity: 0, duration: 0.2 }).set(u.wrap, { pointerEvents: "auto" }).to({}, { duration: Math.min(hold, 2.5) })
      .addLabel("poof").to(u.stage, { opacity: 0, duration: 0.3 });
  } else {
    tl.from(u.stage, { opacity: 0, duration: 0.25 })
      .to(u.wrap, { y: 0, scale: 1, duration: 1.1, ease: "power3.out" }, 0)
      .to(u.spin, { rotationY: 180 + 360 * T.spins, duration: T.spinTime, ease: "power3.inOut" }, 0.55)
      .to(u.wrap, { keyframes: { rotationZ: [0, -10, 9, -7, 5, -3, 0], ease: "sine.inOut" }, duration: T.spinTime }, 0.55)
      .to(u.wrap, { scale: 1.07, duration: 0.18, ease: "power2.out" }, ">-0.1")
      .to(u.wrap, { scale: 1, duration: 0.5, ease: "elastic.out(1,0.5)" }, ">")
      .fromTo(u.glow, { opacity: (card.rarity === "rare" || card.rarity === "legendary") ? 1 : 0.8, scale: 0.7 }, { opacity: 0, scale: card.rarity === "legendary" ? 2.4 : card.rarity === "rare" ? 2 : 1.5, duration: 1.1, ease: "power2.out" }, "<-0.1")
      .set(u.wrap, { pointerEvents: "auto" })
      .to({}, { duration: hold })
      .addLabel("poof")
      .set(u.wrap, { pointerEvents: "none" })
      .call(() => { const r = u.wrap.getBoundingClientRect(); puff(u.fx, r.left + r.width / 2, r.top + r.height / 2, r.width * 0.55, T.glow, T.sparks); })
      .to(u.wrap, { scale: 1.18, opacity: 0, filter: "blur(10px)", duration: 0.28, ease: "power2.in" }, "poof")
      .to(u.stage, { opacity: 0, duration: 0.5 }, "poof+=1.2");
  }
  u.stage.onclick = () => { if (tl.time() < tl.labels.poof - 0.05) tl.seek(tl.labels.poof - 0.02, false); };
  return { kill() { tl.kill(); u.stage.hidden = true; } };
}
