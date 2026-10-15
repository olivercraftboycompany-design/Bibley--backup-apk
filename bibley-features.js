/* bibley-features.js — Bibley's study features, layered on the reader through window.BibleyCore.
   Highlights + notes + verse bookmarks (tap a verse), My Bible (search, jump, backup),
   reading plans with a streak, Verse of the Day, share-as-image, reader comfort settings,
   swipe to change chapter, continue reading, chapter-done check.
   Everything is stored on the device (localStorage). No notifications. */
(() => {
  "use strict";
  const C = window.BibleyCore;
  if (!C) { console.warn("Bibley features: reader bridge missing"); return; }
  const { BOOKS } = C;
  const K = {
    HL: "bible_highlights_v2", BM: "bible_bookmarks_v2", NOTES: "bibley_notes_v1", VBM: "bibley_vbm_v1",
    PLAN: "bibley_plan_v1", READ: "bibley_read_v1", ACT: "bibley_activity_v1", PREFS: "bibley_prefs_v1",
    SEEN: "bibley_today_seen_v1", VOTD: "bibley_votd_v1", POS: "bible_last_pos_v1", NB: "bibley_notebook_v1"
  };
  const COLORS = ["yellow", "green", "blue", "pink", "purple"];
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("Couldn't save: storage is full"); return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dayStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(y, m - 1, d + n); return dayStr(t); };
  const chKey = (b, c) => BOOKS[b][0] + "-" + c;
  const vKey = (b, c, v) => BOOKS[b][0] + "-" + c + "-" + v;
  const refOf = (b, c, v) => BOOKS[b][1] + " " + c + (v ? ":" + v : "");
  const vname = id => { try { return C.versionName(id); } catch { return String(id).toUpperCase(); } };
  function toast(msg, ms) {
    if (typeof window.bibleyToast === "function") { window.bibleyToast(msg, ms); return; }
    let t = document.querySelector(".fx-toast"); if (!t) { t = document.createElement("div"); t.className = "fx-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms || 2600);
  }

  /* ================= reader comfort ================= */
  const PREF_DEF = { size: (window.matchMedia && matchMedia("(max-width:700px)").matches) ? 17 : 19, font: "serif", lh: 1.78, theme: "dark" };
  const prefs = () => Object.assign({}, PREF_DEF, load(K.PREFS, {}));
  const THEME_COLOR = { dark: "#0f1524", sepia: "#ebdfc3", light: "#f1ede4" };
  function applyPrefs() {
    const p = prefs(), r = document.documentElement;
    r.style.setProperty("--verse-size", p.size + "px");
    r.style.setProperty("--fx-lh", String(p.lh));
    r.style.setProperty("--fx-verse-font", p.font === "sans" ? "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" : "'Source Serif 4', Georgia, serif");
    r.classList.toggle("theme-sepia", p.theme === "sepia");
    r.classList.toggle("theme-light", p.theme === "light");
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", THEME_COLOR[p.theme] || THEME_COLOR.dark);
  }
  function setPref(k, v) { const p = load(K.PREFS, {}); p[k] = v; save(K.PREFS, p); applyPrefs(); }
  applyPrefs();

  /* ================= data helpers ================= */
  const notes = () => load(K.NOTES, {});
  const vbms = () => load(K.VBM, {});
  function setHighlight(v, color) {
    if (!color) C.removeHighlight(v.key);
    else C.saveHighlight(v.key, { color, text: v.text, ref: refOf(v.bookIdx, v.chapter, v.verseNum), bookIdx: v.bookIdx, chapter: v.chapter, verseNum: v.verseNum, bookName: BOOKS[v.bookIdx][1], added: Date.now() });
  }
  function setNote(v, text) {
    const all = notes(); text = String(text || "").trim();
    if (!text) delete all[v.key];
    else { all[v.key] = { text, ref: v.ref || refOf(v.bookIdx, v.chapter, v.verseNum), bookIdx: v.bookIdx, chapter: v.chapter, verseNum: v.verseNum, verseText: v.text, version: v.version, updated: Date.now(), added: (all[v.key] && all[v.key].added) || Date.now() };
      if (v.verses && v.verses.length > 1) { all[v.key].verses = v.verses.slice(); all[v.key].verseEnd = v.verses[v.verses.length - 1]; } }
    save(K.NOTES, all);
  }
  function toggleVbm(v) {
    const all = vbms(); let on;
    if (all[v.key]) { delete all[v.key]; on = false; }
    else { all[v.key] = { ref: v.ref || refOf(v.bookIdx, v.chapter, v.verseNum), bookIdx: v.bookIdx, chapter: v.chapter, verseNum: v.verseNum, text: v.text, version: v.version, added: Date.now() }; on = true;
      if (v.verses && v.verses.length > 1) { all[v.key].verses = v.verses.slice(); all[v.key].verseEnd = v.verses[v.verses.length - 1]; all[v.key].range = true; } }
    save(K.VBM, all); return on;
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch { try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch { return false; } }
  }
  const verseQuote = v => `"${v.text}" — ${refOf(v.bookIdx, v.chapter, v.verseNum)} (${vname(v.version)})`;

  /* ================= activity, streak, read chapters ================= */
  function markActive(day = dayStr()) { const a = load(K.ACT, []); if (!a.includes(day)) { a.push(day); a.sort(); save(K.ACT, a.slice(-800)); } }
  function streak() {
    const set = new Set(load(K.ACT, [])); const today = dayStr();
    let d = set.has(today) ? today : addDays(today, -1), n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: set.has(today) };
  }
  const readMap = () => load(K.READ, {});
  const isRead = (b, c) => !!readMap()[chKey(b, c)];

  /* ================= reading plans ================= */
  const range = (b0, b1) => { const out = []; for (let b = b0; b <= b1; b++) for (let c = 1; c <= BOOKS[b][2]; c++) out.push([b, c]); return out; };
  const split = (list, days) => Array.from({ length: days }, (_, d) => list.slice(Math.floor(d * list.length / days), Math.floor((d + 1) * list.length / days)));
  const PLANS = {
    gospels30: { name: "Gospels in 30 days", ico: "✝️", blurb: "Matthew, Mark, Luke & John · ~3 chapters a day", days: () => split(range(39, 42), 30) },
    pp31: { name: "Psalms & Proverbs in 31 days", ico: "🎵", blurb: "~5 psalms + 1 proverb a day", days: () => { const ps = split(range(18, 18), 31); return ps.map((d, i) => d.concat([[19, i + 1]])); } },
    nt90: { name: "New Testament in 90 days", ico: "📜", blurb: "Matthew → Revelation · ~3 chapters a day", days: () => split(range(39, 65), 90) },
    year365: { name: "Bible in a year", ico: "📖", blurb: "Genesis → Revelation · ~3–4 chapters a day", days: () => split(range(0, 65), 365) }
  };
  const planDaysCache = {};
  const planDays = id => planDaysCache[id] || (planDaysCache[id] = PLANS[id].days());
  const getPlan = () => { const p = load(K.PLAN, null); return p && PLANS[p.id] ? p : null; };
  function planState() {
    const p = getPlan(); if (!p) return null;
    const days = planDays(p.id), done = p.done || {};
    let idx = days.findIndex((_, i) => !done[i]); const finished = idx < 0; if (finished) idx = days.length - 1;
    const doneCount = Object.keys(done).length;
    return { p, days, idx, today: days[idx], finished, doneCount, total: days.length, pct: Math.round(doneCount / days.length * 100) };
  }
  function summarize(chs) {
    const parts = []; let i = 0;
    while (i < chs.length) { const b = chs[i][0]; let j = i; while (j + 1 < chs.length && chs[j + 1][0] === b && chs[j + 1][1] === chs[j][1] + 1) j++;
      parts.push(BOOKS[b][1] + " " + chs[i][1] + (j > i ? "–" + chs[j][1] : "")); i = j + 1; }
    return parts.join(" · ");
  }
  function startPlan(id) { save(K.PLAN, { id, started: dayStr(), done: {} }); toast(PLANS[id].name + " started 🔥"); }
  function completeDay(silent) {
    const st = planState(); if (!st || st.finished && st.p.done[st.idx]) return;
    const p = st.p; p.done = p.done || {}; p.done[st.idx] = dayStr(); save(K.PLAN, p);
    const rm = readMap(); st.today.forEach(([b, c]) => { if (!rm[chKey(b, c)]) rm[chKey(b, c)] = dayStr(); }); save(K.READ, rm);
    markActive();
    const s = streak().n; const after = planState();
    if (!silent) toast(after.finished ? "Plan complete! 🎉 " + PLANS[p.id].name : `Day ${st.idx + 1} done ✓ · 🔥 ${s}-day streak`, 3200);
    updateDock(); refreshDoneButton();
  }
  // A chapter checked as read: count it toward today's plan reading; finish the day when all are read.
  function onChapterRead(b, c) {
    markActive();
    const st = planState(); if (!st || st.finished && st.p.done[st.idx]) return false;
    const inToday = st.today.some(([x, y]) => x === b && y === c); if (!inToday) return false;
    const rm = readMap();
    if (st.today.every(([x, y]) => rm[chKey(x, y)])) { completeDay(); return true; }
    return true;
  }

  /* ================= sheet ================= */
  let scrim, sheet, sheetTitle, sheetBody, sheetView = null, pushed = false, onSheetClose = null;
  function ensureSheet() {
    if (sheet) return;
    scrim = document.createElement("div"); scrim.className = "fx-scrim";
    sheet = document.createElement("section"); sheet.className = "fx-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML = `<div class="fx-sheet-head"><div class="fx-sheet-title"></div><button class="fx-close" type="button" aria-label="Close">×</button></div><div class="fx-sheet-body"></div>`;
    document.body.append(scrim, sheet);
    sheetTitle = sheet.querySelector(".fx-sheet-title"); sheetBody = sheet.querySelector(".fx-sheet-body");
    scrim.addEventListener("click", () => closeSheet());
    sheet.querySelector(".fx-close").addEventListener("click", () => closeSheet());
    // swipe the sheet down to close
    let sy = null;
    sheet.querySelector(".fx-sheet-head").addEventListener("touchstart", e => { sy = e.touches[0].clientY; }, { passive: true });
    sheet.querySelector(".fx-sheet-head").addEventListener("touchend", e => { if (sy != null && e.changedTouches[0].clientY - sy > 60) closeSheet(); sy = null; }, { passive: true });
    window.addEventListener("popstate", () => { if (pushed) { pushed = false; closeSheet(true); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetView) closeSheet(); });
  }
  function openSheet(view, title, render) {
    ensureSheet();
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; try { f(); } catch {} }
    sheetView = view; sheet.dataset.view = view; sheetTitle.textContent = title;
    sheetBody.innerHTML = ""; sheetBody.scrollTop = 0; render(sheetBody);
    scrim.classList.add("open"); sheet.classList.add("open");
    if (!pushed) { try { history.pushState({ bibleyFx: 1 }, ""); pushed = true; } catch {} }
  }
  function closeSheet(fromPop) {
    if (!sheet || !sheetView) return;
    sheetView = null; scrim.classList.remove("open"); sheet.classList.remove("open");
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; try { f(); } catch {} }
    if (!fromPop && pushed) { pushed = false; try { history.back(); } catch {} }
    document.querySelectorAll(".verses-text span.selected").forEach(s => s.classList.remove("selected"));
  }
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ================= jump to verse ================= */
  let pendingJump = null;
  // v5.1: jumpTo(b, c, v, verses) opens the chapter, scrolls the verse to just under the top of the
  // reader (clear of the header) and pulses it ~1.8s; with a verses array (a range bookmark) the
  // first verse is scrolled to and every verse in the range pulses. Works when the chapter is already open.
  function jumpTo(b, c, v, verses) {
    closeSheet(); C.closeAi && C.closeAi();
    pendingJump = v ? { b, c, v, verses: (verses && verses.length) ? verses.slice() : null, at: Date.now() } : null;
    C.goTo(b, c);
    // already-open chapter: the reader may not re-render, so run the jump once the verse is on screen
    if (pendingJump) setTimeout(() => { const p = C.panes.a; if (pendingJump && p.bookIdx === b && p.chapter === c && verseSpan(b, c, v)) doPendingJump("a", { bookIdx: b, chapter: c }); }, 80);
  }
  const verseSpan = (b, c, n) => BOOKS[b] ? document.querySelector(`.pane[data-pane="a"] .verses-text span[data-key="${vKey(b, c, n)}"]`) : null;
  function scrollToVerse(span) {
    const box = span.closest(".reader-main");
    if (!box) { span.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    const br = box.getBoundingClientRect(), sr = span.getBoundingClientRect();
    const room = Math.max(24, Math.min(140, box.clientHeight * 0.18));
    box.scrollTo({ top: Math.max(0, box.scrollTop + (sr.top - br.top) - room), behavior: "smooth" });
  }
  function pulseVerses(spans) {
    spans.forEach(s => { s.classList.remove("fx-flash"); void s.offsetWidth; s.classList.add("fx-flash"); });
    setTimeout(() => spans.forEach(s => s.classList.remove("fx-flash")), 2000);
  }
  function doPendingJump(k, info) {
    if (!pendingJump || k !== "a" || pendingJump.b !== info.bookIdx || pendingJump.c !== info.chapter) return;
    const j = pendingJump; pendingJump = null;
    const want = (j.verses && j.verses.length ? j.verses : [j.v]).map(Number).sort((a, b) => a - b);
    let tries = 0;
    const go = () => {
      const q = n => verseSpan(j.b, j.c, n);
      const first = q(want[0]);
      if (!first) { if (++tries < 40) setTimeout(go, 75); return; }
      requestAnimationFrame(() => {
        scrollToVerse(first);
        pulseVerses(want.map(q).filter(Boolean));
        // the reader can re-settle once fonts/notes load; correct once if the verse drifted out of place
        setTimeout(() => { const box = first.closest(".reader-main"); if (!box || !first.isConnected) return; const d = first.getBoundingClientRect().top - box.getBoundingClientRect().top; if (d < 0 || d > box.clientHeight * 0.6) scrollToVerse(first); }, 650);
      });
    };
    go();
  }

  // Study Assistant answers: "Open chapter" under a cited verse opens that chapter and jumps
  // straight to the verse (scrolls to it and pulses it). Runs before the reader's own handler.
  document.addEventListener("click", e => {
    const o = e.target.closest && e.target.closest(".vref-open"); if (!o) return;
    const m = /^(.+?)\s+(\d+):(\d+)/.exec(String(o.dataset.ref || "").trim()); if (!m) return;
    const want = m[1].toLowerCase().replace(/\s+/g, " ");
    const b = C.BOOKS.findIndex(x => String(x[1]).toLowerCase() === want || String(x[0]).toLowerCase() === want);
    if (b < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const c = +m[2], v = +m[3];
    pendingJump = { b, c, v };
    if (window.innerWidth < 900 && C.closeAi) C.closeAi();
    C.goTo(b, c);
    setTimeout(() => { const p = C.panes.a; if (pendingJump && p.bookIdx === b && p.chapter === c && verseSpan(b, c, v)) doPendingJump("a", { bookIdx: b, chapter: c }); }, 60);
  }, true);

  /* ================= v4 studio hooks (bibley-studio.js: image maker, memorize, page turn) ================= */
  const SVG_IMG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>';
  const SVG_MEM = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8a3 3 0 0 0 0 5 3 3 0 0 0 3 4.5A3 3 0 0 0 12 19z"/><path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8a3 3 0 0 1 0 5 3 3 0 0 1-3 4.5A3 3 0 0 1 12 19z"/><path d="M12 5v14"/></svg>';
  const studio = () => window.BibleyStudio || null;
  function openImageMaker(d) { const s = studio(); if (s) s.imageMaker(d); else shareSheet(d); }
  function openMemorize(d) { const s = studio(); if (s) s.memorize(d); else toast("Memorize is still loading"); }

  /* ================= verse selection (v5.1: select several verses at once) ================= */
  // Tap a verse: it is selected and the action bar appears. Tap more verses (same chapter) to add or
  // remove them. Every action works on the whole selection: highlight colours each verse; copy and share
  // give one passage in verse order with a proper reference ("John 3:16-18", "John 3:16, 18");
  // bookmark and note save ONE entry for the range (bibley_vbm_v1 / bibley_notes_v1, key "JHN-3-16.17.18",
  // with verses:[16,17,18]); Image Maker and Memorize get the combined text + reference.
  // The selection clears on chapter change and with the X.
  const ICON = {
    note: "&#128221;", bm: "&#128278;", copy: "&#128203;", study: "&#10024;",
    share: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>'
  };
  let sel = null, selBar = null;
  // "16-18, 20, 22-23" from a sorted list of verse numbers
  function verseLabel(nums) {
    const out = []; let i = 0;
    while (i < nums.length) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++; out.push(j > i ? nums[i] + "-" + nums[j] : String(nums[i])); i = j + 1; }
    return out.join(", ");
  }
  function selList() { return sel ? [...sel.verses.values()].sort((a, b) => a.verseNum - b.verseNum) : []; }
  // the selection as one passage target: single verse = the verse itself (old keys, old behaviour)
  function selTarget() {
    const vs = selList(); if (!vs.length) return null;
    if (vs.length === 1) { const v = vs[0]; return Object.assign({}, v, { ref: refOf(v.bookIdx, v.chapter, v.verseNum), verses: [v.verseNum], single: true }); }
    const nums = vs.map(v => v.verseNum), f = vs[0];
    let text = "";
    vs.forEach((v, i) => { text += (i && v.verseNum !== vs[i - 1].verseNum + 1 ? " ... " : (i ? " " : "")) + v.text; });
    return { key: chKey(f.bookIdx, f.chapter) + "-" + nums.join("."), bookIdx: f.bookIdx, chapter: f.chapter, verseNum: f.verseNum, bookName: BOOKS[f.bookIdx][1],
      version: f.version, paneKey: f.paneKey, verses: nums, label: verseLabel(nums), ref: BOOKS[f.bookIdx][1] + " " + f.chapter + ":" + verseLabel(nums), text,
      numbered: vs.map(v => v.verseNum + " " + v.text).join(" "), single: false };
  }
  const passageQuote = t => t.single ? verseQuote(t) : t.numbered + "\n\u2014 " + t.ref + " (" + vname(t.version) + ")";
  function paintSel() {
    document.querySelectorAll(".verses-text span.fx-sel").forEach(s => s.classList.remove("fx-sel"));
    document.querySelectorAll(".verses-text span.selected").forEach(s => s.classList.remove("selected"));
    if (!sel) return;
    sel.verses.forEach(v => { const s = document.querySelector(`.pane[data-pane="${sel.pane}"] .verses-text span[data-key="${v.key}"]`); if (s) s.classList.add("fx-sel"); });
  }
  function clearSel() {
    sel = null; paintSel();
    document.body.classList.remove("fx-selecting");
    if (selBar) selBar.classList.remove("open");
  }
  function onVerseTap(v, span) {
    const fresh = !sel || sel.pane !== v.paneKey || sel.bookIdx !== v.bookIdx || sel.chapter !== v.chapter || sel.version !== v.version;
    if (fresh) sel = { pane: v.paneKey, bookIdx: v.bookIdx, chapter: v.chapter, version: v.version, verses: new Map() };
    if (sel.verses.has(v.verseNum)) sel.verses.delete(v.verseNum); else sel.verses.set(v.verseNum, v);
    if (!sel.verses.size) { clearSel(); return; }
    paintSel(); renderSelBar();
  }
  function ensureSelBar() {
    if (selBar) return selBar;
    selBar = h(`<div class="fx-selbar" role="toolbar" aria-label="Selected verses">
      <div class="fx-selbar-top"><div class="t"><b></b><span></span></div><button type="button" class="fx-selbar-x" aria-label="Clear selection" title="Clear">&times;</button></div>
      <div class="fx-swatches fx-selbar-sw" role="group" aria-label="Highlight colour">${COLORS.map(c => `<button type="button" class="fx-sw ${c}" data-c="${c}" aria-label="${c} highlight" title="${c}"></button>`).join("")}<button type="button" class="fx-sw clear" data-c="" aria-label="Remove highlight" title="No highlight">&#8856;</button></div>
      <div class="fx-selbar-acts">
        <button type="button" class="fx-act" data-a="note"><span class="e">${ICON.note}</span><i>Note</i></button>
        <button type="button" class="fx-act" data-a="bm"><span class="e">${ICON.bm}</span><i>Bookmark</i></button>
        <button type="button" class="fx-act" data-a="copy"><span class="e">${ICON.copy}</span><i>Copy</i></button>
        <button type="button" class="fx-act" data-a="sharetext"><span class="e">${ICON.share}</span><i>Share</i></button>
        <button type="button" class="fx-act" data-a="img"><span class="e">${SVG_IMG}</span><i>Image</i></button>
        <button type="button" class="fx-act" data-a="mem"><span class="e">${SVG_MEM}</span><i>Memorize</i></button>
        <button type="button" class="fx-act" data-a="study"><span class="e">${ICON.study}</span><i>Study</i></button>
      </div></div>`);
    document.body.appendChild(selBar);
    selBar.querySelector(".fx-selbar-x").onclick = clearSel;
    selBar.querySelectorAll(".fx-sw").forEach(b => b.onclick = () => {
      const c = b.dataset.c || null, vs = selList();
      vs.forEach(v => {
        setHighlight(v, c); v.color = c;
        document.querySelectorAll(`.verses-text span[data-key="${v.key}"]`).forEach(s => { COLORS.forEach(x => s.classList.remove("hl-" + x)); if (c) s.classList.add("hl-" + c); });
      });
      C.refreshLists(); renderSelBar();
      if (vs.length > 1) toast(c ? `Highlighted ${vs.length} verses` : `Highlight removed from ${vs.length} verses`, 1600);
    });
    const act = (a, fn) => { selBar.querySelector(`[data-a="${a}"]`).onclick = fn; };
    act("note", () => { const t = selTarget(); if (t) noteSheet(t); });
    act("bm", () => {
      const t = selTarget(); if (!t) return;
      const on = toggleVbm(t); decorateAll(); C.refreshLists(); renderSelBar();
      toast(on ? (t.single ? "Verse bookmarked" : t.ref + " bookmarked") : "Bookmark removed");
    });
    act("copy", async () => { const t = selTarget(); if (t) toast(await copyText(passageQuote(t)) ? (t.single ? "Copied" : "Copied " + t.ref) : "Couldn't copy"); });
    act("sharetext", async () => {
      const t = selTarget(); if (!t) return; const txt = passageQuote(t);
      if (navigator.share) { try { await navigator.share({ title: t.ref, text: txt }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      toast(await copyText(txt) ? "Copied (sharing isn't available here)" : "Couldn't share");
    });
    act("img", () => { const t = selTarget(); if (t) openImageMaker({ text: t.text, ref: t.ref, version: t.version }); });
    act("mem", () => { const t = selTarget(); if (t) openMemorize({ key: t.key, text: t.text, ref: t.ref, version: t.version, bookIdx: t.bookIdx, chapter: t.chapter, verseNum: t.verseNum }); });
    act("study", () => {
      const t = selTarget(); if (!t) return; clearSel();
      if (t.single) C.studyVerse(t);
      else C.studyVerse({ bookName: t.bookName, chapter: t.chapter, verseNum: t.label, text: t.text, bookIdx: t.bookIdx, key: vKey(t.bookIdx, t.chapter, t.verseNum), color: null });
    });
    return selBar;
  }
  function renderSelBar() {
    const t = selTarget(); if (!t) { clearSel(); return; }
    ensureSelBar();
    const vs = selList(), n = vs.length;
    selBar.querySelector(".t b").textContent = n + " selected";
    selBar.querySelector(".t span").textContent = t.ref + " \u00b7 " + vname(t.version);
    const colors = new Set(vs.map(v => { const hl = C.getHighlights()[v.key]; return hl ? hl.color : null; }));
    const one = colors.size === 1 ? [...colors][0] : undefined;
    selBar.querySelectorAll(".fx-sw").forEach(b => b.classList.toggle("on", !!one && b.dataset.c === one));
    const note = notes()[t.key], bm = !!vbms()[t.key];
    const nb = selBar.querySelector('[data-a="note"]'); nb.classList.toggle("on", !!note); nb.querySelector("i").textContent = note ? "Edit note" : "Note";
    const bb = selBar.querySelector('[data-a="bm"]'); bb.classList.toggle("on", bm); bb.querySelector("i").textContent = bm ? "Saved" : "Bookmark";
    document.body.classList.add("fx-selecting");
    placeSelBar();
    selBar.classList.add("open");
  }
  // sit just above the chapter pager (Prev / dock / Next) when it is at the bottom of the screen
  function placeSelBar() {
    if (!selBar) return;
    const pg = document.querySelector('.pane[data-pane="' + ((sel && sel.pane) || "a") + '"] .pager');
    let off = 0;
    if (pg) { const r = pg.getBoundingClientRect(); if (r.height && r.bottom >= window.innerHeight - 4 && r.top < window.innerHeight) off = Math.max(0, Math.round(window.innerHeight - r.top)); }
    selBar.style.bottom = off ? off + "px" : "";
    selBar.classList.toggle("fx-above-pager", !!off);
  }
  window.addEventListener("resize", () => { if (sel) placeSelBar(); });
  // note on one verse (old key) or on the selected range (range key); back to the bar afterwards
  function noteSheet(t) {
    const note = notes()[t.key];
    openSheet("verse", (t.single ? refOf(t.bookIdx, t.chapter, t.verseNum) : t.ref) + " \u00b7 " + vname(t.version), body => {
      body.append(h(`<div class="fx-vtext">${esc(t.single ? t.text : t.numbered)}</div>`));
      const box = h(`<div><textarea class="fx-textarea" placeholder="What stands out to you? A prayer, a question, a thought..." aria-label="Note">${esc(note ? note.text : "")}</textarea>
        <div class="fx-row" style="margin-top:10px"><button class="fx-btn primary" data-a="save" style="flex:1">Save note</button>${note ? '<button class="fx-btn danger" data-a="del">Delete</button>' : ""}<button class="fx-btn" data-a="back">Back</button></div></div>`);
      body.append(box);
      const ta = box.querySelector("textarea"); setTimeout(() => { try { ta.focus(); } catch {} }, 280);
      const back = () => { closeSheet(); paintSel(); if (sel) renderSelBar(); };
      box.querySelector('[data-a="save"]').onclick = () => { setNote(t, ta.value); decorateAll(); C.refreshLists(); toast(ta.value.trim() ? "Note saved" : "Note removed"); back(); };
      const del = box.querySelector('[data-a="del"]'); if (del) del.onclick = () => { setNote(t, ""); decorateAll(); C.refreshLists(); toast("Note deleted"); back(); };
      box.querySelector('[data-a="back"]').onclick = back;
    });
  }
  // kept for callers that still open the old one-verse sheet: it now selects that verse
  function verseSheet(v, mode) {
    sel = { pane: v.paneKey || "a", bookIdx: v.bookIdx, chapter: v.chapter, version: v.version, verses: new Map([[v.verseNum, v]]) };
    paintSel(); renderSelBar();
    if (mode === "note") noteSheet(selTarget());
  }

  /* ================= My Bible ================= */
  let mbFilter = "all", mbQuery = "";
  function myBibleItems() {
    const out = [];
    const hls = C.getHighlights(), ns = notes(), bms = vbms();
    const keys = new Set([...Object.keys(hls), ...Object.keys(ns), ...Object.keys(bms)]);
    keys.forEach(k => {
      const a = hls[k], n = ns[k], m = bms[k], any = a || n || m;
      const b = any.bookIdx, c = any.chapter, v = any.verseNum;
      if (!BOOKS[b]) return;
      const rng = [m, n, a].find(x => x && Array.isArray(x.verses) && x.verses.length > 1);
      out.push({ type: "verse", key: k, b, c, v, verses: rng ? rng.verses : null, ref: rng && rng.ref ? rng.ref : refOf(b, c, v), text: (a && a.text) || (n && n.verseText) || (m && m.text) || "", color: a && a.color, note: n && n.text, bm: !!m,
        t: Math.max((a && a.added) || 0, (n && n.updated) || 0, (m && m.added) || 0), order: b * 1e6 + c * 1e3 + v });
    });
    (C.getBookmarks() || []).forEach(x => { if (BOOKS[x.bookIdx]) out.push({ type: "chapter", b: x.bookIdx, c: x.chapter, ref: refOf(x.bookIdx, x.chapter), text: "Bookmarked chapter", bm: true, t: x.added || 0, order: x.bookIdx * 1e6 + x.chapter * 1e3 }); });
    return out;
  }
  function myBible() {
    openSheet("mybible", "My Bible", body => {
      const all = myBibleItems();
      const cnt = { all: all.length, hl: all.filter(i => i.color).length, notes: all.filter(i => i.note).length, bm: all.filter(i => i.bm).length };
      const top = h(`<div><input class="fx-input" type="search" placeholder="Search highlights, notes, bookmarks… or type a reference" aria-label="Search My Bible" value="${esc(mbQuery)}">
        <div class="fx-tabs">${[["all", "All"], ["hl", "Highlights"], ["notes", "Notes"], ["bm", "Bookmarks"]].map(([k, l]) => `<button class="fx-tab ${mbFilter === k ? "on" : ""}" data-f="${k}">${l} ${cnt[k]}</button>`).join("")}</div>
        <div class="fx-list"></div>
        <div class="fx-card" style="margin-top:14px"><div class="fx-eyebrow">Backup</div><p class="fx-muted" style="margin:6px 0 10px">Everything lives on this phone. Save a backup file now and then, or move it to a new phone.</p>
          <div class="fx-row"><button class="fx-btn small" data-a="export">⬇ Export backup</button><button class="fx-btn small" data-a="import">⬆ Import backup</button><input type="file" accept="application/json,.json" hidden></div></div></div>`);
      body.append(top);
      const input = top.querySelector("input[type=search]"), list = top.querySelector(".fx-list");
      const draw = () => {
        const q = mbQuery.trim().toLowerCase();
        let items = all.filter(i => mbFilter === "all" || (mbFilter === "hl" && i.color) || (mbFilter === "notes" && i.note) || (mbFilter === "bm" && i.bm));
        if (q) items = items.filter(i => (i.ref + " " + i.text + " " + (i.note || "")).toLowerCase().includes(q));
        items.sort((a, b) => b.t - a.t);
        let html = "";
        // a typed reference ("john 3:16", "ps 23") becomes a jump
        const jr = parseJump(mbQuery);
        if (jr) html += `<div class="fx-item" data-jb="${jr.b}" data-jc="${jr.c}" data-jv="${jr.v || ""}"><div class="k chap"></div><div class="b"><div class="r">↪ Go to ${esc(refOf(jr.b, jr.c, jr.v))}</div></div></div>`;
        if (!items.length) html += all.length ? `<div class="fx-empty">Nothing matches "${esc(mbQuery)}".</div>` : `<div class="fx-empty">Nothing saved yet.<br>Tap any verse while you read to highlight it, add a note, or bookmark it.</div>`;
        html += items.map((i, n) => `<div class="fx-item" data-i="${n}"><div class="k ${i.type === "chapter" ? "chap" : i.color || (i.note ? "note" : "")}"></div><div class="b">
            <div class="r">${esc(i.ref)}${i.bm ? " <span>🔖</span>" : ""}${i.note ? " <span>✎</span>" : ""}</div>
            ${i.text ? `<div class="s">${esc(i.text)}</div>` : ""}${i.note ? `<div class="n">${esc(i.note)}</div>` : ""}</div>
            <button class="x" data-del="${n}" aria-label="Remove">×</button></div>`).join("");
        list.innerHTML = html;
        list.querySelectorAll("[data-jb]").forEach(el => el.onclick = () => jumpTo(+el.dataset.jb, +el.dataset.jc, +el.dataset.jv || null));
        list.querySelectorAll("[data-i]").forEach(el => el.onclick = e => {
          const it = items[+el.dataset.i];
          if (e.target.closest("[data-del]")) { removeItem(it); myBible(); return; }
          jumpTo(it.b, it.c, it.v || null, it.verses);
        });
      };
      input.oninput = () => { mbQuery = input.value; draw(); };
      top.querySelectorAll(".fx-tab").forEach(b => b.onclick = () => { mbFilter = b.dataset.f; top.querySelectorAll(".fx-tab").forEach(x => x.classList.toggle("on", x === b)); draw(); });
      top.querySelector('[data-a="export"]').onclick = exportBackup;
      const file = top.querySelector("input[type=file]");
      top.querySelector('[data-a="import"]').onclick = () => file.click();
      file.onchange = () => { const f = file.files && file.files[0]; if (f) f.text().then(t => { importBackup(t); myBible(); }); };
      draw();
    });
  }
  function removeItem(it) {
    if (it.type === "chapter") {
      const arr = (C.getBookmarks() || []).filter(x => !(x.bookIdx === it.b && x.chapter === it.c)); save(K.BM, arr);
    } else {
      const label = [it.color && "highlight", it.note && "note", it.bm && "bookmark"].filter(Boolean).join(" + ");
      if (!confirm(`Remove the ${label} on ${it.ref}?`)) return;
      C.removeHighlight(it.key); const n = notes(); delete n[it.key]; save(K.NOTES, n); const m = vbms(); delete m[it.key]; save(K.VBM, m);
    }
    C.rerender(); C.refreshLists(); toast("Removed");
  }
  function parseJump(q) {
    const m = String(q || "").trim().match(/^((?:[123]\s*)?[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+))?$/i); if (!m) return null;
    let n = m[1].toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim().replace(/^([123])([a-z])/, "$1 $2");
    if (n.length < 2) return null;
    let b = BOOKS.findIndex(x => x[0].toLowerCase() === n || x[1].toLowerCase() === n);
    if (b < 0) b = BOOKS.findIndex(x => x[0].toLowerCase().startsWith(n) || x[1].toLowerCase().startsWith(n));
    if (b < 0) return null;
    const c = +m[2]; if (c < 1 || c > BOOKS[b][2]) return null;
    return { b, c, v: m[3] ? +m[3] : null };
  }
  const BACKUP_KEYS = [K.HL, K.BM, K.NOTES, K.VBM, K.PLAN, K.READ, K.ACT, K.PREFS, K.NB];
  function exportBackup() {
    const data = {}; BACKUP_KEYS.forEach(k => { const v = load(k, null); if (v != null) data[k] = v; });
    const blob = new Blob([JSON.stringify({ app: "Bibley", kind: "backup", v: 1, exported: new Date().toISOString(), data }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bibley-backup-" + dayStr() + ".json";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast("Backup saved to Downloads ⬇");
  }
  function importBackup(text) {
    let j; try { j = JSON.parse(text); } catch { toast("That file isn't a Bibley backup"); return false; }
    const d = j && j.data; if (!d || j.app !== "Bibley") { toast("That file isn't a Bibley backup"); return false; }
    const merge = (k, kind) => { if (d[k] == null) return; let cur = load(k, kind === "obj" ? {} : []); if (kind === "set" && !Array.isArray(cur)) cur = []; if (kind === "obj" && (typeof cur !== "object" || Array.isArray(cur) || !cur)) cur = {};
      if (kind === "obj") save(k, Object.assign({}, d[k], cur));
      else if (kind === "set") save(k, [...new Set([...cur, ...d[k]])].sort());
    };
    merge(K.HL, "obj"); merge(K.NOTES, "obj"); merge(K.VBM, "obj"); merge(K.READ, "obj"); merge(K.ACT, "set");
    if (Array.isArray(d[K.BM])) { const cur = load(K.BM, []); d[K.BM].forEach(x => { if (!cur.some(y => y.bookIdx === x.bookIdx && y.chapter === x.chapter)) cur.push(x); }); save(K.BM, cur); }
    if (d[K.PLAN]) { const cur = getPlan(); if (!cur || Object.keys(d[K.PLAN].done || {}).length > Object.keys(cur.done || {}).length) save(K.PLAN, d[K.PLAN]); }
    if (d[K.PREFS] && !localStorage.getItem(K.PREFS)) { save(K.PREFS, d[K.PREFS]); applyPrefs(); }
    if (d[K.NB] && window.BibleyNotes && window.BibleyNotes.importData) window.BibleyNotes.importData(d[K.NB]);
    C.rerender(); C.refreshLists(); updateDock(); toast("Backup imported ✓");
    return true;
  }

  /* ================= plans sheet ================= */
  function streakCard() {
    const s = streak();
    return `<div class="fx-streak"><span class="fire ${s.n ? "" : "off"}">🔥</span><div><div class="n">${s.n} day${s.n === 1 ? "" : "s"}</div><div class="fx-muted">${s.n ? (s.today ? "You read today. Keep it going!" : "Read today to keep your streak") : "Read a chapter to start a streak"}</div></div></div>`;
  }
  function todayPlanHtml(st) {
    const rm = readMap();
    if (st.finished && st.p.done[st.idx]) return `<div class="fx-eyebrow">${esc(PLANS[st.p.id].name)}</div><p style="margin:8px 0">Plan complete! 🎉 You read all ${st.total} days.</p><div class="fx-bar"><i style="width:100%"></i></div>`;
    return `<div class="fx-eyebrow">${esc(PLANS[st.p.id].name)} · Day ${st.idx + 1} of ${st.total}</div>
      <div style="font-family:Fraunces,Georgia,serif;font-size:17px;margin-top:6px;color:var(--gold-soft)">${esc(summarize(st.today))}</div>
      <div class="fx-chips">${st.today.map(([b, c]) => `<button class="fx-chip ${rm[chKey(b, c)] ? "done" : ""}" data-b="${b}" data-c="${c}">${esc(refOf(b, c))}</button>`).join("")}</div>
      <div class="fx-bar" aria-label="Plan progress"><i style="width:${st.pct}%"></i></div><div class="fx-muted">${st.doneCount} of ${st.total} days · ${st.pct}%</div>
      <button class="fx-btn primary block" data-a="markday" style="margin-top:12px">✓ Mark today's reading done</button>`;
  }
  function wirePlanCard(el) {
    el.querySelectorAll(".fx-chip[data-b]").forEach(b => b.onclick = () => jumpTo(+b.dataset.b, +b.dataset.c));
    const md = el.querySelector('[data-a="markday"]'); if (md) md.onclick = () => { completeDay(); if (sheetView === "plans") plansSheet(); else if (sheetView === "today") todaySheet(); };
  }
  function plansSheet() {
    openSheet("plans", "Reading plans", body => {
      body.append(h(`<div class="fx-card">${streakCard()}</div>`));
      const st = planState();
      if (st) { const c = h(`<div class="fx-card gold">${todayPlanHtml(st)}</div>`); body.append(c); wirePlanCard(c); }
      body.append(h(`<div class="fx-eyebrow" style="margin:6px 0 10px">${st ? "Switch plan" : "Pick a plan"}</div>`));
      Object.entries(PLANS).forEach(([id, pl]) => {
        const cur = st && st.p.id === id;
        const row = h(`<div class="fx-card"><div class="fx-plan"><div class="ico">${pl.ico}</div><div class="info"><b>${esc(pl.name)}</b><div class="fx-muted">${esc(pl.blurb)}</div></div>
          <button class="fx-btn small ${cur ? "" : "primary"}" data-id="${id}">${cur ? "Restart" : "Start"}</button></div></div>`);
        row.querySelector("button").onclick = () => {
          if (st && !confirm(cur ? "Restart this plan from Day 1?" : `Switch to "${pl.name}"? Your progress on the current plan resets (your streak stays).`)) return;
          startPlan(id); updateDock(); refreshDoneButton(); plansSheet();
        };
        body.append(row);
      });
      body.append(h(`<p class="fx-muted" style="text-align:center;margin:4px 0 8px">Tip: tap "Mark chapter read" at the end of a chapter. When every chapter for today is read, the day checks itself off.</p>`));
    });
  }

  /* ================= verse of the day ================= */
  const VOTD = ["Jeremiah 29:11", "Philippians 4:13", "Isaiah 41:10", "Joshua 1:9", "Romans 8:28", "Proverbs 3:5", "Proverbs 3:6", "Psalm 23:1", "Matthew 11:28", "John 3:16",
    "2 Corinthians 5:17", "Psalm 46:1", "Romans 15:13", "Isaiah 40:31", "Psalm 118:24", "Lamentations 3:22", "Lamentations 3:23", "Philippians 4:6", "Philippians 4:7", "1 Peter 5:7",
    "Psalm 27:1", "Hebrews 11:1", "Romans 8:38", "Romans 8:39", "Galatians 6:9", "Psalm 119:105", "Matthew 6:33", "John 14:27", "John 16:33", "Deuteronomy 31:6",
    "Psalm 34:18", "Isaiah 26:3", "2 Timothy 1:7", "Romans 12:2", "Ephesians 2:8", "Ephesians 2:10", "Colossians 3:23", "1 Corinthians 16:14", "Micah 6:8", "Zephaniah 3:17",
    "Psalm 37:4", "Psalm 16:8", "Psalm 121:2", "Psalm 139:14", "Proverbs 16:3", "James 1:5", "1 John 4:19", "1 John 1:9", "John 15:5", "John 8:12",
    "Matthew 5:16", "Psalm 55:22", "Nahum 1:7", "Isaiah 43:2", "Psalm 91:1", "Romans 5:8", "Hebrews 13:8", "Psalm 145:18", "2 Corinthians 12:9", "Psalm 62:1",
    "Numbers 6:24", "Psalm 32:8", "Isaiah 12:2", "Mark 10:27", "Luke 1:37", "Psalm 103:2", "Psalm 4:8", "1 Thessalonians 5:16", "1 Thessalonians 5:17", "1 Thessalonians 5:18",
    "Proverbs 18:10", "Psalm 28:7", "Matthew 28:20", "Romans 10:9", "Psalm 51:10", "Colossians 3:15", "Psalm 19:14", "James 1:17", "Hebrews 4:16", "Psalm 147:3"];
  function votdRef(date = dayStr()) {
    const [y, m, d] = date.split("-").map(Number); const n = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
    return VOTD[((n * 7) % VOTD.length + VOTD.length) % VOTD.length];
  }
  async function getVotd(version) {
    const date = dayStr(), ref = votdRef(date), store = load(K.VOTD, {}), key = date + "|" + version;
    if (store[key]) return store[key];
    let out = null;
    for (const ver of [version, "web", "kjv"]) {
      try { const text = String(await C.fetchVerseText(ref, ver) || "").replace(/\s+/g, " ").trim(); if (text) { out = { ref, text, version: ver, date }; break; } } catch {}
    }
    if (!out) throw new Error(navigator.onLine ? "fetch-failed" : "offline");
    const keep = {}; Object.keys(store).filter(k => k.startsWith(date)).forEach(k => keep[k] = store[k]); keep[key] = out; save(K.VOTD, keep);
    return out;
  }
  function votdCard(el) {
    const ver = C.panes.a.version; const ref = votdRef();
    el.innerHTML = `<div class="fx-eyebrow">☀️ Verse of the day</div><div class="fx-votd-text"><div class="fx-skel"></div><div class="fx-skel" style="width:70%"></div></div><div class="fx-votd-ref">${esc(ref)}</div>`;
    getVotd(ver).then(v => {
      el.innerHTML = `<div class="fx-eyebrow">☀️ Verse of the day</div><div class="fx-votd-text">“${esc(v.text)}”</div>
        <div class="fx-row" style="justify-content:space-between"><div class="fx-votd-ref">${esc(v.ref)} <span class="fx-muted">· ${esc(vname(v.version))}</span></div></div>
        <div class="fx-row" style="margin-top:12px"><button class="fx-btn small st-ib" data-a="share">${SVG_IMG}Make image</button><button class="fx-btn small st-ib" data-a="mem">${SVG_MEM}Memorize</button><button class="fx-btn small" data-a="copy">📋 Copy</button><button class="fx-btn small" data-a="open">📖 Read chapter</button></div>`;
      el.querySelector('[data-a="share"]').onclick = () => openImageMaker({ text: v.text, ref: v.ref, version: v.version, votd: true });
      el.querySelector('[data-a="mem"]').onclick = () => openMemorize({ text: v.text, ref: v.ref, version: v.version });
      el.querySelector('[data-a="copy"]').onclick = async () => toast(await copyText(`"${v.text}" — ${v.ref} (${vname(v.version)})`) ? "Copied ✓" : "Couldn't copy");
      el.querySelector('[data-a="open"]').onclick = () => { const m = v.ref.match(/^(.+?)\s+(\d+):(\d+)/); const b = BOOKS.findIndex(x => x[0] === m[1] || x[1] === m[1]); if (b >= 0) jumpTo(b, +m[2], +m[3]); };
    }).catch(err => {
      el.innerHTML = `<div class="fx-eyebrow">☀️ Verse of the day</div><div class="fx-votd-ref" style="margin-top:8px">${esc(ref)}</div><p class="fx-muted">${err.message === "offline" ? "You're offline. Today's verse loads when you're back online." : "Couldn't load today's verse right now."}</p><button class="fx-btn small" data-a="retry">Try again</button>`;
      el.querySelector('[data-a="retry"]').onclick = () => votdCard(el);
    });
  }

  /* ================= today (open screen) ================= */
  function lastPos() { const p = load(K.POS, null); const a = C.panes.a; return p && BOOKS[p.bookIdx] ? p : { bookIdx: a.bookIdx, chapter: a.chapter }; }
  function todaySheet() {
    const hr = new Date().getHours(); const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    openSheet("today", greet + " ☀️", body => {
      const v = h(`<div class="fx-card gold fx-votd"></div>`); body.append(v); votdCard(v);
      const pos = lastPos();
      const cont = h(`<button class="fx-btn primary block fx-continue" data-a="continue"><span style="font-size:22px">📖</span><span class="t">Continue reading<small style="color:inherit;opacity:.8">${esc(refOf(pos.bookIdx, pos.chapter))} · ${esc(vname(C.panes.a.version))}</small></span><span>→</span></button>`);
      body.append(cont);
      cont.onclick = () => { const a = C.panes.a; closeSheet(); if (a.bookIdx !== pos.bookIdx || a.chapter !== pos.chapter) C.goTo(pos.bookIdx, pos.chapter); };
      body.append(h(`<div style="height:12px"></div>`));
      const st = planState();
      const pc = h(`<div class="fx-card">${streakCard()}${st ? `<div style="height:12px"></div>${todayPlanHtml(st)}` : `<p class="fx-muted" style="margin:10px 0">Pick a reading plan to build a daily habit.</p><button class="fx-btn block" data-a="plans">🔥 Start a reading plan</button>`}</div>`);
      body.append(pc); wirePlanCard(pc);
      const pb = pc.querySelector('[data-a="plans"]'); if (pb) pb.onclick = plansSheet;
      const links = h(`<div class="fx-row"><button class="fx-btn small" data-a="mb" style="flex:1">🔖 My Bible</button><button class="fx-btn small" data-a="pl" style="flex:1">🔥 Plans</button><button class="fx-btn small" data-a="aa" style="flex:1">Aa Settings</button></div>`);
      body.append(links);
      const memBtn = h(`<button class="fx-btn small block st-ib" data-a="memlist" style="margin-top:8px">${SVG_MEM}My memory verses</button>`); body.append(memBtn);
      memBtn.onclick = () => { const s = studio(); if (s) s.memoryList(); else toast("Memorize is still loading"); };
      links.querySelector('[data-a="mb"]').onclick = myBible; links.querySelector('[data-a="pl"]').onclick = plansSheet; links.querySelector('[data-a="aa"]').onclick = settingsSheet;
    });
    try { localStorage.setItem(K.SEEN, dayStr()); } catch {}
  }

  /* ================= settings ================= */
  function settingsSheet() {
    openSheet("settings", "Reading settings", body => {
      const p = prefs();
      const seg = (k, opts) => `<div class="fx-seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(p[k]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
      const el = h(`<div>
        <div class="fx-set"><label class="h"><span>Text size</span><span class="sz">${p.size}px</span></label><input class="fx-range" type="range" min="14" max="30" step="1" value="${p.size}" aria-label="Text size"></div>
        <div class="fx-set"><label class="h">Font</label>${seg("font", [["serif", "Serif"], ["sans", "Sans"]])}</div>
        <div class="fx-set"><label class="h">Line spacing</label>${seg("lh", [[1.5, "Tight"], [1.78, "Normal"], [2.1, "Roomy"]])}</div>
        <div class="fx-set"><label class="h">Theme</label>${seg("theme", [["dark", '<span class="fx-theme-dot" style="background:#141b2e"></span>Dark'], ["sepia", '<span class="fx-theme-dot" style="background:#f4ecd8"></span>Sepia'], ["light", '<span class="fx-theme-dot" style="background:#fff"></span>Light']])}</div>
        <div class="fx-set"><label class="h">Preview</label><div class="fx-preview"><sup style="color:var(--gold);font-size:.6em">1</sup> In the beginning was the Word, and the Word was with God, and the Word was God.</div></div>
        <button class="fx-btn block" data-a="wn" style="margin-bottom:8px">What's new in Bibley</button>
        <button class="fx-btn block" data-a="reset">Reset to default</button></div>`);
      body.append(el);
      const r = el.querySelector(".fx-range");
      r.oninput = () => { setPref("size", +r.value); el.querySelector(".sz").textContent = r.value + "px"; };
      el.querySelectorAll(".fx-seg").forEach(s => s.querySelectorAll("button").forEach(b => b.onclick = () => {
        const k = s.dataset.k; s.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        setPref(k, k === "lh" ? +b.dataset.v : b.dataset.v);
      }));
      el.querySelector('[data-a="reset"]').onclick = () => { save(K.PREFS, {}); applyPrefs(); settingsSheet(); };
      el.querySelector('[data-a="wn"]').onclick = () => { const s = studio(); if (s) { closeSheet(); s.whatsNew(); } else toast("Still loading"); };
    });
  }

  /* ================= share as image ================= */
  const CARD_STYLES = {
    night: { name: "Night", bg: ["#1b2440", "#0b1020"], ink: "#efe7d4", gold: "#d8b673", glow: "#c9a86733" },
    dawn: { name: "Dawn", bg: ["#3a2a5e", "#e08a5b"], ink: "#fff7ec", gold: "#ffe2a8", glow: "#ffd9a044" },
    paper: { name: "Parchment", bg: ["#f7efdc", "#e9dcbc"], ink: "#3b2f22", gold: "#8a6420", glow: "#8a642022" }
  };
  let cardStyle = "night";
  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  async function drawCard(canvas, d) {
    const W = 1080, H = 1350, s = CARD_STYLES[cardStyle]; canvas.width = W; canvas.height = H;
    try { await Promise.all(["600 60px Fraunces", "400 60px 'Source Serif 4'", "italic 400 60px 'Source Serif 4'"].map(f => document.fonts.load(f))); } catch {}
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * .8, H * .15, 20, W * .8, H * .15, 700); rg.addColorStop(0, s.glow); rg.addColorStop(1, "transparent"); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = s.gold; ctx.globalAlpha = .55; ctx.lineWidth = 3; ctx.strokeRect(46, 46, W - 92, H - 92); ctx.globalAlpha = .25; ctx.lineWidth = 1.5; ctx.strokeRect(62, 62, W - 124, H - 124); ctx.globalAlpha = 1;
    ctx.fillStyle = s.gold; ctx.textAlign = "center"; ctx.font = "600 30px Fraunces, Georgia, serif";
    const eyebrow = (d.votd ? "VERSE OF THE DAY" : "✦  BIBLEY  ✦"); ctx.fillText(eyebrow.split("").join(String.fromCharCode(8202)), W / 2, 150);
    const text = "“" + d.text + "”"; const maxW = W - 220, top = 220, bottom = H - 300;
    let size = 72, lines, lh;
    for (; size >= 30; size -= 2) { ctx.font = `400 ${size}px 'Source Serif 4', Georgia, serif`; lines = wrap(ctx, text, maxW); lh = size * 1.42; if (lines.length * lh <= bottom - top) break; }
    ctx.fillStyle = s.ink; const blockH = lines.length * lh; let y = top + (bottom - top - blockH) / 2 + size;
    for (const l of lines) { ctx.fillText(l, W / 2, y); y += lh; }
    ctx.fillStyle = s.gold; ctx.fillRect(W / 2 - 40, H - 262, 80, 3);
    ctx.font = "600 50px Fraunces, Georgia, serif"; ctx.fillText(d.ref, W / 2, H - 190);
    ctx.font = "400 30px 'Source Serif 4', Georgia, serif"; ctx.globalAlpha = .8; ctx.fillStyle = s.ink; ctx.fillText(vname(d.version) + "  ·  Bibley", W / 2, H - 135); ctx.globalAlpha = 1;
  }
  function shareSheet(d) {
    openSheet("share", "Share verse", body => {
      const el = h(`<div><div class="fx-canvas-wrap"><canvas width="1080" height="1350" aria-label="Verse image preview"></canvas></div>
        <div class="fx-seg" style="margin-bottom:12px">${Object.entries(CARD_STYLES).map(([k, s]) => `<button data-s="${k}" class="${k === cardStyle ? "on" : ""}">${s.name}</button>`).join("")}</div>
        <div class="fx-row"><button class="fx-btn primary" data-a="share" style="flex:1">📤 Share image</button><button class="fx-btn" data-a="save" style="flex:1">⬇ Save image</button></div></div>`);
      body.append(el);
      const cv = el.querySelector("canvas"); drawCard(cv, d);
      el.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { cardStyle = b.dataset.s; el.querySelectorAll("[data-s]").forEach(x => x.classList.toggle("on", x === b)); drawCard(cv, d); });
      const fname = d.ref.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") + ".png";
      const blob = () => new Promise(r => cv.toBlob(r, "image/png"));
      const download = async () => { const b = await blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast("Image saved ⬇"); };
      el.querySelector('[data-a="save"]').onclick = download;
      el.querySelector('[data-a="share"]').onclick = async () => {
        const b = await blob(); const file = new File([b], fname, { type: "image/png" });
        const payload = { files: [file], title: d.ref, text: `${d.ref} (${vname(d.version)})` };
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          try { await navigator.share(payload); } catch (e) { if (e && e.name !== "AbortError") download(); }
        } else download();
      };
    });
  }

  /* ================= dock, chapter-done, decorations, swipe ================= */
  let dock;
  function buildDock() {
    const pager = document.querySelector('.pane[data-pane="a"] .pager'); if (!pager || pager.querySelector(".fx-dock")) return;
    dock = h(`<div class="fx-dock"><button type="button" data-a="today" aria-label="Today" title="Today">☀️</button><button type="button" data-a="mb" aria-label="My Bible" title="My Bible">🔖</button><button type="button" data-a="plans" class="fx-streak-b" aria-label="Reading plans and streak" title="Reading plans">🔥<b>0</b></button><button type="button" data-a="notes" class="fx-notes-b" aria-label="Notes notebook" title="Notes"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h6M10 12h6M10 16h4"/></svg><span>Notes</span></button><button type="button" data-a="aa" aria-label="Reading settings" title="Text & theme">Aa</button></div>`);
    const label = pager.querySelector(".pager-label"); pager.insertBefore(dock, label.nextSibling); pager.classList.add("fx-has-dock");
    dock.querySelector('[data-a="today"]').onclick = todaySheet; dock.querySelector('[data-a="mb"]').onclick = myBible;
    dock.querySelector('[data-a="plans"]').onclick = plansSheet; dock.querySelector('[data-a="aa"]').onclick = settingsSheet;
    dock.querySelector('[data-a="notes"]').onclick = () => { if (window.BibleyNotes) window.BibleyNotes.open(); else toast("Notes are still loading"); };
    updateDock();
  }
  function updateDock() { if (!dock) return; const s = streak(); const b = dock.querySelector(".fx-streak-b b"); b.textContent = s.n; dock.querySelector(".fx-streak-b").style.opacity = s.n ? 1 : .75; }
  function decorate(k) {
    const ns = notes(), bm = vbms();
    // range bookmarks/notes (v5.1) mark every verse they cover
    const spread = all => { const o = {}; Object.keys(all).forEach(key => { const x = all[key]; o[key] = 1; if (x && Array.isArray(x.verses) && BOOKS[x.bookIdx]) x.verses.forEach(n => { o[vKey(x.bookIdx, x.chapter, n)] = 1; }); }); return o; };
    const nsAll = spread(ns), bmAll = spread(bm);
    document.querySelectorAll(`.pane[data-pane="${k}"] .verses-text span[data-key]`).forEach(s => { s.classList.toggle("fx-has-note", !!nsAll[s.dataset.key]); s.classList.toggle("fx-has-bm", !!bmAll[s.dataset.key]); });
  }
  function decorateAll() { decorate("a"); decorate("b"); }
  let cur = { a: null, b: null };
  function refreshDoneButton() {
    const info = cur.a; const box = document.querySelector('.pane[data-pane="a"] .fx-done'); if (!info || !box) return;
    const read = isRead(info.bookIdx, info.chapter); const st = planState();
    const inPlan = st && !(st.finished && st.p.done[st.idx]) && st.today.some(([b, c]) => b === info.bookIdx && c === info.chapter);
    const btn = box.querySelector('[data-a="read"]');
    btn.classList.toggle("is-read", read); btn.innerHTML = read ? "✓ Chapter read" : "✓ Mark chapter read";
    box.querySelector(".hint").textContent = inPlan ? (read ? "Counted toward today's plan reading 🔥" : "This chapter is part of today's plan") : (read ? "Tap again to un-mark" : "Counts toward your 🔥 streak");
  }
  function addDone(info) {
    const inner = document.querySelector('.pane[data-pane="a"] .reader-inner .fade-in'); if (!inner || inner.querySelector(".fx-done")) return;
    const last = info.bookIdx === BOOKS.length - 1 && info.chapter === BOOKS[info.bookIdx][2];
    const box = h(`<div class="fx-done"><button class="fx-btn" type="button" data-a="read">✓ Mark chapter read</button>${last ? "" : '<button class="fx-btn" type="button" data-a="next">Next chapter →</button>'}<div class="hint"></div></div>`);
    inner.appendChild(box);
    box.querySelector('[data-a="read"]').onclick = () => {
      const rm = readMap(), k = chKey(info.bookIdx, info.chapter);
      if (rm[k]) { delete rm[k]; save(K.READ, rm); refreshDoneButton(); return; }
      rm[k] = dayStr(); save(K.READ, rm);
      const counted = onChapterRead(info.bookIdx, info.chapter);
      const s = streak().n; if (!document.querySelector(".pwa-toast.show")) toast(counted ? `Read ✓ · counted for today's plan · 🔥 ${s}` : `Chapter read ✓ · 🔥 ${s}-day streak`);
      updateDock(); refreshDoneButton();
    };
    const nx = box.querySelector('[data-a="next"]'); if (nx) nx.onclick = () => C.goNext("a");
    refreshDoneButton();
  }
  let swipeDir = { a: null, b: null };
  function onChapter(k, info) {
    // the selection belongs to one chapter: a different chapter (or version) clears it, a re-render keeps it
    if (sel && sel.pane === k) { if (sel.bookIdx !== info.bookIdx || sel.chapter !== info.chapter || (info.version && sel.version !== info.version)) clearSel(); else paintSel(); }
    cur[k] = info; decorate(k);
    if (k === "a") { addDone(info); doPendingJump(k, info); }
    const rm = document.querySelector(`.pane[data-pane="${k}"] .reader-main`);
    if (rm && swipeDir[k]) { rm.classList.remove("fx-swipe-next", "fx-swipe-prev"); void rm.offsetWidth; rm.classList.add("fx-swipe-" + swipeDir[k]); const d = swipeDir[k]; swipeDir[k] = null; setTimeout(() => rm.classList.remove("fx-swipe-" + d), 400); }
  }
  function wireSwipe() {
    document.querySelectorAll(".pane[data-pane] .reader-main").forEach(el => {
      const k = el.closest(".pane").dataset.pane; let sx = 0, sy = 0, st = 0, ok = false;
      el.addEventListener("touchstart", e => { if (e.touches.length !== 1) { ok = false; return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); ok = !e.target.closest("button,input,textarea,select,a"); }, { passive: true });
      el.addEventListener("touchend", e => {
        if (!ok) return; ok = false; const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Date.now() - st > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
        const sel = window.getSelection && String(window.getSelection()); if (sel && sel.trim()) return;
        swipeDir[k] = dx < 0 ? "next" : "prev"; if (dx < 0) C.goNext(k); else C.goPrev(k);
      }, { passive: true });
    });
  }

  /* ================= public hooks ================= */
  window.BibleyFX = {
    onVerseTap(v, span) { onVerseTap(v, span); },
    jumpToVerse: (b, c, v, verses) => jumpTo(b, c, v, verses),
    clearSelection: () => clearSel(),
    redecorate: () => decorateAll(),
    selection: () => selTarget(),
    onChapter,
    open: { today: todaySheet, myBible, plans: plansSheet, settings: settingsSheet, share: shareSheet },
    // used by bibley-notes.js (the paged Notes notebook)
    ui: { openSheet, closeSheet, toast, jumpTo, copyText, h, esc, refOf, vname, isOpen: view => sheetView === view, onClose: fn => { onSheetClose = fn; } },
    legacyNotes: {
      key: K.NOTES,
      all: () => notes(),
      set(key, text) { const n = notes()[key]; if (!n) return false; setNote({ key, bookIdx: n.bookIdx, chapter: n.chapter, verseNum: n.verseNum, text: n.verseText, version: n.version }, text); decorateAll(); C.refreshLists(); return true; }
    },
    _test: { votdRef, planDays, streak, importBackup, exportData: () => { const d = {}; BACKUP_KEYS.forEach(k => d[k] = load(k, null)); return d; }, closeSheet, summarize, drawCard }
  };
  buildDock(); wireSwipe();
  // Paged Notes notebook (bibley-notes.js) loads after the core features.
  (function loadNotes() {
    if (document.querySelector('script[data-bibley-notes]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "bibley-notes.css"; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = "bibley-notes.js"; s.defer = true; s.dataset.bibleyNotes = "1"; document.body.appendChild(s);
  })();
  // v4: Verse Image Maker, Memorize mode and the page turn animation (bibley-studio.js).
  (function loadStudio() {
    if (document.querySelector('script[data-bibley-studio]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "bibley-studio.css"; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = "bibley-studio.js"; s.defer = true; s.dataset.bibleyStudio = "1"; document.body.appendChild(s);
  })();
  ["a", "b"].forEach(k => { const p = C.panes[k]; const el = document.querySelector(`.pane[data-pane="${k}"] .verses-text`); if (el) onChapter(k, { bookIdx: p.bookIdx, chapter: p.chapter, version: p.version }); });
  // Open screen: once a day show Today (verse of the day, continue reading, plan) unless opened from a shortcut.
  const fromShortcut = /^#(search|ask)$/.test(location.hash) || /[?&]src=shortcut/.test(location.search);
  if (!fromShortcut && load(K.SEEN, "") !== dayStr() && localStorage.getItem(K.SEEN) !== dayStr()) setTimeout(() => { if (!document.querySelector("#aiPanel.open, #drawer.open")) todaySheet(); }, 450);
})();
