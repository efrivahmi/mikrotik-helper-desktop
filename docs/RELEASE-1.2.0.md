# Rilis 1.2.0 — konfigurasi dan backup wajib

## Perubahan

- Halaman Konfigurasi: 26 paket, 132 menu baca dan 129 editor mutasi; semua pilihan perangkat/record dari evidence SSH.
- Compiler menghasilkan apply, rollback, kondisi awal, selector unik dan verifikasi count/get bertipe.
- Pengaturan management/IP/VLAN, DHCP, ISP/PCC/failover, PCQ/QoS, firewall/NAT/RAW, HotSpot, WiFi/CAPsMAN, VPN dan IPv6 tersedia sesuai versi/package/hardware.
- Profil kebutuhan dapat disimpan, diimpor/ekspor dan digunakan pada router lain tanpa membawa credential atau rollback lama.
- Backup baru sebelum apply/rollback: export tersamarkan + biner AES-SHA256, dua unduhan SCP dengan SHA256 cocok, fsync dan pembacaan ulang lokal. Gagal backup menghentikan import.
- Credential rencana memakai vault; file review/ekspor berisi placeholder. File import sementara dibersihkan setelah pekerjaan bila koneksi tersedia.
- Tool agent dapat membaca catalog/menu dan menyusun paket tanpa credential melalui compiler. Grant tetap diberikan admin di UI.

## Status bukti

Typecheck dan build/package dilakukan. Suite test aplikasi, interaksi UI, native Windows dan eksekusi fitur baru pada RouterOS tidak dijalankan pada pekerjaan ini. Invada sedang di luar jangkauan jaringan pengguna dan tidak diberi perubahan. Karena itu rilis tidak diklaim telah lolos produksi pada seluruh perangkat/versi.

Backup sebelum edit: `Documents/mikrotik-desktop-repair/20261011T081033Z/`, berisi source/build lama dan SQLite konsisten. Arsip sudah diperiksa SHA256/struktur; quick_check database backup mengembalikan `ok`.

Lihat [panduan dan batas fitur](AUTOMATION.md) serta [operasi](OPERATIONS.md). Installer Windows belum ditandatangani publisher. System backup tidak mencakup database User Manager/The Dude dan file portal/custom assets; restore perangkat/versi yang sesuai harus diuji terpisah sebelum diperlukan.
