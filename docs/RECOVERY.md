# Pemulihan workspace dari GitHub private

Backup lengkap ada di asset Release bertajuk Backup workspace pada repo masing-masing. Download file `*-workspace.tar.gz` dan `SHA256SUMS.txt`. Arsip ini berisi credential; simpan dan ekstrak hanya pada komputer yang Anda kelola.

## Salinan kecil credential dan pengaturan

Asset `credentials-and-settings.tar.gz` tersedia terpisah untuk memulihkan SSH key dan database pengaturan tanpa mengunduh seluruh runtime/installer. Periksa dengan `sha256sum -c CREDENTIAL-SHA256SUMS.txt`. Asset ini memerlukan source dari clone repo dan tidak menggantikan backup lengkap workspace.

## Memeriksa unduhan

```bash
sha256sum -c SHA256SUMS.txt
```

Gunakan checksum untuk arsip yang diunduh dari Release repo yang sama. Arsip juga membawa `ARCHIVE-MANIFEST.json` dengan SHA256 file individual.

## Mengembalikan folder

Ekstrak ke direktori baru yang kosong agar folder yang masih ada tidak tertimpa:

```bash
mkdir -m 700 recovered-workspace
tar -xzf NAMA-workspace.tar.gz -C recovered-workspace
```

- `project/` berisi seluruh isi folder project, termasuk file yang diabaikan Git. Metadata `.git` dikecualikan; clone source dari repo jika membutuhkan riwayat commit.
- `credentials/ssh/` berisi key router yang dirujuk inventory, beserta public key jika tersedia. Salin ke lokasi SSH yang sesuai, beri mode private key `600`, lalu sesuaikan `routers.json` atau inventory aplikasi jika komputer/OS berubah. Key ini tidak otomatis mengubah konfigurasi router.
- `local-data/` pada backup desktop berisi data pengguna aplikasi, termasuk salinan SQLite yang konsisten. Tutup aplikasi sebelum mengembalikannya ke direktori userData. Lokasi lama dicatat dalam manifest. Pada Linux lokasi default adalah `~/.config/MikroTik Helper`.
- `ARCHIVE-MANIFEST.json` mencatat lokasi asal, file yang disertakan, symlink, checksum, dan perlakuan khusus SQLite.

Dependensi dan paket desktop yang dibackup berasal dari OS/build saat arsip dibuat. Untuk OS berbeda, gunakan `npm ci` serta build yang sesuai. Credential safeStorage yang dienkripsi OS mungkin memerlukan keyring asal atau pengisian ulang pada komputer baru.

Pemulihan folder tidak menjalankan `.rsc`, restore binary RouterOS, atau perubahan jaringan. Perubahan produksi tetap mengikuti backup, review, grant, rollback, dan verifikasi.
