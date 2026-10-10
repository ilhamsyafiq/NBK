# NBK-Nasi bungkus kelantan

## Stack
Static HTML mockup (no build step) of NBK EXPRESS. URL: http://localhost/NBK-Nasi%20bungkus%20kelantan/
- Core job: BCL orders per agent → per-vendor list (agent rows × vendor menu short-name columns, JUM, harga, TOTAL RM), styled after the owner's "LIST KNB" PDF report (KNB = a vendor; its 9 columns/prices are seeded exactly from that PDF). Keep the UI simple — the owner rejected an earlier feature-heavy version as too complex.
- Plain JS, global `NBK`, load order in `index.html`: util → data → store → webhook → app → pages.
- Pages in `pages.js`: dashboard (default), hari-ini, senarai (+ sub-pages vendor-menu, ejen — nested under "Senarai Vendor" in the sidebar via NAV's 4th element), pesanan, rekonsiliasi, tetapan (BCL, Log, Data demo). Buttons `data-act` → `NBK.act[name]`; filters `data-f="page.key"`.
- UI text Bahasa Melayu. Money = integer sen (`NBK.u.toSen`/`rm`). All rendered data through `esc()`.
- Demo state in localStorage key `nbk-express-demo-v7` (bump the key when seed data changes).

- `api/webhook.php` = dev-only webhook inbox (POST ?k=secret, GET info/list/pull from webhook.site). Never treat as production.
- Real BCL test form: id 18624 on fique.bcl.my (bcl MCP). Import JSON format = BCL's own form export (`exports/`); fixture of a real transaction in `tests/fixtures/`.

## Run / test
- `node tests/check.js` — logic checks. Bump `?v=` in `index.html` after CSS/JS edits.
- Browser QA: browser-automation skill against the URL above (keep trailing slash).

## Environment
- Windows 11, XAMPP: Apache :80, MariaDB :3306 (root, no password), PHP at C:\xampp\php\php.exe
- No backend yet; next phase = Laravel 12 + Filament 4 with a real BCL webhook endpoint (see README).
