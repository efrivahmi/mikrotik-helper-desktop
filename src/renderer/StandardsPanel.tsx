import { STANDARD_SOURCES, type StandardsReport } from "../shared/standards";

export function StandardsPanel({ report }: { report: StandardsReport }) {
  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  return (
    <section className="standards-panel" aria-label="Hasil pemeriksaan aturan">
      <div className="row spread">
        <h3>Aturan konfigurasi</h3>
        <span
          className={
            errors.length ? "standards-count error" : "standards-count"
          }
        >
          {errors.length
            ? `${errors.length} harus diperbaiki`
            : "Tidak ada pelanggaran pada aturan yang diperiksa"}{" "}
          · {warnings.length} peringatan
        </span>
      </div>
      <p className="muted">
        {report.rules.length} kelompok aturan · versi {report.version}.
        Pemeriksaan mencakup perubahan yang direncanakan, bukan audit seluruh
        jaringan atau sertifikasi MTCNA.
      </p>
      {report.findings.length > 0 && (
        <ul className="standards-findings">
          {report.findings.map((f, i) => (
            <li key={`${f.id}-${i}`} className={f.severity}>
              <strong>
                {f.severity === "error" ? "Perbaiki" : "Tinjau"}
                {f.operation !== undefined
                  ? ` · operasi ${f.operation + 1}`
                  : ""}
              </strong>
              <p>{f.message}</p>
              <button
                type="button"
                className="source-link"
                onClick={() =>
                  void window.helper.invoke("standards.source", f.source)
                }
              >
                {STANDARD_SOURCES[f.source].title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Aturan dan acuan yang dipakai</summary>
        <p className="muted">{report.rules.join(" · ")}</p>
        <div className="standard-sources">
          {Object.entries(STANDARD_SOURCES).map(([id, source]) => (
            <button
              key={id}
              type="button"
              className="source-link"
              onClick={() => void window.helper.invoke("standards.source", id)}
            >
              {source.title} <small>{source.kind}</small>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
