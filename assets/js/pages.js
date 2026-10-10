/* NBK EXPRESS — pages: Hari Ini, Senarai Vendor, Pesanan, Tetapan */
(function (NBK) {
  'use strict';
  const u = NBK.u, S = NBK.store, W = NBK.webhook, ui = NBK.ui, V = NBK.view, P = NBK.pages, A = NBK.act;
  const esc = u.esc, st = () => S.st();
  const opts = (list, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const empty = (msg, cols) => cols ? `<tr><td colspan="${cols}"><div class="empty">${msg}</div></td></tr>` : `<div class="empty">${msg}</div>`;
  const menuOptions = () => st().vendors.filter((v) => S.vendorMenus(v.id).length).map((v) =>
    `<optgroup label="${esc(v.name)}">${S.vendorMenus(v.id).map((m) => `<option value="${m.id}">${esc(m.short)} — ${esc(m.name)}</option>`).join('')}</optgroup>`).join('');
  const dateTitle = (d) => `${u.dayName(d)}, ${u.fmtDate(d)}`;
  const areas = () => [...new Set(st().agents.map((a) => a.area).filter(Boolean))];
  const chip = (cls, t) => `<span class="chip c-${cls}">${esc(t)}</span>`;
  const kpi = (ic, value, label, tone) => `<div class="kpi ${tone || ''}"><span class="kpi-ic">${ui.icon(ic)}</span><div><span class="kpi-l">${label}</span><b>${value}</b></div></div>`;
  const VC_TONES = [['#ecfdf5', '#047857'], ['#eff6ff', '#1d4ed8'], ['#f5f3ff', '#6d28d9'], ['#fff7ed', '#c2410c'], ['#fdf2f8', '#be185d'], ['#ecfeff', '#0e7490']];
  const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  const payChip = (o) => ({ ok: chip('ok', '✓ Disahkan'), pending: chip('warn', 'Belum disahkan'), mismatch: chip('err', 'Amaun tak sepadan') })[S.payStatus(o)];
  const who = (o) => { const a = S.agentOf(o); return a ? esc(a.name) + (u.norm(o.agentName) !== a.name ? ` <span class="muted xs">(ditaip: ${esc(o.agentName)})</span>` : '') : `${esc(u.norm(o.agentName))} ${chip('warn', 'baru')}`; };

  function vendorSummary(date) {
    return st().vendors.map((v) => { const sh = S.vendorSheet(date, v.id); return { v, sh, sent: S.sentStatus(date, v.id) }; })
      .sort((a, b) => b.sh.totalQty - a.sh.totalQty);
  }

  // =============== DASHBOARD (keseluruhan) ===============
  P.dashboard = {
    title: 'Dashboard',
    render() {
      const f = ui.F('dashboard', { n: 7 }), n = +f.n;
      const days = [...Array(n)].map((_, i) => u.addDays(V.date, i - n + 1));
      const os = st().orders.filter((o) => !o.cancelled && o.date >= days[0] && o.date <= V.date);
      const pcs = os.reduce((s, o) => s + S.orderQty(o), 0), sen = os.reduce((s, o) => s + S.orderSen(o), 0);
      const agents = {};
      os.forEach((o) => { const k = S.agentLabel(o), a = agents[k] = agents[k] || { name: k, n: 0, q: 0, sen: 0 }; a.n++; a.q += S.orderQty(o); a.sen += S.orderSen(o); });
      const vend = {};
      os.forEach((o) => o.items.forEach((i) => { const m = S.resolveMenu(i); if (!m) return; const v = vend[m.vendorId] = vend[m.vendorId] || { name: S.vendor(m.vendorId).name, q: 0, sen: 0 }; v.q += i.qty; v.sen += i.qty * m.price; }));
      const vRows = Object.values(vend).sort((a, b) => b.q - a.q), vMax = Math.max(1, ...vRows.map((v) => v.q));
      const top = Object.values(agents).sort((a, b) => b.q - a.q).slice(0, 10);
      const perDay = days.map((d) => {
        const dos = os.filter((o) => o.date === d), vs = st().vendors.filter((v) => S.vendorSheet(d, v.id).totalQty);
        return { d, n: dos.length, q: dos.reduce((s, o) => s + S.orderQty(o), 0), sen: dos.reduce((s, o) => s + S.orderSen(o), 0),
          ok: dos.filter((o) => S.payStatus(o) === 'ok').length, vTot: vs.length, vSent: vs.filter((v) => S.sentStatus(d, v.id)).length, rec: S.reconStatus(d) };
      });
      // single-series bar chart (pcs per day); native <title> gives the hover tooltip
      const W = 760, H = 180, gap = n > 14 ? 4 : 10, bw = (W - gap * (n - 1)) / n, maxQ = Math.max(1, ...perDay.map((x) => x.q));
      const chart = `<svg viewBox="0 0 ${W} ${H + 40}" class="chart" role="img" aria-label="Kuantiti pcs sehari, ${n} hari">
        <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#d1fae5"/></linearGradient>
          <linearGradient id="barGradOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>
        ${[0.25, 0.5, 0.75].map((g) => `<line x1="0" x2="${W}" y1="${Math.round(H - g * (H - 22)) + 0.5}" y2="${Math.round(H - g * (H - 22)) + 0.5}" class="grid-line"/>`).join('')}
        <line x1="0" x2="${W}" y1="${H + 0.5}" y2="${H + 0.5}" class="axis-line"/>
        ${perDay.map((x, i) => { const h = x.q ? Math.max(6, Math.round((x.q / maxQ) * (H - 22))) : 0, xx = i * (bw + gap); return `<g class="bar-g" data-act="goDay" data-d="${x.d}">
          <rect x="${xx}" y="0" width="${bw}" height="${H}" class="hit"/>
          ${h ? `<path d="M${xx},${H} v${-(h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${h - 4} z" class="${x.d === V.date ? 'bar-on' : 'bar'}"/>` : ''}
          <title>${dateTitle(x.d)}: ${u.num(x.q)} pcs · ${x.n} pesanan · ${u.rm(x.sen)}</title>
          ${n <= 14 ? `<text x="${xx + bw / 2}" y="${H - h - 6}" text-anchor="middle" class="lbl">${u.num(x.q)}</text>` : ''}
          ${n <= 14 || i % 5 === 4 || i === n - 1 ? `<text x="${xx + bw / 2}" y="${H + 18}" text-anchor="middle" class="axis">${u.fmtDate(x.d).slice(0, 5)}</text>` : ''}</g>`; }).join('')}
      </svg>`;
      const recChip = (r, d) => !st().pulled[d] && !r ? chip('gray', 'Belum') : r ? (r.changed ? chip('warn', 'Berubah') : chip('ok', '✓ Selesai')) : S.reconcile(d).issues.length ? chip('err', S.reconcile(d).issues.length + ' isu') : chip('warn', 'Belum ditanda');
      return `
      <div class="hero">
        <div><h2>Ringkasan keseluruhan</h2><p class="muted">${n} hari sehingga ${dateTitle(V.date)} · pesanan dibatalkan tidak dikira</p></div>
        <div class="seg" role="group" aria-label="Tempoh">${[7, 14, 30].map((k) => `<button class="${n === k ? 'on' : ''}" data-act="dashRange" data-n="${k}">${k} hari</button>`).join('')}</div>
      </div>
      <div class="kpis">
        ${kpi('bag', u.num(os.length), 'Pesanan')}${kpi('box', u.num(pcs), 'Jumlah pcs', 't-blue')}${kpi('wallet', u.rm(sen), 'Nilai jualan')}
        ${kpi('users', Object.keys(agents).length, 'Ejen aktif', 't-violet')}${kpi('trend', u.num(Math.round(pcs / n)), 'Purata pcs sehari', 't-blue')}
      </div>
      <section class="card"><div class="card-head"><h3>Kuantiti sehari (pcs)</h3><span class="muted sm">Klik bar untuk buka hari tersebut</span></div>${os.length ? chart : empty('Tiada pesanan dalam tempoh ini.')}</section>
      <div class="grid g-2">
        <section class="card"><div class="card-head"><h3>Ikut vendor</h3></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendor</th><th class="w40"></th><th class="r">pcs</th><th class="r">Nilai</th></tr></thead><tbody>
          ${vRows.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td><span class="hb"><i style="width:${(v.q / vMax) * 100}%"></i></span></td><td class="r">${u.num(v.q)}</td><td class="r nowrap">${u.rm(v.sen)}</td></tr>`).join('') || empty('Tiada data.', 4)}
          </tbody></table></div></section>
        <section class="card"><div class="card-head"><h3>Ejen teratas</h3></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Ejen</th><th class="r">Pesanan</th><th class="r">pcs</th><th class="r">Nilai</th></tr></thead><tbody>
          ${top.map((a, i) => `<tr><td><span class="rank ${i < 3 ? 'lead' : ''}">${i + 1}</span></td><td><b>${esc(a.name)}</b></td><td class="r">${a.n}</td><td class="r">${u.num(a.q)}</td><td class="r nowrap">${u.rm(a.sen)}</td></tr>`).join('') || empty('Tiada data.', 5)}
          </tbody></table></div></section>
      </div>
      <section class="card p0"><div class="card-head pad"><h3>Status harian</h3><span class="muted sm">Klik baris untuk buka hari tersebut</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarikh</th><th class="r">Pesanan</th><th class="r">pcs</th><th class="r">Nilai</th><th>Bayaran disahkan</th><th>Senarai dihantar</th><th>Rekonsiliasi</th></tr></thead><tbody>
        ${perDay.slice().reverse().map((x) => `<tr class="click" data-act="goDay" data-d="${x.d}"><td class="nowrap"><b>${dateTitle(x.d)}</b></td><td class="r">${x.n}</td><td class="r">${u.num(x.q)}</td><td class="r nowrap">${u.rm(x.sen)}</td>
          <td>${x.n ? (x.ok === x.n ? chip('ok', `✓ ${x.ok}/${x.n}`) : chip('warn', `${x.ok}/${x.n}`)) : '—'}</td>
          <td>${x.vTot ? (x.vSent === x.vTot ? chip('ok', `✓ ${x.vSent}/${x.vTot} vendor`) : chip(x.vSent ? 'warn' : 'gray', `${x.vSent}/${x.vTot} vendor`)) : '—'}</td>
          <td>${x.n ? recChip(x.rec, x.d) : '—'}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    },
  };
  A.dashRange = (d) => { ui.F('dashboard').n = +d.n; ui.render(); };
  A.goDay = (d) => { V.date = d.d; try { sessionStorage.setItem('nbk-date', d.d); } catch (e) { /* ignore */ } location.hash = '#/hari-ini'; };

  // =============== HARI INI ===============
  P['hari-ini'] = {
    title: 'Hari Ini',
    render() {
      const d = V.date, os = S.dayOrders(d), un = S.unmapped(d);
      const newAgents = Object.values(Object.fromEntries(os.filter((o) => !S.agentOf(o)).map((o) => [u.phoneKey(o.agentPhone) || u.norm(o.agentName), o])));
      const vs = vendorSummary(d), withQty = vs.filter((x) => x.sh.totalQty), none = vs.length - withQty.length;
      const pcs = os.reduce((s, o) => s + S.orderQty(o), 0), sen = os.reduce((s, o) => s + S.orderSen(o), 0);
      const agents = new Set(os.map(S.agentLabel)).size;
      const payIssues = os.filter((o) => S.payStatus(o) !== 'ok'), verified = os.length - payIssues.length;
      return `
      <div class="hero">
        <div><h2>${dateTitle(d)}</h2><p class="muted">Pesanan daripada BCL dikumpul ikut vendor. Klik vendor untuk lihat siapa order apa.</p></div>
      </div>
      <div class="kpis">
        ${kpi('bag', os.length, 'Pesanan')}${kpi('users', agents, 'Ejen', 't-violet')}${kpi('box', u.num(pcs), 'Jumlah pcs', 't-blue')}
        ${kpi('wallet', u.rm(sen), 'Nilai')}${kpi('shield', `${verified}/${os.length}`, 'Bayaran disahkan', payIssues.length ? 't-amber' : 't-ok')}
      </div>
      ${un.length || newAgents.length || payIssues.length ? `<section class="card attn"><h3>${ui.icon('alert')} Perlu tindakan</h3>
        ${un.map((x, i) => `<div class="todo"><div><b>${esc(x.name)}</b> — ${x.qty} pcs<br><span class="muted sm">Item ini tidak dikenali, jadi belum masuk mana-mana senarai vendor. Pilih menu yang betul.</span></div>
          <div class="todo-act"><select id="un-${i}" aria-label="Pilih menu untuk ${esc(x.name)}"><option value="">— Pilih menu —</option>${menuOptions()}</select><button class="btn btn-primary" data-act="mapItem" data-i="${i}" data-name="${esc(x.name)}">Simpan</button></div></div>`).join('')}
        ${newAgents.map((o) => `<div class="todo"><div><b>${esc(u.norm(o.agentName))}</b> · ${esc(o.agentPhone || 'tiada No. HP')}<br><span class="muted sm">No. HP ini belum ada dalam senarai ejen. Pesanan tetap dikira; tambah ejen supaya kawasan diketahui.</span></div>
          <div class="todo-act"><button class="btn" data-act="agentAdd" data-name="${esc(u.norm(o.agentName))}" data-phone="${esc(o.agentPhone || '')}">Tambah ejen</button></div></div>`).join('')}
        ${payIssues.map((o) => `<div class="todo"><div><b>${esc(o.sourceOrderId)}</b> · ${esc(S.agentLabel(o))} ${payChip(o)}<br><span class="muted sm">${S.payStatus(o) === 'mismatch'
          ? `Dibayar ${u.rm(o.payment.amountSen)}, tetapi jumlah pesanan ${u.rm(S.orderSen(o))}.` : 'Bayaran belum disahkan dengan gateway.'}</span></div>
          <div class="todo-act"><button class="btn" data-act="orderOpen" data-id="${esc(o.id)}">Lihat bukti</button></div></div>`).join('')}
      </section>` : ''}
      ${!os.length ? `<section class="card">${empty(`Tiada pesanan untuk ${dateTitle(d)}.<br><br><button class="btn" data-act="demoOrder">Terima pesanan contoh dari BCL</button>`)}</section>` : `
      <h3 class="sec">Vendor <span class="count">${withQty.length}</span></h3>
      <div class="vcards">${withQty.map(({ v, sh, sent }) => { const [bg, fg] = VC_TONES[st().vendors.indexOf(v) % VC_TONES.length]; return `
        <a class="vcard" href="#/senarai?v=${v.id}">
          <div class="vc-top"><span class="vc-av" style="background:${bg};color:${fg}">${esc(initials(v.name))}</span><span class="vc-name">${esc(v.name)}</span></div>
          <div class="vc-num">${u.num(sh.totalQty)} <small>pcs</small></div>
          <div class="vc-sub">${sh.rows.length} ejen · ${u.rm(sh.totalSen)}</div>
          <div class="vc-bar"><i style="width:${Math.round((sh.totalQty / withQty[0].sh.totalQty) * 100)}%"></i></div>
          <div class="vc-foot">${sent ? (sent.changed ? chip('warn', 'Berubah selepas dihantar') : chip('ok', 'Dihantar ' + u.fmtDT(sent.at).slice(11))) : chip('gray', 'Belum dihantar')}<span class="vc-go">Buka senarai →</span></div></a>`; }).join('')}
      </div>
      ${none ? `<p class="muted sm">${none} vendor lain tiada pesanan pada tarikh ini.</p>` : ''}`}`;
    },
  };
  A.mapItem = (d) => {
    const id = document.getElementById('un-' + d.i).value;
    if (!id) return ui.toast('Pilih menu dahulu.', 'err');
    const m = S.menu(id);
    m.aliases.push(d.name);
    S.log('Item dipadankan', `"${d.name}" → ${m.name}`);
    ui.commit(); ui.toast(`"${d.name}" kini dikira sebagai ${m.short} (${S.vendor(m.vendorId).name}).`);
  };
  A.demoOrder = () => {
    const p = W.example(); p.data.main_data.created_at = u.fmtDate(V.date) + ' 09:30:00';
    const r = W.process(p); ui.commit(); ui.toast(r.message, r.status === 'processed' ? 'ok' : 'err');
  };

  // =============== SENARAI VENDOR ===============
  P.senarai = {
    title: 'Senarai Vendor',
    onRoute(p) { if (p.v) ui.F('senarai').v = p.v; },
    render() {
      const f = ui.F('senarai', { v: '', area: '' }), vs = vendorSummary(V.date);
      if (!f.v || !S.vendor(f.v)) f.v = (vs.find((x) => x.sh.totalQty) || vs[0]).v.id;
      const sh = S.vendorSheet(V.date, f.v, f.area), sent = S.sentStatus(V.date, f.v);
      const hasOrders = vs.filter((x) => x.sh.totalQty);
      return `
      <div class="vtabs no-print" role="tablist">${hasOrders.map(({ v, sh: s }) => `<button role="tab" class="${v.id === f.v ? 'on' : ''}" data-act="pickVendor" data-v="${v.id}">${esc(v.name)} <span>${s.totalQty}</span></button>`).join('')}
        <select id="sv-all" data-act-change="pickVendorSel" aria-label="Vendor lain">${opts(st().vendors.map((v) => [v.id, v.name]), hasOrders.some((x) => x.v.id === f.v) ? '' : f.v, 'Vendor lain…')}</select></div>
      <div class="toolbar no-print">
        <div class="seg" role="group" aria-label="Kawasan">${[['', 'Semua kawasan'], ...areas().map((a) => [a, a])].map(([k, l]) => `<button class="${f.area === k ? 'on' : ''}" data-act="pickArea" data-a="${esc(k)}">${esc(l)}</button>`).join('')}</div>
        <div class="actions">
          <button class="btn" data-act="sheetPrint">${ui.icon('printer')}Cetak / PDF</button>
          <button class="btn" data-act="sheetXls">${ui.icon('download')}Excel</button>
          <button class="btn" data-act="sheetCopy">${ui.icon('copy')}Salin untuk WhatsApp</button>
          ${sent ? `<button class="btn ${sent.changed ? 'btn-warn' : 'btn-done'}" data-act="sheetUnsent" title="Klik untuk batalkan tanda">${ui.icon('check')}${sent.changed ? 'Berubah selepas dihantar' : 'Dihantar ' + u.fmtDT(sent.at).slice(11)}</button>`
            : `<button class="btn btn-primary" data-act="sheetSent" ${sh.totalQty ? '' : 'disabled'}>${ui.icon('check')}Tanda sudah dihantar</button>`}
        </div>
      </div>
      ${sent && sent.changed ? `<div class="alert a-warn no-print">Senarai ini berubah selepas ditanda dihantar (dahulu ${sent.qty} pcs, sekarang ${sh.totalQty} pcs). Hantar semula kepada vendor jika perlu.</div>` : ''}
      <article class="sheet">
        <div class="sheet-title">NBK EXPRESS ( NASI BERLAUK KELANTAN )</div>
        <div class="sheet-bar"><span>LIST ${esc(sh.vendor.name)}${f.area ? ' · ' + esc(f.area) : ''}</span><span>${dateTitle(V.date)}</span></div>
        ${!sh.menus.length ? empty('Vendor ini belum ada menu. Tambah di <a href="#/vendor-menu">Senarai Vendor → Vendor &amp; Menu</a>.')
          : !sh.rows.length ? empty('Tiada pesanan untuk vendor ini pada tarikh ini.')
          : `<div class="tbl-wrap"><table class="list">
          <thead><tr><th class="nm">NAMA</th>${sh.menus.map((m) => `<th title="${esc(m.name)}">${esc(m.short)}</th>`).join('')}<th class="jum">JUM</th></tr></thead>
          <tbody>${sh.rows.map((r) => `<tr><td class="nm"><button class="link" data-act="agentDay" data-name="${esc(r.name)}">${esc(r.name)}</button>${r.isNew ? ' <span class="chip c-warn no-print">baru</span>' : ''}</td>
            ${sh.menus.map((m) => `<td>${r.cells[m.id] || ''}</td>`).join('')}<td class="jum">${r.total}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td class="nm">JUMLAH pcs</td>${sh.menus.map((m) => `<td>${sh.colQty[m.id]}</td>`).join('')}<td class="jum">${sh.totalQty}</td></tr>
            <tr class="small"><td class="nm">HARGA (MENU)</td>${sh.menus.map((m) => `<td>${u.rm(m.price)}</td>`).join('')}<td></td></tr>
            <tr class="small"><td class="nm"></td>${sh.menus.map((m) => `<td>${u.rm(sh.colSen[m.id])}</td>`).join('')}<td></td></tr>
            <tr class="grand"><td class="nm">TOTAL ( RM )</td><td colspan="${sh.menus.length + 1}">${u.rm(sh.totalSen)}</td></tr>
          </tfoot></table></div>`}
      </article>`;
    },
  };
  const curSheet = () => { const f = ui.F('senarai'); return S.vendorSheet(V.date, f.v, f.area); };
  A.pickVendor = (d) => { ui.F('senarai').v = d.v; ui.render(); };
  A.pickVendorSel = (d, el) => { if (el.value) { ui.F('senarai').v = el.value; ui.render(); } };
  A.pickArea = (d) => { ui.F('senarai').area = d.a; ui.render(); };
  A.sheetPrint = () => { const sh = curSheet(); S.log('Senarai dicetak', `${sh.vendor.name} · ${u.fmtDate(V.date)}`); S.save(); ui.toast('Untuk PDF, pilih "Save as PDF" dalam dialog cetak.', 'info'); setTimeout(() => window.print(), 300); };
  function sheetRows(sh) {
    return [['NAMA', ...sh.menus.map((m) => m.short), 'JUM'],
      ...sh.rows.map((r) => [r.name, ...sh.menus.map((m) => r.cells[m.id] || ''), r.total]),
      ['JUMLAH pcs', ...sh.menus.map((m) => sh.colQty[m.id]), sh.totalQty],
      ['HARGA (MENU)', ...sh.menus.map((m) => u.senToStr(m.price)), ''],
      ['RM', ...sh.menus.map((m) => u.senToStr(sh.colSen[m.id])), ''],
      ['TOTAL (RM)', u.senToStr(sh.totalSen)]];
  }
  A.sheetXls = () => {
    const sh = curSheet(), f = ui.F('senarai');
    u.downloadXLS(`LIST ${sh.vendor.name} ${V.date}${f.area ? ' ' + f.area : ''}.xls`, `NBK EXPRESS — LIST ${sh.vendor.name}${f.area ? ' ' + f.area : ''} — ${dateTitle(V.date)}`, sheetRows(sh));
    S.log('Senarai dieksport (Excel)', `${sh.vendor.name} · ${u.fmtDate(V.date)}`); S.save(); ui.toast('Fail Excel dimuat turun.');
  };
  A.sheetCopy = async () => {
    const sh = curSheet(), f = ui.F('senarai');
    const lines = [`*NBK EXPRESS — ${sh.vendor.name}*`, `${dateTitle(V.date)}${f.area ? ' (' + f.area + ')' : ''}`, '',
      ...sh.menus.filter((m) => sh.colQty[m.id]).map((m) => `${m.short}: ${sh.colQty[m.id]}`), '', `Jumlah: ${sh.totalQty} pcs`, `Total: ${u.rm(sh.totalSen)}`];
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); ui.toast('Ringkasan disalin. Tampal dalam WhatsApp vendor.'); }
    catch (e) { ui.modal({ title: 'Salin ringkasan', body: `<textarea rows="12" readonly>${esc(text)}</textarea>`, foot: '<button class="btn" data-act="modalClose">Tutup</button>' }); }
  };
  A.sheetSent = () => { S.markSent(V.date, ui.F('senarai').v); ui.commit(); ui.toast('Ditanda sudah dihantar kepada vendor.'); };
  A.sheetUnsent = async () => {
    const f = ui.F('senarai');
    if (!(await ui.confirm({ title: 'Batalkan tanda dihantar?', text: `Senarai <b>${esc(S.vendor(f.v).name)}</b> akan kembali ke status "Belum dihantar".`, ok: 'Batalkan tanda' }))) return;
    S.unmarkSent(V.date, f.v); ui.commit();
  };
  A.agentDay = (d) => {
    const os = S.dayOrders(V.date).filter((o) => S.agentLabel(o) === d.name);
    ui.modal({
      title: `${d.name} · ${dateTitle(V.date)}`, wide: true,
      body: os.map((o) => `<div class="ord"><div class="ord-h"><b>${esc(o.sourceOrderId)}</b> <span class="muted sm">${u.fmtDT(o.submittedAt)}</span></div>
        ${itemsTable(o)}</div>`).join('') || empty('Tiada pesanan.'),
      foot: '<button class="btn" data-act="modalClose">Tutup</button>',
    });
  };

  // =============== PESANAN ===============
  function itemsTable(o) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item (dari BCL)</th><th>Vendor · menu</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>
      ${o.items.map((i) => { const m = S.resolveMenu(i); return `<tr><td>${esc(i.name)}</td><td>${m ? `${esc(S.vendor(m.vendorId).name)} · <b>${esc(m.short)}</b>` : '<span class="txt-warn">Tidak dikenali</span>'}</td>
        <td class="r">${i.qty}</td><td class="r">${u.rm(i.unitSen)}</td><td class="r">${u.rm(i.qty * i.unitSen)}</td></tr>`; }).join('')}
      <tr class="tot"><td colspan="2">Jumlah</td><td class="r">${S.orderQty(o)}</td><td></td><td class="r">${u.rm(S.orderSen(o))}</td></tr></tbody></table></div>`;
  }
  const status = (o) => o.cancelled ? chip('gray', 'Dibatalkan') : S.needsReview(o) ? chip('warn', 'Perlu semakan') : chip('ok', 'OK');
  P.pesanan = {
    title: 'Pesanan',
    onRoute(p) { if (p.id) setTimeout(() => A.orderOpen({ id: p.id })); },
    render() {
      const f = ui.F('pesanan', { q: '', show: '' }), q = u.norm(f.q);
      const all = st().orders.filter((o) => o.date === V.date);
      const counts = { review: all.filter(S.needsReview).length, cancelled: all.filter((o) => o.cancelled).length };
      const rows = all.filter((o) => (!q || u.norm(o.agentName + ' ' + S.agentLabel(o) + ' ' + o.sourceOrderId + ' ' + (o.agentPhone || '')).includes(q)) &&
        (!f.show || (f.show === 'review' ? S.needsReview(o) : o.cancelled)))
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
      const summary = (o) => {
        const by = {};
        o.items.forEach((i) => { const m = S.resolveMenu(i), k = m ? S.vendor(m.vendorId).name : '?'; (by[k] = by[k] || []).push(`${m ? m.short : i.name} ${i.qty}`); });
        return Object.entries(by).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v.join(', '))}`).join('<br>');
      };
      return `
      <div class="toolbar">
        <input id="p-q" type="search" class="search" placeholder="Cari ejen, No. HP atau no. pesanan…" value="${esc(f.q)}" data-f="pesanan.q">
        <div class="seg" role="group" aria-label="Tapis">${[['', `Semua (${all.length})`], ['review', `Perlu semakan (${counts.review})`], ['cancelled', `Dibatalkan (${counts.cancelled})`]]
          .map(([k, l]) => `<button class="${f.show === k ? 'on' : ''}" data-act="ordShow" data-k="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Masa</th><th>No. BCL</th><th>Ejen</th><th>Item</th><th class="r">pcs</th><th class="r">Nilai</th><th>Bayaran</th><th>Status</th></tr></thead>
        <tbody>${rows.length ? rows.map((o) => `<tr class="click ${o.cancelled ? 'dim' : ''}" data-act="orderOpen" data-id="${esc(o.id)}">
          <td class="nowrap">${u.fmtDT(o.submittedAt).slice(11)}</td><td class="nowrap">${esc(o.sourceOrderId)}</td>
          <td>${who(o)}</td><td class="sm">${summary(o)}</td>
          <td class="r">${S.orderQty(o)}</td><td class="r nowrap">${u.rm(S.orderSen(o))}</td><td>${o.cancelled ? '' : payChip(o)}</td><td>${status(o)}</td></tr>`).join('')
          : empty(all.length ? 'Tiada pesanan sepadan.' : `Tiada pesanan untuk ${dateTitle(V.date)}.`, 8)}</tbody></table></div></div>`;
    },
  };
  A.ordShow = (d) => { ui.F('pesanan').show = d.k; ui.render(); };
  A.orderOpen = (d) => {
    const o = st().orders.find((x) => x.id === d.id);
    if (!o) return;
    const un = o.items.map((i, k) => [i, k]).filter(([i]) => !S.resolveMenu(i));
    ui.modal({
      title: `Pesanan ${o.sourceOrderId}`, wide: true,
      body: `<div class="kv"><div><span>Ejen</span><b>${who(o)}</b></div><div><span>No. HP</span><b>${esc(o.agentPhone || '—')}</b></div>
        <div><span>Masa bayar</span><b>${u.fmtDT(o.submittedAt)}</b></div><div><span>Status</span><b>${status(o)}</b></div></div>
        ${o.cancelled && o.note ? `<div class="alert a-info">${esc(o.note)}</div>` : ''}
        ${proof(o)}
        ${itemsTable(o)}
        ${un.length && !o.cancelled ? `<div class="alert a-warn"><b>Padankan item yang tidak dikenali</b>${un.map(([i, k]) => `<div class="todo"><span>${esc(i.name)}</span>
          <div class="todo-act"><select id="om-${k}"><option value="">— Pilih menu —</option>${menuOptions()}</select><button class="btn btn-primary btn-sm" data-act="orderMap" data-id="${esc(o.id)}" data-k="${k}">Simpan</button></div></div>`).join('')}</div>` : ''}
        ${o.revisions.length ? `<h4>Sejarah</h4><ul class="tight">${o.revisions.map((r) => `<li>${u.fmtDT(r.at)} — ${esc(r.note)}</li>`).join('')}</ul>` : ''}
        <details class="box"><summary>Data asal dari BCL</summary><pre class="code">${esc(JSON.stringify(o.payload, null, 2))}</pre></details>`,
      foot: `${o.cancelled ? `<button class="btn" data-act="orderRestore" data-id="${esc(o.id)}">Aktifkan semula</button>` : `<button class="btn btn-danger" data-act="orderCancel" data-id="${esc(o.id)}">Batalkan pesanan</button>`}
        <span class="grow"></span><button class="btn" data-act="modalClose">Tutup</button>`,
    });
  };
  function proof(o) {
    const p = o.payment, ps = S.payStatus(o);
    if (!p) return `<div class="proof"><b>Bukti bayaran</b><p class="muted">Tiada maklumat transaksi untuk pesanan ini.</p></div>`;
    const exp = S.expectedSen(o), match = p.amountSen === exp;
    return `<section class="proof ${ps}">
      <div class="proof-h"><b>${ui.icon('shield')}Bukti bayaran</b>${payChip(o)}</div>
      <div class="kv">
        <div><span>Gateway</span><b>${esc(p.gateway)}</b></div>
        <div><span>No. transaksi</span><b class="mono">${esc(p.txId || '—')}</b> ${p.txId ? `<button class="link xs" data-act="payCopy" data-v="${esc(p.txId)}">salin</button>` : ''}</div>
        <div><span>Kaedah</span><b>${esc(p.method || '—')}</b></div>
        <div><span>Status gateway</span><b>${esc(p.statusText || '—')} ${p.live === false ? chip('warn', 'UJIAN') : ''}</b></div>
        <div><span>Amaun dibayar</span><b>${u.rm(p.amountSen)}</b></div>
        <div><span>${p.discountSen ? 'Patut dibayar' : 'Jumlah pesanan'}</span><b>${u.rm(exp)} ${match ? '<span class="txt-ok">✓ sama</span>' : '<span class="txt-err">✗ berbeza ' + u.rm(exp - p.amountSen) + '</span>'}</b></div>
        ${p.discountSen ? `<div><span>Diskaun kupon</span><b>−${u.rm(p.discountSen)} ${chip('gray', p.coupon || 'kupon')}</b></div><div><span>Jumlah item</span><b>${u.rm(S.orderSen(o))}</b></div>` : ''}
        <div><span>Masa bayar</span><b>${u.fmtDT(p.paidAt)}</b></div>
        <div><span>Disahkan</span><b>${p.verifiedAt ? u.fmtDT(p.verifiedAt) + ' <span class="muted xs">(' + esc(p.verifiedBy) + ')</span>' : '—'}</b></div>
      </div>
      ${p.receiptUrl ? `<p class="sm"><a href="${esc(p.receiptUrl)}" target="_blank" rel="noopener">Buka resit BCL (PDF) ↗</a></p>` : ''}
      ${p.accepted ? `<div class="alert a-info">Diterima oleh admin walaupun amaun berbeza: ${esc(p.accepted.note)} (${u.fmtDT(p.accepted.at)})</div>` : ''}
      ${!o.cancelled && ps === 'pending' ? `<button class="btn btn-primary btn-sm" data-act="payVerify" data-id="${esc(o.id)}">Sahkan sekarang</button>` : ''}
      ${!o.cancelled && ps === 'mismatch' ? `<div class="alert a-err">Amaun dibayar tidak sama dengan jumlah pesanan. Semak dengan ejen, kemudian terima dengan catatan atau batalkan pesanan.</div>
        <button class="btn btn-sm" data-act="payAccept" data-id="${esc(o.id)}">Terima dengan catatan</button>` : ''}
    </section>`;
  }
  A.payCopy = async (d) => { try { await navigator.clipboard.writeText(d.v); ui.toast('No. transaksi disalin.'); } catch (e) { ui.toast(d.v, 'info'); } };
  A.payVerify = (d) => {
    const o = st().orders.find((x) => x.id === d.id);
    o.payment.verifiedAt = new Date().toISOString(); o.payment.verifiedBy = 'Simulasi';
    S.log('Bayaran disahkan', `${o.sourceOrderId} · ${o.payment.txId} · ${u.rm(o.payment.amountSen)} (simulasi semakan API)`);
    ui.commit(); A.orderOpen(d); ui.toast('Bayaran disahkan (simulasi).');
  };
  A.payAccept = async (d) => {
    const o = st().orders.find((x) => x.id === d.id);
    const r = await ui.confirm({ title: 'Terima walaupun amaun berbeza?', text: `Dibayar <b>${u.rm(o.payment.amountSen)}</b>, jumlah pesanan <b>${u.rm(S.orderSen(o))}</b>.`, reason: true, ok: 'Terima' });
    if (!r) return A.orderOpen(d);
    o.payment.accepted = { note: r, at: new Date().toISOString() };
    S.log('Beza amaun diterima', `${o.sourceOrderId} — ${r}`); ui.commit(); A.orderOpen(d);
  };
  A.orderMap = (d) => {
    const o = st().orders.find((x) => x.id === d.id), it = o.items[+d.k], id = document.getElementById('om-' + d.k).value;
    if (!id) return ui.toast('Pilih menu dahulu.', 'err');
    const m = S.menu(id); m.aliases.push(it.name);
    S.log('Item dipadankan', `"${it.name}" → ${m.name}`);
    ui.commit(); A.orderOpen(d); ui.toast('Item dipadankan.');
  };
  A.orderCancel = async (d) => {
    const o = st().orders.find((x) => x.id === d.id);
    const r = await ui.confirm({ title: 'Batalkan pesanan?', text: `Pesanan <b>${esc(o.sourceOrderId)}</b> (${esc(S.agentLabel(o))}) tidak akan dikira dalam senarai vendor. Data asal tidak dipadam.`, reason: true, danger: true, ok: 'Batalkan' });
    if (!r) return A.orderOpen(d);
    o.cancelled = true; o.note = 'Dibatalkan: ' + r; o.revisions.push({ at: new Date().toISOString(), note: 'Dibatalkan: ' + r });
    S.log('Pesanan dibatalkan', `${o.sourceOrderId} (${o.agentName}) — ${r}`); ui.commit(); ui.toast('Pesanan dibatalkan.');
  };
  A.orderRestore = (d) => {
    const o = st().orders.find((x) => x.id === d.id);
    o.cancelled = false; o.revisions.push({ at: new Date().toISOString(), note: 'Diaktifkan semula.' });
    S.log('Pesanan diaktifkan semula', o.sourceOrderId); ui.commit(); A.orderOpen(d);
  };

  // =============== REKONSILIASI ===============
  const RK = {
    ok: ['ok', '✓ Sepadan'], missing: ['err', 'Dah bayar, pesanan tiada'], notx: ['err', 'Pesanan ada, bayaran tiada'],
    amount: ['err', 'Amaun tak sama'], cancelled: ['warn', 'Dah bayar, tapi dibatalkan'],
  };
  const RK_DO = {
    missing: 'Webhook terlepas. Import supaya masuk senarai vendor.',
    notx: 'Mungkin pesanan ujian/palsu. Semak dengan ejen; batalkan jika tak sah.',
    amount: 'Tanya ejen. Terima dengan catatan atau batalkan.',
    cancelled: 'Semak sama ada duit perlu dipulangkan kepada ejen.',
  };
  const reconSteps = (pulled, left, done) => `<ol class="steps3">
    <li class="${pulled ? 'done' : 'now'}"><span>${pulled ? '✓' : '1'}</span><div><b>Tarik bayaran dari BCL</b><small>Senarai semua duit masuk hari ini</small></div></li>
    <li class="${!pulled ? '' : left ? 'now' : 'done'}"><span>${pulled && !left ? '✓' : '2'}</span><div><b>Selesaikan yang tak sepadan</b><small>${pulled ? (left ? left + ' perkara lagi' : 'Tiada isu') : 'Sistem tunjuk mana yang berbeza'}</small></div></li>
    <li class="${done ? 'done' : pulled && !left ? 'now' : ''}"><span>${done ? '✓' : '3'}</span><div><b>Tandakan selesai</b><small>Rekod bahawa hari ini sudah disemak</small></div></li></ol>`;
  P.rekonsiliasi = {
    title: 'Rekonsiliasi',
    render() {
      const d = V.date, pulled = st().pulled[d], f = ui.F('rekonsiliasi', { all: false });
      const head = (actions) => `<div class="hero"><div><h2>Semakan duit vs pesanan · ${dateTitle(d)}</h2>
        <p class="muted">Pastikan setiap bayaran di BCL ada pesanannya dalam sistem, dan sebaliknya — sebelum senarai dihantar ke vendor.</p></div>${actions || ''}</div>`;
      if (!pulled) return `${head()}${reconSteps(false, 0, false)}
        <section class="card explain">
          <div class="cmp">
            <div class="cmp-side"><span class="cmp-ic">${ui.icon('bank')}</span><b>Duit masuk di BCL</b><small>Setiap bayaran ejen yang berjaya</small></div>
            <div class="cmp-mid">⇄<small>dipadankan ikut<br>no. pesanan</small></div>
            <div class="cmp-side"><span class="cmp-ic">${ui.icon('db')}</span><b>Pesanan dalam sistem</b><small>Yang dikira dalam senarai vendor</small></div>
          </div>
          <p class="muted center">Jika kedua-dua senarai sama, semuanya beres. Jika berbeza, sistem tunjuk apa yang perlu dibuat.</p>
          <div class="center"><button class="btn btn-primary" data-act="reconPull">${ui.icon('bank')}Tarik bayaran dari BCL</button></div>
        </section>`;
      const r = S.reconcile(d), rs = S.reconStatus(d), diff = r.txSen - r.sysSen, done = !!(rs && !rs.changed);
      const rows = (f.all || !r.issues.length ? r.rows : r.issues).slice().sort((a, b) => (a.kind === 'ok') - (b.kind === 'ok'));
      return `${head(`<div class="actions"><button class="btn" data-act="reconPull">Tarik semula</button><button class="btn" data-act="reconCSV">${ui.icon('download')}CSV</button></div>`)}
      ${reconSteps(true, r.issues.length, done)}
      <section class="card">
        <div class="cmp">
          <div class="cmp-side"><span class="cmp-ic">${ui.icon('bank')}</span><small>Duit masuk di BCL</small><b class="big">${u.rm(r.txSen)}</b><small>${r.txCount} bayaran</small></div>
          <div class="cmp-mid ${diff ? 'bad' : 'good'}">${diff ? '≠' : '='}<small>${diff ? 'beza ' + (diff > 0 ? '+' : '') + u.rm(diff) : 'sama'}</small></div>
          <div class="cmp-side"><span class="cmp-ic">${ui.icon('db')}</span><small>Pesanan dalam sistem</small><b class="big">${u.rm(r.sysSen)}</b><small>${r.sysCount} pesanan</small></div>
        </div>
        <p class="muted xs center">Ditarik ${u.fmtDT(pulled)} · simulasi (sistem sebenar menarik terus melalui API BCL)</p>
      </section>
      ${rs && rs.changed ? `<div class="alert a-warn">Data berubah selepas ditanda selesai. Semak semula dan tandakan semula.</div>` : ''}
      ${!r.issues.length ? `<div class="alert a-ok"><b>✓ Semua sepadan.</b> Setiap bayaran di BCL ada pesanannya dalam sistem.</div>` : ''}
      <div class="toolbar"><h3>${f.all || !r.issues.length ? `Semua (${r.rows.length})` : `Perlu tindakan (${r.issues.length})`}</h3>
        ${r.issues.length ? `<label class="check"><input type="checkbox" id="rk-all" data-f="rekonsiliasi.all" ${f.all ? 'checked' : ''}> Tunjuk yang sepadan juga (${r.rows.length - r.issues.length})</label>` : ''}</div>
      <div class="card p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Masalah</th><th>No. pesanan</th><th>Ejen</th><th class="r">Bayaran BCL</th><th class="r">Pesanan sistem</th><th>Apa perlu buat</th><th></th></tr></thead>
        <tbody>${rows.map((x) => { const o = x.order, t = x.tx; return `<tr>
          <td>${chip(...RK[x.kind])}</td><td class="nowrap">${esc(o ? o.sourceOrderId : t.orderId)}</td><td>${esc(o ? S.agentLabel(o) : u.norm(t.agentName))}</td>
          <td class="r nowrap">${t ? u.rm(t.amountSen) : '<span class="txt-err">tiada</span>'}</td><td class="r nowrap">${o ? u.rm(S.expectedSen(o)) : '<span class="txt-err">tiada</span>'}</td>
          <td class="sm">${RK_DO[x.kind] || '<span class="muted">—</span>'}</td>
          <td class="r nowrap">${x.kind === 'missing' ? (t.payload ? `<button class="btn btn-sm btn-primary" data-act="reconImport" data-id="${esc(t.orderId)}">Import pesanan</button>` : '') : `<button class="btn btn-sm" data-act="orderOpen" data-id="${esc(o.id)}">Buka</button>`}</td></tr>`; }).join('')
          || empty('Tiada bayaran untuk tarikh ini.', 7)}</tbody></table></div></div>
      <div class="finish">${done ? `<span>${ui.icon('check')} Ditanda selesai ${u.fmtDT(rs.at)}${rs.note ? ' — ' + esc(rs.note) : ''}</span><button class="btn" data-act="reconUndo">Buka semula</button>`
        : `<span class="muted">${r.issues.length ? `Masih ada ${r.issues.length} perkara. Anda boleh tandakan selesai dengan catatan.` : 'Semua beres — tandakan hari ini sebagai selesai.'}</span><button class="btn btn-primary" data-act="reconMark">${ui.icon('check')}Tandakan selesai</button>`}</div>`;
    },
  };
  A.reconPull = () => { st().pulled[V.date] = new Date().toISOString(); S.log('Transaksi BCL ditarik', `${u.fmtDate(V.date)} (simulasi)`); ui.commit(); };
  A.reconImport = (d) => {
    const t = st().txns.find((x) => x.orderId === d.id), r = W.process(JSON.parse(JSON.stringify(t.payload)));
    S.log('Pesanan terlepas diimport', `${d.id} melalui rekonsiliasi`);
    ui.commit(); ui.toast(r.message, r.status === 'processed' ? 'ok' : 'err');
  };
  A.reconMark = async () => {
    const r = S.reconcile(V.date);
    let note = '';
    if (r.issues.length) {
      note = await ui.confirm({ title: 'Tandakan selesai dengan isu?', text: `Masih ada <b>${r.issues.length}</b> perkara belum selesai. Nyatakan sebab untuk rekod.`, reason: true, ok: 'Tandakan selesai' });
      if (!note) return;
    }
    S.markReconciled(V.date, note); ui.commit(); ui.toast('Rekonsiliasi ditanda selesai.');
  };
  A.reconUndo = async () => {
    if (!(await ui.confirm({ title: 'Buka semula rekonsiliasi?', text: 'Tanda "selesai" untuk tarikh ini akan dibuang.', ok: 'Buka semula' }))) return;
    delete st().recon[V.date]; S.log('Rekonsiliasi dibuka semula', u.fmtDate(V.date)); ui.commit();
  };
  A.reconCSV = () => {
    const r = S.reconcile(V.date);
    u.downloadCSV(`rekonsiliasi-${V.date}.csv`, [['Status', 'No. BCL', 'Ejen', 'No. transaksi', 'Dibayar (BCL)', 'Pesanan (sistem)'],
      ...r.rows.map((x) => [RK[x.kind][1], x.order ? x.order.sourceOrderId : x.tx.orderId, x.order ? S.agentLabel(x.order) : x.tx.agentName, x.tx ? x.tx.txId : '',
        x.tx ? u.senToStr(x.tx.amountSen) : '', x.order ? u.senToStr(S.orderSen(x.order)) : ''])]);
    ui.toast('CSV dimuat turun.');
  };

  // =============== TETAPAN ===============
  // Vendor & Menu and Ejen live under the "Senarai Vendor" group in the sidebar; Tetapan keeps system settings.
  P['vendor-menu'] = { title: 'Vendor & Menu', render: () => tabMenu(ui.F('tetapan', { tab: 'bcl' })) };
  P.ejen = { title: 'Ejen', render: () => tabEjen(ui.F('tetapan', { tab: 'bcl' })) };
  const TABS = [['bcl', 'Sambungan BCL'], ['log', 'Log'], ['data', 'Data demo']];
  P.tetapan = {
    title: 'Tetapan',
    onRoute(p) { if (p.tab) ui.F('tetapan').tab = p.tab; },
    render() {
      const f = ui.F('tetapan', { tab: 'bcl' });
      const body = { bcl: tabBcl, log: tabLog, data: tabData }[f.tab] || tabBcl;
      return `<div class="tabs">${TABS.map(([k, l]) => `<button class="${f.tab === k ? 'on' : ''}" data-act="setTab" data-k="${k}">${l}</button>`).join('')}</div>${body(f)}`;
    },
  };
  A.setTab = (d) => { ui.F('tetapan').tab = d.k; ui.render(); };

  // ---------- Vendor & Menu: inline-editable, autosaved ----------
  const SHORT = { AYAM: 'A.', DAGING: 'DGG', NASI: 'N.', DAGANG: 'D.', BERLAUK: 'B.', KERABU: 'K.', GULAI: 'GUL', GORENG: 'GOR', PEDAS: 'PDS', KERUTUK: 'KER', BERLENGAS: 'LENGAS' };
  // "NASI DAGANG IKAN (KNB)" → "N.D. IKAN", "AYAM GULAI" → "A. GUL"
  function shortOf(name) {
    const parts = u.norm(name).replace(/\s*\(.*\)\s*$/, '').split(' ').filter(Boolean).map((w) => SHORT[w] || w);
    return parts.reduce((acc, w) => (acc && /^[A-Z]\.$/.test(w) && /[A-Z]\.$/.test(acc) && !acc.includes(' ') ? acc + w : acc ? acc + ' ' + w : w), '').slice(0, 12);
  }
  const usedBy = (m) => st().orders.filter((o) => o.items.some((i) => S.resolveMenu(i) === m)).length;
  function saved(msg) {
    S.save();
    const el = document.getElementById('save-state');
    if (el) { el.textContent = '✓ ' + (msg || 'Disimpan') + ' · ' + new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  const bad = (el, msg) => { ui.toast(msg, 'err'); el.classList.add('invalid'); setTimeout(() => el.classList.remove('invalid'), 2500); };
  const colPreview = (v) => `<span class="pv nm">NAMA</span>${S.vendorMenus(v.id).filter((m) => m.active).map((m) => `<span class="pv">${esc(m.short)}</span>`).join('') || '<span class="pv empty">belum ada lajur</span>'}<span class="pv nm">JUM</span>`;

  function tabMenu(f) {
    if (!f.v || !S.vendor(f.v)) f.v = st().vendors[0].id;
    const v = S.vendor(f.v), ms = S.vendorMenus(v.id), q = u.norm(f.vq || ''), [bg, fg] = VC_TONES[st().vendors.indexOf(v) % VC_TONES.length];
    const others = st().vendors.filter((x) => x.id !== v.id && S.vendorMenus(x.id).length);
    return `<div class="split">
      <aside class="vlist">
        <input id="vm-q" type="search" class="search mini" placeholder="Cari vendor…" value="${esc(f.vq || '')}" data-f="tetapan.vq">
        <nav aria-label="Vendor">${st().vendors.filter((x) => !q || u.norm(x.name).includes(q)).map((x) => { const n = S.vendorMenus(x.id).length; return `<button class="${x.id === f.v ? 'on' : ''}" data-act="setMenuVendor" data-v="${x.id}"><i class="dot ${x.active ? '' : 'off'}"></i><em class="vn">${esc(x.name)}</em><span class="${n ? '' : 'need'}">${n || 'tiada menu'}</span></button>`; }).join('')}</nav>
        <div class="vadd"><input id="new-vendor" placeholder="Nama vendor baharu" maxlength="80" data-enter="vendorAdd" aria-label="Nama vendor baharu"><button class="btn btn-sm" data-act="vendorAdd">${ui.icon('plus')}Tambah vendor</button></div>
      </aside>
      <div>
        <section class="card vhead">
          <span class="vc-av lg" style="background:${bg};color:${fg}">${esc(initials(v.name))}</span>
          <label class="field grow"><span>Nama vendor</span><input value="${esc(v.name)}" maxlength="80" data-act-change="vendorField" data-k="name"></label>
          <label class="field"><span>Telefon</span><input value="${esc(v.phone)}" maxlength="20" placeholder="pilihan" data-act-change="vendorField" data-k="phone"></label>
          <label class="switch"><input type="checkbox" ${v.active ? 'checked' : ''} data-act-change="vendorField" data-k="active"><i></i><span>Aktif</span></label>
          <span id="save-state" class="save-state">Perubahan disimpan automatik</span>
        </section>
        <section class="card">
          <div class="card-head"><div><h3>Menu &amp; harga</h3><p class="muted sm nomargin">Taip terus dalam jadual. Susunan di sini = susunan lajur dalam senarai vendor.</p></div>
            ${others.length ? `<button class="btn btn-sm" data-act="menuCopy">${ui.icon('copy')}Salin menu dari vendor lain</button>` : ''}</div>
          <div class="preview"><span class="muted xs">Pratonton lajur senarai:</span><div id="col-preview" class="pv-row">${colPreview(v)}</div></div>
          <div class="tbl-wrap"><table class="tbl edit">
            <thead><tr><th class="w-ord"></th><th class="w-short">Lajur</th><th>Nama item dalam borang BCL</th><th class="w-price">Harga (RM)</th><th class="w-act">Aktif</th><th class="w-del"></th></tr></thead>
            <tbody>${ms.map((m, i) => `<tr class="${m.active ? '' : 'dim'}">
              <td class="nowrap"><button class="icon-btn sm" data-act="menuMove" data-id="${m.id}" data-dir="-1" aria-label="Naik" ${i ? '' : 'disabled'}>${ui.icon('up')}</button><button class="icon-btn sm" data-act="menuMove" data-id="${m.id}" data-dir="1" aria-label="Turun" ${i < ms.length - 1 ? '' : 'disabled'}>${ui.icon('down')}</button></td>
              <td><input class="cell strong" value="${esc(m.short)}" maxlength="12" data-act-change="menuField" data-id="${m.id}" data-k="short" aria-label="Nama lajur"></td>
              <td><input class="cell" value="${esc(m.name)}" maxlength="120" data-act-change="menuField" data-id="${m.id}" data-k="name" aria-label="Nama item dalam borang">
                ${m.aliases.length ? `<div class="aliases">juga dikenali: ${m.aliases.map((a, k) => `<span class="tag">${esc(a)}<button data-act="menuAliasDel" data-id="${m.id}" data-k="${k}" aria-label="Buang">×</button></span>`).join('')}</div>` : ''}</td>
              <td><input class="cell r" value="${u.senToStr(m.price)}" inputmode="decimal" data-act-change="menuField" data-id="${m.id}" data-k="price" aria-label="Harga"></td>
              <td><label class="switch sm"><input type="checkbox" ${m.active ? 'checked' : ''} data-act-change="menuField" data-id="${m.id}" data-k="active" aria-label="Aktif"><i></i></label></td>
              <td><button class="icon-btn sm del" data-act="menuDelete" data-id="${m.id}" aria-label="Padam menu">${ui.icon('x')}</button></td></tr>`).join('')}
            </tbody>
            <tfoot><tr class="add-row">
              <td>${ui.icon('plus')}</td>
              <td><input id="new-short" class="cell" maxlength="12" placeholder="auto" data-enter="menuAdd" aria-label="Lajur baharu"></td>
              <td><input id="new-name" class="cell" maxlength="120" placeholder="cth. AYAM GULAI (${esc(v.name)})" data-enter="menuAdd" aria-label="Nama item baharu"></td>
              <td><input id="new-price" class="cell r" inputmode="decimal" placeholder="0.00" data-enter="menuAdd" aria-label="Harga baharu"></td>
              <td colspan="2"><button class="btn btn-sm btn-primary" data-act="menuAdd">Tambah</button></td></tr></tfoot>
          </table></div>
          <p class="muted xs">Tips: kosongkan "Lajur" untuk dijana automatik (cth. NASI DAGANG IKAN → N.D. IKAN). Tekan Enter untuk tambah baris seterusnya.${ms.length ? '' : ' Vendor ini belum ada menu — tambah di atas atau salin dari vendor lain.'}</p>
        </section>
      </div></div>`;
  }
  A.setMenuVendor = (d) => { ui.F('tetapan').v = d.v; ui.render(); };
  A.menuMove = (d) => {
    const m = S.menu(d.id), ms = S.vendorMenus(m.vendorId), i = ms.indexOf(m), j = i + +d.dir;
    if (!ms[j]) return;
    ms.splice(i, 1); ms.splice(j, 0, m); ms.forEach((x, k) => { x.sort = k; });
    ui.commit();
  };
  A.vendorAdd = () => {
    const el = document.getElementById('new-vendor'), name = u.norm(el.value);
    if (!name) return el.focus();
    if (st().vendors.some((v) => u.norm(v.name) === name)) return bad(el, 'Vendor ini sudah wujud.');
    const v = { id: u.uid('V'), name, phone: '', notes: '', active: true };
    st().vendors.push(v); ui.F('tetapan').v = v.id;
    S.log('Vendor ditambah', name); ui.commit(); ui.toast(`Vendor ${name} ditambah. Sekarang tambah menunya.`);
    const n = document.getElementById('new-name'); if (n) n.focus();
  };
  A.vendorField = (d, el) => {
    const v = S.vendor(ui.F('tetapan').v);
    if (d.k === 'active') { v.active = el.checked; S.log('Vendor dikemas kini', `${v.name} → ${v.active ? 'aktif' : 'tidak aktif'}`); return saved(); }
    const val = el.value.trim();
    if (d.k === 'name') {
      const n = u.norm(val);
      if (!n) { el.value = v.name; return bad(el, 'Nama vendor diperlukan.'); }
      if (st().vendors.some((x) => x !== v && u.norm(x.name) === n)) { el.value = v.name; return bad(el, 'Nama vendor sudah wujud.'); }
      S.log('Vendor dinamakan semula', `${v.name} → ${n}`); v.name = n; el.value = n; ui.commit(); return saved();
    }
    if (val && !/^[0-9+\-\s]{6,20}$/.test(val)) { el.value = v.phone; return bad(el, 'Nombor telefon tidak sah.'); }
    v.phone = val; saved();
  };
  A.menuField = (d, el) => {
    const m = S.menu(d.id);
    if (d.k === 'active') {
      m.active = el.checked; el.closest('tr').classList.toggle('dim', !m.active);
    } else if (d.k === 'price') {
      const sen = u.toSen(el.value);
      if (sen == null || sen <= 0) { el.value = u.senToStr(m.price); return bad(el, 'Harga mesti nombor, cth. 3.60'); }
      m.price = sen; el.value = u.senToStr(sen);
    } else {
      const val = u.norm(el.value);
      if (!val) { el.value = m[d.k]; return bad(el, d.k === 'short' ? 'Nama lajur diperlukan.' : 'Nama item diperlukan.'); }
      if (d.k === 'name' && st().menus.some((x) => x !== m && u.norm(x.name) === val)) { el.value = m.name; return bad(el, 'Nama item ini sudah digunakan menu lain.'); }
      m[d.k] = val; el.value = val;
    }
    S.log('Menu dikemas kini', `${m.short} — ${m.name} @ ${u.rm(m.price)}${m.active ? '' : ' (tidak aktif)'}`);
    const pv = document.getElementById('col-preview'); if (pv) pv.innerHTML = colPreview(S.vendor(m.vendorId));
    saved();
  };
  A.menuAdd = () => {
    const v = S.vendor(ui.F('tetapan').v), $ = (id) => document.getElementById(id);
    const name = u.norm($('new-name').value), short = u.norm($('new-short').value) || shortOf(name), price = u.toSen($('new-price').value);
    if (!name) { $('new-name').focus(); return bad($('new-name'), 'Isi nama item seperti dalam borang BCL.'); }
    if (st().menus.some((x) => u.norm(x.name) === name)) return bad($('new-name'), 'Nama item ini sudah wujud.');
    if (price == null || price <= 0) { $('new-price').focus(); return bad($('new-price'), 'Isi harga, cth. 3.60'); }
    st().menus.push({ id: u.uid('M'), sku: '', vendorId: v.id, short, name, price, sort: S.vendorMenus(v.id).length, aliases: [], active: true });
    S.log('Menu ditambah', `${v.name}: ${short} — ${name} @ ${u.rm(price)}`);
    ui.commit(); saved(`${short} ditambah`);
    const n = document.getElementById('new-name'); if (n) n.focus();
  };
  A.menuDelete = async (d) => {
    const m = S.menu(d.id), n = usedBy(m);
    if (n) return ui.toast(`${m.short} sudah digunakan dalam ${n} pesanan — matikan "Aktif" sahaja supaya sejarah kekal.`, 'warn');
    if (!(await ui.confirm({ title: 'Padam menu?', text: `<b>${esc(m.short)}</b> — ${esc(m.name)} akan dipadam.`, danger: true, ok: 'Padam' }))) return;
    st().menus = st().menus.filter((x) => x !== m); S.vendorMenus(m.vendorId).forEach((x, k) => { x.sort = k; });
    S.log('Menu dipadam', `${m.short} — ${m.name}`); ui.commit();
  };
  A.menuAliasDel = (d) => {
    const m = S.menu(d.id), [a] = m.aliases.splice(+d.k, 1);
    S.log('Nama lain dibuang', `"${a}" daripada ${m.name}`); ui.commit(); saved();
  };
  A.menuCopy = () => {
    const v = S.vendor(ui.F('tetapan').v), others = st().vendors.filter((x) => x.id !== v.id && S.vendorMenus(x.id).length);
    ui.modal({
      title: 'Salin menu ke ' + v.name,
      body: `<p class="muted mb">Berguna bila vendor jual lauk yang sama. Harga dan susunan disalin; anda boleh ubah selepas itu.</p>
        <div id="cp-form" class="form-grid"><label class="field full"><span>Salin daripada</span><select name="src">${opts(others.map((x) => [x.id, `${x.name} (${S.vendorMenus(x.id).length} menu)`]))}</select></label>
        <label class="check"><input type="checkbox" name="retag" checked> Tukar nama vendor dalam kurungan kepada (${esc(v.name)})</label></div>`,
      foot: `<button class="btn" data-act="modalClose">Batal</button><button class="btn btn-primary" data-act="menuCopyDo">Salin</button>`,
    });
  };
  A.menuCopyDo = () => {
    const v = S.vendor(ui.F('tetapan').v), x = ui.formVals('#cp-form'), src = S.vendor(x.src);
    let n = 0;
    S.vendorMenus(src.id).forEach((m) => {
      const name = x.retag ? u.norm(m.name).replace(/\s*\(.*\)\s*$/, '') + ` (${v.name})` : u.norm(m.name);
      if (st().menus.some((y) => u.norm(y.name) === name)) return;
      st().menus.push({ id: u.uid('M'), sku: '', vendorId: v.id, short: m.short, name, price: m.price, sort: S.vendorMenus(v.id).length, aliases: [], active: true }); n++;
    });
    S.log('Menu disalin', `${n} menu dari ${src.name} ke ${v.name}`);
    ui.closeModal(); ui.commit(); ui.toast(n ? `${n} menu disalin dari ${src.name}.` : 'Tiada menu baharu untuk disalin (nama sudah wujud).', n ? 'ok' : 'warn');
  };

  // ---------- Ejen: inline-editable, new agents from BCL, bulk paste ----------
  function unknownAgents() {
    const m = {};
    st().orders.forEach((o) => {
      if (o.cancelled || S.agentOf(o)) return;
      const k = u.phoneKey(o.agentPhone) || u.norm(o.agentName);
      m[k] = m[k] || { name: u.norm(o.agentName), phone: o.agentPhone || '', n: 0 }; m[k].n++;
    });
    return Object.values(m);
  }
  function tabEjen(f) {
    const q = u.norm(f.aq || ''), area = f.area || '', counts = {}, ar = areas();
    st().orders.forEach((o) => { if (!o.cancelled) { const a = S.agentOf(o); if (a) counts[a.id] = (counts[a.id] || 0) + 1; } });
    const rows = st().agents.filter((a) => (!q || u.norm(a.name + ' ' + a.phone + ' ' + a.aliases.join(' ')).includes(q)) && (!area || (area === '-' ? !a.area : a.area === area)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const unk = unknownAgents();
    const areaInput = (attrs, val) => `<input class="cell" list="area-list" value="${esc(val || '')}" maxlength="40" placeholder="cth. KL" ${attrs}>`;
    return `<datalist id="area-list">${ar.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      ${unk.length ? `<section class="card attn"><div class="card-head"><h3>${ui.icon('alert')} Ejen baharu dari BCL <span class="count">${unk.length}</span></h3><span class="muted sm">No. HP ini ada dalam pesanan tetapi belum dalam senarai ejen.</span></div>
        <div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>Nama ditaip</th><th>No. HP</th><th class="r">Pesanan</th><th>Kawasan</th><th></th><th>atau padankan dengan</th><th></th></tr></thead><tbody>
        ${unk.map((x, i) => `<tr><td><b>${esc(x.name)}</b></td><td class="nowrap">${esc(x.phone || '—')}</td><td class="r">${x.n}</td>
          <td>${areaInput(`id="unk-area-${i}" aria-label="Kawasan"`)}</td><td><button class="btn btn-sm btn-primary" data-act="unkAdd" data-i="${i}">Tambah ejen</button></td>
          <td><select id="unk-merge-${i}" aria-label="Padankan dengan ejen"><option value="">— ejen sedia ada —</option>${st().agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></td>
          <td><button class="btn btn-sm" data-act="unkMerge" data-i="${i}">Padankan</button></td></tr>`).join('')}
        </tbody></table></div></section>` : ''}
      <div class="toolbar">
        <div class="actions"><input id="t-aq" type="search" class="search" placeholder="Cari nama atau No. HP…" value="${esc(f.aq || '')}" data-f="tetapan.aq">
          <div class="seg" role="group" aria-label="Kawasan">${[['', 'Semua'], ...ar.map((x) => [x, x]), ['-', 'Tiada kawasan']].map(([k, l]) => `<button class="${area === k ? 'on' : ''}" data-act="agentArea" data-a="${esc(k)}">${esc(l)}</button>`).join('')}</div></div>
        <div class="actions"><span id="save-state" class="save-state">Perubahan disimpan automatik</span><button class="btn" data-act="agentBulk">${ui.icon('copy')}Tampal senarai</button></div>
      </div>
      <div class="card p0"><div class="tbl-wrap"><table class="tbl edit">
        <thead><tr><th>Nama ejen</th><th class="w-phone">No. HP</th><th class="w-area">Kawasan</th><th>Nama lain di BCL <span class="muted">(pisah dengan koma)</span></th><th class="r w-n">Pesanan</th><th class="w-del"></th></tr></thead>
        <tbody>
          <tr class="add-row"><td><input id="na-name" class="cell" placeholder="+ Nama ejen baharu" maxlength="60" data-enter="agentAddInline" aria-label="Nama ejen baharu"></td>
            <td><input id="na-phone" class="cell" placeholder="012-345 6789" inputmode="tel" maxlength="20" data-enter="agentAddInline" aria-label="No. HP"></td>
            <td>${areaInput('id="na-area" data-enter="agentAddInline" aria-label="Kawasan"', area && area !== '-' ? area : '')}</td>
            <td colspan="3"><button class="btn btn-sm btn-primary" data-act="agentAddInline">Tambah</button></td></tr>
          ${rows.map((a) => `<tr>
            <td><input class="cell strong" value="${esc(a.name)}" maxlength="60" data-act-change="agentField" data-id="${a.id}" data-k="name" aria-label="Nama"></td>
            <td><input class="cell" value="${esc(a.phone || '')}" inputmode="tel" maxlength="20" placeholder="—" data-act-change="agentField" data-id="${a.id}" data-k="phone" aria-label="No. HP"></td>
            <td>${areaInput(`data-act-change="agentField" data-id="${a.id}" data-k="area" aria-label="Kawasan"`, a.area)}</td>
            <td><input class="cell" value="${esc(a.aliases.join(', '))}" placeholder="—" data-act-change="agentField" data-id="${a.id}" data-k="aliases" aria-label="Nama lain"></td>
            <td class="r">${counts[a.id] || 0}</td>
            <td><button class="icon-btn sm del" data-act="agentDelete" data-id="${a.id}" aria-label="Padam ejen">${ui.icon('x')}</button></td></tr>`).join('') || empty('Tiada ejen sepadan.', 6)}
        </tbody></table></div></div>
      <p class="muted xs">${rows.length} ejen dipaparkan · Ejen dipadankan kepada pesanan melalui No. HP dahulu, kemudian nama.</p>`;
  }
  A.agentArea = (d) => { ui.F('tetapan').area = d.a; ui.render(); };
  function agentCheck(a, k, val) {
    if (k === 'name') {
      if (!val) return 'Nama ejen diperlukan.';
      const dup = st().agents.find((x) => x !== a && (u.norm(x.name) === val || x.aliases.some((y) => u.norm(y) === val)));
      if (dup) return `Nama ini sudah digunakan oleh ${dup.name}.`;
    }
    if (k === 'phone' && val) {
      if (!u.phoneKey(val)) return 'No. HP tidak sah.';
      const dup = st().agents.find((x) => x !== a && u.phoneKey(x.phone) === u.phoneKey(val));
      if (dup) return `No. HP ini sudah digunakan oleh ${dup.name}.`;
    }
    return '';
  }
  A.agentField = (d, el) => {
    const a = st().agents.find((x) => x.id === d.id);
    let val = d.k === 'name' ? u.norm(el.value) : el.value.trim();
    const err = agentCheck(a, d.k, val);
    const cur = d.k === 'aliases' ? a.aliases.join(', ') : a[d.k] || '';
    if (err) { el.value = cur; return bad(el, err); }
    if (d.k === 'aliases') { a.aliases = val ? val.split(',').map((x) => x.trim()).filter(Boolean) : []; el.value = a.aliases.join(', '); }
    else { a[d.k] = val; el.value = val; }
    S.log('Ejen dikemas kini', `${a.name}: ${d.k} = ${d.k === 'aliases' ? a.aliases.join(', ') : val || '—'}`);
    saved();
  };
  A.agentAddInline = () => {
    const $ = (id) => document.getElementById(id), name = u.norm($('na-name').value), phone = $('na-phone').value.trim(), area = $('na-area').value.trim();
    const err = agentCheck(null, 'name', name) || agentCheck(null, 'phone', phone);
    if (err) return bad(name ? $('na-phone') : $('na-name'), err);
    st().agents.push({ id: u.uid('A'), name, phone, area, aliases: [] });
    S.log('Ejen ditambah', `${name}${phone ? ' · ' + phone : ''}${area ? ' · ' + area : ''}`);
    ui.commit(); saved(`${name} ditambah`);
    const n = document.getElementById('na-name'); if (n) n.focus();
  };
  A.unkAdd = (d) => {
    const x = unknownAgents()[+d.i], area = document.getElementById('unk-area-' + d.i).value.trim();
    const err = agentCheck(null, 'name', x.name);
    if (err) return ui.toast(err + ' Gunakan "Padankan" sebaliknya.', 'err');
    st().agents.push({ id: u.uid('A'), name: x.name, phone: x.phone, area, aliases: [] });
    S.log('Ejen ditambah', `${x.name} · ${x.phone} (dari pesanan BCL)`); ui.commit(); ui.toast(`${x.name} ditambah ke senarai ejen.`);
  };
  A.unkMerge = (d) => {
    const x = unknownAgents()[+d.i], id = document.getElementById('unk-merge-' + d.i).value;
    if (!id) return ui.toast('Pilih ejen sedia ada dahulu.', 'err');
    const a = st().agents.find((y) => y.id === id);
    if (u.norm(a.name) !== x.name && !a.aliases.some((y) => u.norm(y) === x.name)) a.aliases.push(x.name);
    if (!a.phone && x.phone) a.phone = x.phone;
    S.log('Ejen dipadankan', `"${x.name}" (${x.phone || 'tiada HP'}) → ${a.name}`); ui.commit(); ui.toast(`"${x.name}" kini dikira sebagai ${a.name}.`);
  };
  // Bulk paste: one agent per line — "NAMA, No. HP, Kawasan" (comma, tab or semicolon; copied from Excel works).
  function parseBulk(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name = '', phone = '', area = ''] = l.split(/\t|;|,/).map((x) => x.trim());
      const n = u.norm(name), byPhone = phone && st().agents.find((a) => u.phoneKey(a.phone) === u.phoneKey(phone));
      if (!n) return { line: l, status: 'err', msg: 'Tiada nama' };
      if (phone && !u.phoneKey(phone)) return { line: l, name: n, phone, area, status: 'err', msg: 'No. HP tidak sah' };
      if (byPhone) return { line: l, name: n, phone, area, status: 'upd', msg: 'Kemas kini ' + byPhone.name, agent: byPhone };
      const byName = st().agents.find((a) => u.norm(a.name) === n);
      if (byName) return { line: l, name: n, phone, area, status: 'upd', msg: 'Kemas kini ' + byName.name, agent: byName };
      return { line: l, name: n, phone, area, status: 'new', msg: 'Baharu' };
    });
  }
  const bulkPreview = (rows) => !rows.length ? '<p class="muted sm">Pratonton akan dipaparkan di sini.</p>'
    : `<p class="sm"><b>${rows.filter((r) => r.status === 'new').length}</b> baharu · <b>${rows.filter((r) => r.status === 'upd').length}</b> kemas kini · <b>${rows.filter((r) => r.status === 'err').length}</b> ralat (dilangkau)</p>
      <div class="tbl-wrap bulk"><table class="tbl"><tbody>${rows.slice(0, 50).map((r) => `<tr><td>${chip(r.status === 'new' ? 'ok' : r.status === 'upd' ? 'gray' : 'err', r.msg)}</td><td>${esc(r.name || r.line)}</td><td>${esc(r.phone || '')}</td><td>${esc(r.area || '')}</td></tr>`).join('')}</tbody></table></div>`;
  A.agentBulk = () => {
    ui.modal({
      title: 'Tampal senarai ejen', wide: true,
      body: `<p class="muted mb">Satu ejen setiap baris: <code>NAMA, No. HP, Kawasan</code>. Boleh salin terus dari Excel (3 lajur). No. HP yang sudah wujud akan dikemas kini, bukan digandakan.</p>
        <textarea id="bulk-text" rows="8" class="mono" placeholder="ADAM KL, 012-345 6789, KL&#10;MINIE, 013-222 3344, KL&#10;PASIR MAS, 019-555 6677, Kelantan"></textarea>
        <div id="bulk-preview" class="mt">${bulkPreview([])}</div>`,
      foot: `<button class="btn" data-act="modalClose">Batal</button><button class="btn btn-primary" data-act="agentBulkSave">Simpan semua</button>`,
      onInput: (ev) => { if (ev.target.id === 'bulk-text') document.getElementById('bulk-preview').innerHTML = bulkPreview(parseBulk(ev.target.value)); },
    });
  };
  A.agentBulkSave = () => {
    const rows = parseBulk(document.getElementById('bulk-text').value);
    let n = 0, m = 0;
    rows.forEach((r) => {
      if (r.status === 'new') { st().agents.push({ id: u.uid('A'), name: r.name, phone: r.phone, area: r.area, aliases: [] }); n++; }
      if (r.status === 'upd') { if (r.phone) r.agent.phone = r.phone; if (r.area) r.agent.area = r.area; m++; }
    });
    if (!n && !m) return ui.toast('Tiada baris yang sah.', 'err');
    S.log('Senarai ejen ditampal', `${n} baharu, ${m} dikemas kini`);
    ui.closeModal(); ui.commit(); ui.toast(`${n} ejen baharu, ${m} dikemas kini.`);
  };

  // Quick-add modal (used from Hari Ini "Perlu tindakan")
  function agentForm(a, name, phone) {
    ui.modal({
      title: 'Tambah ejen',
      body: `<div id="af" class="form-grid"><label class="field full"><span>Nama ejen</span><input name="name" value="${esc(name || '')}" maxlength="60"></label>
        <label class="field"><span>No. HP</span><input name="phone" inputmode="tel" value="${esc(phone || '')}" maxlength="20"></label>
        <label class="field"><span>Kawasan</span><input name="area" list="area-list2" maxlength="40" placeholder="cth. KL"><datalist id="area-list2">${areas().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <div id="form-errors" class="alert a-err full" hidden></div></div>`,
      foot: `<button class="btn" data-act="modalClose">Batal</button><button class="btn btn-primary" data-act="agentSave">Simpan</button>`,
    });
  }
  A.agentAdd = (d) => agentForm(null, d.name, d.phone);
  A.agentSave = () => {
    const x = ui.formVals('#af'), name = u.norm(x.name);
    const err = agentCheck(null, 'name', name) || agentCheck(null, 'phone', x.phone);
    if (!ui.showErrors(err ? [err] : [])) return;
    st().agents.push({ id: u.uid('A'), name, phone: x.phone, area: x.area, aliases: [] });
    S.log('Ejen ditambah', name); ui.closeModal(); ui.commit(); ui.toast('Ejen disimpan.');
  };
  A.agentDelete = async (d) => {
    const a = st().agents.find((x) => x.id === d.id);
    if (!(await ui.confirm({ title: 'Padam ejen?', text: `<b>${esc(a.name)}</b> akan dibuang daripada senarai ejen. Pesanan lama tidak dipadam (akan ditanda "baru").`, danger: true, ok: 'Padam' }))) return;
    st().agents = st().agents.filter((x) => x !== a); S.log('Ejen dipadam', a.name); ui.commit();
  };

  // ---------- Dev webhook inbox (api/webhook.php) ----------
  const API = 'api/webhook.php';
  const isHttp = () => typeof location !== 'undefined' && /^https?:/.test(location.protocol);
  function whCard() {
    const set = st().settings, info = V.whInfo;
    if (isHttp() && !info && !V.whInfoLoading) {
      V.whInfoLoading = true;
      fetch(API + '?action=info').then((r) => r.json()).then((j) => { V.whInfo = j; }).catch(() => { V.whInfo = { error: true }; }).finally(() => { V.whInfoLoading = false; ui.render(); });
    }
    const head = `<div class="card-head"><h3>Webhook ke mockup</h3>${V.whTimer ? chip('ok', 'Auto-semak aktif') : chip('gray', 'Auto-semak tutup')}</div>`;
    if (!isHttp()) return `<section class="card">${head}<div class="alert a-warn">Buka mockup melalui <b>http://localhost/NBK-Nasi%20bungkus%20kelantan/</b> (bukan file:///) untuk guna webhook.</div></section>`;
    if (info && info.error) return `<section class="card">${head}<div class="alert a-err">Fail <code>api/webhook.php</code> tidak dapat dicapai. Pastikan Apache XAMPP berjalan.</div></section>`;
    return `<section class="card">${head}
      <p class="muted sm nomargin">Khas untuk ujian (dev). BCL hantar → peti masuk → mockup import automatik. Pesanan sama tidak dikira dua kali.</p>
      <h4>Cara A · Tarik dari webhook.site</h4>
      <div class="row-input"><input id="wh-url" value="${esc(set.whUrl || '')}" placeholder="https://webhook.site/xxxxxxxx-xxxx-…" aria-label="URL webhook.site">
        <button class="btn btn-primary" data-act="whPull">Tarik sekarang</button></div>
      <h4>Cara B · Terima terus (perlukan ngrok)</h4>
      <div class="row-input"><input id="wh-local" readonly value="${esc(info ? info.local_url : 'memuatkan…')}" aria-label="URL webhook tempatan"><button class="btn" data-act="whCopy">${ui.icon('copy')}Salin</button></div>
      <p class="muted xs">BCL perlukan URL awam: jalankan <code>ngrok http 80</code>, kemudian gantikan <code>http://localhost</code> dengan URL https ngrok. URL ini mengandungi kunci rahsia — jangan kongsi.</p>
      <div class="wh-foot"><label class="switch"><input type="checkbox" ${V.whTimer ? 'checked' : ''} data-act-change="whAuto"><i></i><span>Semak peti masuk setiap 10 saat</span></label>
        <button class="btn btn-sm" data-act="whSync">Semak sekarang</button></div>
      <p class="muted xs">${V.whLast ? `Disemak ${V.whLast.at} · ${V.whLast.msg}` : 'Belum disemak.'}</p>
    </section>`;
  }
  async function syncInbox(quiet) {
    const set = st().settings, after = set.inboxSeq || 0;
    const j = await fetch(`${API}?action=list&after=${after}`).then((r) => r.json());
    const c = { processed: 0, duplicate: 0, ignored: 0, failed: 0 };
    (j.events || []).forEach((e) => { c[W.process(e.payload).status]++; });
    set.inboxSeq = j.last || after;
    const n = (j.events || []).length;
    const msg = n ? `${n} event: ${c.processed} diterima, ${c.duplicate} pendua, ${c.ignored} diabaikan, ${c.failed} gagal` : 'tiada event baharu';
    V.whLast = { at: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg };
    if (n) S.log('Peti masuk webhook disemak', msg);
    ui.commit();
    if (n || !quiet) ui.toast(c.processed ? `${c.processed} pesanan baharu dari BCL.` : 'Peti masuk: ' + msg, c.failed ? 'warn' : 'ok');
  }
  A.whSync = () => syncInbox(false).catch((e) => ui.toast('Gagal semak peti masuk: ' + e.message, 'err'));
  A.whPull = async () => {
    const el = document.getElementById('wh-url'), m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(el.value);
    if (!m) return bad(el, 'Tampal URL webhook.site yang sah.');
    st().settings.whUrl = el.value.trim(); S.save();
    try {
      const j = await fetch(`${API}?action=pull&token=${m[1]}`).then((r) => r.json());
      if (j.error) return ui.toast(j.error, 'err');
      if (!j.added) ui.toast(`Tiada webhook baharu di webhook.site${j.skipped_non_json ? ` (${j.skipped_non_json} permintaan bukan dari BCL diabaikan)` : ''}.`, 'warn');
      await syncInbox(!j.added);
    } catch (e) { ui.toast('Gagal: ' + e.message, 'err'); }
  };
  A.whAuto = (d, el) => {
    clearInterval(V.whTimer); V.whTimer = null;
    if (el.checked) { V.whTimer = setInterval(() => syncInbox(true).catch(() => {}), 10000); syncInbox(true).catch(() => {}); }
    ui.render();
  };
  A.whCopy = async () => { const v = document.getElementById('wh-local').value; try { await navigator.clipboard.writeText(v); ui.toast('URL disalin.'); } catch (e) { ui.toast(v, 'info'); } };

  function tabBcl(f) {
    const r = f.res, ev = st().events.slice().sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)).slice(0, 15);
    const EV = { processed: ['ok', 'Diterima'], duplicate: ['gray', 'Pendua'], ignored: ['gray', 'Diabaikan'], failed: ['err', 'Gagal'] };
    return `<div class="grid g-2">
      ${whCard()}
      <section class="card"><div class="card-head"><h3>Masukkan pesanan BCL (simulasi)</h3></div>
        <textarea id="bcl-json" rows="11" class="mono" spellcheck="false" data-bind="tetapan.json" placeholder='Tampal JSON dari BCL di sini…'>${esc(f.json || '')}</textarea>
        <div class="actions mt"><button class="btn" data-act="bclExample">Contoh pesanan</button><button class="btn" data-act="bclCheck">Semak</button>
          <button class="btn btn-primary" data-act="bclImport">Terima pesanan</button><button class="btn btn-ghost" data-act="bclClear">Kosongkan</button></div>
        ${r ? `<div class="alert a-${r.kind} mt"><b>${esc(r.title)}</b>${(r.lines || []).map((x) => '<div>• ' + esc(x) + '</div>').join('')}</div>` : ''}
      </section></div>
      <section class="card p0"><div class="card-head pad"><h3>Pesanan terakhir dari BCL</h3></div><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Masa</th><th>Jenis</th><th>No. BCL</th><th>Status</th><th>Catatan</th><th></th></tr></thead><tbody>
        ${ev.map((e) => `<tr><td class="nowrap">${u.fmtDT(e.receivedAt)}</td><td><code>${esc(e.type)}</code></td><td>${esc(e.sourceOrderId || '—')}</td><td>${chip(...EV[e.status])}</td>
          <td class="sm">${esc(e.error)}</td><td class="nowrap r"><button class="btn btn-sm" data-act="evView" data-id="${esc(e.id)}">Lihat</button>${e.status === 'failed' ? `<button class="btn btn-sm" data-act="evRetry" data-id="${esc(e.id)}">Cuba semula</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></section>`;
  }
  const bclParse = () => {
    const f = ui.F('tetapan'), el = document.getElementById('bcl-json'); if (el) f.json = el.value;
    if (!(f.json || '').trim()) return { err: 'Kotak kosong. Tampal JSON atau klik "Contoh pesanan".' };
    if (f.json.length > 100000) return { err: 'Data terlalu besar (had 100 KB).' };
    try { return { data: JSON.parse(f.json) }; } catch (e) { return { err: 'Format JSON rosak: ' + e.message }; }
  };
  A.bclExample = () => { const f = ui.F('tetapan'); f.json = JSON.stringify(W.example(), null, 2); f.res = null; ui.render(); };
  A.bclClear = () => { const f = ui.F('tetapan'); f.json = ''; f.res = null; ui.render(); };
  A.bclCheck = () => {
    const f = ui.F('tetapan'), p = bclParse();
    if (p.err) { f.res = { kind: 'err', title: p.err }; return ui.render(); }
    const n = W.normalise(p.data);
    if (!n.ok) { f.res = { kind: 'err', title: 'Data tidak lengkap', lines: n.errors }; return ui.render(); }
    const o = n.order, lines = o.items.map((i) => { const m = S.resolveMenu({ sku: i.sku, name: i.name }); return `${i.name} × ${i.qty} → ${m ? S.vendor(m.vendorId).name + ' · ' + m.short : 'TIDAK DIKENALI'}`; });
    const ag = S.agentOf(o);
    lines.unshift(`Ejen: ${ag ? ag.name : o.agentName + ' (baru)'} · No. HP: ${o.agentPhone || '—'} · Tarikh: ${dateTitle(u.myDate(o.date))}`);
    if (o.event !== 'payment-success') lines.unshift('Event ini bukan bayaran berjaya — akan diabaikan.');
    if (W.seen(W.fingerprint(o))) lines.unshift('Pesanan ini SUDAH diterima — tidak akan dikira dua kali.');
    f.res = { kind: 'info', title: `Sah — pesanan ${o.orderId} (${o.event})`, lines: [...lines, ...n.warnings] };
    ui.render();
  };
  A.bclImport = () => {
    const f = ui.F('tetapan'), p = bclParse();
    if (p.err) { f.res = { kind: 'err', title: p.err }; return ui.render(); }
    const r = W.process(p.data);
    f.res = { kind: r.status === 'processed' ? 'ok' : r.status === 'duplicate' ? 'warn' : 'err', title: r.message, lines: r.status === 'failed' ? [] : r.result.warnings };
    ui.commit(); ui.toast(r.message, f.res.kind === 'ok' ? 'ok' : f.res.kind);
  };
  A.evView = (d) => {
    const e = st().events.find((x) => x.id === d.id);
    ui.modal({ title: `${e.type} · ${e.sourceOrderId || e.id}`, wide: true, body: `${e.error ? `<div class="alert a-warn">${esc(e.error)}</div>` : ''}<pre class="code">${esc(JSON.stringify(e.payload, null, 2))}</pre>`,
      foot: '<button class="btn" data-act="modalClose">Tutup</button>' });
  };
  A.evRetry = (d) => {
    const e = st().events.find((x) => x.id === d.id), r = W.process(e.payload, e);
    ui.commit(); ui.toast(r.status === 'processed' ? r.message : 'Masih gagal: ' + r.message, r.status === 'processed' ? 'ok' : 'err');
  };

  function tabLog() {
    return `<div class="card p0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Masa</th><th>Tindakan</th><th>Butiran</th></tr></thead><tbody>
      ${st().logs.map((l) => `<tr><td class="nowrap">${u.fmtDT(l.at)}</td><td><b>${esc(l.action)}</b></td><td class="sm">${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function tabData() {
    return `<section class="card"><h3>Data demo</h3><p>Semua data ialah contoh dan disimpan dalam pelayar ini sahaja (bukan pangkalan data sebenar). Kuantiti dijana secara rawak.</p>
        <button class="btn btn-danger" data-act="resetDemo">Set semula data demo</button></section>`;
  }
  A.resetDemo = async () => {
    if (!(await ui.confirm({ title: 'Set semula data demo?', text: 'Semua perubahan akan dipadam dan data contoh asal dipulihkan.', danger: true, ok: 'Set semula' }))) return;
    S.reset(); V.f = {}; V.date = u.todayMY(); try { sessionStorage.removeItem('nbk-date'); } catch (e) { /* ignore */ }
    location.hash = '#/hari-ini'; ui.render(); ui.toast('Data demo dipulihkan.');
  };
})(globalThis.NBK = globalThis.NBK || {});
