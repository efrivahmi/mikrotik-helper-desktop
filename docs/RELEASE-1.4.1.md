# Rilis 1.4.1 — awal aplikasi tanpa router

- Workspace baru membuka **Panduan koneksi** dengan daftar router kosong. Formulir nama, IP, username, key dan password kosong; port SSH awal tetap 22 sebagai nilai layanan, bukan perangkat contoh.
- Daftar Router aktif dinonaktifkan ketika kosong. Pilihan router lama di localStorage dibuang ketika tidak ada router terpilih.
- Label identity tidak memakai nama router pribadi. Impor helper selalu melalui pilihan pengguna.
- Router yang disimpan pengguna tetap ada setelah aplikasi ditutup atau diperbarui. Tidak ada reset inventory pada setiap startup dan tidak ada perubahan konfigurasi router.

Atas permintaan pemilik, workspace lokal komputer pengembang dikosongkan dari inventory dan data router terdahulu. Profil lama, termasuk cache/riwayat lokal, diarsipkan privat terlebih dahulu; skill/pengaturan/profil reusable global dipertahankan bila ada. Backup dan arsip ini di luar repository serta paket distribusi. Helper Python asal tetap dipertahankan. Pemulihan profil lama dapat mengembalikan daftar router; bukan perilaku instalasi baru.

Backup sebelum perubahan: `Documents/mikrotik-desktop-repair/20261012T051450Z/`. Source/build terpasang 1.4.0 dibaca ulang, dan salinan database dibuat melalui backup API SQLite dengan quick_check `ok`. Checksum, pengarsipan profil lama, versi paket dan hitungan inventory akhir dicatat di direktori tersebut.

Typecheck/build dan packaging dilakukan untuk Linux/Windows. Suite test, interaksi UI, Windows native dan eksekusi RouterOS tidak dijalankan pada pekerjaan ini. Perubahan ini tidak membuktikan layanan jaringan telah lolos produksi.
