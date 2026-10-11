# Konfigurasi melalui UI — 1.3.0

## Cara memakai

1. Tambahkan koneksi router dan verifikasi host key/identity. Komputer harus memiliki jalur SSH ke perangkat: LAN, VPN atau alamat management yang benar. Router dengan akses MAC saja perlu bootstrap IP/SSH dahulu melalui WinBox atau console.
2. Buka **Konfigurasi**. Pilih **Paket** untuk formulir terarah, atau **Menu** untuk pengaturan properti RouterOS. Klik **Baca router**; semua pilihan interface/record berasal dari SSH perangkat itu.
3. Ikuti **Akses router → Isi kebutuhan → Periksa aturan**. Nama konfigurasi dibuat otomatis dan dapat diganti. Pilih interface management serta IP/prefix source administrator yang terlihat oleh router. Konfirmasi akses cadangan hanya bila jalur tersebut memang berfungsi. Bandwidth memakai angka dan pilihan satuan; IP/prefix diisi terpisah.
4. Pada editor menu, pilih record statis yang unik, pilih tindakan, isi properti, lalu **Tambahkan ke rencana**. Beberapa menu dapat digabung dalam satu rencana. Nilai kosong berarti sengaja mengosongkan properti; properti yang tidak dipilih tidak diubah.
5. Periksa aturan, perbaiki semua error, lalu klik **Siapkan rencana untuk review**. Backend membaca ulang konfigurasi serta nilai lama yang diperlukan untuk rollback. Halaman **Perubahan** menampilkan apply, rollback, precondition dan pemeriksaan target.
6. Review scope dan laporan aturan, akui peringatan, lalu ketik grant nama router/hash. Aplikasi membuat backup baru, mengunduh dan memeriksanya, baru mengunggah/import konfigurasi. Backup gagal berarti eksekusi berhenti.
7. Baca hasil pekerjaan. Periksa layanan dari client: DHCP, DNS, internet, login HotSpot, koneksi radio, laju queue, failover/VPN. Status target cocok menunjukkan pemeriksaan konfigurasi cocok; tidak menyatakan seluruh jaringan telah diuji.

Tidak ada interface, IP, bandwidth, credential atau hasil monitoring contoh yang disimpan sebagai konfigurasi pengguna. Nilai alamat/interface/credential dimasukkan admin atau dimuat dari profil milik admin. Nilai awal operasional dijelaskan dalam formulir; tombol kandidat DHCP/DNS memakai data yang terbaca. [Acuan dan batas pemeriksaan aturan](STANDARDS.md).

## Cakupan

| Domain      | Paket siap isi / editor menu                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Management  | IP sekunder, identity, IP service/SSH/WinBox/API, discovery, MAC access, administrator/group                                    |
| Switching   | Bridge, port, VLAN access/trunk/PVID/filtering, bonding, interface list, chip switch/ACL sesuai hardware                        |
| DHCP        | LAN + DHCP, VLAN + DHCP, reservasi, server/client, pool, network, options                                                       |
| ISP/routing | DHCP/static/PPPoE + NAT, failover, PCC berbobot ROS7, route/table/rule, VRF, BGP/OSPF sesuai versi                              |
| Firewall    | Proteksi input/forward, NAT/port forwarding, RAW/source block, isolasi subnet, filter/mangle/address list, bridge/IPv6 firewall |
| Bandwidth   | PCQ, simple queue, Queue Tree/HTB, queue type/FQ-CoDel/CAKE dan interface queue sesuai versi                                    |
| HotSpot     | Server, profil portal/user, akun/voucher, bandwidth, binding, walled garden, RADIUS/PPP                                         |
| WiFi        | Modern WPA2/WPA3, legacy WPA2, CAP/CAPsMAN, security, channel, datapath, provisioning/access list sesuai paket/radio            |
| VPN         | WireGuard interface/peer, IPsec, L2TP/SSTP/OpenVPN dan GRE/IPIP/EoIP/VXLAN sesuai versi                                         |
| IPv6        | Address/pool/route, DHCPv6/PD, ND, firewall                                                                                     |
| Sistem      | Clock, NTP, logging/syslog, SNMP, traffic-flow/collector, graphing                                                              |

Katalog berisi **26 paket** dan **132 menu pembacaan**. Editor mutasi tersedia untuk **129 menu**; tiga menu User Manager bersifat baca saja karena backup sistem tidak mencakup database User Manager. Katalog menyatakan cakupan, bukan jaminan bahwa setiap properti tersedia pada seluruh versi/chip. Error menu/properti asli dicatat dan tidak digantikan data palsu.

### Batas yang diterapkan

