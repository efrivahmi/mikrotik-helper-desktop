# Source di GitHub

Source aplikasi desktop dan helper Python disimpan dalam dua repository public:

- `efrivahmi/mikrotik-helper-desktop`
- `efrivahmi/mikrotik-helper-agent`

Repository menyimpan source, dokumentasi, skill, dan konfigurasi build. File inventory pribadi, credential, private key, database aplikasi, backup, snapshot, dan hasil operasi router tetap lokal. Installer dan dependensi dapat dibangun kembali dari source; direktori `release/`, `dist/`, dan `node_modules/` diabaikan Git.

## Status source saat commit awal

Paket 1.0.0 pernah dibangun pada 5 Oktober 2026. Source saat ini memakai versi 1.1.0 dan memuat pekerjaan lanjutan untuk menghapus data contoh/impor dari dashboard, pemeriksaan koneksi SSH bertahap, pengambilan counter interface dan discovery tetangga, serta pemeriksaan endpoint model.

Pekerjaan 1.1.0 belum diselesaikan sebagai rilis produksi. Laporan validasi 1.0.0 adalah catatan pengujian pada saat itu; laporan tersebut tidak membuktikan seluruh perubahan 1.1.0 sudah teruji. Paket yang berada di komputer asal dapat berbeda dari source terbaru. Pembuatan repo tidak menjalankan perubahan konfigurasi pada router.

## GitHub Actions

Definisi build disimpan sebagai template di `docs/ci/build.yml`. Token classic untuk unggahan awal mempunyai scope `repo`, tanpa scope `workflow`; karena itu workflow otomatis belum diaktifkan.

Untuk mengaktifkannya kemudian, gunakan akses dengan scope `workflow`, pindahkan template ke `.github/workflows/build.yml`, commit, lalu push. Workflow membangun paket Linux dan Windows serta menyimpan hasil sebagai artifact GitHub Actions.

Token dibaca dari file lokal di luar project untuk proses pembuatan repo dan push. Nilainya tidak disimpan pada source, URL remote, atau konfigurasi Git repository.
