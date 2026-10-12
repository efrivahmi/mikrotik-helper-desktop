# Rilis 1.4.0 — Quick Setup dan panduan koneksi

- Pilihan kebutuhan: rumah/toko, kantor, sekolah/kampus, HotSpot/tamu, cabang dan custom.
- Desain LAN bersama, jaringan berbeda per port, atau VLAN access/trunk; port berasal dari pembacaan Ethernet router.
- Pola IP privat, pemeriksaan bentrok dan kandidat rentang DHCP, DNS resmi/terbaca, ISP DHCP/static/PPPoE, firewall IPv4, isolasi, PCQ/Simple Queue dan HotSpot.
- Jaringan existing dapat dipakai tanpa mengganti IP/DHCP. Jalur management serta port yang sudah digunakan tidak dipindahkan otomatis.
- Panduan kabel/VPN → IP/SSH di WinBox → akun aplikasi → host key/autentikasi → konfigurasi terbaca. Perbaikan mengikuti error nyata.
- Komposisi melewati compiler/engine yang sama; backup baru dan grant tetap wajib. Profil reusable membuang password.
- 163 skill bawaan: 132 inspect, 26 paket, satu Quick Setup dan empat skill awal. Skill pengguna yang sudah ada tetap dipertahankan.

Backup sebelum perubahan: `Documents/mikrotik-desktop-repair/20261012T024439Z/`, source/build 1.3.0 serta SQLite konsisten. Arsip 222 berkas dibaca ulang; quick_check backup database `ok`; checksum dicatat.

Status bukti: typecheck, build dan packaging dilakukan. Tidak menjalankan suite test, pengujian UI, Windows native atau penerapan konfigurasi di router produksi dalam pekerjaan ini. Tidak ada perubahan Invada. Source dan distribusi bukan sertifikasi MTCNA/IEEE/RFC atau bukti seluruh kombinasi layanan telah lolos produksi.

Lihat [panduan Quick Setup](QUICK-SETUP.md), [aturan](STANDARDS.md), dan [backup/eksekusi](AUTOMATION.md).
