# Status paket 1.1.1 — 11 Oktober 2026

Perbaikan ini mengganti paket lokal 1.0.0 yang masih digunakan shortcut. TypeScript dan build renderer/main/preload berhasil. Pengujian otomatis tidak dijalankan pada sesi perbaikan ini; hasil versi 1.0.0 di bawah adalah catatan historis.

Invada 192.168.140.1:22 menghasilkan timeout pada pemeriksaan TCP. Pemilik mengonfirmasi sedang berada di luar lokasi router dan belum mempunyai koneksi ke jaringan tersebut. Autentikasi SSH, data monitoring, skill, backup router, apply/rollback, dan pemerataan bandwidth pada router nyata belum dapat dibuktikan dari sesi ini. Tidak ada konfigurasi router yang diubah.

Rincian perbaikan dan batas verifikasi tersedia di [catatan perbaikan](REPAIR-20261011.md).

---

# Hasil validasi versi 1.0.0

Tanggal: 5 Oktober 2026. Lingkungan build: Pop!_OS Linux x64, Node 22.23.3, Electron 44.5.1.

## Pemeriksaan yang berhasil

- TypeScript typecheck dan build renderer/main/preload.
- **18 pengujian backend**: batas diagnostik read-only, redaksi credential, review risiko, hash plan, ikatan router, kondisi awal, backup gagal, apply/rollback dengan backup terpisah, verifikasi target, larangan retry import ambigu, pemeriksaan ulang, mismatch identity, pemulihan startup, serta tool loop model.
- Server SSH lokal untuk uji host fingerprint, pinning, hasil command, failure output, dan transfer SCP. Tidak menggunakan router produksi.
- API model lokal simulasi untuk tool calling: diagnose dan propose_change berhasil; permintaan apply_change ditolak. Tidak menggunakan layanan AI berbayar atau mengirim evidence produksi.
- Pengujian GUI Electron untuk delapan halaman, CRUD inventory, penolakan mutasi dari diagnostik, pembuatan draft, dan penolakan persetujuan yang tidak cocok.
- Aplikasi Linux terkemas berhasil diluncurkan; SQLite, resource skill, dan preload termuat. Node require tidak tersedia pada renderer.
- Build installer NSIS Windows x64, portable Windows x64, serta AppImage Linux x64.
- Paket app.asar diperiksa: tidak memuat routers.json pribadi, known_hosts, key Invada, database pengguna, atau native addon yang dibangun untuk OS yang berbeda.
- `npm audit --omit=dev`: tidak ada vulnerability yang dilaporkan pada dependensi produksi ketika diperiksa. Ini tidak menyatakan aplikasi bebas dari seluruh kelemahan.

Screenshot dan fixture demonstrasi dari validasi historis telah dikeluarkan dari workspace operasional. Aplikasi tidak memuat snapshot contoh.

## Pemeriksaan yang belum tersedia

Invada `192.168.140.1:22` mengalami timeout jaringan pada tanggal pemeriksaan. Helper lama dan probe SSH aplikasi baru sama-sama tidak mendapat koneksi. Karena itu kemampuan RouterOS produksi belum diuji ulang melalui aplikasi desktop, dan tidak ada apply/rollback yang dilakukan pada router produksi.

Windows `.exe` berhasil dibangun dari Linux. Startup, instalasi, keyring, dan koneksi router pada Windows native belum diuji. Build tidak ditandatangani sertifikat publisher. Model eksternal/Ollama nyata perlu dikonfigurasi pengguna; integrasi tool diuji dengan endpoint lokal simulasi.

## Mengulangi validasi

```bash
npm ci
npm test
npm run build
npm run test:ui
node scripts/check-packaged.mjs release/linux-unpacked/mikrotik-helper-desktop
npm audit --omit=dev
```

Pengujian GUI membutuhkan sesi desktop. Untuk validasi produksi, sambungkan komputer melalui LAN/VPN yang sah, verifikasi host key, dan mulai dengan Snapshot/Pustaka skill. Perubahan konfigurasi harus tetap melalui review, backup, persetujuan, verifikasi, dan rollback yang khusus untuk perubahan tersebut.
