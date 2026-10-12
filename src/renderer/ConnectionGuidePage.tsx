import { useEffect, useState } from "react";
import { BookOpen, Check, Plus, Settings2, RefreshCw } from "lucide-react";
import type { AppState, Router } from "../shared/model";
const phases = [
  "Jalur jaringan",
  "Siapkan RouterOS",
  "Akun aplikasi",
  "Periksa SSH",
  "Baca konfigurasi",
];
const advice: Record<string, string> = {
  TCP_TIMEOUT:
    "Periksa IP, sambungan kabel/VPN, subnet komputer dan firewall management. Jika sedang di luar lokasi, alamat LAN router memerlukan jalur VPN/routing yang benar.",
  TCP_REFUSED:
    "Periksa IP → Services → ssh di WinBox: status aktif, port sesuai dan pembatas Address mencakup sumber administrator.",
  NO_ROUTE:
    "Hubungkan LAN/VPN yang menuju subnet router, lalu periksa IP inventory. Aplikasi tidak membuat jalur jaringan hanya dari alamat IP.",
  KEY_MISSING:
    "Pilih kembali file private key pada komputer ini. Path dari instalasi Kubuntu atau komputer Windows lain dapat tidak tersedia.",
  KEY_INVALID:
    "Gunakan private key, bukan file .pub. Periksa format/passphrase key atau pilih metode password yang sesuai akun RouterOS.",
  KEY_ACCESS:
    "Periksa izin baca file private key milik pengguna komputer ini; pilih file yang benar melalui Edit koneksi.",
  AUTH_MISSING:
    "Isi password RouterOS atau passphrase private key di Edit koneksi. Masukkan melalui aplikasi, bukan melalui chat.",
  AUTH_FAILED:
    "Periksa username/password, public key yang terpasang dan izin SSH akun RouterOS. Akun WinBox yang sama perlu mempunyai hak SSH.",
  HOST_CHANGED:
    "Host key berubah. Cocokkan perangkat dan fingerprint melalui jalur tepercaya sebelum memperbarui inventory; jangan langsung menyetujuinya.",
  IDENTITY_MISMATCH:
    "Identity RouterOS berbeda dari inventory. Pastikan IP menunjuk router yang benar dan periksa expected identity sebelum melanjutkan.",
  DNS_FAILED:
    "Periksa hostname atau gunakan IP management yang benar. Periksa resolver DNS komputer jika memakai hostname.",
  SSH_ALGORITHM:
    "Periksa opsi kompatibilitas RSA di Edit koneksi untuk RouterOS lama. Cocokkan versi dan algoritma perangkat sebelum mengubah opsi.",
  SSH_FAILED:
    "Periksa pesan SSH yang dicatat, service/port management dan credential. Ulangi setelah penyebab yang dilaporkan diperbaiki.",
};
export function ConnectionGuidePage({
  state,
  router,
  busy,
  pending,
  onAdd,
  onEdit,
  onChoose,
  onCheck,
  onQuick,
}: {
  state: AppState;
  router?: Router;
  busy: boolean;
  pending: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onChoose: (id: string) => void;
  onCheck: () => Promise<void>;
  onQuick: () => void;
}) {
  const [step, setStep] = useState(0),
    [path, setPath] = useState("local"),
    [prepared, setPrepared] = useState(false),
    [attemptAt, setAttemptAt] = useState(0);
  const connection = state.connections.find((c) => c.routerId === router?.id);
  const report = state.connectionReports.find(
    (r) =>
      r.routerId === router?.id &&
      r.endpoint === `${router?.host}:${router?.port}`,
  );
  const evidence = state.automationEvidence?.find(
    (e) => e.routerId === router?.id,
  );
  const current =
    report?.success &&
    connection?.status === "reachable" &&
    Date.now() - Date.parse(report.checkedAt) < 15 * 60 * 1000;
  const captured =
    current &&
    evidence &&
    Date.parse(evidence.createdAt) >= Date.parse(report.checkedAt);
  const locked = busy || pending;
  useEffect(() => {
    if (
      attemptAt &&
      report?.success &&
      Date.parse(report.checkedAt) >= attemptAt
    )
      setStep(4);
  }, [report?.id, attemptAt]);
  return (
    <section className="panel connection-guide">
      <div className="panel-heading">
        <div>
          <h2>Panduan menghubungkan router</h2>
          <small>
            Ikuti langkah dari jalur jaringan sampai konfigurasi asli terbaca.
          </small>
        </div>
        <button
          onClick={() =>
            void window.helper.invoke("standards.source", "connection")
          }
        >
          <BookOpen size={15} />
          Panduan MikroTik
        </button>
      </div>
      <div className="padded">
        {!state.routers.length && (
          <p className="muted">
            Belum ada router tersimpan. Siapkan koneksi di bawah, lalu tambahkan
            perangkat pada langkah Akun aplikasi. Router tidak diimpor otomatis.
          </p>
        )}
        <ol className="configuration-steps quick-steps">
          {phases.map((p, i) => (
            <li
              key={p}
              className={step === i ? "current" : step > i ? "complete" : ""}
            >
              <button disabled={locked} onClick={() => setStep(i)}>
                <span>{i + 1}</span>
                {p}
              </button>
            </li>
          ))}
        </ol>
        {step === 0 && (
          <>
            <h3>1. Siapkan jalur dari komputer ke router</h3>
            <label className="form-label">
              Anda terhubung dengan cara apa?
            </label>
            <select
              aria-label="Cara menjangkau router"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setPrepared(false);
              }}
            >
              <option value="local">
                Di lokasi — kabel LAN / jaringan management
              </option>
              <option value="vpn">
                Di luar lokasi — melalui VPN management
              </option>
            </select>
            {path === "local" ? (
              <ol className="guide-list">
                <li>
                  Hubungkan komputer ke port LAN/management yang diketahui.
                  Periksa lampu link dan adaptor jaringan komputer.
                </li>
                <li>
                  Gunakan IP DHCP dari jaringan yang tersedia, atau IP statis
                  dalam subnet management yang benar. Port yang dipakai
                  bergantung konfigurasi perangkat.
                </li>
                <li>
                  Buka WinBox dan identifikasi router yang benar. Jika IP belum
                  dapat diakses, MAC WinBox hanya bekerja pada jalur lokal yang
                  mendukungnya.
                </li>
              </ol>
            ) : (
              <ol className="guide-list">
                <li>
                  Hubungkan VPN yang sudah mempunyai route ke subnet management
                  router.
                </li>
                <li>
                  Pastikan alamat router adalah alamat yang dapat dijangkau dari
                  VPN tersebut. Alamat LAN privat memerlukan route yang benar
                  dari komputer Anda.
                </li>
                <li>
                  Gunakan akun dan IP management router tujuan. Membuka port
                  WinBox saja tidak menyiapkan sambungan SSH aplikasi ini.
                </li>
              </ol>
            )}
            <label className="inline-check">
              <input
                type="checkbox"
                checked={prepared}
                onChange={(e) => setPrepared(e.target.checked)}
              />
              Kabel atau VPN management sudah saya siapkan
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <h3>2. Periksa akses RouterOS melalui WinBox</h3>
            <div className="notice">
              Sebelum mengubah IP, layanan atau hak akun lewat WinBox, buat
              backup di Files → Backup dan simpan export konfigurasi. Jangan
              menghapus konfigurasi default untuk menghubungkan aplikasi.
            </div>
            <ol className="guide-list">
              <li>
                Buka <strong>IP → Addresses</strong> dan catat IP serta
                interface management yang benar.
              </li>
              <li>
                Buka <strong>IP → Services → ssh</strong>. Periksa status, port
                dan pembatas Address. Aplikasi memakai SSH; port awalnya 22 jika
                administrator belum menggantinya.
              </li>
              <li>
                Bila akses belum disiapkan, sesuaikan SSH melalui jalur admin
                yang tersedia setelah backup. Batasi source ke LAN/VPN
                administrator yang benar.
              </li>
              <li>
                Buka <strong>System → Users</strong> dan pastikan akun memiliki
                hak SSH. Untuk konfigurasi/backup, hak akun harus mencakup
                tindakan yang dibutuhkan.
              </li>
              <li>
                Jika memakai key, public key dipasang pada akun router; file
                private key tetap berada di komputer aplikasi. Password diisi
                secara privat pada form aplikasi.
              </li>
            </ol>
            <p className="muted">
              Jika SSH belum dapat dijangkau, langkah ini dilakukan admin lewat
              WinBox/console. Aplikasi baru dapat membuat backup otomatis
              setelah akses SSH tersedia.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h3>3. Tambahkan akun router di aplikasi</h3>
            <div className="form-grid">
              <div className="automation-field">
                <label>Router tersimpan</label>
                <select
                  aria-label="Router untuk panduan"
                  value={router?.id || ""}
                  onChange={(e) => {
                    onChoose(e.target.value);
                    setAttemptAt(0);
                  }}
                >
                  <option value="">Pilih router</option>
                  {state.routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.host}:{r.port}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button disabled={locked} onClick={onAdd}>
                  <Plus size={15} />
                  Tambah router
                </button>
                <button disabled={locked || !router} onClick={onEdit}>
                  <Settings2 size={15} />
                  Edit koneksi
                </button>
              </div>
            </div>
            <ol className="guide-list">
              <li>
                Isi nama router, IP management, port SSH dan username RouterOS.
              </li>
              <li>
                Pilih Password atau SSH private key. Untuk file key yang berasal
                dari instalasi lama, pilih lokasi yang tersedia di komputer saat
                ini.
              </li>
              <li>
                Simpan. Penyimpanan akun di inventory belum membuktikan koneksi;
                lanjutkan pemeriksaan SSH.
              </li>
            </ol>
            {router && (
              <div className="connection-target">
                <strong>{router.name}</strong>
                <span>
                  {router.host}:{router.port} · akun {router.user} ·{" "}
                  {router.auth === "password" ? "password" : "private key"}
                </span>
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h3>4. Periksa koneksi dan verifikasi server SSH</h3>
            <p>
              Tekan tombol untuk memeriksa credential lokal, alamat, port, host
              key, autentikasi dan identity RouterOS.
            </p>
            <button
              className="primary"
              disabled={locked || !router}
              onClick={() => {
                setAttemptAt(Date.now());
                void onCheck();
              }}
            >
              <RefreshCw size={15} />
              Periksa & hubungkan SSH
            </button>
            <p className="muted">
              Saat dialog host key muncul, cocokkan fingerprint melalui jalur
              administrasi yang dipercaya. Grant perubahan konfigurasi dilakukan
              terpisah setelah rencana tersedia.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <h3>5. Baca konfigurasi dan mulai Quick Setup</h3>
            {current ? (
              <div className="notice">
                <Check size={16} />
                SSH dan identity berhasil diperiksa.{" "}
                {captured
                  ? `Konfigurasi ${evidence.identity} / RouterOS ${evidence.version} telah dibaca.`
                  : "Tunggu pembacaan konfigurasi selesai, atau tekan tombol baca kembali."}
              </div>
            ) : (
              <p>
                Belum ada hasil SSH yang masih sesuai dengan koneksi aktif ini.
                Jalankan pemeriksaan sebelum membuka konfigurasi.
              </p>
            )}
            <button
              disabled={locked || !router}
              onClick={() => {
                setAttemptAt(Date.now());
                void onCheck();
              }}
            >
              <RefreshCw size={15} />
              Periksa SSH & baca konfigurasi
            </button>
            <ol className="guide-list">
              <li>Buka Quick Setup dan pilih kebutuhan jaringan.</li>
              <li>
                Pilih port, VLAN atau tanpa VLAN, rencana IP, DHCP dan layanan.
              </li>
              <li>
                Periksa rancangan, berikan grant, lalu aplikasi membuat backup
                baru sebelum eksekusi. Setelah itu periksa layanan dari
                perangkat client.
              </li>
            </ol>
          </>
        )}
        {report && step >= 3 && (
          <section className="guide-results">
            <h3>Hasil pemeriksaan aktual</h3>
            <p className="muted">
              {report.endpoint} ·{" "}
              {new Date(report.checkedAt).toLocaleString("id-ID")}
            </p>
            <div className="connection-steps">
              {report.steps.map((s, i) => (
                <div key={i}>
                  <span
                    className={`badge ${s.state === "pass" ? "good" : s.state === "failed" ? "bad" : "neutral"}`}
                  >
                    {s.state === "pass"
                      ? "Berhasil"
                      : s.state === "failed"
                        ? "Gagal"
                        : "Belum selesai"}
                  </span>
                  <section>
                    <strong>{s.label}</strong>
                    <p>{s.detail}</p>
                  </section>
                </div>
              ))}
            </div>
            {report.errorCode && (
              <div className="notice error">
                <strong>Langkah perbaikan</strong>
                <p>
                  {advice[report.errorCode] ||
                    "Baca langkah yang gagal, periksa inventory dan akses management pada perangkat, lalu ulangi pemeriksaan."}
                </p>
                <button disabled={locked || !router} onClick={onEdit}>
                  Edit koneksi router
                </button>
              </div>
            )}
          </section>
        )}
        <div className="automation-actions">
          {step > 0 && (
            <button disabled={locked} onClick={() => setStep(step - 1)}>
              Kembali
            </button>
          )}
          {step < 4 ? (
            <button
              className="primary"
              disabled={
                locked || (step === 0 && !prepared) || (step === 2 && !router)
              }
              onClick={() => setStep(step + 1)}
            >
              Lanjut: {phases[step + 1]}
            </button>
          ) : (
            <button
              className="primary"
              disabled={locked || !captured}
              onClick={onQuick}
            >
              Buka Quick Setup
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
