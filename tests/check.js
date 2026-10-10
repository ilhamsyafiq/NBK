// Logic self-check: `node tests/check.js` — money, BCL import, duplicates, vendor list totals.
const assert = require('assert');
['util', 'data', 'store', 'webhook'].forEach((f) => require('../assets/js/' + f + '.js'));
const { u, store: S, webhook: W } = globalThis.NBK;

assert.strictEqual(u.toSen('3.30'), 330);
assert.strictEqual(u.toSen(0.1 + 0.2), 30);
assert.strictEqual(u.rm(565140), 'RM 5,651.40');
assert.strictEqual(u.toCSV([['=cmd', 'a,b']]), "'=cmd,\"a,b\"");
assert.strictEqual(u.dayName('2026-10-08'), 'Khamis');
assert.strictEqual(u.myDate(u.fromBclDate('08/10/2026 23:30:00')), '2026-10-08', 'BCL MYT date stays on the same business day');
assert.strictEqual(u.fromBclDate(u.toBclDate('2026-10-08T01:02:03Z')), '2026-10-08T09:02:03+08:00');

S.reset(true);
const st = S.st(), today = st.seededFor;
assert.strictEqual(st.vendors.length, 14);
const kak = st.vendors.find((v) => v.name === 'KNB');

// Vendor list: row totals, column totals and RM all agree with the source orders
const sh = S.vendorSheet(today, kak.id);
assert.deepStrictEqual(sh.menus.map((m) => m.short), ['IKAN', 'A. GUL', 'A. GOR', 'A. PDS', 'DGG GOR', 'DGG KER', 'N.D. IKAN', 'N.D. AYAM', 'N.D. DGG']);
assert.strictEqual(sh.rows.reduce((s, r) => s + r.total, 0), sh.totalQty);
assert.strictEqual(sh.menus.reduce((s, m) => s + sh.colQty[m.id] * m.price, 0), sh.totalSen);
let src = 0;
S.dayOrders(today).forEach((o) => o.items.forEach((i) => { const m = S.resolveMenu(i); if (m && m.vendorId === kak.id) src += i.qty; }));
assert.strictEqual(sh.totalQty, src, 'no quantity lost or double counted');
assert.ok(sh.rows.some((r) => r.isNew && r.name === 'KAK LONG'), 'unknown agent still counted, flagged new');
assert.ok(!sh.rows.some((r) => r.name === 'AMBO' && r.cells[sh.menus[6].id] === 10 && r.total === 10), 'cancelled order excluded');

// Area filter
const kl = S.vendorSheet(today, kak.id, 'KL');
assert.ok(kl.rows.every((r) => !r.isNew), 'unknown agents only appear in "all areas"');

// Unknown item → mapped via alias → lands on vendor list
const un = S.unmapped(today);
assert.strictEqual(un.length, 1);
const target = st.menus.find((m) => m.vendorId === kak.id);
target.aliases.push(un[0].name);
assert.strictEqual(S.unmapped(today).length, 0);
assert.strictEqual(S.vendorSheet(today, kak.id).totalQty, sh.totalQty + un[0].qty);

// BCL import: once, then duplicate; only payment-success counts; invalid payloads rejected
const p = W.example('payment-success'), before = st.orders.length;
const r1 = W.process(JSON.parse(JSON.stringify(p)));
assert.strictEqual(r1.status, 'processed');
assert.ok(S.agentOf(r1.order), 'typed lowercase name still matched by phone');
assert.strictEqual(W.process(JSON.parse(JSON.stringify(p))).status, 'duplicate');
assert.strictEqual(st.orders.length, before + 1);
const fsub = W.example('form-submit'); fsub.data.main_data.order_number = 'LINK-FS1';
assert.strictEqual(W.process(fsub).status, 'ignored');
assert.ok(!st.orders.some((o) => o.sourceOrderId === 'LINK-FS1'), 'unpaid form-submit not counted');
assert.strictEqual(W.process({ event: 'payment-success', data: { main_data: { order_number: 'X', payer_name: 'A', items: [] } } }).status, 'failed');
assert.ok(W.normalise({ event: 'x' }).errors.length >= 2);
assert.ok(W.normalise({ event: 'payment-success', data: { main_data: { order_number: 'X', payer_name: 'A', items: [{ sku: 'S', quantity: 1.5, unit_amount: 'abc' }] } } }).errors.length >= 2);

