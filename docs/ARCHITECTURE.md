# Arsitektur

## Komponen

Renderer React menyediakan tampilan dan menerima data terstruktur melalui preload. Renderer tidak memiliki akses Node.js atau credential. Preload mengekspos daftar operasi IPC terbatas. Main process memvalidasi asal frame IPC dan payload Zod, kemudian menjalankan orchestrator.

Orchestrator bertanggung jawab atas inventory, satu pekerjaan per router, pemilihan diagnostik, backup, review, persetujuan, verifikasi, serta pemulihan proses terputus. Transport memakai `ssh2` langsung sehingga Windows tidak membutuhkan SSH executable atau Python terpisah. Upload memakai protokol SCP lama yang juga dipakai helper sebelumnya. Implementasi SSH mengikuti [API ssh2](https://github.com/mscdex/ssh2).

SQLite menyimpan inventory, skill, snapshots, rencana, metadata pekerjaan, percakapan, dan audit. File export backup ditulis terpisah dengan permission privat pada OS yang mendukungnya. WAL dan synchronous FULL digunakan agar penyimpanan pekerjaan konsisten. Audit lokal dapat diedit pemilik komputer; ia tidak dimaksudkan sebagai ledger yang tahan manipulasi.

Pembaruan UI membaca SQLite setiap 2,5 detik. Payload ringkasan hanya membawa evidence penuh snapshot terkini pada router yang dipilih; sampel lain membawa metrik. Hasil pekerjaan penuh dimuat ketika dialog detail dibuka. Query histori dibatasi agar arsip besar tidak selalu diparsing seluruhnya. Semua arsip tetap tersimpan untuk ekspor laporan.

## Batas kepercayaan

- BrowserWindow menggunakan sandbox, context isolation, tanpa nodeIntegration; popup, navigasi eksternal dan permission browser ditolak. Pola ini mengikuti [panduan keamanan Electron](https://www.electronjs.org/docs/latest/tutorial/security).
- Host SSH dipin dengan SHA256 fingerprint. Host yang berubah ditolak; trust baru harus berasal dari probe aplikasi dan persetujuan admin.
- Password/passphrase/API key disimpan dengan safeStorage saat keyring OS tersedia. Backend `basic_text` Linux tidak dipakai untuk persistence. Credential sesi disimpan di memori. Private key dibaca dari path yang dipilih pengguna, bukan disalin ke distribusi.
- Diagnostik menggunakan grammar sederhana untuk menu `print` serta fixed property `get` non-secret yang disetujui. Script, rangkaian perintah, ekspresi, `print file`, dan subscriptions ditolak.
- Rencana mutasi mempunyai hash isi dan target koneksi. Persetujuan harus menyebut nama router dan prefiks hash yang ditampilkan.
- Model memiliki tool pembacaan catalog/menu, compiler proposal paket, `diagnose` dan `propose_change`; tool apply/rollback tidak diberikan. Tool request dan script hasil model melewati validasi backend yang sama.
- Log dan konfigurasi perangkat dianggap sebagai data tidak tepercaya, bukan instruksi agent.

## Status pekerjaan dan rencana

Pekerjaan: `running → done | failed`. Proses yang ditemukan masih `running` saat aplikasi dibuka kembali berubah menjadi `failed` dengan catatan proses terputus.

Rencana: `draft → applying → applied | needs-review | unknown`. Rollback yang disetujui menjalankan backup baru lalu `rolling-back → rolled-back | needs-review | unknown`. Rencana yang ditemukan sedang berubah saat startup ditandai `unknown`.

`applied` berarti seluruh pemeriksaan target rencana cocok dan snapshot inti selesai. Kualitas klaim ini bergantung pada verifikasi yang ditulis admin. Pengecekan yang hanya memeriksa koneksi tidak membuktikan konfigurasi target.

## Pengembangan berikutnya

Compiler automation 1.2.0 mendukung paket/formulir dan editor menu dengan count/property checks bertipe, precondition serta rollback. Transfer backup menggunakan SCP dan hash dua pembacaan. Prioritas berikutnya adalah adapter REST RouterOS 7, backup khusus User Manager/The Dude, dan pengujian perangkat nyata/Windows native untuk setiap kombinasi paket/hardware. Masing-masing dapat ditambahkan lewat engine/adapter tanpa memberi renderer akses SSH langsung. Distribusi signed Windows membutuhkan sertifikat publisher milik pemilik project.
