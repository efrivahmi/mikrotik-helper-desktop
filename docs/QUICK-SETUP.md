# Quick Setup dan panduan koneksi — 1.4.0

## Mulai dari koneksi

Halaman **Panduan koneksi** tersedia saat inventory kosong maupun ketika router sudah tersimpan.

1. **Jalur jaringan:** pilih LAN langsung atau VPN management, lalu siapkan kabel/adaptor atau VPN yang memiliki route ke alamat router. Checklist persiapan adalah konfirmasi pengguna; hasil sambungan tetap diperiksa terpisah.
2. **Siapkan RouterOS:** periksa IP → Addresses, IP → Services → ssh dan akun pada WinBox. Sebelum perubahan manual, buat backup di Files → Backup dan export. Router dengan akses MAC saja memerlukan bootstrap IP/SSH melalui jalur lokal/console. SSH aplikasi memakai port yang dikonfigurasi admin, dengan nilai awal 22.
3. **Akun aplikasi:** tambah/edit router, isi IP/hostname, port, username serta password atau lokasi private key. Lokasi key dari komputer/OS lama perlu dipilih kembali bila sudah tidak tersedia. Tidak memasukkan credential melalui chat.
4. **Periksa SSH:** aplikasi memeriksa credential, alamat, TCP, host key, autentikasi dan identity. Trust memerlukan kecocokan fingerprint melalui jalur tepercaya. Error disertai petunjuk sesuai kode sebenarnya: route/VPN, DNS, port, key, algoritma atau autentikasi.
5. **Baca konfigurasi:** setelah SSH terverifikasi, aplikasi membaca menu Quick Setup. Tombol lanjut dipakai setelah hasil koneksi dan pembacaan sesuai. Pada keadaan gagal/tidak tersedia, tidak ada status keberhasilan buatan.