// Variation-style item (menu name in `option`, no SKU) still maps to the right menu
{
  const pv = W.example('payment-success'); pv.data.main_data.order_number = 'LINK-VAR1';
  pv.data.main_data.items = [{ id: 1, item: 'NBK Express - Borang Pesanan Ejen', option: target.name, sku: null, quantity: 2, unit_amount: u.senToStr(target.price), amount: u.senToStr(target.price * 2) }];
  const rv = W.process(pv);
  assert.strictEqual(rv.status, 'processed', rv.message);
  assert.strictEqual(S.resolveMenu(rv.order.items[0]), target);
}

// Phone matching: +60 format and typed-name variants resolve to the same agent
assert.strictEqual(u.phoneKey('+60 11-0000 0001'), u.phoneKey('011-0000 0001'));
const a1 = st.agents[0];
assert.strictEqual(S.agentOf({ agentName: 'whatever', agentPhone: '+6011 0000 0001' }), a1);
assert.strictEqual(S.agentOf({ agentName: 'nobody', agentPhone: '019-1234 5678' }), null);

// Payment proof: seeded mismatch + pending; imported orders verified; amount mismatch flagged
const todayOrders = st.orders.filter((o) => o.date === today && !o.cancelled);
assert.ok(todayOrders.some((o) => S.payStatus(o) === 'mismatch'));
assert.ok(todayOrders.some((o) => S.payStatus(o) === 'pending'));
assert.ok(todayOrders.filter((o) => S.payStatus(o) !== 'ok').every(S.needsReview));
assert.strictEqual(S.payStatus(r1.order), 'ok');
assert.ok(r1.order.payment.txId);
const short = W.example('payment-success'); short.data.main_data.amount = '1.00';
assert.strictEqual(S.payStatus(W.process(short).order), 'mismatch');

// Reconciliation: seeded missed webhook, order without BCL transaction, amount mismatch; import fixes the missed one
{
  const rc = S.reconcile(today), kinds = rc.issues.map((x) => x.kind);
  ['missing', 'notx', 'amount'].forEach((k) => assert.ok(kinds.includes(k), 'expected ' + k));
  const miss = rc.issues.find((x) => x.kind === 'missing');
  assert.strictEqual(W.process(JSON.parse(JSON.stringify(miss.tx.payload))).status, 'processed');
  assert.ok(!S.reconcile(today).issues.some((x) => x.kind === 'missing'));
  S.markReconciled(today, 'ujian');
  assert.strictEqual(S.reconStatus(today).changed, false);
}

// Real BCL transaction (LINK-522868, payer masked): variation options + SKU, 3 vendors, 100% coupon, API date format
{
  const real = JSON.parse(require('fs').readFileSync(__dirname + '/fixtures/bcl-LINK-522868.json', 'utf8'));
  const rr = W.process(real);
  assert.strictEqual(rr.status, 'processed', rr.message);
  const o = rr.order;
  assert.strictEqual(o.date, '2026-10-10');
  assert.deepStrictEqual(o.items.map((i) => [S.resolveMenu(i).short, S.vendor(S.resolveMenu(i).vendorId).name, i.qty]),
    [['A. GUL', 'KNB', 6], ['A. GOR', 'KNB', 4], ['A. PDS', 'KAKCHIK', 3], ['A. GUL', 'AIR DINGIN', 3]]);
  assert.strictEqual(S.orderSen(o), 5760);
  assert.strictEqual(o.payment.discountSen, 5760);
  assert.strictEqual(S.payStatus(o), 'ok', 'coupon discount is not an amount mismatch');
  assert.strictEqual(u.phoneKey(o.agentPhone), '0190000000');
  assert.strictEqual(o.payment.receiptUrl, 'https://example.com/resit/LINK-522868.pdf');
}

// Sent marker detects later changes
S.markSent(today, kak.id);
assert.strictEqual(S.sentStatus(today, kak.id).changed, false);
const add = W.example('payment-success');
add.data.main_data.created_at = u.fmtDate(today) + ' 10:00:00'; // BCL format DD/MM/YYYY HH:MM:SS
add.data.main_data.items = [{ id: 1, sku: target.sku, item: target.name, quantity: 5, unit_amount: u.senToStr(target.price), amount: u.senToStr(target.price * 5) }];
W.process(add);
assert.strictEqual(S.sentStatus(today, kak.id).changed, true);

console.log('OK — all checks passed');
