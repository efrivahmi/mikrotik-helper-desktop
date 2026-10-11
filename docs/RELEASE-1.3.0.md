# Rilis 1.3.0 — aturan dan pengaturan sederhana

- Alur tiga tahap: akses router, isi kebutuhan, periksa aturan.
- Alamat/prefix terpisah, satuan Mbps/kbps/Gbps, label properti serta pilihan Ya/Tidak/interface.
- Kandidat rentang DHCP dari subnet/alokasi yang terbaca, DNS router dan sumber sesi SSH dapat disalin bila tersedia.
- Pemeriksaan backend paket/editor satuan memakai acuan materi MTCNA, RFC dan implementasi RouterOS. Error menghentikan compiler; peringatan terikat grant/hash dan memerlukan pengakuan.
- Kondisi terbaru diperiksa ulang sebelum backup/import. Operasi validasi yang disimpan tidak membawa password; backup sebelum apply maupun rollback tetap wajib.
- Skill paket berisi sumber/versi aturan. Pengaturan dan skill yang sudah diedit pengguna tetap dipertahankan.

Backup sebelum edit berada di `Documents/mikrotik-desktop-repair/20261011T101457Z/`: source/build 1.2.0 dan SQLite konsisten. Arsip 215 berkas telah dibaca ulang, checksum dicatat, quick_check backup database `ok`.

Status bukti: typecheck/build dan packaging dilakukan; suite test, interaksi UI, Windows native dan penerapan konfigurasi pada RouterOS belum dilakukan pada pekerjaan ini. Tidak ada konfigurasi Invada yang diubah. Rilis tidak diklaim bersertifikasi MTCNA/IEEE/RFC atau telah lolos produksi pada seluruh perangkat.

Lihat [panduan aturan](STANDARDS.md) dan [alur konfigurasi](AUTOMATION.md). Installer Windows belum ditandatangani publisher.
