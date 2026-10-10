# MikroTik Helper Desktop

Aplikasi desktop untuk mengelola banyak router melalui alur helper yang sudah Anda rancang: koneksi, evidence, backup, rencana, review, persetujuan, apply, verifikasi, dan rollback. UI menggunakan navigasi konsol administrasi, tabel perangkat, editor script, serta riwayat pekerjaan dalam Bahasa Indonesia.

Versi 1.0.0 tersedia sebagai installer Windows, `.exe` portable, dan AppImage Linux di `release/`. Program desktop sudah membawa runtime sendiri; Python dan WinBox tidak dibutuhkan untuk menjalankannya. Sambungan ke RouterOS memakai SSH pada jaringan manajemen atau VPN.

## Mulai menggunakan

1. Jalankan `MikroTik-Helper-Setup-1.0.0-x64.exe` untuk instalasi Windows, atau `MikroTik-Helper-Portable-1.0.0-x64.exe` untuk menjalankan tanpa installer. Build ini belum memiliki sertifikat penandatanganan publisher Windows.
2. Buka **Router → Impor helper lama** dan pilih direktori `mikrotik-helper-agent`. Inventory dan skill JSON akan diimpor. Dashboard membaca data melalui koneksi aplikasi ini. Backup dan riwayat lama tetap berada di workspace asal.
3. Periksa IP, port SSH, username, expected identity, dan lokasi private key. Saat berpindah ke Windows, pilih kembali file key yang tersedia di komputer Windows.
4. Pilih **Hubungkan**, bandingkan fingerprint host key dengan perangkat melalui jalur yang dipercaya, lalu setujui. Setelah itu aplikasi mengambil snapshot.
5. Gunakan **Ringkasan**, **Diagnostik**, dan **Pustaka skill** untuk pemeriksaan. Aktifkan pembaruan 60 detik jika diperlukan; polling UI tidak membuat koneksi router otomatis.
6. Gunakan **Perubahan** untuk generator batas profile HotSpot atau rencana manual. Setelah review, konfirmasi nama router dan hash untuk memulai backup dan apply.

### Linux / Pop!_OS

Buka shortcut **MikroTik Helper** di Desktop atau menu aplikasi pada komputer ini. Alternatifnya, jalankan AppImage dari `release/`:

```bash
chmod +x release/MikroTik-Helper-1.0.0-x86_64.AppImage
./release/MikroTik-Helper-1.0.0-x86_64.AppImage
```

Jika AppImage tidak dapat berjalan karena FUSE belum tersedia, jalankan dengan opsi `--appimage-extract-and-run`. Untuk memasang ulang shortcut setelah memindahkan project atau melakukan build baru, jalankan `node scripts/install-local.mjs`.

Data contoh dan screenshot demonstrasi sudah dihapus dari workspace aplikasi. Dashboard menampilkan metrik setelah snapshot live berhasil diambil. Lihat [status source dan penyimpanan GitHub](docs/GITHUB.md).

## Kemampuan yang tersedia

| Bagian     | Fungsi                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Router     | Tambah/edit/hapus inventory, lokasi, SSH key/password, pinning host key, pengecekan identity     |
| Ringkasan  | CPU, memori, uptime, versi, user HotSpot, queue, interface, grafik sampel CPU                    |
| Diagnostik | Katalog `print` read-only, evidence mentah, hasil perintah dan pekerjaan                         |
| Skill      | Skill JSON lama dan skill bandwidth/VPN tambahan; editor, validasi, impor, eksekusi              |
| Agent      | Workflow lokal untuk snapshot/backup; model pilihan untuk percakapan, diagnostik, dan proposal   |
| Perubahan  | Apply/rollback `.rsc`, preconditions, verifikasi target, checksum, backup wajib, grant eksplisit |
| Pemulihan  | Hasil import tidak pasti diberi status `unknown`; pemeriksaan ulang atau rollback terarah        |
| Arsip      | Backup export tersamarkan, laporan JSON, audit lokal, riwayat pekerjaan                          |

