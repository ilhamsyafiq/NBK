/* NBK EXPRESS — demo state + the one calculation that matters: orders → per-vendor list (agent × menu).
   State is mirrored to localStorage for demo convenience only (NOT a secure database). */
(function (NBK) {
  'use strict';
  const u = NBK.u;
  const KEY = 'nbk-express-demo-v8';
  const S = { state: null };
  const hasLS = () => { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } };

  function load() {
    if (hasLS()) try { const raw = localStorage.getItem(KEY); if (raw) return (S.state = JSON.parse(raw)); } catch (e) { /* corrupt → reseed */ }
    return reset(true);
  }
  function save() { if (hasLS()) try { localStorage.setItem(KEY, JSON.stringify(S.state)); } catch (e) { /* private mode: memory only */ } }
  function reset(silent) {
    S.state = NBK.seed.build();
    if (!silent) log('Data demo diset semula', 'Data asal dipulihkan.');
    save();
    return S.state;
  }
  const st = () => S.state;
  function log(action, detail) {
    st().logs.unshift({ at: new Date().toISOString(), action, detail: detail || '' });
    if (st().logs.length > 300) st().logs.length = 300;
  }

  const vendor = (id) => st().vendors.find((v) => v.id === id) || null;
  const menu = (id) => st().menus.find((m) => m.id === id) || null;
  const vendorMenus = (vid) => st().menus.filter((m) => m.vendorId === vid).sort((a, b) => a.sort - b.sort);

  // An order's agent: matched by phone number first (agents type their name freely), then by name/alias.
  // Unknown agents still count on the vendor list, flagged "baru".
  function agentOf(o) {
    const k = u.phoneKey(o.agentPhone);
    if (k) { const a = st().agents.find((x) => u.phoneKey(x.phone) === k); if (a) return a; }
    const n = u.norm(o.agentName);
    return st().agents.find((a) => u.norm(a.name) === n || a.aliases.some((x) => u.norm(x) === n)) || null;
  }
  const agentLabel = (o) => (agentOf(o) || { name: u.norm(o.agentName) }).name;
  function resolveMenu(it) {
    if (it.menuOverride) return menu(it.menuOverride);
    if (it.sku) { const m = st().menus.find((x) => x.sku === it.sku); if (m) return m; }
    const n = u.norm(it.name);
    return st().menus.find((x) => u.norm(x.name) === n || x.aliases.some((a) => u.norm(a) === n)) || null;
  }
  const orderQty = (o) => o.items.reduce((s, i) => s + i.qty, 0);
  const orderSen = (o) => o.items.reduce((s, i) => s + i.qty * i.unitSen, 0);
  // Payment proof: 'ok' (verified, amount matches or accepted by admin) | 'pending' (not verified yet) | 'mismatch' (paid ≠ order total)
  // What the agent should have paid: item total minus any BCL coupon discount.
  const expectedSen = (o) => orderSen(o) - ((o.payment && o.payment.discountSen) || 0);
  function payStatus(o) {
    const p = o.payment;
    if (!p || !p.verifiedAt) return 'pending';
    return p.amountSen === expectedSen(o) || p.accepted ? 'ok' : 'mismatch';
  }
  const needsReview = (o) => !o.cancelled && (o.items.some((i) => !resolveMenu(i)) || payStatus(o) !== 'ok');

  // Orders that count for a day's vendor lists (only paid orders ever get imported)
  const dayOrders = (date) => st().orders.filter((o) => o.date === date && !o.cancelled);

  // Unknown item names for a date → [{name, qty, orders}]
  function unmapped(date) {
    const m = {};
    dayOrders(date).forEach((o) => o.items.forEach((i) => {
      if (resolveMenu(i)) return;
      const k = i.name || i.sku;
      m[k] = m[k] || { name: k, qty: 0, orders: [] };
      m[k].qty += i.qty; m[k].orders.push(o.sourceOrderId);
    }));
    return Object.values(m);
  }

  // The report: rows = agents, columns = vendor menus (all of them, like the paper list), totals + prices.
  function vendorSheet(date, vendorId, area) {
    const menus = vendorMenus(vendorId);
    const ids = new Set(menus.map((m) => m.id));
    const rows = {};
    dayOrders(date).forEach((o) => {
      const a = agentOf(o);
      if (area && (!a || a.area !== area)) return;
      o.items.forEach((i) => {
        const m = resolveMenu(i);
        if (!m || !ids.has(m.id)) return;
        const name = a ? a.name : u.norm(o.agentName);
        const r = rows[name] = rows[name] || { name, isNew: !a, cells: {}, total: 0, orders: new Set() };
        r.cells[m.id] = (r.cells[m.id] || 0) + i.qty; r.total += i.qty; r.orders.add(o.sourceOrderId);
      });
    });
    const list = Object.values(rows).sort((x, y) => x.name.localeCompare(y.name));
    const colQty = {}, colSen = {};
    menus.forEach((m) => { colQty[m.id] = list.reduce((s, r) => s + (r.cells[m.id] || 0), 0); colSen[m.id] = colQty[m.id] * m.price; });
    return {
      date, vendor: vendor(vendorId), area, menus, rows: list, colQty, colSen,
      totalQty: menus.reduce((s, m) => s + colQty[m.id], 0), totalSen: menus.reduce((s, m) => s + colSen[m.id], 0),
    };
  }

  // "Sent to vendor" marker. If quantities change afterwards, the list is flagged.
  const sentKey = (date, vid) => date + '|' + vid;
  function sentStatus(date, vid) {
    const s = st().sent[sentKey(date, vid)];
    if (!s) return null;
    const now = vendorSheet(date, vid);
    return { ...s, changed: now.totalQty !== s.qty || now.totalSen !== s.sen };
  }
  function markSent(date, vid) {
    const sh = vendorSheet(date, vid);
    st().sent[sentKey(date, vid)] = { at: new Date().toISOString(), qty: sh.totalQty, sen: sh.totalSen };
    log('Senarai ditanda dihantar', `${sh.vendor.name} · ${u.fmtDate(date)} · ${sh.totalQty} pcs · ${u.rm(sh.totalSen)}`);
  }
  function unmarkSent(date, vid) {
    delete st().sent[sentKey(date, vid)];
    log('Tanda dihantar dibatalkan', `${vendor(vid).name} · ${u.fmtDate(date)}`);
  }

  // Daily reconciliation: BCL transactions vs orders in the system, matched by BCL order number.
  // kinds: ok | amount (paid ≠ order total) | missing (paid in BCL, not in system) | notx (in system, no BCL transaction) | cancelled (paid, but cancelled here)
  function reconcile(date) {
    const tx = st().txns.filter((t) => t.date === date), left = Object.fromEntries(tx.map((t) => [t.orderId, t]));
    const rows = [];
    st().orders.filter((o) => o.date === date).forEach((o) => {
      const t = left[o.sourceOrderId]; delete left[o.sourceOrderId];
      if (!t && o.cancelled) return;
      const kind = !t ? 'notx' : o.cancelled ? 'cancelled' : t.amountSen === expectedSen(o) || (o.payment && o.payment.accepted) ? 'ok' : 'amount';
      rows.push({ kind, order: o, tx: t || null });
    });
    Object.values(left).forEach((t) => rows.push({ kind: 'missing', order: null, tx: t }));
    const live = st().orders.filter((o) => o.date === date && !o.cancelled);
    const txSen = tx.reduce((s, t) => s + t.amountSen, 0), sysSen = live.reduce((s, o) => s + expectedSen(o), 0);
    return { date, rows, issues: rows.filter((r) => r.kind !== 'ok'), txCount: tx.length, txSen, sysCount: live.length, sysSen };
  }
  function reconStatus(date) {
    const m = st().recon[date];
    if (!m) return null;
    const r = reconcile(date);
    return { ...m, changed: r.txSen !== m.txSen || r.sysSen !== m.sysSen || r.issues.length !== m.issues };
  }
  function markReconciled(date, note) {
    const r = reconcile(date);
    st().recon[date] = { at: new Date().toISOString(), txSen: r.txSen, sysSen: r.sysSen, issues: r.issues.length, note: note || '' };
    log('Rekonsiliasi selesai', `${u.fmtDate(date)} · ${r.txCount} transaksi · ${u.rm(r.txSen)}${r.issues.length ? ` · ${r.issues.length} isu diterima: ${note}` : ''}`);
  }

  NBK.store = { S, load, save, reset, st, log, vendor, menu, vendorMenus, agentOf, agentLabel, resolveMenu, orderQty, orderSen, expectedSen, payStatus, needsReview, dayOrders, unmapped, vendorSheet, sentStatus, markSent, unmarkSent, reconcile, reconStatus, markReconciled };
})(globalThis.NBK = globalThis.NBK || {});
