/* Bibley PWA: service worker, Install button, offline banner, update notice.
   Kept separate from the reader script so the reader works with or without it. */
(() => {
  const $ = id => document.getElementById(id);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
  const DISMISS_KEY = 'bibley_install_dismissed_v1';
  let deferredPrompt = null;

  function toast(msg, ms) {
    const t = $('pwaToast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }
  window.bibleyToast = toast;

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then(reg => {
        // Check for a new version whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      }).catch(err => console.warn('Service worker not registered', err));
    });
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshed) return;   // first install: nothing to announce
      refreshed = true;
      toast('Bibley updated ✓');
    });
  }

  /* ---------- install button ---------- */
  const pill = $('installPill'), pillBtn = $('installPillBtn'), pillClose = $('installPillClose'), drawerBtn = $('installDrawerBtn');
  function dismissedRecently() { try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 3 * 864e5; } catch { return false; } }
  function showInstall(show) {
    const on = show && !isStandalone();
    if (drawerBtn) drawerBtn.hidden = !on;
    if (pill) pill.hidden = !(on && !dismissedRecently());
  }
  async function doInstall() {
    if (!deferredPrompt) { toast('Tap ⋮ in Chrome → "Add to Home screen" or "Install app"', 5000); return; }
    deferredPrompt.prompt();
    let outcome = 'dismissed';
    try { ({ outcome } = await deferredPrompt.userChoice); } catch {}
    deferredPrompt = null;
    if (outcome === 'accepted') showInstall(false);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; showInstall(true); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; showInstall(false); toast('Installed! Bibley is on your home screen 📖', 4000); });
  if (pillBtn) pillBtn.addEventListener('click', doInstall);
  if (drawerBtn) drawerBtn.addEventListener('click', doInstall);
  if (pillClose) pillClose.addEventListener('click', () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} if (pill) pill.hidden = true; });
  const mq = matchMedia('(display-mode: standalone)');
  if (mq.addEventListener) mq.addEventListener('change', () => { if (isStandalone()) showInstall(false); });
  showInstall(false);

  /* ---------- offline banner ---------- */
  const bar = $('offlineBar');
  function updOnline() {
    if (!bar) return;
    bar.hidden = navigator.onLine;
    document.body.classList.toggle('is-offline', !navigator.onLine);
  }
  window.addEventListener('online', () => { updOnline(); toast('Back online'); });
  window.addEventListener('offline', updOnline);
  updOnline();
})();
