/* bibley-notes.js - Bibley's paged Notes notebook.
   - "Add to notes" button under every AI verse summary and chapter summary (Study panel).
   - Notes are kept in pages like a notebook: create, rename, delete, flip (arrows or swipe).
   - Note cards open to edit, add your own thoughts, jump to the verse, move page, delete.
   - Notes written from the tap-verse sheet (bibley_notes_v1) show up too; that key is
     read and written exactly as before, nothing is copied or removed.
   Stored on the device only, in localStorage "bibley_notebook_v1". No notifications. */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !FX.ui || !C) { console.warn("Bibley notes: features bridge missing"); return; }
  const { openSheet, closeSheet, toast, jumpTo, copyText, h, esc, vname } = FX.ui;
  const LEG = FX.legacyNotes;
  const BOOKS = C.BOOKS;
  const KEY = "bibley_notebook_v1";
  const MAIN = "p_main";
  const CHECK = "&#10003;";
  const ICON_NOTE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h6M10 12h6M10 16h4"/></svg>';
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmtDate = t => { try { return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; } };

  /* ================= storage ================= */
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch {}
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    if (!Array.isArray(d.pages)) d.pages = [];
    if (!Array.isArray(d.notes)) d.notes = [];
    if (!d.legacyPage || typeof d.legacyPage !== "object") d.legacyPage = {};
    d.pages = d.pages.filter(p => p && p.id);
    if (!d.pages.length) d.pages.push({ id: MAIN, name: "My Notes", created: Date.now() });
    const ids = new Set(d.pages.map(p => p.id));
    d.notes = d.notes.filter(n => n && n.id);
    d.notes.forEach(n => { if (!ids.has(n.pageId)) n.pageId = d.pages[0].id; });
    if (!ids.has(d.lastPage)) d.lastPage = d.pages[0].id;
    if (!ids.has(d.viewPage)) d.viewPage = d.lastPage;
    d.v = 1;
    return d;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch { toast("Couldn't save: storage is full"); return false; }
  }
  const homePage = d => (d.pages.find(p => p.id === MAIN) || d.pages[0]).id;
  const pageOf = (d, id) => d.pages.find(p => p.id === id);
  function legacyPageId(d, key) { const p = d.legacyPage[key]; return pageOf(d, p) ? p : homePage(d); }

  // Everything on one page: notebook notes plus tap-verse notes placed there.
  function pageItems(d, pageId) {
    const out = d.notes.filter(n => n.pageId === pageId).map(n => Object.assign({ legacy: false }, n));
    const leg = (LEG && LEG.all()) || {};
    Object.keys(leg).forEach(key => {
      const n = leg[key]; if (!n || !n.text) return;
      if (legacyPageId(d, key) !== pageId) return;
      out.push({ id: "legacy:" + key, legacy: true, key, kind: "verse-note", ref: n.ref || "", bookIdx: n.bookIdx, chapter: n.chapter, verseNum: n.verseNum,
        version: n.version, verseText: n.verseText || "", summary: "", thoughts: n.text, created: n.added || n.updated || 0, updated: n.updated || n.added || 0 });
    });
    out.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
    return out;
  }

  function addPage(d, name) {
    name = String(name || "").trim().slice(0, 60); if (!name) return null;
    const p = { id: uid("p_"), name, created: Date.now() }; d.pages.push(p); return p;
  }
  function promptNewPage(d) {
    const name = prompt("Name the new page (e.g. Romans study, Youth group)", "");
    if (name == null) return null;
    const p = addPage(d, name); if (!p) { toast("Page needs a name"); return null; }
    return p;
  }

  /* ================= "Add to notes" under AI results ================= */
  const aiContent = document.getElementById("aiContent");
  const txt = el => (el ? el.textContent : "").replace(/\s+/g, " ").trim();
  function bookIdxByName(name) { const i = BOOKS.findIndex(b => b[1] === name); return i; }
  function verseInfo() {
    const gold = aiContent.querySelector(".ai-card.gold .verse-ref");
    const refStr = txt(gold); const m = refStr.match(/^(.+)\s(\d+):(\d+)(?:[-,\s\d]*)$/); if (!m) return null;
    const bookIdx = bookIdxByName(m[1]);
    let vt = txt(aiContent.querySelector(".ai-card.gold .verse-text")).replace(/^["\u201c]|["\u201d]$/g, "");
    const p = id => txt(document.querySelector("#" + id + " p"));
    const parts = [p("vsSummaryCard")];
    if (p("vsContextCard")) parts.push("In context: " + p("vsContextCard"));
    if (p("vsApplicationCard")) parts.push("Application: " + p("vsApplicationCard"));
    return { kind: "verse", ref: refStr, bookIdx: bookIdx >= 0 ? bookIdx : null, chapter: +m[2], verseNum: +m[3], version: C.panes.a.version, verseText: vt, summary: parts.filter(Boolean).join("\n\n") };
  }
  function chapterInfo() {
    const pa = C.panes.a; if (!BOOKS[pa.bookIdx]) return null;
    const ov = txt(document.querySelector("#chSummaryCard p"));
    const kp = [...document.querySelectorAll("#chKeyPointsCard .bullet p")].map((e, i) => (i + 1) + ". " + txt(e));
    const st = txt(document.querySelector("#chStructureCard p"));
    let s = ov; if (kp.length) s += "\n\nKey points:\n" + kp.join("\n"); if (st) s += "\n\nStructure: " + st;
    return { kind: "chapter", ref: BOOKS[pa.bookIdx][1] + " " + pa.chapter, bookIdx: pa.bookIdx, chapter: pa.chapter, verseNum: null, version: pa.version, verseText: "", summary: s.trim() };
  }
  const sameNote = (a, b) => a.ref === b.ref && (a.summaryOrig || a.summary) === b.summary;
  function pageOptions(d, sel) {
    return d.pages.map(p => `<option value="${esc(p.id)}"${p.id === sel ? " selected" : ""}>${esc(p.name)}</option>`).join("") + '<option value="__new">+ New page...</option>';
  }
  function insertBar(kind, anchor, before) {
    const info0 = kind === "verse" ? verseInfo() : chapterInfo(); if (!info0 || !info0.summary) return;
    const d = load();
    const existing = d.notes.find(n => sameNote(n, info0));
    const bar = h(`<div class="nb-add" data-for="${kind}">
      <button class="nb-add-btn" type="button">${ICON_NOTE}<span>Add to notes</span></button>
      <label class="nb-add-to"><span>Page</span><select aria-label="Notes page">${pageOptions(d, existing ? existing.pageId : d.lastPage)}</select></label></div>`);
    if (before) anchor.parentNode.insertBefore(bar, anchor); else anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    const btn = bar.querySelector(".nb-add-btn"), sel = bar.querySelector("select");
    let lastSel = sel.value, addedId = existing ? existing.id : null;
    const markAdded = () => { btn.classList.add("added"); btn.innerHTML = `<span>Added ${CHECK}</span><small>View</small>`; btn.setAttribute("aria-label", "Added to notes. Open notes"); };
    if (existing) markAdded();
    sel.addEventListener("change", () => {
      if (sel.value !== "__new") { lastSel = sel.value; return; }
      const dd = load(); const p = promptNewPage(dd);
      if (!p) { sel.value = lastSel; return; }
      save(dd); sel.innerHTML = pageOptions(dd, p.id); lastSel = p.id; toast("Page \u201c" + p.name + "\u201d created");
    });
    btn.addEventListener("click", () => {
      const dd = load();
      if (addedId && dd.notes.some(n => n.id === addedId)) { const n = dd.notes.find(x => x.id === addedId); C.closeAi && C.closeAi(); open(n.pageId); return; }
      const info = kind === "verse" ? verseInfo() : chapterInfo(); if (!info) return;
      const pageId = pageOf(dd, sel.value) ? sel.value : dd.lastPage;
      const now = Date.now();
      const n = Object.assign({ id: uid("n_"), pageId, thoughts: "", created: now, updated: now, summaryOrig: info.summary }, info);
      dd.notes.push(n); dd.lastPage = pageId; dd.viewPage = pageId;
      if (!save(dd)) return;
      addedId = n.id; markAdded();
      toast("Added to notes \u00b7 " + pageOf(dd, pageId).name);
    });
  }
  function scan() {
    if (!aiContent) return;
    const sc = document.getElementById("vsSummaryCard"), ac = document.getElementById("vsApplicationCard");
    if (sc && ac && !aiContent.querySelector('.nb-add[data-for="verse"]') && sc.querySelector("p") && !sc.querySelector(".skeleton, #retryVerseSummary, .ai-action-btn")) insertBar("verse", ac, false);
    const regen = document.getElementById("regenChapterSummary");
    if (regen && !aiContent.querySelector('.nb-add[data-for="chapter"]') && document.querySelector("#chSummaryCard p")) insertBar("chapter", regen, true);
  }
  if (aiContent) { new MutationObserver(() => scan()).observe(aiContent, { childList: true, subtree: true }); scan(); }

  /* ================= notebook ================= */
  let flipDir = 0;
  function open(pageId) {
    const d = load();
    if (pageId && pageOf(d, pageId)) { d.viewPage = pageId; save(d); }
    openSheet("notes", "Notes", renderNotebook);
  }
  function go(delta) {
    const d = load(); const i = d.pages.findIndex(p => p.id === d.viewPage);
    const j = i + delta; if (j < 0 || j >= d.pages.length) { toast(delta < 0 ? "This is the first page" : "This is the last page"); return; }
    d.viewPage = d.pages[j].id; save(d); flipDir = delta; openSheet("notes", "Notes", renderNotebook);
  }
  function renderNotebook(body) {
    const d = load(); const i = Math.max(0, d.pages.findIndex(p => p.id === d.viewPage)); const page = d.pages[i];
    const items = pageItems(d, page.id);
    const wrap = h(`<div class="nb">
      <div class="nb-pagebar">
        <button class="nb-arrow" type="button" data-a="prev" aria-label="Previous page"${i === 0 ? " disabled" : ""}>&#8249;</button>
        <button class="nb-pagehead" type="button" data-a="rename" title="Rename page"><span class="nb-pagename">${esc(page.name)}</span><span class="nb-pageof">Page ${i + 1} of ${d.pages.length}</span></button>
        <button class="nb-arrow" type="button" data-a="next" aria-label="Next page"${i === d.pages.length - 1 ? " disabled" : ""}>&#8250;</button>
      </div>
      <div class="nb-dots" role="tablist" aria-label="Pages">${d.pages.map((p, k) => `<button type="button" class="nb-dot${k === i ? " on" : ""}" data-k="${k}" aria-label="${esc(p.name)}" title="${esc(p.name)}"></button>`).join("")}</div>
      <div class="nb-tools">
        <button class="fx-btn primary small" type="button" data-a="newnote">+ New note</button>
        <button class="fx-btn small" type="button" data-a="newpage">+ New page</button>
        <button class="fx-btn small" type="button" data-a="more" aria-expanded="false">Page &#8943;</button>
      </div>
      <div class="nb-menu" hidden>
        <button class="fx-btn small" type="button" data-a="rename">Rename</button>
        <button class="fx-btn small" type="button" data-a="copy">Copy page</button>
        <button class="fx-btn small" type="button" data-a="share">Share page</button>
        <button class="fx-btn small danger" type="button" data-a="delpage">Delete page</button>
      </div>
      <div class="nb-paper${flipDir ? (flipDir > 0 ? " flip-next" : " flip-prev") : ""}"></div>
      <div class="nb-hint">Swipe left or right to flip pages</div>
    </div>`);
    flipDir = 0;
    const paper = wrap.querySelector(".nb-paper");
    if (!items.length) {
      paper.append(h(`<div class="nb-empty"><div class="nb-empty-ico">${ICON_NOTE}</div><p>No notes on this page yet.</p><p class="nb-sub">Open Study on a verse, and when the summary shows up tap <b>Add to notes</b>. Or write your own with <b>+ New note</b>.</p></div>`));
    }
    items.forEach(it => {
      const first = (it.summary || "").split("\n\n")[0];
      const snippet = it.kind === "free" ? (it.thoughts || "") : (first || it.thoughts || it.verseText || "");
      const title = it.kind === "free" ? (it.title || "Note") : (it.ref || "Note");
      const tag = it.kind === "verse-note" ? "Verse note" : it.kind === "chapter" ? "Chapter summary" : it.kind === "verse" ? "Verse summary" : "My note";
      const card = h(`<button type="button" class="nb-card k-${esc(it.kind || "free")}">
        <span class="nb-card-top"><span class="nb-card-ref">${esc(title)}${it.version && it.kind !== "free" ? ` <span class="nb-ver">${esc(vname(it.version))}</span>` : ""}</span><span class="nb-card-date">${esc(fmtDate(it.created || it.updated))}</span></span>
        <span class="nb-card-sum">${esc(snippet)}</span>
        ${it.thoughts && it.kind !== "free" && it.kind !== "verse-note" ? `<span class="nb-card-mine">${esc(it.thoughts)}</span>` : ""}
        <span class="nb-card-tag">${tag}</span></button>`);
      card.addEventListener("click", () => openNote(it));
      paper.append(card);
    });
    body.append(wrap);
    const q = a => wrap.querySelectorAll(`[data-a="${a}"]`);
    q("prev").forEach(b => b.onclick = () => go(-1));
    q("next").forEach(b => b.onclick = () => go(1));
    wrap.querySelectorAll(".nb-dot").forEach(b => b.onclick = () => { const dd = load(); const k = +b.dataset.k; const cur = dd.pages.findIndex(p => p.id === dd.viewPage); if (k === cur) return; dd.viewPage = dd.pages[k].id; save(dd); flipDir = k > cur ? 1 : -1; openSheet("notes", "Notes", renderNotebook); });
    q("newnote").forEach(b => b.onclick = () => openNote({ id: null, kind: "free", pageId: page.id, title: "", thoughts: "", summary: "", created: Date.now() }));
    q("newpage").forEach(b => b.onclick = () => { const dd = load(); const p = promptNewPage(dd); if (!p) return; dd.viewPage = p.id; dd.lastPage = p.id; save(dd); flipDir = 1; toast("Page \u201c" + p.name + "\u201d created"); openSheet("notes", "Notes", renderNotebook); });
    q("more").forEach(b => b.onclick = () => { const m = wrap.querySelector(".nb-menu"); m.hidden = !m.hidden; b.setAttribute("aria-expanded", String(!m.hidden)); });
    q("rename").forEach(b => b.onclick = () => {
      const name = prompt("Rename this page", page.name); if (name == null) return;
      const nm = name.trim().slice(0, 60); if (!nm) { toast("Page needs a name"); return; }
      const dd = load(); const p = pageOf(dd, page.id); if (!p) return; p.name = nm; save(dd); toast("Page renamed"); openSheet("notes", "Notes", renderNotebook);
    });
    q("delpage").forEach(b => b.onclick = () => {
      const dd = load();
      if (dd.pages.length <= 1) { toast("You need at least one page. Rename this one instead."); return; }
      const own = dd.notes.filter(n => n.pageId === page.id).length;
      const leg = items.filter(x => x.legacy).length;
      const msg = `Delete the page \u201c${page.name}\u201d` + (own ? ` and its ${own} note${own === 1 ? "" : "s"}` : "") + "? This can't be undone." + (leg ? `\n\n${leg} verse note${leg === 1 ? "" : "s"} from the reader will move to another page, not be deleted.` : "");
      if (!confirm(msg)) return;
      const idx = dd.pages.findIndex(p => p.id === page.id);
      dd.pages.splice(idx, 1); dd.notes = dd.notes.filter(n => n.pageId !== page.id);
      Object.keys(dd.legacyPage).forEach(k => { if (dd.legacyPage[k] === page.id) delete dd.legacyPage[k]; });
      dd.viewPage = dd.pages[Math.max(0, idx - 1)].id; if (dd.lastPage === page.id) dd.lastPage = dd.viewPage;
      save(dd); toast("Page deleted"); openSheet("notes", "Notes", renderNotebook);
    });
    q("copy").forEach(b => b.onclick = async () => toast(await copyText(pageText(page, items)) ? "Page copied " + "\u2713" : "Couldn't copy"));
    q("share").forEach(b => b.onclick = async () => {
      const text = pageText(page, items);
      if (navigator.share) { try { await navigator.share({ title: "Bibley Notes: " + page.name, text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      toast(await copyText(text) ? "Sharing isn't available here, so the page was copied" : "Couldn't share");
    });
    // swipe to flip pages
    let sx = null, sy = null;
    wrap.addEventListener("touchstart", e => { if (e.target.closest("textarea, input, select")) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    wrap.addEventListener("touchend", e => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  function pageText(page, items) {
    const lines = ["Bibley Notes: " + page.name, ""];
    items.forEach(it => {
      if (it.kind === "free") lines.push((it.title || "Note") + " (" + fmtDate(it.created) + ")");
      else lines.push((it.ref || "Note") + (it.version ? " (" + vname(it.version) + ")" : "") + " - " + fmtDate(it.created));
      if (it.verseText) lines.push("\u201c" + it.verseText + "\u201d");
      if (it.summary) lines.push(it.summary);
      if (it.thoughts) lines.push(it.kind === "free" ? it.thoughts : "My thoughts: " + it.thoughts);
      lines.push("", "---", "");
    });
    if (!items.length) lines.push("(no notes on this page yet)");
    return lines.join("\n").replace(/\n---\n\n$/, "\n").trim();
  }

  /* ================= one note ================= */
  function openNote(it) {
    const d0 = load();
    const pageId0 = it.legacy ? legacyPageId(d0, it.key) : it.pageId;
    const title = it.kind === "free" ? (it.id ? "Note" : "New note") : (it.ref || "Note");
    openSheet("notes-note", title, body => {
      const d = load();
      const canJump = it.bookIdx != null && BOOKS[it.bookIdx] && it.chapter;
      const box = h(`<div class="nb-note">
        ${it.kind !== "free" ? `<button type="button" class="nb-ref" ${canJump ? "" : "disabled"}>${esc(it.ref || "")}${it.version ? " \u00b7 " + esc(vname(it.version)) : ""}${canJump ? ' <span class="nb-go">Go to verse &#8250;</span>' : ""}</button>` : ""}
        ${it.verseText ? `<div class="fx-vtext nb-vtext">${esc(it.verseText)}</div>` : ""}
        ${it.kind === "free" ? `<label class="nb-lbl">Title</label><input class="fx-input nb-title" type="text" maxlength="80" placeholder="Title (optional)" value="${esc(it.title || "")}">` : ""}
        ${it.kind === "verse" || it.kind === "chapter" ? `<label class="nb-lbl">${it.kind === "chapter" ? "AI chapter summary" : "AI summary"}</label><textarea class="fx-textarea nb-sum" aria-label="Summary">${esc(it.summary || "")}</textarea>` : ""}
        <label class="nb-lbl">${it.kind === "free" ? "Note" : it.kind === "verse-note" ? "Your note" : "Your thoughts"}</label>
        <textarea class="fx-textarea nb-mine" aria-label="Your thoughts" placeholder="${it.kind === "free" ? "Write anything: sermon notes, prayers, questions..." : "What stands out to you? A prayer, a question, a thought..."}">${esc(it.thoughts || "")}</textarea>
        <label class="nb-lbl">Page</label>
        <select class="fx-input nb-move" aria-label="Move to page">${pageOptions(d, pageId0)}</select>
        ${it.id ? `<div class="nb-meta">Added ${esc(fmtDate(it.created))}${it.legacy ? " from the verse note in the reader" : ""}</div>` : ""}
        <div class="fx-row nb-btns"><button class="fx-btn primary" type="button" data-a="done" style="flex:1">Save</button>${it.id ? '<button class="fx-btn danger" type="button" data-a="del">Delete</button>' : ""}<button class="fx-btn" type="button" data-a="back">Back</button></div>
      </div>`);
      body.append(box);
      const tEl = box.querySelector(".nb-title"), sEl = box.querySelector(".nb-sum"), mEl = box.querySelector(".nb-mine"), mv = box.querySelector(".nb-move");
      if (!it.id) setTimeout(() => { try { (tEl || mEl).focus(); } catch {} }, 280);
      let lastMv = mv.value, discard = false;
      mv.addEventListener("change", () => {
        if (mv.value !== "__new") { lastMv = mv.value; return; }
        const dd = load(); const p = promptNewPage(dd); if (!p) { mv.value = lastMv; return; }
        save(dd); mv.innerHTML = pageOptions(dd, p.id); lastMv = p.id;
      });
      const commit = (quiet) => {
        if (discard) return null;
        const dd = load(); const pid = pageOf(dd, mv.value) ? mv.value : (pageOf(dd, pageId0) ? pageId0 : dd.pages[0].id);
        const mine = mEl.value.replace(/\s+$/, ""), ttl = tEl ? tEl.value.trim() : "", sum = sEl ? sEl.value.replace(/\s+$/, "") : null;
        if (it.legacy) {
          const cur = (LEG.all() || {})[it.key];
          if (!cur) return pid;
          if (!mine.trim()) { if (!quiet) toast("Note is empty, so it was kept as it was"); }
          else if (mine !== cur.text) LEG.set(it.key, mine);
          if (pid !== legacyPageId(dd, it.key)) { dd.legacyPage[it.key] = pid; save(dd); }
          return pid;
        }
        if (!it.id) {
          if (!mine.trim() && !ttl) return pid;
          const now = Date.now();
          const n = { id: uid("n_"), pageId: pid, kind: "free", ref: "", title: ttl, thoughts: mine, summary: "", created: now, updated: now };
          dd.notes.push(n); dd.lastPage = pid; save(dd); it.id = n.id; Object.assign(it, n);
          return pid;
        }
        const n = dd.notes.find(x => x.id === it.id); if (!n) return pid;
        const changed = n.thoughts !== mine || (tEl && n.title !== ttl) || (sum != null && n.summary !== sum) || n.pageId !== pid;
        if (changed) { n.thoughts = mine; if (tEl) n.title = ttl; if (sum != null) n.summary = sum; n.pageId = pid; n.updated = Date.now(); save(dd); }
        return pid;
      };
      FX.ui.onClose(() => commit(true));
      const backTo = pid => { const dd = load(); if (pid && pageOf(dd, pid)) { dd.viewPage = pid; save(dd); } openSheet("notes", "Notes", renderNotebook); };
      box.querySelector('[data-a="done"]').onclick = () => { FX.ui.onClose(null); const pid = commit(false); toast(pid !== pageId0 && it.id ? "Saved and moved to " + (pageOf(load(), pid) || {}).name : "Saved " + "\u2713"); backTo(pid); };
      box.querySelector('[data-a="back"]').onclick = () => { FX.ui.onClose(null); const pid = commit(true); backTo(pid); };
      const del = box.querySelector('[data-a="del"]');
      if (del) del.onclick = () => {
        if (!confirm(it.legacy ? "Delete this note? It's your verse note from the reader, so it will be removed there too." : "Delete this note? This can't be undone.")) return;
        discard = true; FX.ui.onClose(null);
        if (it.legacy) { LEG.set(it.key, ""); const dd = load(); delete dd.legacyPage[it.key]; save(dd); }
        else { const dd = load(); dd.notes = dd.notes.filter(x => x.id !== it.id); save(dd); }
        toast("Note deleted"); backTo(pageId0);
      };
      const refBtn = box.querySelector(".nb-ref");
      if (refBtn && canJump) refBtn.onclick = () => { FX.ui.onClose(null); commit(true); jumpTo(it.bookIdx, it.chapter, it.verseNum || null); };
    });
  }

  /* ================= backup import (from My Bible) ================= */
  function importData(src) {
    if (!src || typeof src !== "object") return;
    const d = load(); const pids = new Set(d.pages.map(p => p.id)); const nids = new Set(d.notes.map(n => n.id));
    (src.pages || []).forEach(p => { if (p && p.id && !pids.has(p.id)) { d.pages.push(p); pids.add(p.id); } });
    (src.notes || []).forEach(n => { if (n && n.id && !nids.has(n.id)) { d.notes.push(n); nids.add(n.id); } });
    Object.keys(src.legacyPage || {}).forEach(k => { if (!d.legacyPage[k]) d.legacyPage[k] = src.legacyPage[k]; });
    save(d);
  }

  window.BibleyNotes = { open, importData, _test: { load, save, pageItems, scan, pageText, KEY } };
})();
