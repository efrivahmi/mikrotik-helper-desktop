import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  BookOpen,
  FileCode2,
  Save,
} from "lucide-react";
import {
  QUICK_PURPOSES,
  ADDRESS_PLANS,
  DNS_PRESETS,
  emptyQuickSetup,
  emptySegment,
  quickModules,
  addressCandidates,
  addressConflict,
  protectedManagementPorts,
  portUsage,
  type QuickSetupConfig,
} from "../shared/quick-setup";
import { detailRows } from "../shared/routeros";
import { singletonFields } from "../shared/routeros-literals";
import {
  ipv4Subnet,
  suggestDhcpRange,
  type StandardsReport,
} from "../shared/standards";
import type { AppState, Router } from "../shared/model";
import type {
  AutomationEvidence,
  AutomationRequest,
} from "../shared/automation";
import { NetworkInput } from "./NetworkInput";
import { RateInput } from "./RateInput";
import { StandardsPanel } from "./StandardsPanel";
type Run = (method: string, input?: any, success?: string) => Promise<any>;
const api = window.helper.invoke;
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="automation-field">
      <label id={id}>{label}</label>
      <div role="group" aria-labelledby={id}>
        {children}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}
const steps = ["Router", "Kebutuhan", "Port", "IP & DHCP", "Layanan", "Review"];
export function QuickSetupPage({
  state,
  router,
  busy,
  pending,
  run,
  runRouter,
  onConnection,
  onAdvanced,
}: {
  state: AppState;
  router: Router;
  busy: boolean;
  pending: boolean;
  run: Run;
  runRouter: Run;
  onConnection: () => void;
  onAdvanced: () => void;
}) {
  const [q, setQ] = useState<QuickSetupConfig>(emptyQuickSetup),
    [step, setStep] = useState(0),
    [name, setName] = useState(() => `qs-${Date.now().toString(36)}`);
  const [managementInterface, setManagementInterface] = useState(""),
    [managementSubnet, setManagementSubnet] = useState(""),
    [alternateAccess, setAlternate] = useState(false);
  const [evidence, setEvidence] = useState<AutomationEvidence | null>(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  const [report, setReport] = useState<StandardsReport | null>(null),
    [checked, setChecked] = useState(""),
    [persist, setPersist] = useState(false),
    [profileName, setProfileName] = useState("");
  const latest = useRef(""),
    metadata = state.automationEvidence?.find((e) => e.routerId === router.id);
  useEffect(() => {
    let active = true;
    if (metadata?.id)
      void api<AutomationEvidence | null>("automation.evidence", metadata.id)
        .then((e) => {
          if (active) setEvidence(e);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [metadata?.id, router.id]);
  const interfaces = detailRows(evidence?.data.interfaces || "").filter(
      (r) => r.name,
    ),
    physical = detailRows(evidence?.data.ethernet || "").filter((r) => r.name);
  const required = quickModules(q),
    capable =
      !!evidence && required.every((id) => Object.hasOwn(evidence.data, id)),
    locked = busy || pending || checking;
  const protections = evidence
    ? protectedManagementPorts(evidence, managementInterface, q.managementPort)
    : new Set<string>();
  const addresses = detailRows(evidence?.data["ip-address"] || "").filter(
    (r) => r.address && r.interface && r.disabled !== "yes",
  );
  const sessions = [
    ...new Set(
      detailRows(evidence?.data.managementSessions || "")
        .filter((r) => r.name === router.user && r.via === "ssh")
        .map((r) => r.address)
        .filter((ip) => {
          try {
            ipv4Subnet(`${ip}/32`);
            return true;
          } catch {
            return false;
          }
        }),
    ),
  ];
  const dnsFields = singletonFields(evidence?.data.dns || ""),
    observedDns = (dnsFields.servers || dnsFields["dynamic-servers"] || "")
      .split(",")
      .map((x) => x.trim())
      .filter((ip) => {
        try {
          ipv4Subnet(`${ip}/32`);
          return true;
        } catch {
          return false;
        }
      })
      .join(",");
  const request = (): AutomationRequest => ({
    routerId: router.id,
    evidenceId: evidence?.id || "",
    name,
    managementInterface,
    managementSubnet,
    alternateAccess,
    quick: q,
  });
  const stamp = JSON.stringify(request());
  latest.current = stamp;
  const validReport = report && checked === stamp ? report : null;
  const update = (patch: Partial<QuickSetupConfig>) =>
    setQ((old) => ({ ...old, ...patch }));
  const chooseManagement = (value: string, physicalPort = q.managementPort) => {
    setManagementInterface(value);
    setQ((old) => ({
      ...old,
      managementPort: physicalPort,
      ports: old.ports.map((p) =>
        evidence &&
        protectedManagementPorts(evidence, value, physicalPort).has(p.interface)
          ? { ...p, role: "keep", segment: "", segments: [] }
          : p,
      ),
    }));
  };
  const segment = (
    id: string,
    patch: Partial<QuickSetupConfig["segments"][number]>,
  ) =>
    setQ((old) => ({
      ...old,
      segments: old.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  const port = (
    name: string,
    patch: Partial<QuickSetupConfig["ports"][number]>,
  ) =>
    setQ((old) => {
      const previous = old.ports.find((p) => p.interface === name) || {
        interface: name,
        role: "keep",
        segment: "",
        segments: [],
      };
      return {
        ...old,
        ports: [
          ...old.ports.filter((p) => p.interface !== name),
          { ...previous, ...patch },
        ],
      };
    });
  const candidateRange = (address: string) => {
    if (!evidence || !Object.hasOwn(evidence.data, "dhcp-lease")) return "";
    try {
      const r = suggestDhcpRange(address, evidence);
      return `${r.start}-${r.end}`;
    } catch {
      return "";
    }
  };
  const chooseAddress = (id: string, address: string) =>
    segment(id, { address, range: candidateRange(address) });
  const choosePurpose = (id: QuickSetupConfig["purpose"]) => {
    const p = QUICK_PURPOSES.find((p) => p.id === id)!;
    setQ((old) => ({
      ...old,
      purpose: id,
      topology: p.topology,
      segments: p.labels.map((label, i) => ({
        ...emptySegment(i, label),
        service: p.hotspot && i === 1 ? "hotspot" : "lan",
      })),
      ports: old.ports.map((p) => ({
        ...p,
        role: "keep",
        segment: "",
        segments: [],
      })),
      addressPlan: "",
      isolate: p.isolate,
    }));
  };
  const useExisting = (id: string, value: string) => {
    const row = addresses.find((r) => `${r.interface}|${r.address}` === value);
    if (row)
      segment(id, {
        attachment: "existing",
        interface: row.interface,
        address: row.address,
        dhcp: "preserve",
        service: "lan",
        range: "",
      });
  };
  const check = async () => {
    const source = request(),
      fingerprint = JSON.stringify(source);
    setChecking(true);
    setError("");
    setReport(null);
    try {
      const data = await api<StandardsReport>("automation.check", source);
      if (latest.current === fingerprint) {
        setReport(data);
        setChecked(fingerprint);
      }
    } catch (e) {
      if (latest.current === fingerprint)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };
  const next = () => {
    setError("");
    if (step === 0) {
      try {
        ipv4Subnet(managementSubnet);
      } catch {
        setError("Isi sumber administrator IPv4/prefix yang valid.");
        return;
      }
      if (!capable || !managementInterface || !q.managementPort) return;
    }
    setStep(Math.min(step + 1, 5));
    if (step === 4) void check();
  };
  const freePorts = physical.filter(
    (p) =>
      !protections.has(p.name) &&
      !portUsage(evidence!, p.name).length &&
      p.name !== q.internet.interface,
  );
  return (
    <div className="quick-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quick Setup</h2>
            <small>
              Pilih desain dan kebutuhan. Sistem menyusun rencana konfigurasi
              yang dapat direview.
            </small>
          </div>
          <button disabled={locked} onClick={onConnection}>
            <BookOpen size={15} />
            Panduan koneksi
          </button>
        </div>
        <div className="padded">
          <ol className="configuration-steps quick-steps">
            {steps.map((title, i) => (
              <li
                key={title}
                className={step === i ? "current" : step > i ? "complete" : ""}
              >
                <button
                  type="button"
                  disabled={locked || i > step}
                  onClick={() => {
                    setStep(i);
                    setError("");
                  }}
                >
                  <span>{i + 1}</span>
                  {title}
                </button>
              </li>
            ))}
          </ol>
          <div className="panel-note">
            Pilihan di halaman ini adalah rencana. Eksekusi memerlukan review,
            grant dan backup baru yang berhasil diperiksa.
          </div>
          {step === 0 && (
            <>
              <h3>1. Sambungkan dan baca router</h3>
              <p>
                {router.name} ·{" "}
                <span className="mono">
                  {router.host}:{router.port}
                </span>
              </p>
              <p className="muted">
                Jika router belum bisa diakses, buka Panduan koneksi. Router
                baru dengan akses MAC perlu disiapkan IP/SSH terlebih dahulu
                melalui WinBox.
              </p>
              <button
                className="primary"
                disabled={locked}
                onClick={() =>
                  void runRouter(
                    "automation.inspect",
                    { id: router.id, moduleIds: required },
                    "Membaca konfigurasi Quick Setup dari router.",
                  )
                }
              >
                <RefreshCw size={15} />
                Baca router untuk Quick Setup
              </button>
              {evidence && (
                <p className="muted">
                  Terbaca: {evidence.identity} · RouterOS {evidence.version} ·{" "}
                  {new Date(evidence.createdAt).toLocaleString("id-ID")}
                </p>
              )}
              {!!evidence && !capable && (
                <div className="notice">
                  Baca ulang menu yang diperlukan:{" "}
                  {required
                    .filter((id) => !Object.hasOwn(evidence.data, id))
                    .map(
                      (id) => `${id}: ${evidence.errors[id] || "belum dibaca"}`,
                    )
                    .join("; ")}
                </div>
              )}
              {sessions.length === 1 && (
                <button
                  onClick={() => {
                    setManagementSubnet(`${sessions[0]}/32`);
                    const r = addresses.find(
                      (r) => r.address.split("/")[0] === router.host,
                    );
                    if (r) chooseManagement(r.interface);
                  }}
                >
                  Gunakan sumber sesi SSH: {sessions[0]}/32
                </button>
              )}
              <div className="form-grid quick-fields">
                <Field
                  label="Nama rencana"
                  hint="Dibuat otomatis, dapat diganti; maksimal 20 karakter."
                >
                  <input
                    aria-label="Nama Quick Setup"
                    value={name}
                    maxLength={20}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Interface management yang sedang digunakan">
                  <select
                    aria-label="Interface management"
                    value={managementInterface}
                    onChange={(e) => chooseManagement(e.target.value)}
                  >
                    <option value="">Pilih dari router</option>
                    {interfaces.map((r) => (
                      <option key={r.name}>{r.name}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Sumber administrator"
                  hint="Alamat yang terlihat oleh router, termasuk source VPN/NAT."
                >
                  <NetworkInput
                    label="Sumber administrator"
                    value={managementSubnet}
                    onChange={setManagementSubnet}
                    defaultPrefix={32}
                  />
                </Field>
                <Field
                  label="Port fisik untuk mempertahankan akses"
                  hint="Port ini serta anggota bridge/VLAN management tetap dipertahankan."
                >
                  <select
                    aria-label="Port management"
                    value={q.managementPort}
                    onChange={(e) =>
                      chooseManagement(managementInterface, e.target.value)
                    }
                  >
                    <option value="">Pilih port kabel management</option>
                    {physical.map((r) => (
                      <option key={r.name}>{r.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={alternateAccess}
                  onChange={(e) => setAlternate(e.target.checked)}
                />
                Saya memiliki akses management cadangan yang sudah berfungsi
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h3>2. Pilih kebutuhan jaringan</h3>
              <div className="form-grid">
                <Field label="Untuk kebutuhan apa?">
                  <select
                    aria-label="Kebutuhan jaringan"
                    value={q.purpose}
                    onChange={(e) =>
                      choosePurpose(
                        e.target.value as QuickSetupConfig["purpose"],
                      )
                    }
                  >
                    {QUICK_PURPOSES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <small>
                    {
                      QUICK_PURPOSES.find((p) => p.id === q.purpose)
                        ?.description
                    }
                  </small>
                </Field>
                <Field label="Desain port / VLAN">
                  <select
                    aria-label="Desain jaringan"
                    value={q.topology}
                    onChange={(e) =>
                      setQ((old) => ({
                        ...old,
                        topology: e.target
                          .value as QuickSetupConfig["topology"],
                        segments:
                          e.target.value === "bridge"
                            ? old.segments.slice(0, 1)
                            : old.segments,
                        ports: old.ports.map((p) => ({
                          ...p,
                          role: "keep",
                          segment: "",
                          segments: [],
                        })),
                      }))
                    }
                  >
                    <option value="bridge">
                      Tanpa VLAN — port dalam satu LAN (bridge)
                    </option>
                    <option value="routed">
                      Tanpa VLAN — jaringan berbeda per port
                    </option>
                    <option value="vlan">VLAN — port access dan trunk</option>
                  </select>
                </Field>
                <Field label="Koneksi internet / ISP">
                  <select
                    aria-label="Jenis koneksi ISP"
                    value={q.internet.mode}
                    onChange={(e) =>
                      update({
                        internet: {
                          ...q.internet,
                          mode: e.target
                            .value as QuickSetupConfig["internet"]["mode"],
                          interface: "",
                        },
                      })
                    }
                  >
                    <option value="keep">
                      Gunakan koneksi ISP yang sudah ada
                    </option>
                    <option value="dhcp">
                      ISP memberikan IP otomatis (DHCP)
                    </option>
                    <option value="static">ISP memberikan IP statis</option>
                    <option value="pppoe">
                      ISP memberikan username/password (PPPoE)
                    </option>
                  </select>
                </Field>
                <Field label="Interface internet">
                  <select
                    aria-label="Interface ISP"
                    value={q.internet.interface}
                    onChange={(e) =>
                      setQ((old) => ({
                        ...old,
                        internet: {
                          ...old.internet,
                          interface: e.target.value,
                        },
                        ports: old.ports.map((p) =>
                          p.interface === e.target.value
                            ? { ...p, role: "keep", segment: "", segments: [] }
                            : p,
                        ),
                      }))
                    }
                  >
                    <option value="">Pilih interface ISP</option>
                    {(q.internet.mode === "keep" ? interfaces : physical).map(
                      (r) => (
                        <option
                          key={r.name}
                          disabled={
                            q.internet.mode !== "keep" &&
                            (protections.has(r.name) ||
                              !!portUsage(evidence!, r.name).length)
                          }
                        >
                          {r.name}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>
              {q.internet.mode === "static" && (
                <div className="form-grid">
                  <Field label="IP WAN dari ISP">
                    <NetworkInput
                      label="Alamat WAN"
                      value={q.internet.address}
                      onChange={(v) =>
                        update({ internet: { ...q.internet, address: v } })
                      }
                    />
                  </Field>
                  <Field label="Gateway dari ISP">
                    <input
                      aria-label="Gateway ISP"
                      value={q.internet.gateway}
                      onChange={(e) =>
                        update({
                          internet: { ...q.internet, gateway: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              {q.internet.mode === "pppoe" && (
                <div className="form-grid">
                  <Field label="Username PPPoE">
                    <input
                      autoComplete="off"
                      value={q.internet.user}
                      onChange={(e) =>
                        update({
                          internet: { ...q.internet, user: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="Password PPPoE">
                    <input
                      type="password"
                      autoComplete="off"
                      value={q.internet.password}
                      onChange={(e) =>
                        update({
                          internet: { ...q.internet, password: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              <p className="muted">
                Satu rencana Quick Setup memakai satu jalur ISP. Failover, PCC,
                pengaturan radio WiFi dan fitur lanjutan tersedia di Paket /
                Menu.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h3>3. Tentukan fungsi setiap port</h3>
              <p className="muted">
                Port dalam satu bridge berbagi gateway. Port terpisah atau VLAN
                dapat memakai subnet berbeda. Trunk membawa VLAN ke switch/AP
                yang mendukung tagging.
              </p>
              <div className="quick-segment-toolbar">
                {q.segments.map((s) => (
                  <div className="row" key={s.id}>
                    <input
                      aria-label={`Nama ${s.id}`}
                      value={s.label}
                      onChange={(e) => segment(s.id, { label: e.target.value })}
                    />
                    <span>
                      {s.id}
                      {q.topology === "vlan" && s.attachment === "new"
                        ? ` · VLAN ${s.vlan}`
                        : ""}
                    </span>
                    <button
                      className="icon"
                      aria-label={`Hapus ${s.label}`}
                      disabled={q.segments.length === 1}
                      onClick={() =>
                        update({
                          segments: q.segments.filter((x) => x.id !== s.id),
                          ports: q.ports.map((p) => ({
                            ...p,
                            segment: p.segment === s.id ? "" : p.segment,
                            segments: p.segments.filter((id) => id !== s.id),
                          })),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                disabled={q.segments.length >= 4 || q.topology === "bridge"}
                onClick={() => {
                  const index = [0, 1, 2, 3].find(
                    (i) => !q.segments.some((s) => s.id === `s${i + 1}`),
                  )!;
                  update({
                    segments: [
                      ...q.segments,
                      emptySegment(index, `Jaringan ${index + 1}`),
                    ],
                  });
                }}
              >
                <Plus size={15} />
                Tambah jaringan
              </button>
              {addresses.length > 0 && (
                <div className="quick-existing-choice">
                  <label>
                    Gunakan jaringan existing tanpa mengganti IP/DHCP
                  </label>
                  <select
                    aria-label="Tambahkan jaringan existing"
                    value=""
                    onChange={(e) => {
                      const s = q.segments.find((s) => s.attachment === "new");
                      if (s) useExisting(s.id, e.target.value);
                      else if (q.segments.length < 4) {
                        const index = [0, 1, 2, 3].find(
                            (i) =>
                              !q.segments.some((s) => s.id === `s${i + 1}`),
                          )!,
                          r = addresses.find(
                            (r) =>
                              `${r.interface}|${r.address}` === e.target.value,
                          )!;
                        update({
                          segments: [
                            ...q.segments,
                            {
                              ...emptySegment(index, r.interface),
                              attachment: "existing",
                              interface: r.interface,
                              address: r.address,
                              dhcp: "preserve",
                            },
                          ],
                        });
                      }
                    }}
                  >
                    <option value="">Pilih LAN/VLAN yang sudah terbaca</option>
                    {addresses.map((r, i) => (
                      <option key={i} value={`${r.interface}|${r.address}`}>
                        {r.interface} · {r.address}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Port asli</th>
                      <th>Penggunaan saat ini</th>
                      <th>Peran yang dipilih</th>
                      <th>Jaringan / VLAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {physical.map((r) => {
                      const p = q.ports.find((p) => p.interface === r.name) || {
                        interface: r.name,
                        role: "keep",
                        segment: "",
                        segments: [],
                      };
                      const usage = portUsage(evidence!, r.name),
                        protectedPort = protections.has(r.name),
                        wan = r.name === q.internet.interface;
                      return (
                        <tr key={r.name}>
                          <td className="mono">
                            {r.name}
                            <small>
                              {r.running === "yes"
                                ? "link aktif"
                                : "status link sesuai pembacaan"}
                            </small>
                          </td>
                          <td>
                            {protectedPort
                              ? "Management dipertahankan"
                              : usage.join("; ") ||
                                "Belum ada konfigurasi IP/bridge yang terbaca"}
                          </td>
                          <td>
                            {wan ? (
                              "Internet / ISP"
                            ) : (
                              <select
                                aria-label={`Peran ${r.name}`}
                                value={p.role}
                                disabled={protectedPort || !!usage.length}
                                onChange={(e) =>
                                  port(r.name, {
                                    role: e.target.value as any,
                                    segment: "",
                                    segments: [],
                                  })
                                }
                              >
                                <option value="keep">Pertahankan</option>
                                {q.topology === "vlan" ? (
                                  <>
                                    <option value="access">
                                      Access — perangkat tanpa tag
                                    </option>
                                    <option value="trunk">
                                      Trunk — switch/AP bertag
                                    </option>
                                  </>
                                ) : (
                                  <option value="lan">LAN / AP / switch</option>
                                )}
                              </select>
                            )}
                          </td>
                          <td>
                            {!["keep", "wan"].includes(p.role) &&
                              !wan &&
                              (p.role === "trunk" ? (
                                <div className="interface-options">
                                  {q.segments
                                    .filter((s) => s.attachment === "new")
                                    .map((s) => (
                                      <label
                                        className="inline-check"
                                        key={s.id}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={p.segments.includes(s.id)}
                                          onChange={(e) =>
                                            port(r.name, {
                                              segments: e.target.checked
                                                ? [...p.segments, s.id]
                                                : p.segments.filter(
                                                    (id) => id !== s.id,
                                                  ),
                                            })
                                          }
                                        />
                                        {s.label}
                                      </label>
                                    ))}
                                </div>
                              ) : (
                                <select
                                  aria-label={`Jaringan ${r.name}`}
                                  value={p.segment}
                                  onChange={(e) =>
                                    port(r.name, { segment: e.target.value })
                                  }
                                >
                                  <option value="">Pilih jaringan</option>
                                  {q.segments
                                    .filter((s) => s.attachment === "new")
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.label}
                                      </option>
                                    ))}
                                </select>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!freePorts.length &&
                q.segments.some((s) => s.attachment === "new") && (
                  <div className="notice">
                    Belum ada port kosong yang dapat dipakai untuk jaringan
                    baru. Pilih jaringan existing, atau siapkan migrasi port
                    melalui Paket / Menu dengan backup dan grant.
                  </div>
                )}
            </>
          )}
          {step === 3 && (
            <>
              <h3>4. Pilih rencana alamat IP dan DHCP</h3>
              <div className="form-grid">
                <Field
                  label="Pilihan rencana IP"
                  hint="Usulan alamat privat RFC 1918; bukan alamat wajib dari MikroTik atau jaminan bebas bentrok."
                >
                  <select
                    aria-label="Rencana IP"
                    value={q.addressPlan}
                    onChange={(e) => {
                      const plan = e.target
                        .value as QuickSetupConfig["addressPlan"];
                      update({
                        addressPlan: plan,
                        segments: q.segments.map((s, i) => {
                          if (
                            s.attachment === "existing" ||
                            !plan ||
                            plan === "custom"
                          )
                            return s;
                          const first = addressCandidates(i, q.site).find(
                            (a) =>
                              a.plan === plan &&
                              !addressConflict(a.address, evidence!),
                          );
                          return first
                            ? {
                                ...s,
                                address: first.address,
                                range: candidateRange(first.address),
                              }
                            : { ...s, address: "", range: "" };
                        }),
                      });
                    }}
                  >
                    <option value="">Pilih pola IP atau isi sendiri</option>
                    {ADDRESS_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                    <option value="custom">Isi setiap jaringan sendiri</option>
                  </select>
                </Field>
                <Field
                  label="Kode lokasi (untuk pola 10.site.x)"
                  hint="Mengubah kode lokasi tidak mengganti alamat yang sudah dipilih. Pilih ulang pola IP untuk memakai kode baru."
                >
                  <input
                    aria-label="Kode lokasi"
                    type="number"
                    min={1}
                    max={254}
                    value={q.site}
                    onChange={(e) => update({ site: Number(e.target.value) })}
                  />
                </Field>
              </div>
              {q.segments.map((s, i) => (
                <section className="quick-segment" key={s.id}>
                  <h3>{s.label}</h3>
                  <div className="form-grid">
                    <Field label="Sumber jaringan">
                      <select
                        aria-label={`Sumber ${s.label}`}
                        value={s.attachment}
                        onChange={(e) =>
                          segment(
                            s.id,
                            e.target.value === "new"
                              ? {
                                  attachment: "new",
                                  interface: "",
                                  address: "",
                                  range: "",
                                  dhcp: "server",
                                }
                              : {
                                  attachment: "existing",
                                  interface: "",
                                  address: "",
                                  range: "",
                                  dhcp: "preserve",
                                  service: "lan",
                                },
                          )
                        }
                      >
                        <option value="new">Buat jaringan baru</option>
                        <option value="existing">
                          Gunakan jaringan existing
                        </option>
                      </select>
                    </Field>
                    {s.attachment === "existing" ? (
                      <Field label="IP/interface yang terbaca">
                        <select
                          aria-label={`Jaringan existing ${s.label}`}
                          value={`${s.interface}|${s.address}`}
                          onChange={(e) => useExisting(s.id, e.target.value)}
                        >
                          <option value="|">Pilih dari router</option>
                          {addresses.map((r, j) => (
                            <option
                              key={j}
                              value={`${r.interface}|${r.address}`}
                            >
                              {r.interface} · {r.address}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <>
                        <Field label="Pilih kandidat IP gateway">
                          <select
                            aria-label={`Kandidat IP ${s.label}`}
                            value={
                              addressCandidates(i, q.site).some(
                                (c) => c.address === s.address,
                              )
                                ? s.address
                                : ""
                            }
                            onChange={(e) =>
                              chooseAddress(s.id, e.target.value)
                            }
                          >
                            <option value="">Isi IP sendiri</option>
                            {addressCandidates(i, q.site).map((c) => {
                              const conflict = addressConflict(
                                c.address,
                                evidence!,
                              );
                              return (
                                <option
                                  key={c.address}
                                  value={c.address}
                                  disabled={!!conflict}
                                >
                                  {c.address}
                                  {conflict
                                    ? ` · bentrok: ${conflict}`
                                    : " · kandidat"}
                                </option>
                              );
                            })}
                          </select>
                        </Field>
                        <Field label="IP gateway / prefix">
                          <NetworkInput
                            label={`Alamat ${s.label}`}
                            value={s.address}
                            onChange={(v) =>
                              segment(s.id, { address: v, range: "" })
                            }
                          />
                          {s.address &&
                            addressConflict(s.address, evidence!) && (
                              <small className="error">
                                {addressConflict(s.address, evidence!)}
                              </small>
                            )}
                        </Field>
                        {q.topology === "vlan" && (
                          <Field label="VLAN ID">
                            <input
                              aria-label={`VLAN ${s.label}`}
                              type="number"
                              min={1}
                              max={4094}
                              value={s.vlan}
                              onChange={(e) =>
                                segment(s.id, { vlan: Number(e.target.value) })
                              }
                            />
                          </Field>
                        )}
                      </>
                    )}
                    <Field label="DHCP">
                      <select
                        aria-label={`DHCP ${s.label}`}
                        value={s.dhcp}
                        disabled={s.attachment === "existing"}
                        onChange={(e) =>
                          segment(s.id, { dhcp: e.target.value as any })
                        }
                      >
                        {s.attachment === "existing" ? (
                          <option value="preserve">
                            Pertahankan DHCP yang sudah ada
                          </option>
                        ) : (
                          <>
                            <option value="server">
                              Bagikan IP otomatis (DHCP server)
                            </option>
                            <option value="none">
                              Tanpa DHCP — client memakai IP manual
                            </option>
                          </>
                        )}
                      </select>
                    </Field>
                    {s.attachment === "new" && s.dhcp === "server" && (
                      <Field label="Rentang IP client">
                        <input
                          aria-label={`Rentang DHCP ${s.label}`}
                          value={s.range}
                          onChange={(e) =>
                            segment(s.id, { range: e.target.value })
                          }
                        />
                        <button
                          disabled={!s.address}
                          onClick={() => {
                            const range = candidateRange(s.address);
                            if (range) {
                              segment(s.id, { range });
                              setError("");
                            } else
                              setError(
                                "Kandidat rentang belum dapat dihitung; periksa subnet dan alokasi yang terbaca.",
                              );
                          }}
                        >
                          Hitung kandidat DHCP
                        </button>
                      </Field>
                    )}
                  </div>
                  {s.attachment === "existing" && (
                    <p className="muted">
                      Alamat, pool, DHCP dan port existing tidak diganti oleh
                      Quick Setup.
                    </p>
                  )}
                </section>
              ))}
              <p className="muted">
                Gateway, lease dan pool yang terbaca dikeluarkan dari kandidat.
                IP statis AP/switch/printer yang tidak tercatat di DHCP tetap
                harus diperiksa. Switch/AP eksternal mengikuti desain VLAN yang
                dipilih.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <h3>5. Pilih layanan</h3>
              {!capable && (
                <div className="notice">
                  Pilihan layanan membutuhkan menu tambahan.{" "}
                  <button
                    disabled={locked}
                    onClick={() =>
                      void runRouter(
                        "automation.inspect",
                        { id: router.id, moduleIds: required },
                        "Membaca menu layanan yang dipilih.",
                      )
                    }
                  >
                    Baca menu layanan
                  </button>
                </div>
              )}
              <div className="form-grid">
                <Field label="DNS untuk client">
                  <select
                    aria-label="Pilihan DNS"
                    value={
                      !q.dns
                        ? ""
                        : DNS_PRESETS.find(
                            (p) => p.servers && p.servers === q.dns,
                          )?.id ||
                          (q.dns === observedDns && observedDns
                            ? "observed"
                            : "manual")
                    }
                    onChange={(e) => {
                      const p = DNS_PRESETS.find(
                        (p) => p.id === e.target.value,
                      );
                      if (!p) {
                        update({ dns: "" });
                        return;
                      }
                      update({
                        dns: p.id === "observed" ? observedDns : p.servers,
                      });
                    }}
                  >
                    <option value="">Pilih resolver DNS</option>
                    {DNS_PRESETS.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={p.id === "observed" && !observedDns}
                      >
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Alamat DNS (pisahkan koma)">
                  <input
                    aria-label="Alamat DNS client"
                    value={q.dns}
                    onChange={(e) => update({ dns: e.target.value })}
                  />
                </Field>
              </div>
              <div className="quick-service-checks">
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={q.firewall}
                    onChange={(e) => update({ firewall: e.target.checked })}
                  />
                  Tambahkan proteksi firewall untuk router dan trafik WAN
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={q.isolate && q.segments.length > 1}
                    disabled={!q.firewall || q.segments.length < 2}
                    onChange={(e) => update({ isolate: e.target.checked })}
                  />
                  Isolasi antar jaringan pilihan (akses administrator tetap
                  diizinkan)
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={q.disableFastTrack}
                    onChange={(e) =>
                      update({ disableFastTrack: e.target.checked })
                    }
                  />
                  Izinkan penonaktifan FastTrack untuk shaping/HotSpot/isolasi
                </label>
              </div>
              {q.segments.map((s) => (
                <section className="quick-segment" key={s.id}>
                  <h3>{s.label}</h3>
                  <div className="form-grid">
                    <Field label="Layanan akses">
                      <select
                        aria-label={`Layanan ${s.label}`}
                        value={s.service}
                        disabled={s.attachment === "existing"}
                        onChange={(e) =>
                          segment(s.id, {
                            service: e.target.value as any,
                            ...(e.target.value === "hotspot"
                              ? { dhcp: "server" }
                              : {}),
                          })
                        }
                      >
                        <option value="lan">
                          LAN / WiFi melalui AP — tanpa login router
                        </option>
                        <option
                          value="hotspot"
                          disabled={q.segments.some(
                            (x) => x.id !== s.id && x.service === "hotspot",
                          )}
                        >
                          HotSpot — login dengan akun
                        </option>
                      </select>
                    </Field>
                    <Field label="Bandwidth jaringan">
                      <select
                        aria-label={`Pengaturan bandwidth ${s.label}`}
                        value={s.shaping}
                        onChange={(e) =>
                          segment(s.id, { shaping: e.target.value as any })
                        }
                      >
                        <option value="none">
                          Pertahankan pengaturan yang ada
                        </option>
                        <option value="pcq">
                          PCQ — bagi plafon per IP client aktif
                        </option>
                        <option value="limit">
                          Simple Queue — plafon total jaringan
                        </option>
                      </select>
                    </Field>
                    {s.shaping !== "none" && (
                      <>
                        <Field label="Total upload jaringan">
                          <RateInput
                            label={`Upload ${s.label}`}
                            value={s.upload}
                            onChange={(v) => segment(s.id, { upload: v })}
                          />
                        </Field>
                        <Field label="Total download jaringan">
                          <RateInput
                            label={`Download ${s.label}`}
                            value={s.download}
                            onChange={(v) => segment(s.id, { download: v })}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                  {s.service === "hotspot" && (
                    <div className="form-grid">
                      <Field label="Domain portal lokal">
                        <input
                          value={s.hotspot.domain}
                          onChange={(e) =>
                            segment(s.id, {
                              hotspot: { ...s.hotspot, domain: e.target.value },
                            })
                          }
                        />
                      </Field>
                      <Field label="Akun HotSpot awal">
                        <input
                          autoComplete="off"
                          value={s.hotspot.user}
                          onChange={(e) =>
                            segment(s.id, {
                              hotspot: { ...s.hotspot, user: e.target.value },
                            })
                          }
                        />
                      </Field>
                      <Field label="Password akun awal">
                        <input
                          type="password"
                          autoComplete="off"
                          value={s.hotspot.password}
                          onChange={(e) =>
                            segment(s.id, {
                              hotspot: {
                                ...s.hotspot,
                                password: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Upload per akun">
                        <RateInput
                          label={`Upload akun ${s.label}`}
                          value={s.hotspot.upload}
                          onChange={(v) =>
                            segment(s.id, {
                              hotspot: { ...s.hotspot, upload: v },
                            })
                          }
                        />
                      </Field>
                      <Field label="Download per akun">
                        <RateInput
                          label={`Download akun ${s.label}`}
                          value={s.hotspot.download}
                          onChange={(v) =>
                            segment(s.id, {
                              hotspot: { ...s.hotspot, download: v },
                            })
                          }
                        />
                      </Field>
                      <p className="muted">
                        Portal bawaan dibuat dalam direktori AGENT baru. Portal
                        existing dan sesi pengguna tetap dipertahankan.
                      </p>
                    </div>
                  )}
                </section>
              ))}
              <p className="muted">
                Isi kapasitas berdasarkan layanan ISP. PCQ membagi plafon per IP
                aktif; batas per akun HotSpot berbeda dari plafon total
                jaringan. Koneksi yang sudah berjalan tidak diputus massal.
              </p>
              <p className="muted">
                Paket firewall Quick Setup menangani IPv4. Pengaturan IPv6
                tersedia pada Paket / Menu dan memerlukan review tersendiri.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <h3>6. Review rancangan</h3>
              <p>
                <strong>
                  {QUICK_PURPOSES.find((p) => p.id === q.purpose)?.title}
                </strong>{" "}
                ·{" "}
                {q.topology === "vlan"
                  ? "Segmentasi VLAN"
                  : q.topology === "bridge"
                    ? "LAN bersama"
                    : "Port terpisah"}{" "}
                · ISP {q.internet.mode} pada {q.internet.interface}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jaringan</th>
                      <th>Rencana interface / port</th>
                      <th>Gateway</th>
                      <th>DHCP / layanan</th>
                      <th>Bandwidth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.segments.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.label}
                          {q.topology === "vlan" && s.attachment === "new" && (
                            <small>VLAN {s.vlan}</small>
                          )}
                        </td>
                        <td>
                          {s.attachment === "existing"
                            ? `${s.interface} · existing`
                            : q.ports
                                .filter(
                                  (p) =>
                                    p.segment === s.id ||
                                    p.segments.includes(s.id),
                                )
                                .map((p) => `${p.interface} (${p.role})`)
                                .join(", ") || "Belum dipilih"}
                        </td>
                        <td className="mono">{s.address || "Belum dipilih"}</td>
                        <td>
                          {s.dhcp === "preserve"
                            ? "Dipertahankan"
                            : s.dhcp === "server"
                              ? s.range
                              : "IP manual"}
                          <small>{s.service}</small>
                        </td>
                        <td>
                          {s.shaping === "none"
                            ? "Dipertahankan"
                            : `${s.shaping}: ${s.upload} / ${s.download}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                Firewall {q.firewall ? "ditambahkan" : "dipertahankan"}; isolasi{" "}
                {q.isolate && q.segments.length > 1
                  ? "ditambahkan"
                  : "tidak ditambahkan"}
                . Password tidak ditampilkan pada ringkasan atau profil.
              </p>
              <button
                disabled={locked || !capable}
                onClick={() => void check()}
              >
                {checking ? "Memeriksa…" : "Periksa aturan rancangan"}
              </button>
              {validReport && <StandardsPanel report={validReport} />}
              <p className="muted">
                Backend membaca router kembali saat menyusun rencana dan sebelum
                eksekusi. Backup gagal menghentikan perubahan.
              </p>
              <label className="inline-check">
                <input
                  type="checkbox"
                  disabled={!state.secureStorage}
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                />
                Simpan credential rencana pada keyring agar tersedia setelah
                aplikasi ditutup
              </label>
            </>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="automation-actions">
            {step > 0 && (
              <button
                disabled={locked}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                Kembali
              </button>
            )}
            {step < 5 ? (
              <button
                className="primary"
                disabled={
                  locked ||
                  (step === 0 &&
                    (!capable ||
                      !managementInterface ||
                      !managementSubnet ||
                      !q.managementPort)) ||
                  (step === 1 && !q.internet.interface)
                }
                onClick={next}
              >
                Lanjut: {steps[step + 1]}
              </button>
            ) : (
              <button
                className="primary"
                disabled={
                  locked ||
                  !capable ||
                  !validReport ||
                  validReport.findings.some((f) => f.severity === "error")
                }
                onClick={() =>
                  void runRouter(
                    "automation.prepare",
                    { request: request(), persist },
                    "Rencana Quick Setup sedang disusun; belum diterapkan.",
                  )
                }
              >
                <FileCode2 size={15} />
                Siapkan rencana untuk grant
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Profil Quick Setup</h2>
            <small>
              Simpan rancangan untuk router lain; interface/IP dan credential
              perlu diperiksa ulang.
            </small>
          </div>
          <button disabled={locked} onClick={onAdvanced}>
            Paket / Menu lanjutan
          </button>
        </div>
        <div className="padded">
          <div className="row">
            <input
              aria-label="Nama profil Quick Setup"
              placeholder="Nama profil"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <button
              disabled={
                locked ||
                !evidence ||
                profileName.trim().length < 2 ||
                !managementSubnet ||
                !managementInterface
              }
              onClick={() =>
                void run(
                  "profile.save",
                  { name: profileName, request: request() },
                  "Profil Quick Setup disimpan tanpa password.",
                )
              }
            >
              <Save size={15} />
              Simpan profil
            </button>
            <button
              disabled={locked}
              onClick={() =>
                void run("profile.import", undefined, "Profil diimpor.")
              }
            >
              Impor
            </button>
          </div>
          {state.deploymentProfiles
            ?.filter((p) => p.request.quick)
            .map((p) => (
              <div key={p.id} className="profile-entry">
                <strong>{p.name}</strong>
                <button
                  disabled={locked}
                  onClick={() => {
                    setQ(p.request.quick!);
                    setName(p.request.name);
                    setManagementInterface("");
                    setManagementSubnet("");
                    setAlternate(false);
                    setStep(0);
                    setReport(null);
                    setChecked("");
                    setError(
                      "Profil dimuat. Baca router tujuan, pilih jalur management dan periksa semua pemetaan port/alamat; isi ulang password.",
                    );
                  }}
                >
                  Gunakan
                </button>
                <button
                  disabled={locked}
                  onClick={() =>
                    void run("profile.export", p.id, "Profil diekspor.")
                  }
                >
                  Ekspor
                </button>
                <button
                  className="icon"
                  aria-label={`Hapus profil ${p.name}`}
                  disabled={locked}
                  onClick={() =>
                    void run("profile.delete", p.id, "Profil dihapus.")
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
