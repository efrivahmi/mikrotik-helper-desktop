# MikroTik Helper 1.5.0 — Development by ep

## Perubahan

- Workflow lokal memahami beberapa topik, target eksplisit, pertanyaan lanjutan, negasi, pembatalan dan pertanyaan status backup.
- Semua tindakan Agent/skill/backup ditinjau melalui kartu konfirmasi yang terikat router/hash dan waktu. Pesan percakapan tidak menjadi grant perubahan.
- Hasil deterministik menyertakan sumber SSH, waktu, batas jumlah baris, kegagalan pembacaan serta batas kesimpulan. Konteks lama tidak menggantikan evidence baru.
- Enam belas skill diagnostik/playbook baru. Skill pengguna lama tetap dipertahankan.
- Konfirmasi backup penuh wajib di backend dan UI untuk apply maupun rollback. Export, biner terenkripsi, file pengguna terenkripsi dan manifest harus selesai/diverifikasi sebelum import.
- Kondisi awal dibaca ulang setelah backup. CPU tinggi/ambigu, data berubah dan cakupan backup khusus yang belum didukung menghentikan import.
- Pembatas diagnostik diperketat untuk menolak output file dan subscription. Selector operasi add diperbaiki. Import ssh2 kompatibel dengan ESM/CJS.
- Model dipilih eksplisit, memerlukan evidence baru, endpoint/izin yang sama dan konfirmasi. Jawaban diberi label analisis serta pemeriksaan nilai/klaim yang tidak didukung.
- Identitas tetap di aplikasi dan paket: **Development by ep**, tanpa pengaturan untuk menghapus/mengganti.

## Status

Rilis ini diterbitkan sebagai **prarilis**. Typecheck, build renderer/main/preload, AppImage Linux x64 serta NSIS installer/portable Windows x64 berhasil. Metadata paket, kecocokan bundle main dengan hasil build, 179 skill dan ketiadaan inventory/credential lokal diperiksa. Windows dibangun melalui Wine dengan prefix build tersendiri. Pengujian otomatis baru, pengujian backup penuh pada RouterOS produksi, restore hardware, model Ollama nyata serta Windows native belum dijalankan pada revisi ini. Tes koneksi/backup aplikasi 1.4.1 sebelumnya tidak membuktikan jalur file/konfirmasi baru pada 1.5.0.

Tidak menjalankan apply/rollback atau perubahan router produksi untuk membuat rilis ini. Tidak menyertakan inventory, credential, database, arsip operasional atau SSH key dalam paket/source Git. Batas backup dan penggunaan ada di [LOCAL-AGENT.md](LOCAL-AGENT.md).
