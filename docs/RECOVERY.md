# Pemulihan workspace dari GitHub private

Backup lengkap ada di asset Release bertajuk Backup workspace pada repo masing-masing. Arsip besar dibagi menjadi asset `*-workspace.bundle.part-0000` dan seterusnya. Download semua bagian, `WORKSPACE-PARTS.json`, dan `BUNDLE-SHA256SUMS.txt` dari repo yang sama. Snapshot ini berisi credential; simpan dan ekstrak hanya pada komputer yang Anda kelola.

## Salinan kecil credential dan pengaturan

Asset `credentials-and-settings.tar.gz` tersedia terpisah untuk memulihkan SSH key dan database pengaturan tanpa mengunduh seluruh runtime/installer. Periksa dengan `sha256sum -c CREDENTIAL-SHA256SUMS.txt`. Asset ini memerlukan source dari clone repo dan tidak menggantikan backup lengkap workspace.

## Menyatukan bagian backup

Simpan semua bagian dan manifest pada satu folder, lalu jalankan alat pemulihan dari source repo:

```bash
python3 scripts/restore-release-parts.py /lokasi/unduhan-backup
```

Alat memeriksa ukuran, urutan, checksum setiap bagian, dan checksum arsip lengkap. Ia menghasilkan `*-workspace.bundle` tanpa mengekstrak atau menimpa folder project. Bagian yang tidak lengkap/berubah ditolak.

## Memeriksa unduhan

```bash
sha256sum -c BUNDLE-SHA256SUMS.txt
```

Jalankan pemeriksaan checksum dari folder unduhan karena nama bundle di checksum bersifat relatif. Gunakan checksum dari Release repo yang sama. Arsip juga membawa `ARCHIVE-MANIFEST.json` dengan SHA256 file individual.

## Mengembalikan folder

Bundle adalah snapshot Git mandiri berisi seluruh file yang dibackup, termasuk yang diabaikan Git. Clone ke direktori baru yang kosong, lalu verifikasi isi dan pulihkan permission:

```bash
mkdir -m 700 recovered-workspace
git clone --branch backup /lokasi/unduhan-backup/NAMA-workspace.bundle recovered-workspace
python3 scripts/restore-workspace-metadata.py recovered-workspace
```

- `project/` berisi seluruh isi folder project, termasuk file yang diabaikan Git. Metadata `.git` dikecualikan; clone source dari repo jika membutuhkan riwayat commit.
- `credentials/ssh/` berisi key router yang dirujuk inventory, beserta public key jika tersedia. Salin ke lokasi SSH yang sesuai, beri mode private key `600`, lalu sesuaikan `routers.json` atau inventory aplikasi jika komputer/OS berubah. Key ini tidak otomatis mengubah konfigurasi router.
- `local-data/` pada backup desktop berisi data pengguna aplikasi, termasuk salinan SQLite yang konsisten. Tutup aplikasi sebelum mengembalikannya ke direktori userData. Lokasi lama dicatat dalam manifest. Pada Linux lokasi default adalah `~/.config/MikroTik Helper`.
- `ARCHIVE-MANIFEST.json` mencatat lokasi asal, file yang disertakan, symlink, checksum, dan perlakuan khusus SQLite. Git menyimpan file identik sekali untuk memperkecil unggahan. Hardlink dipulihkan sebagai file terpisah dengan isi identik; timestamp file akan mengikuti waktu clone.

Dependensi dan paket desktop yang dibackup berasal dari OS/build saat arsip dibuat. Untuk OS berbeda, gunakan `npm ci` serta build yang sesuai. Credential safeStorage yang dienkripsi OS mungkin memerlukan keyring asal atau pengisian ulang pada komputer baru.

Pemulihan folder tidak menjalankan `.rsc`, restore binary RouterOS, atau perubahan jaringan. Perubahan produksi tetap mengikuti backup, review, grant, rollback, dan verifikasi.
