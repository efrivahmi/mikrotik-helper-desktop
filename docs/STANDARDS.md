# Aturan konfigurasi dan pengaturan sederhana — 1.3.0

## Acuan

MTCNA merupakan kurikulum pelatihan/sertifikasi MikroTik untuk konfigurasi dasar. Aplikasi memakai susunan materinya sebagai acuan dan memeriksa sejumlah aturan teknis dari RFC serta dokumentasi implementasi RouterOS. Hasil pemeriksaan aplikasi bukan sertifikat MTCNA, sertifikasi IEEE/RFC, atau audit kepatuhan seluruh jaringan.

Sumber utama:

- [Outline MTCNA](https://i.mt.lv/cdn/training_pdf/mtcna_outline_2019181161836.pdf): koneksi/backup, DHCP, bridge, routing, wireless, firewall, QoS, tunnel dan monitoring. Outline ini bertanggal 2016; kompatibilitas fitur modern mengikuti versi/package/router yang terbaca.
- [RFC 4632](https://www.rfc-editor.org/info/rfc4632/): notasi CIDR. Format IPv4/prefix diperiksa; alamat host dibedakan dari network/broadcast. /31 didukung untuk alamat point-to-point; paket DHCP memerlukan alamat host yang dapat dialokasikan.
- [RFC 1918](https://www.rfc-editor.org/info/rfc1918/): ruang alamat privat. LAN DHCP dengan alamat di luar ruang ini mendapat peringatan, bukan larangan terhadap LAN publik yang dialokasikan secara sah.
- [RFC 2131](https://www.rfc-editor.org/info/rfc2131/): DHCP. Pemeriksaan konflik/rentang aplikasi merupakan pengamanan sebelum konfigurasi, bukan pembuktian implementasi lengkap protocol DHCP.
- [IEEE 802.1Q-2022](https://1.ieee802.org/maintenance/802-1q-2022-rev/) dan [Bridge VLAN Table RouterOS](https://help.mikrotik.com/docs/spaces/ROS/pages/28606465/Bridge+VLAN+Table): bridge/VLAN, keanggotaan tagged/untagged dan akses CPU. Aturan konkret menu mengikuti dokumentasi vendor.
- [Queues RouterOS](https://manual.mikrotik.com/docs/firewall-and-quality-of-service/queues/): PCQ, HTB, prioritas 1–8, limit-at/max-limit dan FastTrack.
- [Pengamanan RouterOS](https://help.mikrotik.com/docs/spaces/ROS/pages/328353/Securing+your+router), [WiFi](https://manual.mikrotik.com/docs/wireless/wifi/), [PCC](https://manual.mikrotik.com/docs/high-availability-solutions/load-balancing/per-connection-classifier/), dan [backup](https://manual.mikrotik.com/docs/getting-started/configuration-management/backup/): aturan implementasi serta pemulihan.

## Pengaturan yang lebih mudah

Pilih **Konfigurasi → Paket** atau **Menu**, lalu ikuti tiga tahap:

1. **Akses router:** baca konfigurasi asli, pilih interface management dan alamat sumber administrator. Jika ada satu sumber sesi SSH yang cocok dengan akun inventory, tombol dapat menyalinnya sebagai /32. Interface hanya disarankan jika alamat SSH inventory cocok dengan alamat interface yang terbaca; VPN/NAT tetap harus diperiksa admin.
2. **Isi kebutuhan:** isi alamat IP dan pilih prefix terpisah; isi bandwidth dengan angka serta satuan Mbps/kbps/Gbps/bps. Pada editor menu, pilih nama pengaturan berlabel Indonesia; mode nama properti manual tetap tersedia.
3. **Periksa aturan:** baca ringkasan tanpa password, perbaiki error, lalu siapkan rencana. Halaman Perubahan menyediakan script apply/rollback, laporan aturan, precondition dan verifikasi. Grant tetap terikat router/hash dan memerlukan pengakuan atas seluruh peringatan.

Nama konfigurasi dapat dibuat otomatis. Distance awal 1, prioritas Queue Tree awal 8, satu login per akun dan bobot ISP awal 1 merupakan **nilai operasional awal aplikasi**, bukan kewajiban standar internasional. Prefix awal /24 pada jaringan dan /32 pada satu IP juga perlu disesuaikan dengan desain. Aplikasi tidak memasukkan alamat, nama interface, credential atau kapasitas ISP contoh ke inventory.

**Hitung kandidat dari subnet** mengecualikan gateway, alamat interface router, lease dan pool yang berhasil terbaca. Ini bukan pemindaian seluruh perangkat: IP statis di AP/switch/printer di luar DHCP belum tentu terlihat. Gunakan kandidat setelah memastikan tidak bentrok dengan alokasi perangkat. **Gunakan DNS router** hanya tersedia bila resolver benar-benar terbaca; DNS tidak ditebak.

## Aturan backend

| Domain              | Pelanggaran yang menghentikan rencana                                                                                                                                                                           | Peringatan yang perlu review                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Evidence/management | Menu/dependensi belum terbaca, target tidak unik, interface tidak ada, CIDR/sumber management tidak valid                                                                                                       | Jalur pemulihan belum dikonfirmasi                                                                                        |
| IP/DHCP             | IPv4/CIDR salah, IP interface duplikat, pool terbalik/bertumpuk/mencakup router/network/broadcast, gateway keluar subnet, pool keluar subnet server, DHCP pada port anggota bridge, server ganda, lease bentrok | Deteksi konflik dimatikan, LAN memakai alamat nonprivat                                                                   |
| Bridge/VLAN         | VID/PVID bukan 1–4094, port tagged sekaligus untagged, beberapa VLAN pada access row, anggota bukan port bridge yang sama, filtering tanpa akses cadangan                                                       | Akses CPU/VLAN management perlu review, pencegahan loop dimatikan                                                         |
| Queue/QoS           | Satuan bandwidth salah, prioritas keluar 1–8, CIR di atas MIR, total CIR child melebihi parent, maksimum child melebihi parent                                                                                  | Nilai 0 tanpa batas, FastTrack berpotensi melewati shaping, format burst profil lanjutan                                  |
| Firewall/NAT        | Port di luar 1–65535, port tanpa protocol transport yang sesuai, alamat sumber/tujuan salah                                                                                                                     | Input accept tanpa batas, DST-NAT tanpa batas interface/alamat masuk, resolver DNS perlu firewall WAN                     |
| Services/WiFi       | Passphrase tidak valid, WEP/WPA pertama dalam perubahan profil                                                                                                                                                  | Management/MAC terbuka luas, WiFi terbuka dengan autentikasi kosong                                                       |
| PCC                 | PCC/policy routing umum digabung dengan HotSpot aktif; paket PCC juga menolak LAN/WAN sama                                                                                                                      | FastTrack dan policy routing perlu pengecualian                                                                           |
| Domain lanjutan     | Tetap mengikuti schema/selector/compiler serta batas versi/package                                                                                                                                              | IPv6, BGP/OSPF, chip switch, VPN dan beberapa menu belum memiliki pemeriksaan protocol lengkap; review khusus ditampilkan |

Aturan diterapkan pada perubahan paket dan editor satuan melalui compiler yang sama, termasuk proposal paket model. Pemeriksaan memakai keadaan akhir virtual dari operasi yang diminta; hanya sebagian hubungan antarobjek yang diperiksa. Laporan `configuration-delta` tidak menyatakan seluruh menu/router aman. Error backend tetap dapat muncul walaupun preview tidak menemukan error, misalnya credential rollback tersembunyi atau pembatas Invada.

Preview memakai evidence terakhir. Pembuatan rencana membaca ulang router. Sebelum apply, backend membaca ulang menu terkait dan menghentikan proses bila muncul pelanggaran atau peringatan baru yang belum ada pada review. Pembacaan ini tidak mengubah konfigurasi. Setelah grant, **backup baru export + biner terenkripsi wajib terunduh dan diperiksa**, kemudian import dan verifikasi. Rollback juga wajib backup; jalur rollback tetap tersedia untuk pemulihan konfigurasi lama.

Script manual, generator profile HotSpot lama pada halaman Perubahan, dan rencana lama tidak mendapatkan klaim pemeriksaan domain yang sama. Rencana automation dari versi aturan lama harus disusun ulang sebelum apply; rollback rencana yang sudah dieksekusi tetap dapat digunakan. Backup/grant berlaku pada semua jalur.

## Mengembangkan aturan

- `src/shared/standards.ts`: sumber, versi aturan, dependency evidence, evaluator delta dan kandidat DHCP.
- `src/main/automation.ts`: compiler, perlindungan router dan penyimpanan operasi validasi tanpa credential.
- `src/main/engine.ts`: pemeriksaan evidence, compiler, pengakuan peringatan dan pemeriksaan ulang sebelum backup/import.
- `src/shared/config-inputs.ts`: label, jenis input dan penjelasan nilai awal.
- `src/renderer/AutomationPage.tsx`: tahapan, formulir, preview dan profil.
- Generator skill mencantumkan versi/sumber aturan pada skill paket baru. Skill lama atau yang diedit pengguna tidak ditimpa; keselamatan tetap ditegakkan backend.

Naikkan `STANDARDS_VERSION` ketika makna aturan berubah agar draft lama meminta review baru. Jangan membuat tombol atau skill yang melewati backup/grant.
