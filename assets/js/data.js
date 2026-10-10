/* NBK EXPRESS — demo seed data.
   Agent names + lauk prices follow the owner's "LIST KNB" report; menu names follow the public OnPay form.
   ALL QUANTITIES ARE RANDOM DEMO DATA. */
(function (NBK) {
  'use strict';
  const u = NBK.u;

  const VENDORS = ['CHE YAM', 'KAKCHIK', 'AIR DINGIN', 'FIZOW KITCHEN', 'DEPEY TANGGO', 'KAKAK AISYAH', 'NASI BERLAUK MAMA',
    'TENGKU NOOR', 'KERABU PALOH', 'KERABU PC', 'NASI TUMPANG PASIR HOR', 'DAPUR BERANGAN', 'NASI KAPIT DIDI LUNDANG', 'KNB'];

  const KL = ['ADAM KL', 'ADILA', 'ADNAN', 'AHMAD', 'AMBO', 'ANDORA', 'AWI', 'AYOB', 'AZRUL', 'B.CHANGGANG', 'BASRI', 'CHOWKIT', 'CT MALL',
    'DRIVE THRU', 'FC BANGI', 'FIRAS', 'HAFIZ', 'HOOD', 'HUDA', 'HUZAIFAH', 'ISE', 'JIJIEY', 'KAKZA', 'KANCIL', 'KEDAI AWE', 'KG BARU', 'LUTH',
    'MAFIA', 'MINIE', 'MR HAN', 'NADIA', 'NASI CIKGU KJ', 'NIL', 'NORMA', 'PEJA', 'RIMBA', 'ROSLI', 'SANY', 'SENTUL', 'SER', 'SHAM', 'SITI',
    'SOHO', 'SPECIAL', 'STESEN', 'TAJUDDIN', 'TAUFIK', 'TINGKAP', 'FUAD', 'YUS', 'ZAINON', 'ZUL'];
  const KB = ['PASIR MAS', 'TUMPAT', 'KUBANG KERIAN', 'BACHOK', 'WAKAF BHARU'];

  // vendor → [short column name, full menu name (as on the order form), price]
  const LAUK = [['IKAN', 'IKAN GULAI', '3.30'], ['A. GUL', 'AYAM GULAI', '3.60'], ['A. GOR', 'AYAM GORENG', '3.60'], ['A. PDS', 'AYAM PEDAS', '3.60'],
    ['DGG GOR', 'DAGING GORENG', '4.00'], ['DGG KER', 'DAGING KERUTUK', '4.00'], ['N.D. IKAN', 'NASI DAGANG IKAN', '3.60'], ['N.D. AYAM', 'NASI DAGANG AYAM', '3.70']];
  const MENUS = {
    // KNB: columns + prices exactly as the owner's "LIST KNB" report.
    'KNB': [...LAUK, ['N.D. DGG', 'NASI DAGANG DAGING', '3.70']],
    'KAKCHIK': LAUK,
    'AIR DINGIN': [['IKAN', 'IKAN GULAI', '3.30'], ['IKAN PDS', 'IKAN PEDAS', '3.30'], ['A. GUL', 'AYAM GULAI', '3.60'], ['A. GOR', 'AYAM GORENG', '3.60'],
      ['A. KICAP', 'AYAM KICAP', '3.60'], ['DGG KER', 'DAGING KERUTUK', '4.00'], ['N.D. IKAN', 'NASI DAGANG IKAN', '3.60'], ['N.K. AYAM', 'NASI KERABU AYAM GORENG', '4.50']],
    'CHE YAM': [['N.A. GUL', 'NASI AYAM GULAI', '4.50'], ['N.A. GOR', 'NASI AYAM GORENG', '4.50'], ['DGG GUL', 'DAGING GULAI', '4.00'],
      ['DGG KER', 'DAGING KERUTUK', '4.00'], ['N.D. IKAN', 'NASI DAGANG IKAN', '3.60'], ['N.D. AYAM', 'NASI DAGANG AYAM', '3.70']],
    'FIZOW KITCHEN': [['NB A. GUL', 'NASI BERLAUK AYAM GULAI', '5.50'], ['NB A. PDS', 'NASI BERLAUK AYAM PEDAS', '5.50'],
      ['NB A. KER', 'NASI BERLAUK AYAM KERUTUK', '5.50'], ['NB DGG', 'NASI BERLAUK DAGING BERLENGAS', '6.00']],
    // The order form calls this vendor "TNB" — assumed to be TENGKU NOOR (to be confirmed).
    'TENGKU NOOR': [['IKAN', 'IKAN GULAI', '3.30'], ['A. GUL', 'AYAM GULAI', '3.60'], ['A. PDS', 'AYAM PEDAS', '3.60'], ['A. GOR', 'AYAM GORENG', '3.60'],
      ['DGG GOR', 'DAGING GORENG', '4.00'], ['DGG KER', 'DAGING KERUTUK', '4.00']],
  };
  const FORM_TAG = { 'TENGKU NOOR': 'TNB' };

  function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function build() {
    const today = u.todayMY(), r = rng(20261008);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const vendors = VENDORS.map((name, i) => ({ id: 'V' + String(i + 1).padStart(2, '0'), name, phone: '', notes: '', active: true }));
    const vid = (n) => vendors.find((v) => v.name === n).id;
    const menus = [];
    Object.entries(MENUS).forEach(([vn, list]) => list.forEach(([short, name, price], i) => {
      const full = `${name} (${FORM_TAG[vn] || vn})`;
      menus.push({ id: 'M' + String(menus.length + 1).padStart(3, '0'), sku: 'MENU-' + String(menus.length + 1).padStart(3, '0'), vendorId: vid(vn), short, name: full, price: u.toSen(price), sort: i, aliases: [], active: true });
    }));
    const agents = [...KL.map((n) => [n, 'KL']), ...KB.map((n) => [n, 'Kelantan'])]
      .map(([name, area], i) => ({ id: 'A' + String(i + 1).padStart(3, '0'), name, area, phone: '011-0000 ' + String(i + 1).padStart(4, '0'), aliases: [] })); // fictional numbers

    const orders = [], events = [];
    const qtys = [5, 5, 5, 5, 6, 7, 8, 10, 10, 12, 15, 20];
    const mainVendors = ['KNB', 'KNB', 'KNB', 'KAKCHIK', 'AIR DINGIN', 'CHE YAM', 'FIZOW KITCHEN', 'TENGKU NOOR'];
    let seq = 2001;
    for (let d = -6; d <= 0; d++) {
      const date = u.addDays(today, d);
      agents.forEach((a) => {
        if (r() > (a.area === 'KL' ? 0.75 : 0.5)) return;
        // One order can mix vendors (single BCL form): ~45% one vendor, ~35% two, ~20% three.
        const want = r() < 0.45 ? 1 : r() < 0.64 ? 2 : 3, chosen = [];
        while (chosen.length < want) { const vn = pick(mainVendors); if (!chosen.includes(vn)) chosen.push(vn); }
        const items = [];
        chosen.forEach((vn) => {
          const vm = menus.filter((m) => m.vendorId === vid(vn)), before = items.length;
          vm.forEach((m) => { if (r() < (want > 1 ? 0.3 : 0.45)) items.push({ sku: m.sku, name: m.name, qty: pick(qtys), unitSen: m.price }); });
          if (items.length === before) items.push({ sku: vm[0].sku, name: vm[0].name, qty: 5, unitSen: vm[0].price });
        });
        const hm = String(10 + Math.floor(r() * 5)).padStart(2, '0') + ':' + String(Math.floor(r() * 60)).padStart(2, '0'); // form open 10:00–15:00
        const typed = r() < 0.7 ? a.name : r() < 0.5 ? a.name.toLowerCase() : a.name.split(/[ .]/)[0] + ' nbk';
        orders.push(mk('LINK-0' + seq++, date, hm, typed, a.phone, items));
      });
    }
    // Payment proof review cases: one paid amount short, one not yet verified
    const todays = orders.filter((o) => o.date === today);
    todays[2].payment.amountSen -= 500; todays[2].payload.data.main_data.amount = u.senToStr(todays[2].payment.amountSen);
    todays[5].payment.verifiedAt = null;
    // Today's review cases
    const ad = menus.find((m) => m.short === 'N.D. IKAN' && m.vendorId === vid('KNB'));
    const huda = agents.find((a) => a.name === 'HUDA');
    orders.push(mk('LINK-0' + seq++, today, '11:05', 'Huda', huda.phone, [{ sku: '', name: 'NASI TUMPANG (PASIR HOR)', qty: 4, unitSen: 500 }, { sku: ad.sku, name: ad.name, qty: 5, unitSen: ad.price }]));
    orders.push(mk('LINK-0' + seq++, today, '11:20', 'Kak Long', '019-0000 9999', [{ sku: ad.sku, name: ad.name, qty: 6, unitSen: ad.price }]));
    const c = mk('LINK-0' + seq++, today, '10:58', 'AMBO', agents.find((a) => a.name === 'AMBO').phone, [{ sku: ad.sku, name: ad.name, qty: 10, unitSen: ad.price }]);
    c.cancelled = true; c.note = 'Dibatalkan oleh admin (demo).';
    orders.push(c);
    // Paid after the 3:00 PM cut-off → admin decides (include today / move to tomorrow)
    [['15:20', 'ADNAN'], ['16:05', 'SITI']].forEach(([hm, name]) => {
      const a = agents.find((x) => x.name === name);
      orders.push(mk('LINK-0' + seq++, today, hm, name, a.phone, [{ sku: ad.sku, name: ad.name, qty: 5, unitSen: ad.price }]));
    });

    function mk(id, date, hm, agentName, phone, items) {
      const at = new Date(u.isoMY(date, hm)).toISOString();
      const total = items.reduce((s, i) => s + i.qty * i.unitSen, 0);
      const method = r() < 0.75 ? 'FPX' : 'DuitNow QR';
      const pay = { gateway: 'BayarCash', txId: 'BC' + Math.floor(r() * 1e12).toString(16).toUpperCase().padStart(10, '0'), method, statusText: 'Successful', live: true, receiptUrl: '', amountSen: total,
        paidAt: at, verifiedAt: new Date(new Date(at).getTime() + 40e3).toISOString(), verifiedBy: 'Simulasi', accepted: null };
      const payload = {
        event: 'payment-success',
        data: { formable_type: 'payment_form', formable_id: 210, form_title: 'Borang Pesanan NBK (DEMO)', record_type: 'Transaction', record_id: id,
          main_data: { id: pay.txId, order_number: id, payer_name: agentName, payer_email: 'ejen@contoh.test', payer_telephone_number: phone, transaction_type: 'live', currency: 'MYR',
            subtotal_amount: u.senToStr(total), fee_amount: '0.00', amount: u.senToStr(total), payment_channel: pay.method, status: 3, status_description: 'Successful', is_paid: 1, created_at: u.toBclDate(at),
            items: items.map((i, k) => ({ id: 5000 + k, sku: i.sku, item: i.name, quantity: i.qty, unit_amount: u.senToStr(i.unitSen), amount: u.senToStr(i.qty * i.unitSen) })) },
          custom_fields_data: {} },
      };
      events.push({ id: 'EVT-' + id, source: 'bcl', type: payload.event, sourceOrderId: id, receivedAt: at, status: 'processed', error: '', payload, fingerprint: null });
      return { id: 'bcl:' + id, source: 'bcl', sourceOrderId: id, agentName, agentPhone: phone, agentEmail: 'ejen@contoh.test', date, submittedAt: at, updatedAt: at, cancelled: false,
        items: items.map((i) => ({ ...i, menuOverride: null })), revisions: [], payload, payment: pay };
    }

    // Simulated BCL transaction ledger (what a reconciliation pull would return).
    const txOf = (o) => ({ txId: o.payment.txId, orderId: o.sourceOrderId, agentName: o.agentName, phone: o.agentPhone, amountSen: o.payment.amountSen, paidAt: o.payment.paidAt, date: o.date, payload: null });
    const txns = orders.map(txOf);
    // Reconciliation cases: a paid order whose webhook never arrived (today + yesterday), and a system order with no BCL transaction.
    [[today, '12:41', 'MINIE'], [u.addDays(today, -1), '11:12', 'STESEN']].forEach(([date, hm, name]) => {
      const a = agents.find((x) => x.name === name), m = menus.filter((x) => x.vendorId === vid('KNB'));
      const missed = mk('LINK-0' + seq++, date, hm, name, a.phone, [{ sku: m[0].sku, name: m[0].name, qty: 10, unitSen: m[0].price }, { sku: m[1].sku, name: m[1].name, qty: 10, unitSen: m[1].price }]);
      events.pop(); // the webhook never reached us
      txns.push({ ...txOf(missed), payload: missed.payload });
    });
    const noTx = orders.filter((o) => o.date === today && !o.cancelled)[8].sourceOrderId;
    txns.splice(txns.findIndex((t) => t.orderId === noTx), 1);

    events.push({ id: 'EVT-GAGAL-1', source: 'bcl', type: 'payment-success', sourceOrderId: 'LINK-09999', receivedAt: new Date(u.isoMY(today, '09:12')).toISOString(),
      status: 'failed', error: 'Tiada item dalam pesanan.', fingerprint: null,
      payload: { event: 'payment-success', data: { record_id: 'LINK-09999', main_data: { order_number: 'LINK-09999', payer_name: 'ADNAN', currency: 'MYR', amount: '0.00', is_paid: 1, items: [] } } } });

    return {
      version: 2, seededFor: today, vendors, menus, agents, orders, events, sent: {}, txns, pulled: {}, recon: {},
      settings: { openTime: '10:00', cutoffTime: '15:00' },
      logs: [{ at: new Date().toISOString(), action: 'Data demo dimuatkan', detail: `${orders.length} pesanan demo (7 hari).` }],
    };
  }

  NBK.seed = { build };
})(globalThis.NBK = globalThis.NBK || {});
