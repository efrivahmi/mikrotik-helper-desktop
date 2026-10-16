# Workflow lokal 2.0 — Development by ep

## Penggunaan

1. Pilih router. Tulis tujuan serta IP, MAC, username atau interface yang pasti bila pemeriksaan spesifik.
2. Agent menyiapkan kartu berisi tujuan, target, perintah, dampak dan waktu kedaluwarsa. Pada tahap ini tidak ada SSH.
3. Review kartu. Pilih **Konfirmasi pemeriksaan baca saja**, atau centang cakupan lalu **Konfirmasi & buat backup penuh**. Konfirmasi berlaku sepuluh menit, satu kali, pada target dan hash yang sama.
4. Hasil menyebut snapshot, router, waktu dan command untuk setiap kategori. Error menu, hasil parsial dan data yang tidak dapat diurai tetap terlihat.
5. Perubahan konfigurasi dibuat di Konfigurasi/Perubahan. Apply dan rollback memerlukan review, grant nama router/hash serta konfirmasi backup penuh baru. Backup atau precondition gagal menghentikan import. Import tidak diulang otomatis.

Contoh: `cek DHCP dan HotSpot untuk 192.168.111.17`, `periksa bandwidth tanpa mengubah konfigurasi`, `cek interface=ether1`, `lihat log`, `sudah ada backup?`, `buat backup penuh`, `batalkan`.

Pertanyaan lanjutan seperti `cek lagi` memakai topik/target pemeriksaan berhasil sebelumnya, maksimal dua puluh menit, hanya pada router yang sama. Evidence dibaca ulang sesudah konfirmasi. Nama orang tidak otomatis dipetakan ke MAC. Konteks percakapan bukan bukti keadaan router. Kata `lanjut`, `iya` atau penyebutan backup tidak memberikan grant apply.

Permintaan perubahan/ambiguitas disampaikan sebagai tujuan atau permintaan data tambahan. Tidak ada default IP, identitas perangkat, hasil ping atau hasil monitoring contoh yang disimpan. Data historis tidak dilaporkan sebagai keadaan terkini.

## Cakupan diagnostik

Tiga belas workflow: kondisi, bandwidth/PCQ, interface/VLAN/routing, HotSpot, DHCP/pool/bentrok IP, DNS, firewall/NAT, VPN, WiFi, log, administrasi, kapasitas/lisensi, dan backup. Enam belas skill baru memakai nama `workflow-v2-*` serta `playbook-v2-*`, sehingga skill lama yang disunting pengguna tetap dipertahankan.

Alamat HotSpot `address`, translasi `to-address`, reservasi DHCP dan IP native client dijelaskan sebagai bukti berbeda. Lease waiting bukan bukti client memakai reservasi. Tidak ada baris target tidak membuktikan IP bebas atau perangkat offline. PCQ/max-limit tidak membuktikan pemerataan; satu snapshot tidak membuktikan kapasitas puncak, jaringan aman atau layanan normal.

Pustaka skill menampilkan perintah. Menekan Jalankan menyiapkan kartu konfirmasi di Agent. Isi skill/log/perangkat diperlakukan sebagai data, bukan instruksi yang memberi izin mutasi. Diagnostik menolak `print file`, interval/subscription, ekspresi, credential dan rangkaian command.

## Model pilihan

Workflow deterministik tetap digunakan untuk permintaan yang dikenal. Bila model diaktifkan, gunakan awalan `analisis model: …`, `tanya model …` atau `model: …` untuk analisis bebas. Kartu meminta konfirmasi pengambilan/pengiriman evidence. Perubahan endpoint, model atau izin evidence membatalkan persetujuan lama.

Model mendapat snapshot baru, keluaran tool yang dibatasi, konteks percakapan dan batas kewenangan. Tool hanya membaca atau menyimpan draft. Jawaban diberi label analisis; klaim IP/MAC/persentase yang tidak didukung corpus evidence dan klaim perubahan yang tidak dijalankan ditahan. Pemeriksaan ini tidak membuktikan semua kalimat model benar. Cocokkan hipotesis dengan evidence dan verifikasi client.

## Backup penuh yang diterapkan

Cakupan adalah konfigurasi RouterOS dan seluruh file pengguna yang tercantum dalam `/file`, termasuk portal. Bukan image disk/firmware.

- Export tersamarkan dan biner sistem AES-SHA256 dengan password acak.
- Inventaris package serta file dibandingkan dengan count dan diperiksa sebelum/sesudah arsip.
- Setiap file biasa diunduh dua kali; direktori/disk dicatat. Nama/path yang tidak dapat ditransfer secara aman menghentikan backup.
- File pengguna disimpan AES-256-GCM; key diturunkan dari password backup melalui scrypt dengan salt acak. Setiap file terikat nama asal melalui AAD dan didekripsi/dibaca ulang untuk memeriksa SHA256.
- Manifest menyimpan cakupan, ukuran, nama asal, hash file dan hash ciphertext. Metadata backup lengkap baru disimpan sesudah seluruh tahap berhasil dan export statis tetap sama.
- Batas: 64 MiB per file, 512 MiB file pengguna, 2.000 entri. Melampaui batas, file berubah, permission, disk/transfer/hash gagal: berhenti; tidak dianggap backup penuh.
- User Manager, The Dude dan container yang terdeteksi memerlukan prosedur tersendiri dan menghentikan jalur ini. Tidak menganggap binary backup mencakup database tersebut. [Dokumentasi MikroTik](https://manual.mikrotik.com/docs/getting-started/configuration-management/backup/), [daftar file pengguna](https://manual.mikrotik.com/docs/system-information-and-utilities/files/).

Arsip lama tetap ada dan ditandai sebagai export/biner saja. Backup lama tidak digunakan untuk memenuhi syarat baru. Backup baru diambil pada setiap apply/rollback; beban CPU tinggi atau kondisi berubah menghentikan import. Snapshot konfigurasi/file tidak atomik. Pemulihan hardware belum diuji.

`scripts/restore-user-files.mjs` memeriksa manifest/checksum dan mendekripsi file ke direktori lokal baru, tanpa koneksi router. Pemulihan konfigurasi biner, database khusus dan uji layanan tetap prosedur terpisah.

## Identitas dan batas rilis

**Development by ep** ditanam pada kode UI dan metadata paket; tidak disediakan pengaturan untuk menghapusnya. Pengelola yang mengubah source/paket tetap dapat membuat versi berbeda. Tidak ada perubahan branding pada komentar atau konfigurasi router.

Build/typecheck bukan bukti seluruh workflow, layanan RouterOS atau Windows native sudah diuji. Status verifikasi rilis tersedia pada RELEASE-1.5.0.md.
