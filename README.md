# NBK EXPRESS — Pesanan & Vendor (prototaip)

Sistem untuk admin dan staf NBK Express (Nasi Berlauk Kelantan): kumpul pesanan ejen daripada **BCL.my**, kemudian susun ikut **vendor** supaya admin tahu berapa perlu dipesan daripada setiap vendor dan siapa yang order. Senarai vendor mengikut format laporan "LIST KNB" sedia ada (nama ejen × menu, JUM, harga, TOTAL RM).

**Semua kuantiti ialah data demo rawak.** Tiada pelayan, pangkalan data atau sambungan sebenar.

## Jalankan
- XAMPP: <http://localhost/NBK-Nasi%20bungkus%20kelantan/> (garis miring akhir diperlukan).
- Semakan logik: `node tests/check.js`
- Selepas edit CSS/JS, naikkan `?v=` dalam `index.html`.

## Halaman
| Menu | Fungsi |
|---|---|
| **Dashboard** | Ringkasan keseluruhan 7 / 14 / 30 hari: pesanan, pcs, nilai, ejen aktif, carta pcs sehari, ikut vendor, 10 ejen teratas, status harian (bayaran disahkan, senarai dihantar, rekonsiliasi). Klik hari untuk buka Hari Ini. |
| **Hari Ini** | Ringkasan hari dipilih, item/ejen yang perlu tindakan, kad setiap vendor (pcs, RM, status dihantar). |
| **Senarai Vendor** | Jadual seperti laporan LIST sedia ada untuk satu vendor; tapis kawasan (KL/Kelantan); Cetak/PDF, Excel, Salin untuk WhatsApp, Tanda sudah dihantar (amaran jika berubah selepas dihantar). Klik nama ejen untuk lihat pesanannya. |
| **Pesanan** | Semua pesanan BCL untuk tarikh dipilih; tapis Perlu semakan / Dibatalkan; buka pesanan untuk padankan item atau batalkan. |
| **Rekonsiliasi** | Tarik transaksi BCL untuk tarikh dipilih dan banding dengan pesanan dalam sistem ikut no. pesanan BCL: Sepadan / Amaun berbeza / Tiada dalam sistem (webhook terlepas — butang Import) / Tiada di BCL (mungkin palsu) / Dibayar tapi dibatalkan. Tandakan selesai (sebab wajib jika masih ada isu), CSV. Dalam prototaip tarikan ini simulasi. |
| **Senarai Vendor → Vendor & Menu** | Edit terus dalam jadual (simpan automatik): nama lajur (dijana automatik jika kosong), nama item dalam borang BCL, harga, aktif, susunan. Pratonton lajur senarai, salin menu dari vendor lain, tambah vendor/menu dengan Enter. Menu yang sudah dipesan tidak boleh dipadam (matikan Aktif). |
| **Senarai Vendor → Ejen** | Edit terus dalam jadual: nama, No. HP, kawasan, nama lain. Panel "Ejen baharu dari BCL" (Tambah / Padankan dengan ejen sedia ada), tapis kawasan, Tampal senarai dari Excel (NAMA, No. HP, Kawasan) dengan pratonton. |
| **Tetapan** | Sambungan BCL (simulasi), Log, Data demo. |

## Cara pesanan dikira
- Item BCL dipadankan kepada menu melalui **SKU**, atau **nama item** sama dengan "Nama dalam borang", atau nama yang pernah dipadankan secara manual.
- Item yang tidak dikenali tidak masuk mana-mana senarai dan dipaparkan dalam "Perlu tindakan" sehingga dipadankan.
- Ejen mengisi Nama, Emel dan No. HP sendiri dalam borang. Ejen dipadankan **ikut No. HP dahulu** (format +60 / 0 / sengkang tidak penting), kemudian nama. Nama yang ditaip berbeza dipaparkan sebagai "ditaip: ...".
- No. HP yang belum ada dalam senarai ejen tetap dikira (ditanda "baru") dan dipaparkan di "Perlu tindakan".
- **Hanya pesanan yang sudah dibayar dikira**: event `payment-success` sahaja; `form-submit` / `payment-failed` diabaikan. Pesanan dibatalkan oleh admin tidak dikira.
- **Waktu pesanan** (brief: borang dibuka 10:00 PG – 3:00 PTG, senarai dikunci 3:00 PTG; boleh ubah di Tetapan → Waktu pesanan). Pesanan yang dibayar di luar waktu ditanda **Lewat**, tidak dikira, dan dipaparkan di "Perlu tindakan" — admin pilih *Masukkan hari ini* atau *Pindah ke esok*.
- Satu pesanan boleh mengandungi item dari beberapa vendor (satu borang); sistem pecahkan item ke senarai setiap vendor.
- Kawasan (KL/Kelantan) datang daripada rekod ejen, jadi satu borang untuk semua kawasan sudah memadai.
- No. pesanan BCL ialah identiti pesanan; event yang sama dihantar dua kali tidak dikira dua kali.
- Wang dikira dalam sen (integer), bukan perpuluhan terapung.
- **Bukti bayaran** dalam setiap pesanan: gateway, no. transaksi, rujukan bank/FPX, kaedah, amaun dibayar vs jumlah pesanan, masa bayar, masa disahkan. Status: Disahkan / Belum disahkan / Amaun tak sepadan (masuk "Perlu tindakan"). Dalam prototaip pengesahan ialah **simulasi**; sistem sebenar akan menyemak setiap transaksi dengan API BCL (dan BayarCash jika perlu) secara automatik.

