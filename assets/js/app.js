/* NBK EXPRESS — app shell: layout, hash router, event delegation, dialogs, toasts. */
(function (NBK) {
  'use strict';
  const u = NBK.u, S = NBK.store, esc = u.esc;
  NBK.pages = NBK.pages || {};
  NBK.act = NBK.act || {};

  const NAV = [['dashboard', 'Dashboard', 'chart'], ['hari-ini', 'Hari Ini', 'home'], ['senarai', 'Senarai Vendor', 'list', [['senarai', 'Senarai harian'], ['vendor-menu', 'Vendor & Menu'], ['ejen', 'Ejen']]], ['pesanan', 'Pesanan', 'bag'], ['rekonsiliasi', 'Rekonsiliasi', 'scale'], ['tetapan', 'Tetapan', 'settings']];
  const ICONS = {
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 21h8"/><path d="M8 7c0-1.5 1-2 1-3.5"/><path d="M12 7c0-1.5 1-2 1-3.5"/><path d="M16 7c0-1.5 1-2 1-3.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    bank: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    list: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  const V = NBK.view = { date: u.todayMY(), f: {}, route: 'dashboard', params: {}, navOpen: false };
  try { const d = sessionStorage.getItem('nbk-date'); if (d) V.date = d; } catch (e) { /* ignore */ }
  const F = (page, defaults) => (V.f[page] = V.f[page] || Object.assign({}, defaults || {}));

  // ---- dialogs ----
  const M = { onInput: null, resolve: null, needReason: false };
  function modal(o) {
    const root = document.getElementById('modal');
    M.onInput = o.onInput || null;
    root.innerHTML = `<div class="modal-back" data-act="modalClose"></div>
      <div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h3 id="modal-title">${esc(o.title)}</h3><button class="icon-btn" data-act="modalClose" aria-label="Tutup">${icon('x')}</button></div>
        <div class="modal-body">${o.body}</div>${o.foot ? `<div class="modal-foot">${o.foot}</div>` : ''}</div>`;
    root.hidden = false;
    const first = root.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
    (first || root.querySelector('.modal-head button')).focus();
  }
  function closeModal(val) {
    const root = document.getElementById('modal');
    root.hidden = true; root.innerHTML = ''; M.onInput = null;
    if (M.resolve) { const r = M.resolve; M.resolve = null; r(val === undefined ? false : val); }
  }
  NBK.act.modalClose = () => closeModal(false);
  function confirmDlg(o) {
    return new Promise((resolve) => {
      modal({
        title: o.title,
        body: `<p class="mb">${o.text}</p>${o.reason ? `<label class="field"><span>Sebab</span><textarea id="cf-reason" rows="2" maxlength="300"></textarea></label><p class="err-text" id="cf-err" hidden>Sila nyatakan sebab.</p>` : ''}`,
        foot: `<button class="btn" data-act="modalClose">Batal</button><button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-act="confirmOk">${esc(o.ok || 'Ya')}</button>`,
      });
      M.resolve = resolve; M.needReason = !!o.reason;
    });
  }
  NBK.act.confirmOk = () => {
    if (!M.needReason) return closeModal(true);
    const v = document.getElementById('cf-reason').value.trim();
    if (!v) { document.getElementById('cf-err').hidden = false; return; }
    closeModal(v);
  };
  function toast(msg, type) {
    const box = document.getElementById('toasts'), el = document.createElement('div');
    el.className = 'toast t-' + (type || 'ok'); el.setAttribute('role', 'status'); el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 4000);
  }
  const formVals = (sel) => { const o = {}; document.querySelectorAll(sel + ' [name]').forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
  const showErrors = (errs) => {
    const box = document.getElementById('form-errors');
    if (box) { box.hidden = !errs.length; box.innerHTML = errs.map((e) => '<div>• ' + esc(e) + '</div>').join(''); }
    return !errs.length;
  };

  // ---- layout ----
  function layout() {
    const page = NBK.pages[V.route];
    const isToday = V.date === u.todayMY();
    const todo = S.st().orders.filter((o) => o.date === V.date && S.needsReview(o)).length + S.unmapped(V.date).length;
    return `
    <aside class="side ${V.navOpen ? 'open' : ''}" aria-label="Navigasi utama">
      <div class="brand"><div class="logo">${icon('bowl')}</div><div><strong>NBK Express</strong><small>Pesanan &amp; Vendor</small></div></div>
      <div class="nav-label">Menu utama</div>
      <nav>${NAV.map(([k, l, ic, sub]) => {
        const inGroup = sub && sub.some(([sk]) => sk === V.route);
        return `<a href="#/${k}" class="${V.route === k || inGroup ? 'on' : ''}" ${sub ? `aria-expanded="${inGroup}"` : ''}>${icon(ic)}<span>${l}</span>${k === 'hari-ini' && todo ? `<span class="nav-badge" title="Perlu tindakan">${todo}</span>` : ''}${sub ? `<svg class="ic caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>` : ''}</a>`
          + (inGroup ? `<div class="subnav">${sub.map(([sk, sl]) => `<a href="#/${sk}" class="${V.route === sk ? 'cur' : ''}">${sl}</a>`).join('')}</div>` : '');
      }).join('')}</nav>
      <div class="side-foot"><span class="avatar">AD</span><div><strong>Admin NBK</strong><small>Pentadbir</small><span class="demo-pill">Prototaip · data demo</span></div></div>
    </aside>
    <div class="scrim ${V.navOpen ? 'open' : ''}" data-act="navToggle"></div>
    <div class="main">
      <header class="top">
        <button class="icon-btn only-mobile" data-act="navToggle" aria-label="Buka menu">${icon('menu')}</button>
        <div class="top-title"><div class="crumb">NBK Express${(NAV.find((n) => n[3] && n[3].some(([sk]) => sk === V.route)) || [])[1] ? ' / ' + NAV.find((n) => n[3] && n[3].some(([sk]) => sk === V.route))[1] : ''}</div><h1>${esc(page.title)}</h1></div>
        <a class="conn" href="#/tetapan?tab=bcl" title="Status sambungan BCL"><i></i>BCL · mod demo</a>
        <div class="day-nav" role="group" aria-label="Tarikh">
          <button class="icon-btn" data-act="dayShift" data-n="-1" aria-label="Hari sebelum">${icon('left')}</button>
          <label><span class="sr">Tarikh</span><input type="date" id="top-date" value="${esc(V.date)}" data-act-change="setDate"></label>
          <button class="icon-btn" data-act="dayShift" data-n="1" aria-label="Hari berikut">${icon('right')}</button>
          ${isToday ? '<span class="today-tag hide-sm">Hari ini</span>' : '<button class="btn btn-sm hide-sm" data-act="dayToday">Hari ini</button>'}
        </div>
      </header>
      <main id="page" class="page">${page.render()}</main>
    </div>`;
  }
  function render() {
    const app = document.getElementById('app'), a = document.activeElement;
    const focusId = a && a.id && app.contains(a) ? a.id : null;
    const sel = focusId && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY;
    try { app.innerHTML = layout(); } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="page"><div class="alert a-err">Ralat memaparkan halaman: ${esc(e.message)} <a href="#/dashboard">Kembali</a></div></div>`;
    }
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not text */ } } }
    window.scrollTo(0, y);
  }
  const commit = () => { S.save(); render(); };

  function route() {
    const [path, q] = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?');
    V.route = NBK.pages[path] ? path : 'dashboard';
    V.params = Object.fromEntries(new URLSearchParams(q || ''));
    V.navOpen = false;
    if (NBK.pages[V.route].onRoute) NBK.pages[V.route].onRoute(V.params);
    render(); window.scrollTo(0, 0);
  }
  const setDate = (d) => { V.date = d; try { sessionStorage.setItem('nbk-date', d); } catch (e) { /* ignore */ } render(); };
  NBK.act.setDate = (d, el) => { if (el.value) setDate(el.value); };
  NBK.act.dayShift = (d) => setDate(u.addDays(V.date, +d.n));
  NBK.act.dayToday = () => setDate(u.todayMY());
  NBK.act.navToggle = () => { V.navOpen = !V.navOpen; render(); };

  function boot() {
    S.load();
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || !NBK.act[el.dataset.act]) return;
      ev.preventDefault();
      Promise.resolve(NBK.act[el.dataset.act](el.dataset, el, ev)).catch((e) => { console.error(e); toast(e.message, 'err'); });
    });
    const onField = (ev) => {
      const el = ev.target;
      if (el.dataset.f) { const [p, k] = el.dataset.f.split('.'); F(p)[k] = el.type === 'checkbox' ? el.checked : el.value; render(); }
      else if (ev.type === 'change' && el.dataset.actChange) Promise.resolve(NBK.act[el.dataset.actChange](el.dataset, el, ev)).catch((e) => toast(e.message, 'err'));
      else if (M.onInput && el.closest('#modal')) M.onInput(ev);
      if (el.dataset.bind) { const [p, k] = el.dataset.bind.split('.'); F(p)[k] = el.value; }
    };
    document.addEventListener('input', (ev) => { if (ev.target.type !== 'date' && ev.target.tagName !== 'SELECT') onField(ev); });
    document.addEventListener('change', (ev) => { if (ev.target.type === 'date' || ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox' || ev.target.dataset.actChange) onField(ev); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !document.getElementById('modal').hidden) return closeModal(false);
      const el = ev.target;
      if (ev.key !== 'Enter' || el.tagName !== 'INPUT') return;
      if (el.dataset.enter && NBK.act[el.dataset.enter]) { ev.preventDefault(); NBK.act[el.dataset.enter](el.dataset, el, ev); }
      else if (el.dataset.actChange) { ev.preventDefault(); el.blur(); } // Enter commits an inline cell
    });
    window.addEventListener('hashchange', route);
    route();
  }

  NBK.ui = { icon, F, modal, closeModal, confirm: confirmDlg, toast, formVals, showErrors, render, commit };
  NBK.boot = boot;
})(globalThis.NBK = globalThis.NBK || {});