- Selector harus unik dan statis. Index print bukan identitas target. Record dinamis tidak diubah.
- Alamat SSH yang sedang dipakai dilindungi. Perubahan interface management, VLAN filtering, service dan user administration meminta deklarasi jalur cadangan serta tetap membutuhkan grant.
- Perubahan IP/pool/network/lease Invada yang sudah ada tidak dibuat oleh compiler umum. Portal `flash/IPBCirebon/IPBCirebon` tidak boleh diganti. Tugas target khusus menggunakan rencana terarah berdasarkan batas pemilik.
- FastTrack aktif menghentikan paket shaping/PCC/HotSpot kecuali admin mengizinkan penonaktifan dalam rencana. Connection lama yang sudah FastTrack perlu dievaluasi dari client; aplikasi tidak memutus sesi massal.
- PCC paket ini ditolak bila ada HotSpot aktif atau connection/routing mark aktif yang belum ditinjau. Failover mengecek gateway, bukan seluruh konektivitas internet.
- LAN baru menolak DHCP overlap dan penggunaan port anggota bridge sebagai server DHCP. Queue baru menolak simple queue aktif yang bertumpuk.
- Penghapusan rule berurutan memerlukan pemulihan posisi khusus; gunakan disable atau rencana manual. Delete object lain hanya dibuat bila seluruh properti yang diperlukan dapat direkonstruksi. Rename dengan selector yang berubah perlu selector stabil atau rencana manual.
- Reset configuration, reboot, netinstall, scripts/scheduler, external execution, firmware/device-mode/hardware confirmation dan impor certificate/key tidak diberikan sebagai tindakan umum dalam formulir ini.
- User Manager dan The Dude membutuhkan prosedur backup khusus. Katalog tidak memberikan izin perubahan database tersebut.

## HotSpot baru

Paket membuat DHCP, profil server/user, NAT dengan source/interface terarah dan akun awal. Bila resolver router belum aktif, paket menambahkan resolver dan chain firewall DNS untuk LAN HotSpot baru; nilai lama masuk rollback. FastTrack, overlap DHCP dan device-mode diperiksa.

Pilih direktori portal dengan `login.html` yang sudah tersedia, atau centang **Buat portal bawaan**. Pilihan kedua menjalankan reset-html hanya terhadap server AGENT baru dengan direktori AGENT baru; direktori yang sudah ada ditolak. Portal bawaan dipertahankan sebagai aset setelah rollback konfigurasi. HTTPS/certificate dan pengalaman captive portal harus disiapkan serta diperiksa sesuai kebutuhan; HTTP-CHAP bukan enkripsi seluruh sesi web.

## Backup wajib

Sebelum setiap apply dan rollback, aplikasi:

1. Membuat export konfigurasi tersamarkan.
2. Membuat system backup dengan password acak dan AES-SHA256 (RouterOS 6.43+/7).
3. Mengunduh file biner dua kali melalui SCP pada koneksi SSH dengan host key terverifikasi.
4. Membandingkan SHA256 kedua unduhan, menyimpan file lokal, fsync, lalu membaca ulang export/biner/password.
5. Baru mencatat backup selesai dan memulai import. Batas transfer biner 64 MiB; kegagalan permission, storage, transfer atau checksum menghentikan perubahan.

Lokasi berada di folder data aplikasi `backups/<router UUID>/`. Export `.rsc`, biner `AGENT-<backup UUID>.backup`, dan `<backup UUID>.password.txt` disimpan privat (0700/0600 pada Linux; lindungi ACL folder pada Windows). Password pemulihan tidak ditulis ke log/database/laporan. Jangan membagikan seluruh folder ini sebagai laporan publik.

Hash dan pembacaan ulang membuktikan kesesuaian transfer; **pemulihan pada perangkat belum dibuktikan**. System backup digunakan pada perangkat/versi yang sesuai dan restore dapat reboot. Restore biner tidak dijalankan otomatis. Database User Manager/The Dude serta file portal/custom assets membutuhkan arsip terpisah bila akan diubah.

## Credential dan profil

Password baru/lama yang diperlukan untuk rollback masuk vault. Rencana berisi placeholder UUID; nilai asli baru dimasukkan ke script dalam main process ketika apply. File import sementara dihapus sesudah pekerjaan jika koneksi masih tersedia; kegagalan cleanup dilaporkan. Backup biner menyimpan konfigurasi sensitif secara terenkripsi.

Keyring tersedia: centang persistence agar credential dapat dibuka setelah restart aplikasi. Tanpa persistence, credential sesi hilang ketika aplikasi ditutup dan rencana memerlukan pembuatan ulang. Profil reusable menyimpan kebutuhan/interface/IP tetapi membuang credential dan nilai rollback lama. Pada router tujuan selalu baca evidence baru, cocokkan interface/subnet, isi ulang password dan review rencana.

## Pengembangan

- `src/shared/automation.ts`: definisi menu, properti dan formulir paket.
- `src/main/automation.ts`: validasi topologi dan compiler apply/rollback/checks.
- `src/main/engine.ts`: pembacaan live, vault, backup dan eksekusi.
- `src/renderer/AutomationPage.tsx`: katalog, formulir, editor dan profil.
- `npm run skills:build`: menghasilkan 132 skill read-only dan 26 skill plan-only dari katalog. Skill data tidak memiliki kewenangan apply.

Model agent dapat membaca catalog/menu dan mengusulkan paket tanpa credential melalui compiler yang sama. Paket dengan credential diisi lewat UI. Model tidak diberi tool apply/rollback.

## Acuan RouterOS

- [Backup dan keterbatasan database](https://manual.mikrotik.com/docs/getting-started/configuration-management/backup/)
- [Argumen backup save](https://manual.mikrotik.com/docs/cli-reference/system/backup/save/)
- [Konfigurasi/export/import](https://manual.mikrotik.com/docs/getting-started/configuration-management/)
- [PCC](https://manual.mikrotik.com/docs/high-availability-solutions/load-balancing/per-connection-classifier/)
- [Queues](https://manual.mikrotik.com/docs/firewall-and-quality-of-service/queues/)
- [WiFi](https://manual.mikrotik.com/docs/wireless/wifi/)
- [HotSpot](https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/)
- [HotSpot reset-html](https://manual.mikrotik.com/docs/cli-reference/ip/hotspot/reset-html/)