Model belum diaktifkan pada instalasi baru. Workflow lokal tetap dapat bekerja. Untuk analisis bahasa alami, aktifkan endpoint kompatibel Chat Completions pada **Pengaturan**, pilih model yang mendukung function/tool calling, dan berikan izin pengiriman evidence. Ollama lokal dapat menggunakan `http://127.0.0.1:11434/v1`; pastikan server serta model yang dipilih sudah tersedia. Endpoint HTTPS lain dapat diisi sendiri.

## Alur perubahan

Rencana tidak diterapkan saat dibuat. Hash mengikat isi apply, rollback, preconditions, dan verifikasi. Target koneksi juga diikat sehingga rencana lama ditolak jika inventory berganti perangkat.

Setelah persetujuan: periksa identity dan kondisi awal → export backup → upload SCP → import → verifikasi target → snapshot → audit. Satu router menjalankan satu pekerjaan pada satu waktu; router berbeda dapat menjalankan pekerjaan secara terpisah.

Jika backup gagal, import tidak dimulai. Jika import terputus, hasil ditandai belum pasti dan tidak diulang otomatis. Apply berikutnya pada router itu diblokir sampai state terverifikasi atau rollback selesai. Tombol **Periksa hasil** memeriksa target apply dan rollback secara read-only.

## Menjalankan dari source

Node.js 22.12+ dan npm diperlukan untuk pengembangan. Pengujian UI memerlukan sesi desktop Linux/Windows yang aktif.

```bash
npm ci
npm run build
npm start
```

Untuk mode pengembangan gunakan `npm run dev`. Build distribusi:

```bash
npm test
npm run test:ui
npm run dist:win
npm run dist:linux
```

Windows build dapat dijalankan pada Windows atau Linux dengan Wine/NSIS yang dipakai electron-builder. Build Linux AppImage dilakukan pada Linux. Panduan lintas platform mengikuti [dokumentasi electron-builder](https://www.electron.build/v26/docs/features/multi-platform-build/).

## Struktur project

```text
src/main/       transport SSH, policy, orchestrator, SQLite, IPC dan vault OS
src/shared/     model data dan schema validasi
src/renderer/   UI React, editor, dialog dan CSS
resources/skills/  skill pack yang dibundel
tests/          pengujian policy, transport, orchestrator dan tool model
scripts/        build, dev server, pengujian UI, ikon
docs/           arsitektur, operasi, pengembangan skill dan hasil validasi
build/          ikon aplikasi
release/        hasil installer, portable dan AppImage
```

Data pengguna dibuat di direktori userData Electron, ditampilkan pada **Pengaturan → Workspace lokal**. Source, skill bawaan, dan paket distribusi tidak berisi inventory atau private key Anda. Hasil impor tetap di komputer yang melakukan impor.

## Batas penggunaan versi ini

Konfigurasi RouterOS 6/7 harus tetap direview sesuai versi dan topologi. Scanner script memeriksa pola yang diketahui; ia bukan parser lengkap atau pembuktian keamanan. Backup otomatis merupakan export konfigurasi yang menyamarkan secret, sehingga tidak menggantikan binary backup atau prosedur pemulihan credential. Model AI menghasilkan proposal yang perlu ditinjau.

Paket Windows dibangun dari Linux; validasi pada Windows native tetap diperlukan sebelum rollout luas. RouterOS produksi tidak diberi perubahan sebagai bagian dari pengujian aplikasi. Detail: [hasil validasi](docs/VALIDATION.md), [operasi](docs/OPERATIONS.md), [arsitektur](docs/ARCHITECTURE.md), dan [pengembangan skill](docs/SKILLS.md).

## Repository GitHub

Source aplikasi disimpan di repository public `efrivahmi/mikrotik-helper-desktop`. Helper Python disimpan terpisah di `efrivahmi/mikrotik-helper-agent`. Inventory, credential, database pengguna, dan arsip operasional lokal dikecualikan dari Git.

Template GitHub Actions tersedia di [docs/ci/build.yml](docs/ci/build.yml). Aktivasi dan status pengembangan dijelaskan di [docs/GITHUB.md](docs/GITHUB.md).
