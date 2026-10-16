export function groundedModelAnswer(
  content: string,
  evidence: string[],
  snapshotId: string,
): string {
  const corpus = evidence.join("\n").toLowerCase();
  const claims =
    content.match(
      /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[a-f0-9]{2}:){5}[a-f0-9]{2}\b|\b\d+(?:\.\d+)?%/gi,
    ) || [];
  const observed = new Set(
    corpus.match(
      /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[a-f0-9]{2}:){5}[a-f0-9]{2}\b|\b\d+(?:\.\d+)?%/gi,
    ) || [],
  );
  const unsupported = claims.filter(
    (value) => !observed.has(value.toLowerCase()),
  );
  const mutationClaim =
    /\b(?:sudah|telah|berhasil)\s+(?:diubah|mengubah|diterapkan|menerapkan|diperbaiki|memperbaiki|dihapus|menghapus|dipulihkan|memulihkan)\b/i.test(
      content,
    );
  if (unsupported.length || mutationClaim)
    return `Jawaban model ditahan karena memuat nilai atau klaim tindakan yang belum didukung evidence. Gunakan temuan SSH yang bersumber pada snapshot ${snapshotId} dan detail pekerjaan. Tidak ada konfigurasi yang diterapkan oleh model.`;
  return `Analisis model — cocokkan dengan evidence snapshot ${snapshotId}. Hipotesis dan saran belum merupakan hasil verifikasi layanan.\n\n${content}\n\nModel tidak menerapkan konfigurasi. Setiap perubahan memerlukan review, konfirmasi backup penuh baru, grant dan verifikasi.`;
}
