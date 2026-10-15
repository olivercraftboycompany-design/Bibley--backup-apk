/* bibley-studio.js - Bibley v4 extras (2026-10-14):
   1. Verse Image Maker: turn any verse into a phone wallpaper (1080x1920) or a square post
      (1080x1080). 21 built-in backgrounds drawn on the device (v4.1: classic Night/Dawn/Parchment + 6 new scenes) (no downloaded images, works
      offline), 4 fonts, alignment, text size. Download or Share.
   2. Memorize mode: hide words step by step, peek by tapping, then a "type it from memory" test
      with a score. Your memory verses are listed with progress.
   3. (Page turn animation: removed in v4.2.)
   4. What's new: an updates log shown once per version (X closes it for good until the next update).
   Stored on the device only: "bibley_memorize_v1", "bibley_imagemaker_v1", "bibley_seen_version".
   No notifications. ASCII only in this file (symbols are written as escapes). */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !FX.ui || !C) { console.warn("Bibley studio: features bridge missing"); return; }
  const { openSheet, closeSheet, toast, h, esc, vname } = FX.ui;
  const BOOKS = C.BOOKS;
  const K_MEM = "bibley_memorize_v1", K_IMG = "bibley_imagemaker_v1";
  const LQ = "\u201C", RQ = "\u201D", DOT = "\u00B7";
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Couldn't save: storage is full"); return false; } };
  const ICON = {
    image: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>',
    brain: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8a3 3 0 0 0 0 5 3 3 0 0 0 3 4.5A3 3 0 0 0 12 19z"/><path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8a3 3 0 0 1 0 5 3 3 0 0 1-3 4.5A3 3 0 0 1 12 19z"/><path d="M12 5v14"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 8l5-4 5 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  // small deterministic random so a background looks the same every time
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ===================================================================
     1. VERSE IMAGE MAKER
     =================================================================== */
  const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const rad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  function fill(ctx, W, H, style) { ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); }
  function stars(ctx, W, H, n, seed, maxR, alpha) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, s = r() * maxR + .4; ctx.globalAlpha = (r() * .7 + .3) * alpha; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  function ridge(ctx, W, H, baseY, amp, seed, color, steps) {
    const r = rng(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, baseY);
    const n = steps || 9; let prev = baseY;
    for (let i = 1; i <= n; i++) { const x = W * i / n; const y = baseY - r() * amp + amp * .35; ctx.quadraticCurveTo(x - W / n / 2, Math.min(prev, y) - r() * amp * .5, x, y); prev = y; }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function vignette(ctx, W, H, a) { fill(ctx, W, H, rad(ctx, W / 2, H / 2, Math.min(W, H) * .35, Math.max(W, H) * .8, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0," + a + ")"]])); }

  // Each background: draw(ctx,W,H), ink (verse colour), accent (reference colour), shade (text panel strength)
  const OLD_BGS = {
    midnight: { name: "Midnight", ink: "#f3ecda", accent: "#e2c07e", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W * .3, H, [[0, "#1d2747"], [1, "#070b17"]])); fill(c, W, H, rad(c, W * .82, H * .12, 10, W * .9, [[0, "rgba(226,192,126,.30)"], [1, "rgba(226,192,126,0)"]])); stars(c, W, H * .55, 90, 7, 1.6, .7); } },
    sunrise: { name: "Sunrise", ink: "#fffaf0", accent: "#fff0c8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#2b1f4f"], [.45, "#b2486b"], [.75, "#f08a4b"], [1, "#ffd27a"]])); fill(c, W, H, rad(c, W * .5, H * .78, 10, W * .55, [[0, "rgba(255,240,200,.95)"], [.25, "rgba(255,210,140,.55)"], [1, "rgba(255,180,120,0)"]])); ridge(c, W, H, H * .86, H * .05, 3, "rgba(60,20,50,.55)", 7); ridge(c, W, H, H * .92, H * .04, 9, "rgba(35,12,35,.75)", 6); } },
    ocean: { name: "Ocean", ink: "#f2fbff", accent: "#bfefff", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#0b3d5c"], [.55, "#0e6f8e"], [1, "#062a3f"]])); for (let i = 0; i < 7; i++) { const y = H * (.62 + i * .06); c.strokeStyle = "rgba(255,255,255," + (.10 - i * .01) + ")"; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x / 90 + i) * 14; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); } fill(c, W, H, rad(c, W * .3, H * .18, 10, W * .7, [[0, "rgba(190,240,255,.22)"], [1, "rgba(190,240,255,0)"]])); } },
    forest: { name: "Forest", ink: "#f4f7ee", accent: "#d8e8b0", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#c9d9b4"], [.35, "#6f9a76"], [1, "#16301f"]])); ridge(c, W, H, H * .55, H * .1, 11, "rgba(60,100,75,.55)", 8); ridge(c, W, H, H * .66, H * .1, 21, "rgba(35,70,50,.75)", 10); const r = rng(5); c.fillStyle = "#0f2418"; for (let i = 0; i < 26; i++) { const x = r() * W, b = H * (.78 + r() * .1), th = H * (.12 + r() * .1), tw = th * .28; c.beginPath(); c.moveTo(x, b - th); c.lineTo(x - tw, b); c.lineTo(x + tw, b); c.closePath(); c.fill(); } c.fillRect(0, H * .86, W, H); } },
    galaxy: { name: "Galaxy", ink: "#f6f0ff", accent: "#d9c2ff", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#140b2e"], [1, "#05030e"]])); fill(c, W, H, rad(c, W * .25, H * .3, 10, W * .8, [[0, "rgba(140,80,220,.45)"], [1, "rgba(140,80,220,0)"]])); fill(c, W, H, rad(c, W * .8, H * .7, 10, W * .7, [[0, "rgba(60,120,230,.35)"], [1, "rgba(60,120,230,0)"]])); stars(c, W, H, 260, 42, 1.8, .9); } },
    dusk: { name: "Desert", ink: "#fff7ee", accent: "#ffe0b3", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#3c2f6b"], [.5, "#c56b6b"], [1, "#f2b26b"]])); fill(c, W, H, rad(c, W * .7, H * .62, 10, W * .25, [[0, "rgba(255,236,190,1)"], [.5, "rgba(255,220,160,.5)"], [1, "rgba(255,200,150,0)"]])); ridge(c, W, H, H * .74, H * .04, 13, "#a8584f", 4); ridge(c, W, H, H * .82, H * .05, 17, "#7a3c3f", 3); ridge(c, W, H, H * .9, H * .04, 19, "#4f2533", 3); } },
    mountains: { name: "Mountains", ink: "#ffffff", accent: "#ffe7b8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#f7c59f"], [.35, "#9fb7d9"], [1, "#2c3e63"]])); ridge(c, W, H, H * .55, H * .16, 31, "rgba(110,135,175,.85)", 6); ridge(c, W, H, H * .66, H * .14, 37, "rgba(70,92,135,.9)", 7); ridge(c, W, H, H * .78, H * .1, 41, "rgba(40,55,90,.95)", 8); ridge(c, W, H, H * .9, H * .06, 47, "#1b2540", 9); } },
    parchment: { name: "Scroll", ink: "#3a2d1f", accent: "#8a6420", light: true, draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#f8f0dc"], [1, "#e6d5b0"]])); const r = rng(77); for (let i = 0; i < 1400; i++) { c.fillStyle = "rgba(120,90,40," + (r() * .06) + ")"; c.fillRect(r() * W, r() * H, 2, 2); } fill(c, W, H, rad(c, W / 2, H / 2, Math.min(W, H) * .3, Math.max(W, H) * .75, [[0, "rgba(120,80,20,0)"], [1, "rgba(120,80,20,.28)"]])); } },
    bokeh: { name: "Glow", ink: "#fff9ef", accent: "#ffd79a", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#2a1a10"], [1, "#0d0a14"]])); const r = rng(99); const cols = ["255,200,120", "255,150,90", "255,230,170", "200,160,255"]; for (let i = 0; i < 34; i++) { const x = r() * W, y = r() * H, rr = 30 + r() * 120, col = cols[i % 4]; fill(c, W, H, rad(c, x, y, 0, rr, [[0, "rgba(" + col + "," + (.18 + r() * .25) + ")"], [.7, "rgba(" + col + ",.08)"], [1, "rgba(" + col + ",0)"]])); } } },
    aurora: { name: "Aurora", ink: "#f0fff8", accent: "#a8ffd8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#04121c"], [1, "#0a1f2c"]])); stars(c, W, H * .7, 120, 3, 1.4, .8); [["60,230,160", .30, 0], ["120,120,255", .55, 1.7], ["40,200,220", .42, 3.1]].forEach(([col, y0, ph]) => { for (let k = 0; k < 18; k++) { c.strokeStyle = "rgba(" + col + "," + (.05) + ")"; c.lineWidth = 40 - k * 1.5; c.beginPath(); for (let x = -20; x <= W + 20; x += 24) { const y = H * y0 + Math.sin(x / 160 + ph) * 70 + Math.sin(x / 57 + ph) * 18 + k * 6; x > -20 ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } }); ridge(c, W, H, H * .9, H * .04, 5, "#020a10", 10); } },
    light: { name: "Clean", ink: "#1d2230", accent: "#8a6420", light: true, draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#ffffff"], [1, "#efe9dc"]])); c.strokeStyle = "rgba(138,100,32,.35)"; c.lineWidth = 3; c.strokeRect(54, 54, W - 108, H - 108); } },
    cross: { name: "Cross", ink: "#fbf5e6", accent: "#f0cf8a", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#0d1222"], [1, "#1c1630"]])); const cx = W / 2, cy = H * .2; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.fillStyle = "rgba(240,207,138," + (i % 2 ? .035 : .06) + ")"; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * W * 2, cy + Math.sin(a) * W * 2); c.lineTo(cx + Math.cos(a + .13) * W * 2, cy + Math.sin(a + .13) * W * 2); c.closePath(); c.fill(); } fill(c, W, H, rad(c, cx, cy, 5, W * .5, [[0, "rgba(255,230,170,.55)"], [1, "rgba(255,230,170,0)"]])); const s = Math.min(W, H) * .07; c.fillStyle = "rgba(255,240,210,.9)"; c.fillRect(cx - s * .13, cy - s, s * .26, s * 2.1); c.fillRect(cx - s * .65, cy - s * .45, s * 1.3, s * .26); } }
  };

  // ---- v4.1 backgrounds (2026-10-14): the 3 classic share-card styles + 6 new scenes ----
  let _grain = null;
  function grain(ctx, W, H, a) {
    try {
      if (!_grain) { _grain = document.createElement("canvas"); _grain.width = _grain.height = 192; const g = _grain.getContext("2d"), id = g.createImageData(192, 192), r = rng(1234); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255 | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "overlay"; ctx.fillStyle = ctx.createPattern(_grain, "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore();
    } catch {}
  }
  // classic card look (the old "share as image" styles): diagonal gradient, corner glow, double gold frame
  function classic(s) {
    return function (c, W, H) {
      fill(c, W, H, lin(c, 0, 0, W * .4, H, [[0, s.bg[0]], [1, s.bg[1]]]));
      const R = 700 * Math.max(1, H / 1350);
      fill(c, W, H, rad(c, W * .8, H * .15, 20, R, [[0, s.glow], [1, "rgba(0,0,0,0)"]]));
      c.strokeStyle = s.gold; c.globalAlpha = .55; c.lineWidth = 3; c.strokeRect(46, 46, W - 92, H - 92);
      c.globalAlpha = .25; c.lineWidth = 1.5; c.strokeRect(62, 62, W - 124, H - 124); c.globalAlpha = 1;
    };
  }
  function glowStars(c, W, H, n, seed) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, s = 2 + r() * 2.5; c.fillStyle = rad(c, x, y, 0, s * 7, [[0, "rgba(255,255,255,.9)"], [.15, "rgba(220,230,255,.35)"], [1, "rgba(220,230,255,0)"]]); c.fillRect(x - s * 7, y - s * 7, s * 14, s * 14); c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - s * 5, y); c.lineTo(x + s * 5, y); c.moveTo(x, y - s * 5); c.lineTo(x, y + s * 5); c.stroke(); } }
  function hill(c, W, H, baseY, amp, f, ph, color) { c.fillStyle = color; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 10; x += 10) c.lineTo(x, baseY - Math.sin(x / W * Math.PI * f + ph) * amp - Math.sin(x / W * Math.PI * f * 3.1 + ph * 2) * amp * .18); c.lineTo(W, H); c.closePath(); c.fill(); }
  function pine(c, x, b, h, color) { c.fillStyle = color; const w = h * .32; c.beginPath(); c.moveTo(x, b - h); for (let k = 0; k < 4; k++) { const yy = b - h + h * (k + 1) / 4.3, ww = w * (k + 1) / 4; c.lineTo(x + ww, yy); c.lineTo(x + ww * .45, yy); } c.lineTo(x + w * .12, b); c.lineTo(x - w * .12, b); for (let k = 3; k >= 0; k--) { const yy = b - h + h * (k + 1) / 4.3, ww = w * (k + 1) / 4; c.lineTo(x - ww * .45, yy); c.lineTo(x - ww, yy); } c.closePath(); c.fill(); }
  function cloud(c, x, y, s, col, a, seed) { const r = rng(seed); for (let i = 0; i < 9; i++) { const cx = x + (r() - .5) * s * 2.2, cy = y + (r() - .6) * s * .55, rr = s * (.35 + r() * .45); c.fillStyle = rad(c, cx, cy, 0, rr, [[0, "rgba(" + col + "," + a + ")"], [.6, "rgba(" + col + "," + (a * .75) + ")"], [1, "rgba(" + col + ",0)"]]); c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fill(); } }
  function rays(c, cx, cy, n, len, col, seed) { const r = rng(seed); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, w = .02 + r() * .05; c.fillStyle = lin(c, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, [[0, "rgba(" + col + "," + (.10 + r() * .1) + ")"], [1, "rgba(" + col + ",0)"]]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a - w) * len, cy + Math.sin(a - w) * len); c.lineTo(cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len); c.closePath(); c.fill(); } }

  function streak(c, x, y, w, h, col, a) { c.save(); c.translate(x, y); c.scale(w / h, 1); c.fillStyle = rad(c, 0, 0, 0, h, [[0, "rgba(" + col + "," + a + ")"], [.5, "rgba(" + col + "," + (a * .5) + ")"], [1, "rgba(" + col + ",0)"]]); c.beginPath(); c.arc(0, 0, h, 0, Math.PI * 2); c.fill(); c.restore(); }
  function peaks(c, W, baseY, amp, seed, n, color) { const r = rng(seed); c.fillStyle = color; c.beginPath(); c.moveTo(0, baseY + 2); let x = 0; c.lineTo(0, baseY - r() * amp * .5); while (x < W) { const step = W / n * (.5 + r()); x += step / 2; c.lineTo(x, baseY - amp * (.45 + r() * .55)); x += step / 2; c.lineTo(x, baseY - amp * (.1 + r() * .35)); } c.lineTo(W + 10, baseY + 2); c.closePath(); c.fill(); }
  const NEW_BGS = {
    night: { name: "Night", classic: true, scrim: .3, ink: "#efe7d4", accent: "#d8b673", draw: classic({ bg: ["#1b2440", "#0b1020"], gold: "#d8b673", glow: "#c9a86733" }) },
    dawn: { name: "Dawn", classic: true, scrim: .45, ink: "#fff7ec", accent: "#ffe2a8", draw: classic({ bg: ["#3a2a5e", "#e08a5b"], gold: "#ffe2a8", glow: "#ffd9a044" }) },
    paper: { name: "Parchment", classic: true, light: true, scrim: .5, ink: "#3b2f22", accent: "#8a6420", draw: classic({ bg: ["#f7efdc", "#e9dcbc"], gold: "#8a6420", glow: "#8a642022" }) },
    moonlight: { name: "Moonlight", isNew: true, ink: "#f4f1ff", accent: "#e9dcaa", draw(c, W, H) {
      fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#03061a"], [.45, "#0d1b40"], [.8, "#25386a"], [1, "#3b4a7a"]]));
      fill(c, W, H, rad(c, W * .5, H * 1.05, 10, H * .7, [[0, "rgba(120,140,220,.35)"], [1, "rgba(120,140,220,0)"]]));
      stars(c, W, H * .8, 320, 61, 1.5, .85); glowStars(c, W, H * .6, 9, 62);
      const mx = W * .72, my = H * .15, mr = Math.min(W, H) * .1;
      fill(c, W, H, rad(c, mx, my, mr * .8, mr * 5, [[0, "rgba(240,230,190,.38)"], [.3, "rgba(200,200,240,.12)"], [1, "rgba(200,200,240,0)"]]));
      c.save(); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.clip();
      fill(c, W, H, rad(c, mx - mr * .3, my - mr * .3, 2, mr * 1.3, [[0, "#fffbe8"], [1, "#e6dcb6"]]));
      const cr = rng(8); for (let i = 0; i < 9; i++) { c.fillStyle = "rgba(170,160,130," + (.12 + cr() * .12) + ")"; c.beginPath(); c.arc(mx + (cr() - .5) * mr * 1.6, my + (cr() - .5) * mr * 1.6, mr * (.06 + cr() * .14), 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "rgba(12,22,56,.9)"; c.beginPath(); c.arc(mx - mr * .45, my - mr * .2, mr * .95, 0, Math.PI * 2); c.fill(); c.restore();
      fill(c, W, H, lin(c, 0, H * .72, 0, H * .86, [[0, "rgba(150,170,230,0)"], [.6, "rgba(150,170,230,.18)"], [1, "rgba(150,170,230,0)"]]));
      hill(c, W, H, H * .84, H * .035, 1.6, .4, "#141c3c"); hill(c, W, H, H * .9, H * .03, 2.3, 2.1, "#0a1028");
      const pr = rng(19); for (let i = 0; i < 14; i++) { const x = pr() * W, b = H * (.885 + pr() * .02); pine(c, x, b, H * (.05 + pr() * .05), "#060a1c"); }
      c.fillStyle = lin(c, 0, H * .93, 0, H, [[0, "#060a1c"], [1, "#03050f"]]); c.fillRect(0, H * .93, W, H * .07); grain(c, W, H, .06);
    } },
    lakeside: { name: "Lakeside", isNew: true, ink: "#fff8f0", accent: "#ffd9a0", scrim: .5, draw(c, W, H) {
      const hy = H * .7;
      const scene = () => {
        fill(c, W, H, lin(c, 0, 0, 0, hy, [[0, "#1c1846"], [.35, "#5a2d6e"], [.65, "#c8506a"], [.85, "#f5875a"], [1, "#ffc978"]]));
        fill(c, W, H, rad(c, W * .5, hy, 10, W * .75, [[0, "rgba(255,236,190,.95)"], [.18, "rgba(255,200,130,.55)"], [1, "rgba(255,170,120,0)"]]));
        c.fillStyle = "#fff3d6"; c.beginPath(); c.arc(W * .5, hy - 4, Math.min(W, H) * .07, Math.PI, 0); c.fill();
        streak(c, W * .25, hy * .5, W * .5, H * .012, "255,180,160", .35); streak(c, W * .7, hy * .36, W * .6, H * .016, "255,160,170", .3); streak(c, W * .6, hy * .66, W * .45, H * .01, "255,215,170", .4); streak(c, W * .15, hy * .78, W * .4, H * .008, "255,220,180", .35);
        peaks(c, W, hy, H * .09, 23, 7, "#6b3a62"); peaks(c, W, hy, H * .05, 29, 11, "#3f2148");
        c.fillStyle = "#2a1636"; c.fillRect(0, hy - 6, W, H);
      };
      c.save(); c.beginPath(); c.rect(0, 0, W, hy); c.clip(); scene(); c.restore();
      c.save(); c.beginPath(); c.rect(0, hy, W, H - hy); c.clip(); c.translate(0, hy * 2); c.scale(1, -1); scene(); c.restore();
      c.fillStyle = lin(c, 0, hy, 0, H, [[0, "rgba(30,16,50,.35)"], [1, "rgba(14,8,28,.9)"]]); c.fillRect(0, hy, W, H - hy);
      const r = rng(31); for (let i = 0; i < 70; i++) { const y = hy + 8 + Math.pow(r(), 1.6) * (H - hy), w = (20 + r() * 160) * (1 + (y - hy) / (H - hy)), x = W * .5 + (r() - .5) * W * .5 * (1 + (y - hy) / (H - hy)); c.fillStyle = "rgba(255,220,170," + (.08 + r() * .25) * (1 - (y - hy) / (H - hy) * .6) + ")"; c.fillRect(x - w / 2, y, w, 2 + r() * 2); }
      fill(c, W, H, lin(c, 0, hy - 3, 0, hy + 3, [[0, "rgba(255,230,190,0)"], [.5, "rgba(255,230,190,.45)"], [1, "rgba(255,230,190,0)"]])); grain(c, W, H, .05);
    } },
    field: { name: "Golden Field", isNew: true, ink: "#fffaf0", accent: "#fff0c2", scrim: .5, draw(c, W, H) {
      const hy = H * .72, sx = W * .5, sy = hy - H * .015;
      fill(c, W, H, lin(c, 0, 0, 0, hy, [[0, "#3e5f8a"], [.4, "#9c8db0"], [.75, "#f2a65a"], [1, "#ffd892"]]));
      rays(c, sx, sy, 26, H * .9, "255,236,180", 12);
      fill(c, W, H, rad(c, sx, sy, 4, W * .9, [[0, "rgba(255,250,225,1)"], [.06, "rgba(255,240,190,.9)"], [.25, "rgba(255,200,120,.35)"], [1, "rgba(255,190,110,0)"]]));
      streak(c, W * .75, hy * .22, W * .55, H * .014, "255,230,205", .45); streak(c, W * .2, hy * .12, W * .45, H * .011, "255,240,220", .4); streak(c, W * .4, hy * .4, W * .6, H * .01, "255,215,170", .35);
      ridge(c, W, H, hy, H * .02, 51, "rgba(120,90,80,.55)", 12);
      c.fillStyle = lin(c, 0, hy, 0, H, [[0, "#d9a24a"], [.35, "#b07524"], [1, "#4a2a0c"]]); c.fillRect(0, hy, W, H - hy);
      fill(c, W, H, rad(c, sx, hy, 4, W * .8, [[0, "rgba(255,230,160,.55)"], [1, "rgba(255,230,160,0)"]]));
      const r = rng(77);
      for (let L = 0; L < 3; L++) { const n = [220, 150, 70][L], y0 = hy + (H - hy) * [.15, .45, .75][L], len = (H - hy) * [.18, .32, .55][L], lw = [1.5, 2.5, 4][L];
        for (let i = 0; i < n; i++) { const x = r() * W, b = y0 + r() * (H - y0), l = len * (.6 + r() * .6), bend = (r() - .4) * l * .35; const lit = r() < .35;
          c.strokeStyle = lit ? "rgba(255,214,130," + (.5 + L * .15) + ")" : "rgba(" + (60 - L * 15) + "," + (35 - L * 10) + ",10," + (.55 + L * .15) + ")"; c.lineWidth = lw; c.beginPath(); c.moveTo(x, b); c.quadraticCurveTo(x + bend * .3, b - l * .6, x + bend, b - l); c.stroke();
          if (L > 0 && r() < .5) { c.fillStyle = lit ? "rgba(255,220,140,.85)" : "rgba(70,40,12,.85)"; c.beginPath(); c.ellipse(x + bend, b - l, lw * 1.6, lw * 5, Math.atan2(bend, l) * .8, 0, Math.PI * 2); c.fill(); } } }
      fill(c, W, H, lin(c, 0, H * .9, 0, H, [[0, "rgba(30,15,5,0)"], [1, "rgba(30,15,5,.7)"]])); grain(c, W, H, .06);
    } },
    neon: { name: "Neon", isNew: true, ink: "#ffffff", accent: "#7ff3ff", scrim: .38, draw(c, W, H) {
      const hy = H * .62;
      const sky = lin(c, 0, 0, 0, hy, [[0, "#0a0220"], [.5, "#2c0b52"], [.85, "#8a1a7a"], [1, "#ff3d8b"]]); fill(c, W, H, sky);
      stars(c, W, hy * .7, 160, 91, 1.4, .8);
      const sr = Math.min(W, H) * .2, scy = hy - sr * .45;
      fill(c, W, H, rad(c, W / 2, scy, sr * .5, sr * 2.6, [[0, "rgba(255,80,160,.45)"], [1, "rgba(255,80,160,0)"]]));
      c.save(); c.beginPath(); c.arc(W / 2, scy, sr, 0, Math.PI * 2); c.clip();
      fill(c, W, H, lin(c, 0, scy - sr, 0, scy + sr, [[0, "#ffe66d"], [.5, "#ff9a3d"], [1, "#ff2e88"]]));
      c.fillStyle = sky; for (let k = 0; k < 7; k++) { const y = scy + sr * (.05 + k * .14), th = 3 + k * 3.2; c.fillRect(W / 2 - sr, y, sr * 2, th); }
      c.restore();
      hill(c, W, H, hy, H * .05, 2.2, 1.2, "#1a0633");
      c.strokeStyle = "rgba(255,90,200,.8)"; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W + 10; x += 10) { const y = hy - Math.sin(x / W * Math.PI * 2.2 + 1.2) * H * .05 - Math.sin(x / W * Math.PI * 2.2 * 3.1 + 2.4) * H * .009; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      c.fillStyle = lin(c, 0, hy, 0, H, [[0, "#1a0436"], [1, "#05010f"]]); c.fillRect(0, hy, W, H - hy);
      c.save(); c.beginPath(); c.rect(0, hy, W, H - hy); c.clip(); c.strokeStyle = "rgba(255,60,200,.7)"; c.lineWidth = 2.5; c.shadowColor = "rgba(255,60,200,.9)"; c.shadowBlur = 12;
      for (let k = -14; k <= 14; k++) { c.beginPath(); c.moveTo(W / 2 + k * W * .02, hy); c.lineTo(W / 2 + k * W * .32, H); c.stroke(); }
      for (let k = 0; k < 14; k++) { const t = Math.pow(k / 13, 2.1), y = hy + t * (H - hy); c.globalAlpha = .35 + t * .65; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.restore(); c.globalAlpha = 1;
      fill(c, W, H, lin(c, 0, hy - H * .02, 0, hy + H * .06, [[0, "rgba(255,80,180,0)"], [.4, "rgba(255,80,180,.35)"], [1, "rgba(255,80,180,0)"]])); grain(c, W, H, .05);
    } },
    marble: { name: "Marble", isNew: true, light: true, ink: "#26221e", accent: "#9a7230", scrim: .6, draw(c, W, H) {
      fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#fbfaf7"], [.5, "#efece6"], [1, "#e4e0d8"]]));
      const r = rng(2024);
      const vein = (x, y, ang, len, steps, col, lw, blur) => { c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.shadowColor = col; c.shadowBlur = blur; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < steps; i++) { ang += (r() - .5) * .38; const d = len / steps; const nx = x + Math.cos(ang) * d, ny = y + Math.sin(ang) * d; c.quadraticCurveTo(x + Math.cos(ang + (r() - .5)) * d * .5, y + Math.sin(ang + (r() - .5)) * d * .5, nx, ny); x = nx; y = ny; } c.stroke(); c.restore(); };
      for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H, rr = W * (.2 + r() * .35); fill(c, W, H, rad(c, x, y, 0, rr, [[0, "rgba(150,148,160," + (.04 + r() * .05) + ")"], [1, "rgba(150,148,160,0)"]])); }
      for (let i = 0; i < 16; i++) vein(r() * W, r() * H, .6 + (r() - .5) * .8, H * (.4 + r() * .5), 22, "rgba(110,108,118," + (.07 + r() * .1) + ")", 3 + r() * 14, 24);
      for (let i = 0; i < 22; i++) vein(r() * W, r() * H, .8 + (r() - .5) * 1.2, H * (.15 + r() * .3), 14, "rgba(90,88,96," + (.08 + r() * .1) + ")", .8 + r() * 1.5, 2);
      for (let i = 0; i < 3; i++) { const x = W * (.1 + i * .38), y = H * (.05 + r() * .2); vein(x, y, 1.1 + (r() - .5) * .5, H * .9, 30, "rgba(196,150,62,.35)", 7, 10); }
      for (let i = 0; i < 3; i++) { const x = W * (.1 + i * .38) + 3, y = H * (.05 + rng(7 + i)() * .2); vein(x, y, 1.1, H * .9, 30, "rgba(176,128,40,.55)", 2, 3); }
      fill(c, W, H, rad(c, W * .5, H * .45, 10, Math.max(W, H) * .7, [[0, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]])); grain(c, W, H, .05);
    } },
    clouds: { name: "Heaven", isNew: true, light: true, ink: "#2e2450", accent: "#7a4f9e", scrim: .6, draw(c, W, H) {
      fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#7fb6f2"], [.4, "#b9b4f0"], [.7, "#f0c4e4"], [1, "#ffe1d0"]]));
      rays(c, W * .5, -H * .05, 30, H * 1.2, "255,255,240", 5);
      fill(c, W, H, rad(c, W * .5, 0, 10, W * .9, [[0, "rgba(255,252,235,.85)"], [1, "rgba(255,252,235,0)"]]));
      [[.15, .16, .2, 1], [.85, .24, .24, 2], [.5, .08, .15, 3], [.1, .9, .35, 4], [.6, .95, .4, 5], [.95, .85, .3, 6], [.35, .82, .25, 7], [.8, .7, .16, 8]].forEach(([x, y, s, sd]) => { cloud(c, W * x + 6, H * y + 14, W * s, "180,150,200", .25, sd); cloud(c, W * x, H * y, W * s, "255,255,255", .8, sd); });
      grain(c, W, H, .04);
    } }
  };
  const BGS = Object.assign({}, NEW_BGS, OLD_BGS);
  const FONTS = {
    classic: { name: "Classic", css: (px) => "600 " + px + "px Fraunces, Georgia, serif", load: "600 60px Fraunces" },
    book: { name: "Book", css: (px) => "400 " + px + "px 'Source Serif 4', Georgia, serif", load: "400 60px 'Source Serif 4'" },
    italic: { name: "Italic", css: (px) => "italic 400 " + px + "px 'Source Serif 4', Georgia, serif", load: "italic 400 60px 'Source Serif 4'" },
    modern: { name: "Modern", css: (px) => "700 " + px + "px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", load: null }
  };
  const SIZES = { wall: { name: "Wallpaper", w: 1080, h: 1920 }, square: { name: "Square", w: 1080, h: 1080 } };
  const IMG_DEF = { bg: "midnight", font: "classic", align: "center", size: 100, format: "wall", mark: true, shadow: true };
  const imgPrefs = () => { const p = Object.assign({}, IMG_DEF, load(K_IMG, {})); if (!BGS[p.bg]) p.bg = IMG_DEF.bg; if (!FONTS[p.font]) p.font = IMG_DEF.font; if (!SIZES[p.format]) p.format = IMG_DEF.format; if (!/^(left|center|right)$/.test(p.align)) p.align = "center"; p.size = Math.max(70, Math.min(140, +p.size || 100)); return p; };

  function wrapLines(ctx, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  async function fontsReady(fontKey) {
    const f = FONTS[fontKey]; const list = ["600 40px Fraunces"]; if (f && f.load) list.push(f.load);
    try { await Promise.race([Promise.all(list.map(x => document.fonts.load(x))), new Promise(r => setTimeout(r, 1500))]); } catch {}
  }
  // Renders verse d = {text, ref, version} onto canvas with options o. Returns the canvas.
  async function renderImage(canvas, d, o) {
    o = Object.assign({}, imgPrefs(), o || {});
    const S = SIZES[o.format], W = S.w, H = S.h, bg = BGS[o.bg], font = FONTS[o.font];
    canvas.width = W; canvas.height = H;
    await fontsReady(o.font);
    const ctx = canvas.getContext("2d");
    ctx.save(); bg.draw(ctx, W, H); ctx.restore(); ctx.globalAlpha = 1;
    // text box: on a wallpaper keep clear of the lock-screen clock (top) and the home bar (bottom)
    const padX = 110, top = o.format === "wall" ? H * .30 : H * .14, bottom = o.format === "wall" ? H * .76 : H * .74;
    const maxW = W - padX * 2;
    const text = LQ + String(d.text || "").trim().replace(/^["\u201C]+|["\u201D]+$/g, "") + RQ;
    const maxPx = Math.round((o.format === "wall" ? 84 : 70) * o.size / 100), minPx = 26;
    let px = maxPx, lines = [], lh = 0;
    for (; px >= minPx; px -= 2) { ctx.font = font.css(px); lines = wrapLines(ctx, text, maxW); lh = px * 1.38; if (lines.length * lh <= bottom - top) break; }
    const blockH = lines.length * lh;
    const x = o.align === "left" ? padX : o.align === "right" ? W - padX : W / 2;
    ctx.textAlign = o.align; ctx.textBaseline = "alphabetic";
    // soft panel behind the words for readability on busy backgrounds
    const y0 = top + (bottom - top - blockH) / 2;
    const sa = bg.scrim != null ? bg.scrim : bg.light ? .55 : .42;
    const panel = rad(ctx, W / 2, y0 + blockH / 2, 10, Math.max(maxW, blockH) * .75, bg.light ? [[0, "rgba(255,255,255," + sa + ")"], [1, "rgba(255,255,255,0)"]] : [[0, "rgba(0,0,0," + sa + ")"], [1, "rgba(0,0,0,0)"]]);
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    if (bg.classic && o.mark) { ctx.save(); ctx.fillStyle = bg.accent; ctx.textAlign = "center"; ctx.font = "600 30px Fraunces, Georgia, serif"; const hs = String.fromCharCode(8202); ctx.fillText(("\u2726  BIBLEY  \u2726").split("").join(hs), W / 2, Math.max(150, y0 - Math.max(70, px * 1.1))); ctx.restore(); }
    ctx.fillStyle = bg.ink; ctx.font = font.css(px);
    const sh = o.shadow !== false;
    ctx.shadowColor = bg.light ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)"; ctx.shadowBlur = sh ? 18 : 0; ctx.shadowOffsetY = sh ? 2 : 0;
    let y = y0 + px;
    for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
    // reference
    const refY = y0 + blockH + Math.max(70, px * .9);
    ctx.shadowBlur = sh ? 10 : 0; ctx.fillStyle = bg.accent;
    const lineX = o.align === "left" ? padX : o.align === "right" ? W - padX - 90 : W / 2 - 45;
    ctx.fillRect(lineX, refY - Math.max(46, px * .7), 90, 4);
    ctx.font = "600 " + Math.round(Math.max(40, px * .62)) + "px Fraunces, Georgia, serif";
    ctx.fillText(String(d.ref || ""), x, refY + 12);
    if (d.version) { ctx.globalAlpha = .82; ctx.fillStyle = bg.ink; ctx.font = "400 " + Math.round(Math.max(28, px * .4)) + "px 'Source Serif 4', Georgia, serif"; ctx.fillText(vname(d.version), x, refY + 12 + Math.max(50, px * .62)); ctx.globalAlpha = 1; }
    if (o.mark && !bg.classic) { ctx.shadowBlur = 0; ctx.globalAlpha = .6; ctx.fillStyle = bg.accent; ctx.textAlign = "center"; ctx.font = "600 28px Fraunces, Georgia, serif"; ctx.fillText("B I B L E Y", W / 2, H - (o.format === "wall" ? 150 : 70)); ctx.globalAlpha = 1; }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    return canvas;
  }
  const fileName = (d, o) => (String(d.ref || "verse").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "verse") + "-" + (o.format === "wall" ? "wallpaper" : "square") + ".png";
  const toBlob = cv => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("no-blob")), "image/png"));
  async function downloadBlob(b, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function imageMaker(d) {
    if (!d || !d.text) { toast("Pick a verse first"); return; }
    let o = imgPrefs();
    openSheet("image", "Make a verse image", body => {
      const seg = (k, opts) => '<div class="fx-seg st-seg" data-k="' + k + '">' + opts.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (String(o[k]) === String(v) ? "on" : "") + '">' + l + "</button>").join("") + "</div>";
      const el = h('<div class="st-maker">' +
        '<div class="st-preview" data-format="' + o.format + '"><canvas aria-label="Verse image preview"></canvas></div>' +
        '<div class="fx-set"><label class="h">Size</label>' + seg("format", [["wall", "Wallpaper 9:16"], ["square", "Square 1:1"]]) + "</div>" +
        '<div class="fx-set"><label class="h">Background</label><div class="st-bgs" role="group" aria-label="Background">' + Object.keys(BGS).map(k => '<button type="button" class="st-bg ' + (k === o.bg ? "on" : "") + '" data-bg="' + k + '" aria-label="' + BGS[k].name + '" title="' + BGS[k].name + '"><canvas width="90" height="120"></canvas>' + (BGS[k].isNew ? '<i class="st-new">NEW</i>' : "") + "<span>" + BGS[k].name + "</span></button>").join("") + "</div></div>" +
        '<div class="fx-set"><label class="h">Font</label>' + seg("font", Object.keys(FONTS).map(k => [k, FONTS[k].name])) + "</div>" +
        '<div class="fx-set"><label class="h">Align</label>' + seg("align", [["left", "Left"], ["center", "Center"], ["right", "Right"]]) + "</div>" +
        '<div class="fx-set"><label class="h"><span>Text size</span><span class="st-sz">' + o.size + '%</span></label><input class="fx-range" type="range" min="70" max="140" step="5" value="' + o.size + '" aria-label="Text size"></div>' +
        '<label class="st-check"><input type="checkbox" data-o="mark" ' + (o.mark ? "checked" : "") + '> Show the Bibley mark</label>' +
        '<label class="st-check"><input type="checkbox" data-o="shadow" ' + (o.shadow !== false ? "checked" : "") + '> Text shadow</label>' +
        '<div class="fx-row st-actions"><button class="fx-btn primary" data-a="share" type="button" style="flex:1">' + ICON.share + " Share</button>" +
        '<button class="fx-btn" data-a="dl" type="button" style="flex:1">' + ICON.download + " Download</button></div></div>");
      body.append(el);
      const cv = el.querySelector(".st-preview canvas"), pv = el.querySelector(".st-preview");
      // thumbnails
      el.querySelectorAll(".st-bg canvas").forEach(t => { const k = t.closest(".st-bg").dataset.bg; const big = document.createElement("canvas"); big.width = 270; big.height = 360; const bc = big.getContext("2d"); bc.save(); bc.scale(.25, .1875); BGS[k].draw(bc, 1080, 1920); bc.restore(); t.getContext("2d").drawImage(big, 0, 0, 90, 120); });
      let busy = null, again = false;
      const redraw = async () => { if (busy) { again = true; return busy; } busy = renderImage(cv, d, o).catch(e => console.warn(e)); await busy; busy = null; if (again) { again = false; redraw(); } };
      const persist = () => save(K_IMG, o);
      el.querySelectorAll(".st-seg").forEach(s => s.querySelectorAll("button").forEach(b => b.onclick = () => {
        o[s.dataset.k] = b.dataset.v; s.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        if (s.dataset.k === "format") pv.dataset.format = o.format; persist(); redraw();
      }));
      el.querySelectorAll(".st-bg").forEach(b => b.onclick = () => { o.bg = b.dataset.bg; el.querySelectorAll(".st-bg").forEach(x => x.classList.toggle("on", x === b)); persist(); redraw(); });
      const r = el.querySelector(".fx-range"); r.oninput = () => { o.size = +r.value; el.querySelector(".st-sz").textContent = r.value + "%"; persist(); redraw(); };
      el.querySelectorAll(".st-check input[data-o]").forEach(i => i.onchange = e => { o[i.dataset.o] = e.target.checked; persist(); redraw(); });
      el.querySelector('[data-a="dl"]').onclick = async () => { await redraw(); const b = await toBlob(cv); api._lastBlob = b; await downloadBlob(b, fileName(d, o)); toast("Image saved to Downloads"); };
      el.querySelector('[data-a="share"]').onclick = async () => {
        await redraw(); const b = await toBlob(cv); api._lastBlob = b; const name = fileName(d, o);
        const file = new File([b], name, { type: "image/png" });
        if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: d.ref, text: d.ref + (d.version ? " (" + vname(d.version) + ")" : "") }); }
          catch (e) { if (e && e.name !== "AbortError") { await downloadBlob(b, name); toast("Sharing isn't available, so it was downloaded"); } }
        } else { await downloadBlob(b, name); toast("Sharing isn't available here, so it was downloaded"); }
      };
      redraw();
    });
  }

  /* ===================================================================
     2. MEMORIZE MODE
     =================================================================== */
  const LEVELS = ["Read it", "A few hidden", "Half hidden", "Most hidden", "First letters", "All hidden"];
  const memAll = () => { const d = load(K_MEM, {}); return d && typeof d === "object" && d.verses && typeof d.verses === "object" ? d : { v: 1, verses: {} }; };
  const memKey = d => d.key || ("ref:" + String(d.ref || "").replace(/\s+/g, "_"));
  function memGet(d) { return memAll().verses[memKey(d)] || null; }
  function memPut(d, patch) {
    const all = memAll(), k = memKey(d); const cur = all.verses[k] || { ref: d.ref, text: d.text, version: d.version || "", bookIdx: d.bookIdx, chapter: d.chapter, verseNum: d.verseNum, added: Date.now(), level: 0, best: 0, tries: 0 };
    all.verses[k] = Object.assign(cur, { text: d.text || cur.text, ref: d.ref || cur.ref }, patch || {}); all.v = 1; save(K_MEM, all); return all.verses[k];
  }
  function memDel(k) { const all = memAll(); delete all.verses[k]; save(K_MEM, all); }
  const words = t => String(t || "").trim().split(/\s+/).filter(Boolean);
  const norm = w => String(w).toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9]/g, "");
  // order in which words disappear (same every time for a verse, each level hides more)
  function hideOrder(n, seedStr) { let s = 0; for (const ch of seedStr) s = (s * 31 + ch.charCodeAt(0)) >>> 0; const r = rng(s || 1); const idx = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }
  function maskedHtml(text, level, seed) {
    const ws = words(text), n = ws.length, ord = hideOrder(n, seed);
    const frac = [0, .25, .5, .75, 1, 1][level]; const hidden = new Set(ord.slice(0, Math.round(n * frac)));
    return ws.map((w, i) => {
      if (!hidden.has(i)) return '<span class="st-w">' + esc(w) + "</span>";
      const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][\s\S]*?)([^A-Za-z0-9]*)$/) || ["", "", w, ""];
      const core = m[2] || w;
      const shown = level === 4 ? esc(core[0]) + '<i>' + "_".repeat(Math.max(1, Math.min(8, core.length - 1))) + "</i>" : '<i>' + "_".repeat(Math.max(2, Math.min(10, core.length))) + "</i>";
      return '<span class="st-w">' + esc(m[1]) + '<button type="button" class="st-blank" data-w="' + esc(core) + '" aria-label="Hidden word, tap to peek">' + shown + "</button>" + esc(m[3]) + "</span>";
    }).join(" ");
  }
  function score(target, typed) {
    const T = words(target).map(norm).filter(Boolean), Y = words(typed).map(norm).filter(Boolean);
    // longest common subsequence: words in the right order count as correct
    const m = T.length, n = Y.length, dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = T[i] === Y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ok = new Array(m).fill(false); let i = 0, j = 0;
    while (i < m && j < n) { if (T[i] === Y[j]) { ok[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    const hit = ok.filter(Boolean).length, extra = Math.max(0, n - hit);
    const pct = m ? Math.max(0, Math.round(100 * (hit - extra * .5) / m)) : 0;
    return { pct: Math.min(100, pct), ok, hit, total: m };
  }
  function memorize(d, startLevel) {
    if (!d || !d.text) { toast("Pick a verse first"); return; }
    const rec = memPut(d, {}); let level = typeof startLevel === "number" ? startLevel : Math.min(rec.level || 0, 5);
    const seed = memKey(d);
    openSheet("memorize", "Memorize " + DOT + " " + d.ref, body => {
      const el = h('<div class="st-mem">' +
        '<div class="st-levels" role="group" aria-label="Level">' + LEVELS.map((l, i) => '<button type="button" class="st-lv" data-l="' + i + '" aria-label="Level ' + (i + 1) + ": " + l + '"></button>').join("") + "</div>" +
        '<div class="st-lvname"></div><div class="fx-vtext st-text" aria-live="polite"></div>' +
        '<p class="fx-muted st-hint">Say it out loud. Tap a blank to peek.</p>' +
        '<div class="fx-row"><button class="fx-btn" data-a="less" type="button" style="flex:1">Show more</button><button class="fx-btn primary" data-a="more" type="button" style="flex:1">Hide more</button></div>' +
        '<div style="height:10px"></div><button class="fx-btn block" data-a="test" type="button">' + ICON.check + " Test me: type it from memory</button>" +
        '<div class="st-test" hidden><textarea class="fx-textarea" rows="4" placeholder="Type the verse from memory..." aria-label="Type the verse from memory" autocapitalize="sentences"></textarea>' +
        '<div class="fx-row" style="margin-top:8px"><button class="fx-btn primary" data-a="check" type="button" style="flex:1">Check</button><button class="fx-btn" data-a="hide" type="button">Back</button></div><div class="st-result"></div></div>' +
        '<div class="st-foot fx-muted"></div>' +
        '<button class="fx-btn small block" data-a="list" type="button" style="margin-top:10px">' + ICON.brain + " My memory verses</button></div>");
      body.append(el);
      const txt = el.querySelector(".st-text"), foot = el.querySelector(".st-foot");
      const draw = () => {
        txt.innerHTML = maskedHtml(d.text, level, seed);
        el.querySelector(".st-lvname").textContent = "Step " + (level + 1) + " of 6 " + DOT + " " + LEVELS[level];
        el.querySelectorAll(".st-lv").forEach((b, i) => { b.classList.toggle("on", i <= level); b.classList.toggle("cur", i === level); });
        el.querySelector('[data-a="less"]').disabled = level === 0; el.querySelector('[data-a="more"]').disabled = level === 5;
        const r = memGet(d) || rec; foot.textContent = r.best ? "Best test score: " + r.best + "%" + (r.best >= 90 ? " " + DOT + " memorized!" : "") : "Not tested yet";
        txt.querySelectorAll(".st-blank").forEach(b => b.onclick = () => { b.classList.add("peek"); b.textContent = b.dataset.w; setTimeout(() => { if (b.isConnected) { b.classList.remove("peek"); draw(); } }, 1600); });
      };
      const setLevel = l => { level = Math.max(0, Math.min(5, l)); const r = memGet(d) || rec; if (level > (r.level || 0)) memPut(d, { level }); draw(); };
      el.querySelector('[data-a="more"]').onclick = () => setLevel(level + 1);
      el.querySelector('[data-a="less"]').onclick = () => setLevel(level - 1);
      el.querySelectorAll(".st-lv").forEach(b => b.onclick = () => setLevel(+b.dataset.l));
      const test = el.querySelector(".st-test"), ta = test.querySelector("textarea"), res = el.querySelector(".st-result");
      el.querySelector('[data-a="test"]').onclick = () => { test.hidden = false; txt.innerHTML = maskedHtml(d.text, 5, seed); res.innerHTML = ""; setTimeout(() => { try { ta.focus(); } catch {} }, 150); };
      el.querySelector('[data-a="hide"]').onclick = () => { test.hidden = true; draw(); };
      el.querySelector('[data-a="check"]').onclick = () => {
        if (!ta.value.trim()) { toast("Type what you remember first"); return; }
        const s = score(d.text, ta.value), r = memGet(d) || rec;
        const best = Math.max(r.best || 0, s.pct); memPut(d, { best, tries: (r.tries || 0) + 1, lastScore: s.pct, practiced: Date.now(), mastered: best >= 90 || !!r.mastered });
        const ws = words(d.text); let k = 0;
        const marked = ws.map(w => { const isWord = !!norm(w); const good = isWord ? s.ok[k++] : true; return '<span class="' + (good ? "st-ok" : "st-miss") + '">' + esc(w) + "</span>"; }).join(" ");
        const msg = s.pct >= 90 ? "You've got it memorized!" : s.pct >= 70 ? "So close. One more try?" : s.pct >= 40 ? "Good start. Practise a step back and try again." : "Keep going. Go back a step or two and say it out loud.";
        res.innerHTML = '<div class="st-score ' + (s.pct >= 90 ? "great" : "") + '"><b>' + s.pct + '%</b><span>' + s.hit + " of " + s.total + " words " + DOT + " " + msg + '</span></div><div class="fx-vtext st-diff">' + marked + "</div>";
        if (s.pct >= 90) toast("Memorized " + DOT + " " + d.ref, 2800);
        draw(); txt.innerHTML = maskedHtml(d.text, 5, seed);
      };
      el.querySelector('[data-a="list"]').onclick = memoryList;
      draw();
    });
  }
  function memoryList() {
    openSheet("memlist", "My memory verses", body => {
      const all = memAll().verses; const keys = Object.keys(all).sort((a, b) => (all[b].practiced || all[b].added || 0) - (all[a].practiced || all[a].added || 0));
      if (!keys.length) { body.append(h('<div class="fx-card"><p class="fx-muted" style="margin:0">No memory verses yet. Tap any verse in the reader, then tap <b>Memorize</b>.</p></div>')); return; }
      const done = keys.filter(k => (all[k].best || 0) >= 90).length;
      body.append(h('<p class="fx-muted" style="margin:0 0 10px">' + keys.length + " verse" + (keys.length === 1 ? "" : "s") + " " + DOT + " " + done + " memorized</p>"));
      const list = h('<div class="st-memlist"></div>'); body.append(list);
      keys.forEach(k => {
        const r = all[k], pct = Math.round(((r.level || 0) / 5) * 100);
        const row = h('<div class="st-mrow"><button type="button" class="st-mopen"><div class="r">' + esc(r.ref) + ((r.best || 0) >= 90 ? ' <span class="st-badge">' + ICON.check + "</span>" : "") + '</div><div class="t">' + esc(r.text) + '</div><div class="st-bar"><i style="width:' + pct + '%"></i></div><div class="fx-muted st-msub">Step ' + ((r.level || 0) + 1) + "/6" + (r.best ? " " + DOT + " best " + r.best + "%" : "") + '</div></button><button type="button" class="st-mdel" aria-label="Remove ' + esc(r.ref) + '">&times;</button></div>');
        row.querySelector(".st-mopen").onclick = () => memorize(Object.assign({ key: k }, r));
        row.querySelector(".st-mdel").onclick = () => { if (confirm("Remove " + r.ref + " from your memory verses?")) { memDel(k); memoryList(); } };
        list.append(row);
      });
    });
  }

  /* 3. (page turn animation removed in v4.2; chapter changes use the reader's own swipe slide) */
  try { localStorage.removeItem("bibley_page_anim"); } catch {}
  document.documentElement.classList.remove("st-pageturn");

  /* ===================================================================
     4. WHAT'S NEW (updates log)
     Shows once per version: closes with the X or a tap outside, then stays hidden
     until APP_VERSION changes. Stored: localStorage "bibley_seen_version".
     =================================================================== */
  const APP_VERSION = "5.1";
  const K_SEEN_VER = "bibley_seen_version";
  const CHANGELOG = [
    { v: "5.1", date: "October 2026", items: [
      ["Select multiple verses at once", "Tap a verse, then tap more to add them. Highlight, copy, share, bookmark, add a note, make an image or memorize the whole passage at once. Tap the X to clear."],
      ["Verse bookmarks jump straight to the verse", "Tap a verse bookmark and Bibley opens the chapter, scrolls right to the verse and makes it glow. A bookmarked passage glows all the way through."]
    ] },
    { v: "5.0", date: "October 2026", release: true, items: [
      ["Bibley is officially out of beta", "Bibley is officially out of beta: full release. Thanks for reading with it."],
      ["Removed the page-turn animation", "Chapters switch the simple way again: a quick slide when you swipe, an instant change with the buttons."],
      ["Open chapter jumps to the verse", "Tap Open chapter under a verse in the Study Assistant: Bibley opens that chapter, scrolls straight to the verse and makes it glow."],
      ["Study Assistant: removed the mode buttons", "No more Scholar / Scripture Only / Cross-Centered / Conversational. It now answers in one clear, friendly, scripture-grounded voice."]
    ] },
    { v: "4.1", date: "October 2026", items: [
      ["Image Maker backgrounds", "Image Maker: classic Night, Dawn and Parchment backgrounds are back + 6 new backgrounds: Moonlight, Lakeside, Golden Field, Neon, Marble and Heaven."],
      ["Text shadow switch", "Turn the soft shadow behind the words on or off in the Image Maker."]
    ] },
    { v: "4.0", date: "October 2026", items: [
      ["AI study help fixed", "Verse and chapter summaries now come back complete (Summary, In Context and Application), retry on their own if an answer gets cut off, and no longer make up Hebrew or Greek words."],
      ["Verse Image Maker", "Tap a verse, then Image: 12 backgrounds, 4 fonts, alignment and size. Make a phone wallpaper or a square post, then download or share it."],
      ["Memorize mode", "Tap a verse, then Memorize. Words disappear step by step, tap a blank to peek, then type it from memory for a score. Find them all under My memory verses."],
      ["Page turn animation", "Chapters turned like real pages. (Removed in 4.2.)"],
      ["More Bible versions", "Added NRSV, ISV, CEV, plus a Catholic group with NABRE, RSV-CE and NJB."],
      ["What's new", "This updates log. It shows once after each update."]
    ] },
    { v: "3.0", date: "October 2026", items: [
      ["Notes notebook", "Paged notes you can name, flip through and export."],
      ["Add to notes", "Save any AI verse or chapter summary straight into your notes."]
    ] },
    { v: "2.0", date: "October 2026", items: [
      ["40+ Bible versions", "Popular, easy-to-read, classic and other languages, plus Compare."],
      ["Install as an app", "Add Bibley to your home screen. Chapters you've opened work offline."]
    ] }
  ];
  function whatsNew() {
    const old = document.querySelector(".st-wn-wrap"); if (old) old.remove();
    const cur = CHANGELOG[0], earlier = CHANGELOG.slice(1);
    const li = it => '<li><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></li>";
    const wrap = h('<div class="st-wn-wrap" role="dialog" aria-modal="true" aria-labelledby="stWnTitle"><div class="st-wn">' +
      '<button type="button" class="st-wn-x" aria-label="Close what\'s new">&times;</button>' +
      '<div class="fx-eyebrow">What\'s new ' + DOT + " version " + esc(cur.v) + "</div>" +
      (cur.release
        ? '<h2 id="stWnTitle" class="st-wn-hero">Bibley ' + esc(cur.v) + ' &mdash; The Full Release</h2><p class="st-wn-thanks">Thanks for being here from the start.</p>'
        : '<h2 id="stWnTitle">Bibley just got better</h2>') +
      '<ul class="st-wn-list">' + cur.items.map(li).join("") + "</ul>" +
      '<details class="st-wn-earlier"><summary>Earlier updates</summary>' + earlier.map(e => '<div class="st-wn-v">Version ' + esc(e.v) + '</div><ul class="st-wn-list small">' + e.items.map(li).join("") + "</ul>").join("") + "</details>" +
      '<button type="button" class="fx-btn primary block st-wn-ok">Got it</button></div></div>');
    document.body.appendChild(wrap);
    const close = () => { try { localStorage.setItem(K_SEEN_VER, APP_VERSION); } catch {} wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 250); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    wrap.querySelector(".st-wn-x").onclick = close; wrap.querySelector(".st-wn-ok").onclick = close;
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => wrap.classList.add("open"));
    setTimeout(() => { try { wrap.querySelector(".st-wn-x").focus({ preventScroll: true }); } catch {} }, 300);
    if (cur.release) setTimeout(confetti, 250);
  }
  // Full-release celebration: a short confetti burst drawn on a canvas (no library).
  // Skipped when the phone asks for reduced motion.
  function confetti() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const old = document.querySelector(".st-confetti"); if (old) old.remove();
    const cv = document.createElement("canvas"); cv.className = "st-confetti"; cv.setAttribute("aria-hidden", "true");
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    document.body.appendChild(cv);
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const COLORS = ["#d8b673", "#c9a867", "#f3d999", "#fff7ec", "#ffffff", "#6d8fd6", "#3f63b8", "#9db7f0"];
    const N = Math.min(170, Math.round(W * H / 2600));
    const parts = [];
    for (let i = 0; i < N; i++) {
      const fromLeft = i % 2 === 0;
      parts.push({ x: fromLeft ? W * 0.08 : W * 0.92, y: H * 0.78, vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 8), vy: -(10 + Math.random() * 10),
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: COLORS[i % COLORS.length], round: Math.random() < 0.25, wob: Math.random() * 6.28 });
    }
    const DUR = 2600, t0 = performance.now();
    function frame(now) {
      const t = now - t0; g.clearRect(0, 0, W, H);
      const fade = t > DUR - 600 ? Math.max(0, (DUR - t) / 600) : 1;
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx + Math.sin(p.wob += 0.12) * 0.6; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = fade; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.h * 0.7, 0, 6.283); g.fill(); }
        else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)) + 1);
        g.restore();
      }
      if (t < DUR) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
  }
  function maybeWhatsNew() {
    let seen = null; try { seen = localStorage.getItem(K_SEEN_VER); } catch {}
    if (seen === APP_VERSION) return;
    setTimeout(whatsNew, 900);
  }

  /* ===================================================================
     public
     =================================================================== */
  const api = window.BibleyStudio = {
    imageMaker, memorize, memoryList, renderImage, score, maskedHtml,
    whatsNew, confetti, APP_VERSION, CHANGELOG,
    backgrounds: Object.keys(BGS), fonts: Object.keys(FONTS), ICON, _lastBlob: null
  };
  maybeWhatsNew();
})();