## Uji dengan BCL sebenar
Prototaip statik tidak boleh menerima webhook. Untuk menguji format sebenar:
1. Buka webhook.site, salin URL, dan masukkan dalam tetapan webhook borang BCL.
2. Buat pesanan ujian, salin JSON yang diterima.
3. Tetapan → Sambungan BCL → tampal → **Semak** → **Terima pesanan**.

## Borang BCL
- Borang import: `exports/bcl-import-nbk-pesanan.json` (dijana daripada fail eksport BCL sebenar; satu kumpulan variation setiap vendor, SKU = SKU menu dalam sistem). Diimport sebagai borang 18624 di fique.bcl.my, webhook `payment-success` → webhook.site (ujian).
- Contoh transaksi sebenar (disamarkan) untuk ujian: `tests/fixtures/bcl-LINK-522868.json`.

## Webhook ujian (dev sahaja)
`api/webhook.php` (PHP, XAMPP) — peti masuk webhook untuk mockup. Buka mockup melalui http://localhost (bukan file:///) → Tetapan → Sambungan BCL.
- **Cara A:** BCL hantar ke webhook.site → klik *Tarik sekarang* (PHP baca API webhook.site; pelayar tidak boleh kerana tiada CORS).
- **Cara B:** BCL hantar terus ke `api/webhook.php?k=<rahsia>` melalui URL awam (ngrok). Kunci dalam `api/data/secret.txt` (dijana automatik, folder `api/data` disekat oleh .htaccess). Awas: `ngrok http 80` mendedahkan seluruh htdocs.
- Auto-semak setiap 10 saat; pendua tidak dikira dua kali. **Bukan endpoint produksi.**

## Fasa seterusnya (sistem sebenar)
- Backend Laravel 12 + Filament 4 + MariaDB, dihoskan di pelayan (RunCloud).
- Endpoint `POST /api/integrations/webhooks/bcl/{rahsia}`: had saiz, simpan event mentah, kekangan unik (no. pesanan + event), proses melalui queue.
- Webhook BCL **tidak ditandatangani dan tidak dicuba semula** → URL rahsia sukar diteka, sahkan bayaran melalui API BCL, rekonsiliasi harian untuk pesanan yang terlepas.
- Kunci API disimpan terenkripsi di skrin tetapan admin, bukan dalam kod. Log audit di pelayan.

## Perlu disahkan oleh NBK
1. ~~Waktu tutup~~ — 10:00 PG–3:00 PTG (brief NBK-Order-Flow). Belum: tarikh hantar = esok (+1 hari) dan hari tanpa hantaran.
2. ~~Nama medan payload BCL~~ — **disahkan** dengan transaksi sebenar LINK-522868 (borang BCL 18624): `payer_name` / `payer_email` / `payer_telephone_number`, item = kumpulan vendor, `option` = menu, `sku` = MENU-xxx, `discount_amount` + `coupon_code`, `receipt_url`. Pengesahan bayaran boleh dibuat melalui API BCL (`get_transaction` ikut no. pesanan) — tiada integrasi BayarCash berasingan diperlukan.
3. "TNB" dalam borang = TENGKU NOOR? KNB tiada dalam borang OnPay contoh — apakah nama item KNB dalam borang BCL?
4. Menu dan harga bagi vendor lain (DEPEY TANGGO, KAKAK AISYAH, dll.).
