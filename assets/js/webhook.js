/* NBK EXPRESS — BCL payload parsing, validation, duplicate check and (simulated) import.
   Runs in the browser against demo state. It is NOT a webhook receiver. */
(function (NBK) {
  'use strict';
  const u = NBK.u;
  const EVENTS = ['form-submit', 'payment-success', 'payment-failed'];
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // BCL envelope → internal order. Field names per BCL's documented webhook; confirm against a real payload.
  function normalise(p) {
    const errors = [], warnings = [];
    if (!isObj(p)) return { ok: false, errors: ['Payload mesti objek JSON.'], warnings, order: null };
    if (!EVENTS.includes(p.event)) errors.push(`Jenis event "${p.event == null ? '' : p.event}" tidak dikenali. Dijangka: ${EVENTS.join(', ')}.`);
    const d = isObj(p.data) ? p.data : null, md = d && isObj(d.main_data) ? d.main_data : null;
    if (!md) { errors.push('Medan data.main_data tiada.'); return { ok: false, errors, warnings, order: null }; }
    const cf = isObj(d.custom_fields_data) ? d.custom_fields_data : {};
    // Agents fill the form's Nama / Emel / No. HP → payer_name / payer_email / payer_telephone_number.
    const agentName = cf.nama_ejen || cf.ejen || md.payer_name;
    const date = u.fromBclDate(md.created_at || null);
    const o = {
      event: p.event, orderId: md.order_number || d.record_id || null, agentName: agentName || null,
      agentPhone: md.payer_telephone_number || md.payer_phone || cf.no_hp || null, agentEmail: md.payer_email || null,
      date,
      payment: { gateway: 'BayarCash', txId: md.id || null, method: md.payment_channel || '', statusText: md.status_description || '',
        live: md.transaction_type !== 'test', receiptUrl: d.receipt_url || '', amountSen: u.toSen(md.amount), paidAt: date,
        discountSen: u.toSen(md.discount_amount) || 0, coupon: md.coupon_code || '' },
      // Menus are BCL variation options (form_variations), so the menu name arrives in `option`; plain products use `item`.
      items: (Array.isArray(md.items) ? md.items : []).map((i) => ({ sku: i.sku || '', name: i.option || i.item || i.name || '', qty: i.quantity, price: i.unit_amount })),
      payload: p,
    };
    if (!o.orderId) errors.push('No. pesanan (order_number / record_id) tiada.');
    if (!o.agentName && !o.agentPhone) errors.push('Nama dan No. HP ejen tiada.');
    if (!o.agentPhone) warnings.push('Tiada No. HP — ejen dipadankan ikut nama sahaja.');
    if (md.currency && md.currency !== 'MYR') errors.push(`Mata wang ${md.currency} tidak disokong.`);
    if (!o.date) { warnings.push('Tiada tarikh dalam payload — masa sekarang digunakan.'); o.date = new Date().toISOString(); }
    else if (isNaN(new Date(o.date))) errors.push(`Tarikh "${o.date}" tidak sah.`);
    if (p.event === 'payment-success' && !o.items.length) errors.push('Tiada item dalam pesanan.');
    o.items.forEach((i, k) => {
      if (!i.sku && !i.name) errors.push(`Item ${k + 1}: tiada SKU atau nama.`);
      if (!/^\d+$/.test(String(i.qty)) || +i.qty <= 0) errors.push(`Item ${k + 1}: kuantiti "${i.qty}" tidak sah.`);
      if (u.toSen(i.price) == null) errors.push(`Item ${k + 1}: harga "${i.price}" tidak sah.`);
    });
    if (md.transaction_type === 'test') warnings.push('Transaksi UJIAN (transaction_type = test) — bukan bayaran sebenar.');
    if (p.event === 'payment-success') warnings.push('Dalam sistem sebenar, bayaran disahkan semula melalui API BCL (get_transaction ikut no. pesanan) kerana webhook BCL tidak ditandatangani.');
    return { ok: !errors.length, errors, warnings, order: o };
  }

  // Same event content twice = duplicate (BCL sends no event ID).
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  const fingerprint = (o) => [o.event, o.orderId, hash(JSON.stringify(o.items.map((i) => [i.sku, i.name, +i.qty, u.toSen(i.price)])))].join('|');
  function fpOf(e) { const r = normalise(e.payload); return r.ok ? fingerprint(r.order) : 'invalid:' + e.id; }
  const seen = (fp, except) => NBK.store.st().events.some((e) => e !== except && e.status === 'processed' && (e.fingerprint || (e.fingerprint = fpOf(e))) === fp);

  const toItems = (o) => o.items.map((i) => ({ sku: i.sku, name: i.name || i.sku, qty: +i.qty, unitSen: u.toSen(i.price), menuOverride: null }));
  const same = (a, b) => JSON.stringify(a.map((i) => [i.sku, i.name, i.qty, i.unitSen])) === JSON.stringify(b.map((i) => [i.sku, i.name, i.qty, i.unitSen]));

  // Apply a payload to demo state → { status: processed|duplicate|ignored|failed, message, order, result }
  // Only payment-success creates/updates an order: every order NBK handles is already paid.
  function process(raw, existingEvent) {
    const S = NBK.store, st = S.st(), res = normalise(raw);
    const evt = existingEvent || { id: u.uid('EVT'), receivedAt: new Date().toISOString() };
    Object.assign(evt, { source: 'bcl', type: (raw && raw.event) || '—', sourceOrderId: res.order ? res.order.orderId : null, payload: raw });
    const done = (status, message, order) => {
      evt.status = status; evt.error = status === 'processed' ? '' : message;
      if (!existingEvent) st.events.unshift(evt);
      return { status, message, order, result: res };
    };
    if (!res.ok) { S.log('Import BCL gagal', res.errors.join(' ')); return done('failed', res.errors.join(' '), null); }
    const n = res.order;
    if (n.event !== 'payment-success') return done('ignored', `Event ${n.event} diabaikan — pesanan hanya dikira selepas bayaran berjaya.`, null);
    const fp = fingerprint(n);
    evt.fingerprint = fp;
    if (seen(fp, evt)) { S.log('Pendua diabaikan', `Pesanan ${n.orderId} (${n.event}) sudah diterima.`); return done('duplicate', 'Pesanan ini sudah diterima — tidak dikira dua kali.', null); }

    const id = 'bcl:' + n.orderId, items = toItems(n), now = new Date().toISOString();
    let o = st.orders.find((x) => x.id === id), msg;
    if (o) {
      const changed = items.length && !same(o.items, items);
      if (!changed) return done('duplicate', `Pesanan ${n.orderId} sudah wujud.`, o);
      o.revisions.push({ at: now, note: 'Item dikemas kini oleh BCL.' }); o.items = items; o.payment = verify(n.payment);
      o.updatedAt = now; o.payload = raw;
      msg = `Pesanan ${n.orderId} dikemas kini (${n.event}).`;
    } else {
      o = { id, source: 'bcl', sourceOrderId: String(n.orderId), agentName: n.agentName || '', agentPhone: n.agentPhone, agentEmail: n.agentEmail,
        date: u.myDate(n.date), submittedAt: new Date(n.date).toISOString(), updatedAt: now, cancelled: false, items, revisions: [], payload: raw, payment: verify(n.payment) };
      st.orders.unshift(o);
      // Prototype only: keep the simulated BCL ledger in step (the real BCL already has this transaction).
      if (st.txns && !st.txns.some((t) => t.orderId === o.sourceOrderId)) st.txns.push({ txId: o.payment.txId, orderId: o.sourceOrderId, agentName: o.agentName, phone: o.agentPhone, amountSen: o.payment.amountSen, paidAt: o.payment.paidAt, date: o.date, payload: null });
      msg = `Pesanan ${n.orderId} daripada ${S.agentLabel(o)} diterima (${items.reduce((s, i) => s + i.qty, 0)} pcs).`;
    }
    S.log('Pesanan BCL diterima', msg);
    return done('processed', msg, o);
  }

  // Prototype stand-in for the backend check against the BCL / BayarCash API.
  const verify = (p) => ({ ...p, paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null, verifiedAt: new Date().toISOString(), verifiedBy: 'Simulasi', accepted: null });

  // Example payload using real menus so it lands on a vendor list.
  function example(event) {
    const st = NBK.store.st();
    const ag = st.agents[Math.floor(Math.random() * st.agents.length)];
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const ms = st.menus.filter((m) => m.active), m1 = rnd(ms), m2 = rnd(ms.filter((m) => m.vendorId === m1.vendorId && m !== m1)) || m1;
    const id = 'LINK-' + (10000 + Math.floor(Math.random() * 89999));
    const items = [[m1, 5], [m2, 10]].filter((x, i) => i === 0 || x[0] !== m1).map(([m, q], k) => ({ id: 5501 + k, sku: m.sku, item: m.name, quantity: q, unit_amount: u.senToStr(m.price), amount: u.senToStr(m.price * q) }));
    return {
      event: event || 'payment-success',
      data: { formable_type: 'payment_form', formable_id: 210, form_title: 'Borang Pesanan NBK', record_type: 'Transaction', record_id: id,
        main_data: { id: 'BC' + Date.now().toString(16).toUpperCase(), order_number: id, payer_name: ag.name.toLowerCase(), payer_email: 'ejen@contoh.test', payer_telephone_number: ag.phone,
          transaction_type: 'live', currency: 'MYR', payment_channel: 'FPX', status: 3, status_description: 'Successful',
          amount: u.senToStr(items.reduce((s, i) => s + u.toSen(i.amount), 0)), is_paid: event === 'form-submit' ? 0 : 1,
          created_at: u.toBclDate(new Date().toISOString()), items },
        custom_fields_data: {} },
    };
  }

  NBK.webhook = { EVENTS, normalise, fingerprint, seen, process, example };
})(globalThis.NBK = globalThis.NBK || {});
