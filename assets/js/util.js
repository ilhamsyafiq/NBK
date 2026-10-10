/* NBK EXPRESS — shared helpers (money, dates, escaping, export, dialogs). */
(function (NBK) {
  'use strict';

  // ---- Escaping: every piece of data rendered into HTML goes through esc() ----
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

  // ---- Money: integer sen everywhere, never floats ----
  // Accepts "3.30", "3.3", "3", 3, 3.3 (number converted via fixed string). Returns null when invalid.
  function toSen(v) {
    if (v == null || v === '') return null;
    let s = typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(2) : '') : String(v).trim();
    s = s.replace(/^RM\s*/i, '').replace(/,/g, '');
    const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) return null;
    const sen = parseInt(m[2], 10) * 100 + parseInt((m[3] || '0').padEnd(2, '0'), 10);
    return m[1] ? -sen : sen;
  }
  function senToStr(sen) {
    const neg = sen < 0; sen = Math.abs(sen);
    return (neg ? '-' : '') + Math.floor(sen / 100) + '.' + String(sen % 100).padStart(2, '0');
  }
  function rm(sen) {
    if (sen == null) return '—';
    const s = senToStr(sen).split('.');
    return 'RM ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
  }
  const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---- Dates: business dates are Malaysia time (UTC+8), stored as YYYY-MM-DD ----
  function myDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
  }
  function todayMY() { return myDate(new Date().toISOString()); }
  function addDays(ymd, n) {
    const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  }
  const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const dayName = (ymd) => HARI[new Date(ymd + 'T00:00:00Z').getUTCDay()];
  function fmtDT(iso) {
    if (!iso) return '—';
    const d = new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString();
    return `${fmtDate(d.slice(0, 10))} ${d.slice(11, 16)}`;
  }
  // BCL webhook dates are Malaysia time "DD/MM/YYYY HH:MM:SS" (docs.bcl.my/webhook-payment-form). ISO strings pass through.
  function fromBclDate(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || '').trim());
    if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}+08:00`;
    // BCL API (get_transaction_by_order) uses "YYYY-MM-DD HH:MM:SS", also Malaysia time
    const n = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || '').trim());
    return n ? `${n[1]}-${n[2]}-${n[3]}T${n[4]}:${n[5]}:${n[6] || '00'}+08:00` : s;
  }
  const toBclDate = (iso) => { const d = new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 19)}`; };
  // ISO string with +08:00 offset for a business date + HH:MM
  const isoMY = (ymd, hm) => `${ymd}T${hm}:00+08:00`;

  // Malaysian phone → '01xxxxxxxx' so +60 12-345 6789 and 012-3456789 match. '' when too short.
  function phoneKey(p) {
    let d = String(p == null ? '' : p).replace(/\D/g, '');
    if (d.startsWith('60')) d = d.slice(1); else if (d && !d.startsWith('0')) d = '0' + d;
    return d.length >= 9 ? d : '';
  }
  const norm = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toUpperCase();
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---- Export ----
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  function download(name, content, mime) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const downloadCSV = (name, rows) => download(name, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
  // Excel opens an HTML table saved as .xls (shows a format warning). ponytail: swap for SheetJS when real .xlsx is needed.
  function downloadXLS(name, title, rows) {
    const body = rows.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('');
    const html = `<html><head><meta charset="utf-8"></head><body><h3>${esc(title)}</h3><table border="1">${body}</table></body></html>`;
    download(name, '﻿' + html, 'application/vnd.ms-excel');
  }

  NBK.u = { fromBclDate, toBclDate, phoneKey, dayName, esc, toSen, senToStr, rm, num, myDate, todayMY, addDays, fmtDate, fmtDT, isoMY, norm, uid, toCSV, downloadCSV, downloadXLS, download };
})(globalThis.NBK = globalThis.NBK || {});
