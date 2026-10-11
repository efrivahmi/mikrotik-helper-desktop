# Mengembangkan skill

Skill pack JSON tetap mengikuti format helper lama. Skill bertipe `read-only` dapat menjalankan katalog print. Skill `plan-only` menjadi panduan perencanaan; ia tidak dapat memberikan izin apply. Edit di Pustaka skill dan simpan, atau impor JSON. Perubahan disimpan pada workspace pengguna dan bertahan ketika aplikasi diperbarui.

Contoh:

```json
{
  "name": "dhcp-review",
  "title": "Pemeriksaan DHCP",
  "version": "1.0.0",
  "mode": "read-only",
  "purpose": "Periksa server, scope dan lease sebelum perubahan alamat.",
  "domains": ["dhcp", "addressing"],
  "commands": [
    "/ip dhcp-server print detail",
    "/ip dhcp-server network print detail",
    "/ip dhcp-server lease print detail",
    "/ip address print detail"
  ],
  "checks": ["Scope overlap", "Lease dan interface yang tepat"],
  "safety": ["Tidak mengubah DHCP atau alamat management."]
}
```

Nama skill harus berisi huruf kecil, angka dan tanda minus. Commands maksimal 50 per skill. `add`, `set`, `remove`, `disable`, `enable`, script dan command chaining ditolak. Perintah `print` tabel diberi `without-paging`; singleton seperti DNS dan identity memakai print biasa untuk kompatibilitas RouterOS 6.

Field tambahan lama seperti `level`, `guardrails`, `required-input`, `workflow`, dan `output` dipertahankan. Jalankan skill pada router yang tepat dan baca catatan error bila bagian tertentu tidak didukung.

Untuk domain diagnostik baru, tambahkan menu ke allowlist pada `src/main/policy.ts`, periksa grammar dan dampak operasinya, lalu tambahkan test penolakan mutasi. Untuk generator perubahan baru, buat fungsi engine yang membaca kondisi awal, membuat apply/rollback bertag, preconditions, serta verifikasi dua arah. Seluruh generator harus menggunakan `prepare()` dan `apply()` yang sudah ada.

Schema data berada pada `src/shared/model.ts`. UI hanya meminta operasi IPC yang didaftarkan di main/preload. Jangan menambahkan akses shell atau endpoint apply langsung kepada model.

## Katalog 1.2.0

132 skill inspect dan 26 configure dibuat dari `src/shared/automation.ts` melalui `npm run skills:build`. Skill inspect menjalankan read-only SSH, sedangkan configure mengarahkan ke compiler/UI dan tidak dapat memberi grant. Tambah menu/paket di katalog lalu implementasikan operasi pada `src/main/automation.ts`; gunakan jalur backup dan apply engine. Skill yang sudah diedit pengguna tidak ditimpa saat startup. Detail di [AUTOMATION.md](AUTOMATION.md).
