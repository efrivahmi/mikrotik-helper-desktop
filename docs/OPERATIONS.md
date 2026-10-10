# Penggunaan operasional

## Router baru

Tambahkan nama, site, host, port SSH, username, dan metode autentikasi. SSH key disarankan mengikuti helper lama. Untuk RouterOS 6 yang memakai host key RSA lama, aktifkan kompatibilitas RSA. Expected identity bersifat opsional; saat diisi, setiap pekerjaan berhenti jika nama perangkat berbeda.

Tekan Hubungkan dan cocokkan fingerprint melalui jalur tepercaya. Fingerprint yang sudah dipercaya dipakai pada setiap sambungan. Perubahan IP/port menghapus trust sehingga perlu probe ulang. Mengubah target koneksi juga membuat rencana lama tidak dapat diterapkan.

## Monitoring

Snapshot adalah sampel pada waktu yang ditampilkan. Data impor ditandai Arsip impor. CPU 0, jumlah user 0 dan data tidak tersedia ditampilkan berbeda. Pembaruan 60 detik hanya berjalan jika admin mengaktifkannya, router sudah dipercaya, dan tidak sedang ada pekerjaan lain.

PCQ tidak menjamin semua user mendapat laju total yang sama: classifier, kelas trafik, subnet mangle, profile limit, dan kondisi AP harus dinilai bersama. Counter drop kumulatif membutuhkan pembandingan beberapa sampel. Grafik CPU menggunakan snapshot asli yang tersimpan.

## Backup dan perubahan

Backup menyimpan `/export hide-sensitive` pada RouterOS 6 dan export default dengan sensitive hidden pada RouterOS 7. Output juga melewati redaksi pola credential. Secret di luar pola yang dikenal tidak dijamin terdeteksi; periksa arsip sebelum dibagikan.

Generator HotSpot membaca rate-limit lama dari snapshot live yang berumur maksimal 30 menit. Ia membuat rollback nilai lama dan precondition yang dicek ulang sebelum apply. Login aktif dapat membutuhkan login ulang untuk memperoleh batas baru.

Rencana manual memerlukan alasan/dampak, apply script, rollback script, verifikasi apply, serta verifikasi rollback. `contains` harus memuat setiap nilai target. `notContains` dapat dipakai untuk memastikan field atau nilai lama tidak ada. Generator memakai pemeriksaan tersebut untuk profile tanpa rate-limit sebelumnya.

```json
[
  {
    "command": "/ip hotspot user profile print detail where name=\"mahasiswa\"",
    "contains": ["name=\"mahasiswa\"", "rate-limit=\"2M/8M\""],
    "notContains": []
  }
]
```

Import bukan transaksi atomik. Jika terputus, baca evidence dan gunakan Periksa hasil. Aplikasi tidak mengulang import. Jika target belum cocok atau ambigu, tinjau rollback terarah. Apply lain diblokir selama ada state yang belum jelas pada router itu.

## Model agent

Mode lokal menyediakan workflow snapshot dan backup. Percakapan bebas memerlukan model function-calling yang berjalan pada endpoint API kompatibel Chat Completions. Endpoint harus HTTPS, kecuali localhost. Pengaturan meminta persetujuan pengiriman pesan dan evidence karena data dapat memuat IP privat, nama perangkat, atau isi log.

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

Tutup aplikasi sebelum menyalin folder userData agar database dan WAL konsisten. Credential terenkripsi terikat keyring komputer/akun asal; masukkan kembali credential pada komputer tujuan. Private key dan binary backup tetap dikelola terpisah. Menu Backup & riwayat dapat mengekspor laporan diagnostik JSON dengan data tersamarkan.