Panduan tidak menjalankan reset, menghapus konfigurasi default, membuka akses publik, mengubah IP komputer, atau membuat VPN secara otomatis. Backup router otomatis membutuhkan SSH yang sudah tersedia. Panduan ini mengikuti [First Time Configuration MikroTik](https://manual.mikrotik.com/docs/getting-started/first-time-configuration/).

## Enam tahap Quick Setup

1. **Router:** baca konfigurasi asli, pilih interface/source administrator dan port fisik management yang dipertahankan.
2. **Kebutuhan:** pilih Rumah/toko, Kantor, Sekolah/kampus, HotSpot/tamu, Cabang atau Susun sendiri. Pilih desain dan koneksi ISP.
3. **Port:** tetapkan LAN/AP/switch, access atau trunk dari port Ethernet yang benar-benar terbaca. Port yang sudah terpakai dan jalur management dipertahankan. Jaringan default/existing dapat dipilih melalui dropdown.
4. **IP & DHCP:** pilih pola privat, gateway/prefix setiap jaringan, VLAN ID bila diperlukan, DHCP atau IP manual, serta kandidat rentang client.
5. **Layanan:** pilih DNS, firewall IPv4, isolasi, Simple Queue/PCQ atau HotSpot. Isi kapasitas ISP dan batas akun yang sesuai; password hanya di form privat.
6. **Review:** lihat pemetaan port/gateway/layanan, perbaiki error aturan dan siapkan rencana. Halaman Perubahan menampilkan script, rollback, precondition dan grant. Backup baru wajib selesai sebelum import.

## Pilihan desain

| Desain                    | Pemakaian port                                          | Alamat gateway                                            |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| Tanpa VLAN, LAN bersama   | Beberapa port pada satu bridge baru                     | Satu gateway/subnet untuk LAN bersama                     |
| Tanpa VLAN, port terpisah | Satu port fisik per jaringan baru                       | Gateway/subnet berbeda pada setiap port                   |
| VLAN                      | Port access untuk satu VLAN; trunk membawa VLAN pilihan | Interface VLAN dan gateway masing-masing pada bridge baru |
| Jaringan existing         | Pilih IP/interface yang terbaca                         | Alamat, pool, DHCP dan port existing tetap dipertahankan  |

Untuk bridge VLAN baru, CPU bridge hanya menerima frame tagged, dengan VLAN yang dinyatakan pada tabel. Jalur management lama tidak dimasukkan ke bridge baru. Filtering pada bridge existing tetap memakai paket terarah dan deklarasi akses cadangan. Acuan implementasi: [Bridge VLAN Table RouterOS](https://help.mikrotik.com/docs/spaces/ROS/pages/28606465/Bridge+VLAN+Table).

Access point/switch eksternal perlu dikonfigurasi untuk native/tagged VLAN yang sesuai. Quick Setup menyiapkan sisi MikroTik; ia tidak menganggap perangkat lain telah diprogram hanya karena role port dipilih. Pengaturan radio WiFi MikroTik tersedia melalui paket WiFi/CAPsMAN pada halaman Konfigurasi.

## Rencana IP yang disediakan

Pola dalam dropdown berasal dari ruang privat [RFC 1918](https://www.rfc-editor.org/info/rfc1918/):

- `10.<kode lokasi>.<nomor jaringan>.1/24`
- `172.16.<nomor jaringan>.1/24`
- `192.168.<nomor jaringan>.1/24`

Nomor awal jaringan adalah 10, 20, 30 dan 40, dengan kandidat alternatif 110, 120, 130 dan 140. Ini konvensi usulan aplikasi, dapat diganti; RFC tidak mewajibkan nomor port/VLAN/gateway tersebut. IP hanya dimasukkan ke draft ketika pengguna memilihnya, tidak diisi sebagai inventory/snapshot router.

Kandidat diperiksa terhadap IP interface, DHCP network dan route IPv4 yang terbaca. Route default atau route lebih luas dari /8 tidak dipakai sebagai bukti konflik subnet. Backend memeriksa lagi saat menyusun rencana serta sebelum apply. Kandidat DHCP mengecualikan gateway, IP router, lease dan pool yang terbaca; IP statis di perangkat yang tidak tercatat masih perlu diperiksa.

Mengubah kode lokasi tidak mengganti IP yang sudah dipilih. Pilih ulang pola untuk menerapkan kode baru pada draft. Perubahan desain/purpose juga dapat mereset pemetaan port; review tabel sebelum grant.

DNS dapat dipilih dari resolver IPv4 yang terbaca, diisi sendiri, atau dipilih dari [Cloudflare](https://developers.cloudflare.com/1.1.1.1/ip-addresses/) / [Google Public DNS](https://developers.google.com/speed/public-dns/docs/using). Aplikasi menyediakan alamat resmi penyedia; keterjangkauan resolver dari client tetap perlu diperiksa setelah konektivitas tersedia.

## Eksekusi dan batas saat ini

- Satu rencana menggunakan satu ISP existing atau satu ISP baru DHCP/static/PPPoE. Koneksi baru tidak menimpa prioritas default route existing. Multi ISP/failover/PCC dan migrasi port memakai paket/menu terarah.
- Maksimal empat jaringan dan 64 operasi dalam satu rencana. Pilihan yang lebih besar dihentikan dengan jumlah operasi aktual; kurangi layanan dan lanjutkan paket berikutnya setelah tahap pertama terverifikasi.
- Quick Setup tidak melepas port bridge existing atau mengganti alamat/pool/DHCP lama. Untuk router factory default, pilih jaringan default melalui **Gunakan jaringan existing**, atau siapkan migrasi melalui editor terarah. Pembatas Invada tetap berlaku.
- Firewall Quick Setup menangani IPv4. Isolasi mengatur jaringan yang dipilih, dengan pengecualian source administrator. Koneksi established tidak diputus massal. IPv6 memerlukan desain dan editor tersendiri.
- Bandwidth PCQ memakai classifier IP upload/download. Plafon jaringan berbeda dari batas per akun HotSpot. FastTrack aktif meminta pilihan penonaktifan atau review desain terlebih dahulu.
- Satu HotSpot baru per rencana, pada jaringan baru dengan DHCP/firewall, direktori portal AGENT baru dan akun awal. Portal existing dipertahankan. Asset portal baru dipertahankan setelah rollback konfigurasi.
- Profil Quick Setup dapat disimpan/import/export tanpa password. Router tujuan memerlukan pembacaan baru, pemetaan port, pemeriksaan alamat, jalur management dan credential baru. Profil ini membutuhkan aplikasi 1.4.0+.
- Tidak ada tindakan router saat memilih preset, menyimpan profil atau memeriksa draft. Preview membaca evidence; rencana dibangun dari pembacaan fresh. Setiap apply dan rollback memakai backup baru dan grant yang sudah tersedia pada engine.

Status `applied` menyatakan pemeriksaan konfigurasi target cocok. DHCP, DNS, internet, isolasi, queue, login HotSpot dan switch/AP perlu diperiksa dari client untuk membuktikan fungsi layanan. Typecheck/build bukan bukti bahwa seluruh kombinasi sudah lolos pengujian RouterOS atau Windows native.

## Source

- `src/shared/quick-setup.ts`: schema, pilihan kebutuhan, pola IP, konflik subnet dan penggunaan port.
- `src/main/quick-setup.ts`: komposisi operasi dari pilihan dan overlay rencana yang hanya berada di memori; overlay tidak disimpan sebagai evidence live.
- `src/main/automation.ts`: compiler, backup/grant binding, rollback dan pemeriksaan port existing sebelum perubahan.
- `src/renderer/QuickSetupPage.tsx`: enam tahap, dropdown, port, layanan, review dan profil.
- `src/renderer/ConnectionGuidePage.tsx`: panduan serta hasil pemeriksaan aktual.

Semua operasi melewati engine aplikasi. Tidak ada shortcut apply dari skill, model atau renderer.
