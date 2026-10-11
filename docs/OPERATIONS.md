# Penggunaan operasional

## Router baru

Tambahkan nama, site, host, port SSH, username, dan metode autentikasi. SSH key disarankan mengikuti helper lama. Untuk RouterOS 6 yang memakai host key RSA lama, aktifkan kompatibilitas RSA. Expected identity bersifat opsional; saat diisi, setiap pekerjaan berhenti jika nama perangkat berbeda.

Tekan Hubungkan dan cocokkan fingerprint melalui jalur tepercaya. Fingerprint yang sudah dipercaya dipakai pada setiap sambungan. Perubahan IP/port menghapus trust sehingga perlu probe ulang. Mengubah target koneksi juga membuat rencana lama tidak dapat diterapkan.

## Monitoring

Snapshot adalah sampel pada waktu yang ditampilkan. Snapshot impor lama tidak ditampilkan sebagai monitoring. Aplikasi hanya memakai snapshot hasil SSH langsung; snapshot terakhir yang sudah lama ditandai historis. CPU 0, jumlah user 0 dan data tidak tersedia ditampilkan berbeda. Pembaruan 60 detik hanya berjalan jika admin mengaktifkannya, router sudah dipercaya, dan tidak sedang ada pekerjaan lain.

PCQ tidak menjamin semua user mendapat laju total yang sama: classifier, kelas trafik, subnet mangle, profile limit, dan kondisi AP harus dinilai bersama. Counter drop kumulatif membutuhkan pembandingan beberapa sampel. Grafik CPU menggunakan snapshot asli yang tersimpan.

## Backup dan perubahan

Backup wajib menyimpan export tersamarkan, membuat biner AES-SHA256 dengan password acak, mengunduh dua kali, membandingkan SHA256 dan membaca ulang arsip lokal sebelum import. Berlaku pula untuk rollback. Lihat [Konfigurasi dan backup](AUTOMATION.md). Export memakai `/export hide-sensitive` pada RouterOS 6 dan default sensitive hidden pada RouterOS 7. Output juga melewati redaksi pola credential. Secret di luar pola yang dikenal tidak dijamin terdeteksi; periksa arsip sebelum dibagikan.

Generator HotSpot membaca rate-limit lama dari snapshot live yang berumur maksimal 30 menit. Ia membuat rollback nilai lama dan precondition yang dicek ulang sebelum apply. Login aktif dapat membutuhkan login ulang untuk memperoleh batas baru.

Rencana manual memerlukan alasan/dampak, apply script, rollback script, verifikasi apply, serta verifikasi rollback. `contains` harus memuat setiap nilai target. `notContains` dapat dipakai untuk memastikan field atau nilai lama tidak ada. Generator memakai pemeriksaan `row` yang memerlukan tepat satu baris RouterOS, sehingga nilai yang dicetak dengan atau tanpa tanda kutip dibaca sama. Nilai lama yang tidak terbaca menghentikan generator.

```json
[
  {
    "command": "/ip hotspot user profile print detail where name=\"mahasiswa\"",
    "contains": [],
    "notContains": [],
    "row": { "name": "mahasiswa", "rate-limit": "2M/8M" }
  }
]
```

Import bukan transaksi atomik. Jika terputus, baca evidence dan gunakan Periksa hasil. Aplikasi tidak mengulang import. Jika target belum cocok atau ambigu, tinjau rollback terarah. Apply lain diblokir selama ada state yang belum jelas pada router itu.

## Model agent

Mode lokal menyediakan workflow kondisi router, bandwidth/PCQ, jaringan/AP/switch, HotSpot, log, backup, serta perintah print dari katalog. Laporan berasal dari output SSH. Permintaan di luar katalog mendapat panduan; tidak diterjemahkan menjadi perubahan otomatis. Percakapan bebas memerlukan model function-calling yang berjalan pada endpoint API kompatibel Chat Completions. Endpoint harus HTTPS, kecuali localhost. Pengaturan meminta persetujuan pengiriman pesan dan evidence karena data dapat memuat IP privat, nama perangkat, atau isi log.

Model memiliki paling banyak enam langkah, empat tool request per langkah, timeout, dan batas ukuran respons. Tool proposal menyimpan rencana sebagai draft. Persetujuan perubahan tetap tersedia hanya melalui halaman Perubahan.

## Kesalahan koneksi

| Gejala                          | Pemeriksaan                                                        |
| ------------------------------- | ------------------------------------------------------------------ |
| Timeout/refused                 | Jalur LAN/VPN, IP, port SSH dan firewall management                |
| Host key berubah                | Verifikasi apakah perangkat/key diganti; jangan langsung menerima  |
| Authentication failed           | Username, public key terpasang, password/passphrase, key path      |
| Expected identity berbeda       | Inventory menunjuk perangkat yang berbeda                          |
| Perintah tidak tersedia         | Versi RouterOS atau privilege user; evidence parsial disimpan      |
| Tidak bisa menyimpan credential | Gunakan credential sesi atau buka keyring OS                       |
| Rencana stale                   | Ambil snapshot dan buat rencana ulang setelah perubahan admin lain |

Inventory tidak memberi jalur otomatis melalui internet. Pastikan komputer aplikasi berada di jaringan manajemen atau VPN. Membuka port WinBox saja tidak membuka SSH.

## Memindahkan workspace

Tutup aplikasi sebelum menyalin folder userData agar database dan WAL konsisten. Credential terenkripsi terikat keyring komputer/akun asal; masukkan kembali credential pada komputer tujuan. Private key dikelola terpisah; biner dan password pemulihan baru berada dalam folder privat backup. Menu Backup & riwayat dapat mengekspor laporan diagnostik JSON dengan data tersamarkan.

## Paket desktop yang aktif

Setelah memperbarui source, jalankan build distribusi dan `node scripts/install-local.mjs`. Installer lokal memeriksa versi di app.asar; shortcut tidak dipasang jika paket masih versi lama. Versi di footer aplikasi dibaca dari paket yang benar-benar berjalan.

Hubungkan memeriksa credential → alamat → TCP → host key → autentikasi/identity. Bila host key belum disetujui, aplikasi meminta verifikasi, lalu melanjutkan aksi semula. Agent, Skill, Snapshot, dan Backup memakai alur yang sama. Hasil diagnostik/skill dibuka sebagai detail pekerjaan; status selesai/gagal muncul sesudah pekerjaan berakhir.

Credential lama dipertahankan hanya jika target, username, metode, dan lokasi key tetap sama. Perubahan target membutuhkan credential yang sesuai. Di komputer lain, pilih kembali private key; file .pub tidak dapat dipakai sebagai private key.
