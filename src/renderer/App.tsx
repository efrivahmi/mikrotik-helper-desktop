import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Database,
  FileCode2,
  FolderOpen,
  Gauge,
  History,
  KeyRound,
  Layers3,
  LoaderCircle,
  Network,
  Play,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Terminal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type {
  AppState,
  Router,
  Snapshot,
  Skill,
  Plan,
  Settings,
  Job,
  ConnectionReport,
  ConnectionState,
  ModelCheck,
} from "../shared/model";
import { detailRows } from "../shared/routeros";
import { AutomationPage } from "./AutomationPage";

const api = window.helper.invoke;
const connectionLabels: Record<ConnectionState["status"], string> = {
  untested: "Belum diperiksa",
  checking: "Memeriksa koneksi",
  "trust-required": "Host key perlu diverifikasi",
  connecting: "Menghubungkan SSH",
  reachable: "SSH terverifikasi",
  unreachable: "Tidak dapat dijangkau",
  "auth-failed": "Credential perlu diperbaiki",
  "host-key-changed": "Host key berubah",
  "identity-mismatch": "Identity berbeda",
};
const rate = (n?: number) =>
  n === undefined
    ? "—"
    : n >= 1e9
      ? `${(n / 1e9).toFixed(2)} Gbps`
      : n >= 1e6
        ? `${(n / 1e6).toFixed(2)} Mbps`
        : n >= 1e3
          ? `${(n / 1e3).toFixed(1)} kbps`
          : `${Math.round(n)} bps`;
const nav = [
  ["overview", "Ringkasan", Gauge],
  ["routers", "Router", RouterIcon],
  ["agent", "Agent", Activity],
  ["automation", "Konfigurasi", Layers3],
  ["diagnostics", "Diagnostik", Terminal],
  ["skills", "Pustaka skill", BookOpen],
  ["plans", "Perubahan", FileCode2],
  ["history", "Backup & riwayat", History],
  ["settings", "Pengaturan", Settings2],
] as const;
type View = (typeof nav)[number][0];
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Belum ada data";
const statusLabels: Record<string, string> = {
  draft: "Menunggu review",
  applying: "Menerapkan",
  applied: "Terverifikasi",
  "needs-review": "Perlu pemeriksaan",
  unknown: "Hasil belum pasti",
  "rolling-back": "Rollback berjalan",
  "rolled-back": "Sudah di-rollback",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
};
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Network size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <div
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  let assigned = false;
  const bind = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          id?: string;
          "aria-describedby"?: string;
        }>(node)
      )
        return node;
      if (
        !assigned &&
        ["input", "textarea", "select"].includes(String(node.type))
      ) {
        assigned = true;
        return cloneElement(node, {
          id,
          "aria-describedby": hint ? id + "-hint" : undefined,
        });
      }
      return node.props.children
        ? cloneElement(node, { children: bind(node.props.children) })
        : node;
    });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {bind(children)}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
function records(raw: string) {
  return detailRows(raw).filter((r) => r.name);
}
function memory(value?: string) {
  if (!value) return 0;
  const match = value.match(/^([\d.]+)([GMK]?i?B)/i);
  if (!match) return 0;
  return (
    Number(match[1]) *
    (/^G/i.test(match[2]) ? 1024 : /^K/i.test(match[2]) ? 1 / 1024 : 1)
  );
}
function JobDetails({ job }: { job: Job }) {
  return (
    <div className="job-detail">
      <div className="row spread">
        <strong>{job.title}</strong>
        <Badge
          tone={
            job.state === "failed"
              ? "bad"
              : job.state === "done"
                ? "good"
                : "blue"
          }
        >
          {statusLabels[job.state]}
        </Badge>
      </div>
      <small>
        {date(job.startedAt)}
        {job.endedAt && ` → ${date(job.endedAt)}`}
      </small>
      <pre className="terminal-output">
        {job.steps.join("\n\n") || "Menyiapkan pekerjaan…"}
        {job.error && `\n\nERROR: ${job.error}`}
      </pre>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>();
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState(
    localStorage.getItem("selectedRouter") || "",
  );
  const [toast, setToast] = useState<{ text: string; bad?: boolean }>();
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  const [auto, setAuto] = useState(false);
  const [routerForm, setRouterForm] = useState<Partial<Router> | null>(null);
  const [trust, setTrust] = useState<{
    id: string;
    fingerprint: string;
    action?: { method: string; input?: unknown; success?: string };
    connectAfterTrust?: boolean;
  } | null>(null);
  const [connectionReport, setConnectionReport] =
    useState<ConnectionReport | null>(null);
  const [remove, setRemove] = useState<Router | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [planForm, setPlanForm] = useState(false);
  const [grant, setGrant] = useState<{ plan: Plan; rollback: boolean } | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [skillText, setSkillText] = useState("");
  const [command, setCommand] = useState("/system resource print");
  const [evidence, setEvidence] = useState("resource");
  const [chat, setChat] = useState("");
  const [fatal, setFatal] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const activeJobs = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    try {
      const data = await api<AppState>("state", selected || undefined);
      setState(data);
      setFatal("");
    } catch (e) {
      setFatal(String(e));
    }
  }, [selected]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!selectedJob) return;
    let active = true;
    const update = async () => {
      try {
        const full = await api<Job>("job.read", selectedJob.id);
        if (active) setSelectedJob(full);
      } catch (e) {
        if (active) setToast({ text: String(e), bad: true });
      }
    };
    void update();
    const timer = setInterval(() => void update(), 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedJob?.id]);
  useEffect(() => {
    if (state && !state.routers.some((r) => r.id === selected)) {
      setSelected(state.routers[0]?.id || "");
    }
  }, [state, selected]);
  useEffect(() => {
    localStorage.setItem("selectedRouter", selected);
    setAuto(false);
  }, [selected]);
  useEffect(() => {
    if (toast && !toast.bad) {
      const timer = setTimeout(() => setToast(undefined), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const router = state?.routers.find((r) => r.id === selected);
  const snapshot = state?.snapshots.find(
    (s) => s.routerId === selected && s.source === "live",
  );
  const connection = state?.connections.find((c) => c.routerId === selected);
  const currentSnapshot =
    !!snapshot &&
    connection?.status === "reachable" &&
    Date.now() - Date.parse(snapshot.createdAt) < 120000 &&
    snapshot.metrics.identity !== undefined &&
    snapshot.metrics.cpu !== undefined;
  const jobs = state?.jobs.filter((j) => j.routerId === selected) || [];
  const busy = jobs.some((j) => j.state === "running");
  useEffect(() => {
    for (const job of state?.jobs || []) {
      if (!activeJobs.current.has(job.id) || job.state === "running") continue;
      activeJobs.current.delete(job.id);
      const prepared = state?.plans.find((p) => p.automation?.jobId === job.id);
      if (prepared && job.state === "done") {
        setSelectedPlan(prepared.id);
        setSelectedJob(null);
        setView("plans");
      }
      setToast({
        text:
          job.state === "failed"
            ? `${job.title} gagal: ${job.error || "Lihat detail pekerjaan."}`
            : `${job.title} selesai.`,
        bad: job.state === "failed",
      });
    }
  }, [state?.jobs]);
  const run = useCallback(
    async (method: string, input?: unknown, success?: string) => {
      setPending(true);
      try {
        const result = await api(method, input);
        if (method === "chat" && result) setChat("");
        if (
          [
            "snapshot",
            "backup",
            "diagnostic",
            "skill.run",
            "chat",
            "plan.apply",
            "plan.reconcile",
            "automation.inspect",
            "automation.prepare",
          ].includes(method) &&
          typeof result === "string"
        ) {
          activeJobs.current.add(result);
          if (
            [
              "diagnostic",
              "skill.run",
              "plan.apply",
              "plan.reconcile",
              "automation.inspect",
              "automation.prepare",
            ].includes(method)
          ) {
            const job = await api<Job>("job.read", result);
            setSelectedJob(job);
          }
        }
        await refresh();
        if (
          success &&
          result !== null &&
          !(method === "chat" && typeof result !== "string")
        )
          setToast({ text: success });
        return result;
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : String(e),
          bad: true,
        });
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    if (!auto || !router?.fingerprint) return;
    const timer = setInterval(() => {
      if (!busy && !pending) void run("snapshot", selected);
    }, 60000);
    return () => clearInterval(timer);
  }, [auto, router?.fingerprint, busy, pending, run, selected]);
  const runRouter = async (method: string, input: any, success?: string) => {
    const id =
      typeof input === "string" ? input : input.id || input.request?.routerId;
    const target = state?.routers.find((r) => r.id === id);
    if (!target) return;
    if (!target.fingerprint) {
      const report = (await run("router.diagnose", id)) as
        ConnectionReport | undefined;
      if (report?.needsTrust && report.fingerprint && !report.errorCode)
        setTrust({
          id,
          fingerprint: report.fingerprint,
          action: { method, input, success },
        });
      else if (report) setConnectionReport(report);
      return;
    }
    return run(method, input, success);
  };
  const checkConnection = async (id = selected) => {
    const report = await run("router.diagnose", id);
    if (report) setConnectionReport(report);
  };
  const connect = async (id = selected) => {
    const r = state?.routers.find((x) => x.id === id);
    if (!r) return;
    const report = (await run("router.diagnose", id)) as
      ConnectionReport | undefined;
    if (report?.success) {
      await run("snapshot", id, "Snapshot sedang dikumpulkan.");
    } else if (report?.needsTrust && report.fingerprint && !report.errorCode)
      setTrust({ id, fingerprint: report.fingerprint });
    else if (report) setConnectionReport(report);
  };
  const sendChat = async (text = chat) => {
    if (!selected || !text.trim()) return;
    const result = await runRouter(
      "chat",
      { id: selected, text },
      "Agent mulai bekerja.",
    );
    if (result) setChat("");
  };
  const messages = state?.messages.filter((m) => m.routerId === selected) || [];
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);
  const chooseSkill = (s: Skill) => {
    setSelectedSkill(s.name);
    setSkillText(JSON.stringify(s, null, 2));
  };
  const currentSkill = state?.skills.find((s) => s.name === selectedSkill);
  const plans = state?.plans.filter((p) => p.routerId === selected) || [];
  const plan = plans.find((p) => p.id === selectedPlan) || plans[0];
  const title = nav.find((n) => n[0] === view)?.[1];
  if (!state)
    return (
      <div className="loading">
        <RouterIcon size={34} />
        <h2>MikroTik Helper</h2>
        <p>{fatal || "Membuka workspace…"}</p>
        {fatal && <button onClick={() => void refresh()}>Coba lagi</button>}
      </div>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Network size={24} />
          </div>
          <div>
            <strong>MikroTik Helper</strong>
            <span>Desktop console</span>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "plans" &&
                state.plans.filter((p) => p.status === "draft").length > 0 && (
                  <em>
                    {state.plans.filter((p) => p.status === "draft").length}
                  </em>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="row">
            <span className="dot" />
            <span>Data tersimpan lokal</span>
          </div>
          <small>Helper Desktop · v{state.version}</small>
          <button className="text-button" onClick={() => void run("data.open")}>
            Buka folder data <ArrowUpRight size={13} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="muted tiny">ROUTER AKTIF</span>
            <select
              aria-label="Router aktif"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {!state.routers.length && (
                <option value="">Belum ada router</option>
              )}
              {state.routers.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name} · {r.host}
                </option>
              ))}
            </select>
            <span className="avatar">OP</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                MIKROTIK HELPER /{" "}
                {view === "overview" ? "OPERASIONAL" : title?.toUpperCase()}
              </div>
              <h1>{view === "overview" ? "Ringkasan jaringan" : title}</h1>
              <p>
                {
                  {
                    overview:
                      "Kondisi perangkat dan layanan berdasarkan evidence terbaru.",
                    routers:
                      "Kelola koneksi dan identitas perangkat di seluruh lokasi.",
                    agent:
                      "Jalankan pemeriksaan dan siapkan perubahan dari satu ruang kerja.",
                    automation:
                      "Pilih paket atau menu RouterOS. Siapkan konfigurasi dengan evidence, backup dan persetujuan.",
                    diagnostics:
                      "Baca kondisi RouterOS dan periksa evidence yang terkumpul.",
                    skills:
                      "Workflow operasional yang dapat diperiksa dan dikembangkan.",
                    plans:
                      "Tinjau script, rollback, dan target sebelum memberikan persetujuan.",
                    history:
                      "Arsip konfigurasi dan catatan tindakan pada perangkat.",
                    settings:
                      "Atur penyimpanan dan koneksi model untuk workspace ini.",
                  }[view]
                }
              </p>
            </div>
            <div className="row">
              {view === "routers" ? (
                <>
                  <button
                    onClick={() =>
                      void run(
                        "legacy.import",
                        undefined,
                        "Impor workspace selesai.",
                      )
                    }
                    disabled={pending}
                  >
                    <FolderOpen size={16} />
                    Impor helper lama
                  </button>
                  <button className="primary" onClick={() => setRouterForm({})}>
                    <Plus size={16} />
                    Tambah router
                  </button>
                </>
              ) : view === "skills" ? (
                <>
                  <button
                    onClick={() =>
                      void run("skill.import", undefined, "Skill diimpor.")
                    }
                  >
                    <ArrowDownToLine size={16} />
                    Impor JSON
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setSelectedSkill("new");
                      setSkillText(
                        JSON.stringify(
                          {
                            name: "skill-baru",
                            title: "Skill baru",
                            version: "1.0.0",
                            mode: "read-only",
                            purpose: "Jelaskan tujuan pemeriksaan.",
                            domains: ["routing"],
                            commands: ["/ip route print detail"],
                            checks: [],
                            safety: [],
                          },
                          null,
                          2,
                        ),
                      );
                    }}
                  >
                    <Plus size={16} />
                    Skill baru
                  </button>
                </>
              ) : view === "plans" ? (
                <button
                  className="primary"
                  disabled={!router}
                  onClick={() => setPlanForm(true)}
                >
                  <Plus size={16} />
                  Buat rencana
                </button>
              ) : view === "overview" || view === "diagnostics" ? (
                <>
                  <button
                    disabled={!router || busy || pending}
                    onClick={() =>
                      void runRouter("backup", selected, "Backup dimulai.")
                    }
                  >
                    <Database size={16} />
                    Backup
                  </button>
                  <button
                    disabled={!router || busy || pending}
                    onClick={() => void checkConnection()}
                  >
                    <Network size={16} /> Periksa koneksi
                  </button>
                  <button
                    className="primary"
                    disabled={!router || busy || pending}
                    onClick={() => void connect()}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}{" "}
                    {router?.fingerprint ? "Ambil snapshot" : "Hubungkan"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {fatal && <div className="notice error">{fatal}</div>}
          {busy && (
            <div className="running-bar">
              <LoaderCircle size={15} className="spin" />
              <strong>{jobs.find((j) => j.state === "running")?.title}</strong>
              <span>
                {jobs
                  .find((j) => j.state === "running")
                  ?.steps.at(-1)
                  ?.slice(0, 110)}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  setSelectedJob(jobs.find((j) => j.state === "running")!)
                }
              >
                Detail
              </button>
            </div>
          )}
          {router &&
            !["routers", "settings", "history"].includes(view) &&
            connection && (
              <section
                className={`connection-banner ${connection.error ? "failed" : ""}`}
                role={connection.error ? "alert" : "status"}
              >
                <Network size={18} />
                <div>
                  <strong>{connectionLabels[connection.status]}</strong>
                  <p>
                    {connection.error ||
                      (connection.status === "reachable"
                        ? `Identity ${connection.identity || router.name} diverifikasi pada ${date(connection.lastSuccessAt)}.`
                        : "Data perangkat tersedia setelah koneksi SSH dan identity berhasil diverifikasi.")}
                  </p>
                </div>
                <button
                  disabled={pending || busy}
                  onClick={() => void checkConnection()}
                >
                  Detail koneksi
                </button>
              </section>
            )}
          {!router && !["routers", "settings", "skills"].includes(view) ? (
            <Empty
              title="Tambahkan router pertama Anda"
              action={
                <button className="primary" onClick={() => setRouterForm({})}>
                  <Plus size={16} />
                  Tambah router
                </button>
              }
            >
              Hubungkan perangkat menggunakan SSH key atau password. Anda juga
              bisa mengimpor inventory helper lama dari halaman Router.
            </Empty>
          ) : null}
          {view === "automation" && router && (
            <AutomationPage
              key={router.id}
              state={state}
              router={router}
              busy={busy}
              pending={pending}
              run={run}
              runRouter={runRouter}
            />
          )}
          {view === "overview" && router && (
            <>
              <div className="device-strip">
                <div className="device-symbol">
                  <RouterIcon size={25} />
                </div>
                <div>
                  <strong>{router.expectedIdentity || router.name}</strong>
                  <span>
                    {router.host}:{router.port} <span className="sep">·</span>{" "}
                    {router.site || "Lokasi belum diisi"}
                  </span>
                </div>
                <div className="device-meta">
                  <Badge tone={currentSnapshot ? "good" : "neutral"}>
                    {currentSnapshot
                      ? "Snapshot live"
                      : snapshot
                        ? "Snapshot terakhir · historis"
                        : "Data live belum tersedia"}
                  </Badge>
                  <small>{date(snapshot?.createdAt)}</small>
                </div>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={auto}
                    disabled={!router.fingerprint}
                    onChange={(e) => setAuto(e.target.checked)}
                  />
                  Perbarui tiap 60 dtk
                </label>
              </div>
              {snapshot ? (
                <>
                  {!currentSnapshot && (
                    <div className="panel-note">
                      Data berikut diambil pada {date(snapshot.createdAt)}.
                      Kondisi router saat ini belum diperbarui. Gunakan
                      Hubungkan saat jalur LAN/VPN tersedia.
                    </div>
                  )}
                  <div className="metrics">
                    <Metric
                      label="BEBAN CPU"
                      value={
                        snapshot.metrics.cpu === undefined
                          ? "—"
                          : `${snapshot.metrics.cpu}%`
                      }
                      sub={snapshot.metrics.board || "Model tidak tersedia"}
                      progress={snapshot.metrics.cpu}
                    />
                    <Metric
                      label="MEMORI TERPAKAI"
                      value={
                        memory(snapshot.metrics.totalMemory)
                          ? `${Math.round((1 - memory(snapshot.metrics.freeMemory) / memory(snapshot.metrics.totalMemory)) * 100)}%`
                          : "—"
                      }
                      sub={`${snapshot.metrics.freeMemory || "—"} bebas / ${snapshot.metrics.totalMemory || "—"}`}
                      progress={
                        memory(snapshot.metrics.totalMemory)
                          ? (1 -
                              memory(snapshot.metrics.freeMemory) /
                                memory(snapshot.metrics.totalMemory)) *
                            100
                          : undefined
                      }
                    />
                    <Metric
                      label="HOTSPOT AKTIF"
                      value={String(snapshot.metrics.activeUsers ?? "—")}
                      sub={`${snapshot.metrics.hostCount ?? "—"} host terdeteksi`}
                      icon={<Network size={19} />}
                    />
                    <Metric
                      label="SIMPLE QUEUE"
                      value={String(snapshot.metrics.simpleQueues ?? "—")}
                      sub="Jumlah antrean pada snapshot"
                      icon={<Layers3 size={19} />}
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Interface perangkat</h2>
                          <small>Status dari snapshot terakhir</small>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            setView("diagnostics");
                            setEvidence("interfaces");
                          }}
                        >
                          Lihat evidence <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Interface</th>
                              <th>Tipe</th>
                              <th>Status</th>
                              <th>MTU</th>
                              <th>RX</th>
                              <th>TX</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records(snapshot.data.interfaces || "").map(
                              (r) => (
                                <tr key={r.index}>
                                  <td className="mono">{r.name}</td>
                                  <td>{r.type || "—"}</td>
                                  <td>
                                    <Badge
                                      tone={
                                        r.flags.includes("R")
                                          ? "good"
                                          : r.flags.includes("X")
                                            ? "neutral"
                                            : "warn"
                                      }
                                    >
                                      {r.flags.includes("R")
                                        ? "Running"
                                        : r.flags.includes("X")
                                          ? "Disabled"
                                          : "Tidak running"}
                                    </Badge>
                                  </td>
                                  <td>{r["actual-mtu"] || r.mtu || "—"}</td>
                                  <td className="mono">
                                    {rate(
                                      snapshot.metrics.interfaceTraffic?.find(
                                        (t) => t.name === r.name,
                                      )?.rxBps,
                                    )}
                                  </td>
                                  <td className="mono">
                                    {rate(
                                      snapshot.metrics.interfaceTraffic?.find(
                                        (t) => t.name === r.name,
                                      )?.txBps,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                        {!records(snapshot.data.interfaces || "").length && (
                          <div className="small-empty">
                            Detail interface belum tersedia. Ambil snapshot
                            baru.
                          </div>
                        )}
                      </div>
                    </section>
                    <div className="stack">
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Informasi perangkat</h2>
                          <ShieldCheck size={18} />
                        </div>
                        <dl>
                          <div>
                            <dt>RouterOS</dt>
                            <dd>{snapshot.metrics.version || "—"}</dd>
                          </div>
                          <div>
                            <dt>Uptime</dt>
                            <dd>{snapshot.metrics.uptime || "—"}</dd>
                          </div>
                          <div>
                            <dt>Autentikasi</dt>
                            <dd>
                              {router.auth === "key" ? "SSH key" : "Password"}
                            </dd>
                          </div>
                          <div>
                            <dt>Host key</dt>
                            <dd>
                              <Badge
                                tone={router.fingerprint ? "good" : "warn"}
                              >
                                {router.fingerprint
                                  ? "Dipercaya"
                                  : "Belum diverifikasi"}
                              </Badge>
                            </dd>
                          </div>
                        </dl>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Jalankan pemeriksaan</h2>
                        </div>
                        <div className="action-list">
                          {state.skills
                            .filter((s) => s.mode === "read-only")
                            .slice(0, 3)
                            .map((s) => (
                              <button
                                key={s.name}
                                disabled={
                                  busy || pending || !router.fingerprint
                                }
                                onClick={() =>
                                  void runRouter(
                                    "skill.run",
                                    { id: selected, name: s.name },
                                    "Pemeriksaan dimulai.",
                                  )
                                }
                              >
                                <BookOpen size={16} />
                                <span>{s.title}</span>
                                <ChevronRight size={15} />
                              </button>
                            ))}
                        </div>
                      </section>
                    </div>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>CPU pada snapshot tersimpan</h2>
                      <small>Pengambilan sampel, bukan grafik real-time</small>
                    </div>
                    <CpuChart
                      snapshots={state.snapshots
                        .filter(
                          (s) =>
                            s.routerId === selected &&
                            s.metrics.cpu !== undefined,
                        )
                        .slice(0, 20)
                        .reverse()}
                    />
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Perangkat tetangga</h2>
                      <small>Hasil discovery RouterOS</small>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Identity</th>
                            <th>Alamat</th>
                            <th>Interface</th>
                            <th>Perangkat / versi</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRows(snapshot.data.neighbors || "").map(
                            (n) => (
                              <tr key={n.index}>
                                <td>{n.identity || "—"}</td>
                                <td className="mono">{n.address || "—"}</td>
                                <td>{n.interface || "—"}</td>
                                <td>
                                  {n.board || n.platform || "—"}
                                  <small>{n.version || ""}</small>
                                </td>
                                <td>
                                  {n.address && (
                                    <button
                                      className="compact"
                                      onClick={() =>
                                        setRouterForm({
                                          name: n.identity || n.address,
                                          host: n.address,
                                          expectedIdentity: n.identity || "",
                                        })
                                      }
                                    >
                                      Tambah ke inventory
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    {!detailRows(snapshot.data.neighbors || "").length && (
                      <p className="small-empty">
                        {snapshot.errors.neighbors ||
                          "Belum ada perangkat yang dilaporkan discovery RouterOS."}
                      </p>
                    )}
                    <p className="panel-note">
                      Laju RX/TX memakai selisih dua sampel counter. Sampel
                      pertama dan counter yang direset ditampilkan —. Discovery
                      hanya mencakup perangkat yang dilaporkan router ini.
                    </p>
                  </section>
                  {Object.keys(snapshot.errors).length > 0 && (
                    <div className="notice warn">
                      {Object.keys(snapshot.errors).length} bagian evidence
                      memiliki catatan. Baca detail di Diagnostik.
                    </div>
                  )}
                </>
              ) : (
                <Empty
                  title="Belum ada data live yang terverifikasi"
                  action={
                    <button
                      className="primary"
                      onClick={() => void connect()}
                      disabled={pending || busy}
                    >
                      <Play size={16} />
                      Hubungkan & ambil snapshot
                    </button>
                  }
                >
                  Hubungkan router untuk membaca CPU, memori, interface,
                  HotSpot, dan QoS. Dashboard menampilkan data setelah perintah
                  SSH berhasil.
                </Empty>
              )}
            </>
          )}
          {view === "routers" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  Inventory{" "}
                  <span className="count">{state.routers.length}</span>
                </h2>
                <div className="search">
                  <Search size={15} />
                  <input
                    aria-label="Cari router"
                    placeholder="Cari nama, IP, atau lokasi"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama / lokasi</th>
                      <th>Alamat SSH</th>
                      <th>Autentikasi</th>
                      <th>Host key</th>
                      <th>Koneksi</th>
                      <th>Snapshot terakhir</th>
                      <th className="right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.routers
                      .filter((r) =>
                        `${r.name} ${r.host} ${r.site}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((r) => (
                        <tr key={r.id}>
                          <td>
                            <button
                              className="table-link"
                              onClick={() => {
                                setSelected(r.id);
                                setView("overview");
                              }}
                            >
                              {r.name}
                            </button>
                            <small>{r.site || "Belum ada lokasi"}</small>
                          </td>
                          <td className="mono">
                            {r.host}:{r.port}
                          </td>
                          <td>{r.auth === "key" ? "SSH key" : "Password"}</td>
                          <td>
                            <Badge tone={r.fingerprint ? "good" : "warn"}>
                              {r.fingerprint ? "Dipercaya" : "Perlu verifikasi"}
                            </Badge>
                          </td>
                          <td>
                            {
                              connectionLabels[
                                state.connections.find(
                                  (c) => c.routerId === r.id,
                                )?.status || "untested"
                              ]
                            }
                          </td>
                          <td>
                            {date(
                              state.snapshots.find((s) => s.routerId === r.id)
                                ?.createdAt,
                            )}
                          </td>
                          <td className="right">
                            <div className="row end">
                              <button
                                className="compact"
                                disabled={
                                  pending ||
                                  state.jobs.some(
                                    (j) =>
                                      j.routerId === r.id &&
                                      j.state === "running",
                                  )
                                }
                                onClick={() => {
                                  setSelected(r.id);
                                  void connect(r.id);
                                }}
                              >
                                Hubungkan
                              </button>
                              <button
                                className="compact"
                                disabled={pending || busy}
                                onClick={() => void checkConnection(r.id)}
                              >
                                Periksa
                              </button>
                              <button
                                className="icon"
                                aria-label={`Edit ${r.name}`}
                                onClick={() => setRouterForm(r)}
                              >
                                <Settings2 size={16} />
                              </button>
                              <button
                                className="icon"
                                aria-label={`Hapus ${r.name}`}
                                onClick={() => setRemove(r)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!state.routers.length && (
                  <Empty title="Inventory masih kosong">
                    Tambah router atau impor folder mikrotik-helper-agent yang
                    sudah Anda gunakan.
                  </Empty>
                )}
              </div>
            </section>
          )}
          {view === "agent" && router && (
            <div className="agent-grid">
              <section className="panel chat-panel">
                <div className="panel-heading">
                  <div className="row">
                    <Activity size={18} />
                    <h2>Agent · {router.name}</h2>
                  </div>
                  <Badge tone="blue">
                    {state.settings.aiEnabled
                      ? state.settings.aiModel
                      : "Workflow lokal"}
                  </Badge>
                </div>
                <div className="messages">
                  {!messages.length && (
                    <div className="chat-welcome">
                      <h2>Mulai dari kondisi perangkat.</h2>
                      <p>
                        Agent mengumpulkan evidence dan mencatat setiap langkah.
                        Rencana konfigurasi akan masuk ke halaman Perubahan
                        untuk Anda tinjau.
                      </p>
                      <div className="prompt-options">
                        {[
                          "Periksa kondisi router sekarang",
                          "Evaluasi pemerataan bandwidth",
                          "Buat backup konfigurasi",
                        ].map((t) => (
                          <button
                            disabled={busy}
                            key={t}
                            onClick={() => void sendChat(t)}
                          >
                            {t}
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m) => (
                    <article className={`message ${m.role}`} key={m.id}>
                      <div className="message-meta">
                        <strong>
                          {m.role === "user" ? "Anda" : "Helper Agent"}
                        </strong>
                        <time>{date(m.createdAt)}</time>
                      </div>
                      <div className="message-body">{m.text}</div>
                    </article>
                  ))}
                  {busy &&
                    jobs.some(
                      (j) => j.title === "Agent" && j.state === "running",
                    ) && (
                      <div className="agent-working">
                        <LoaderCircle size={16} className="spin" />
                        Agent sedang memeriksa perangkat…
                      </div>
                    )}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendChat();
                  }}
                >
                  <textarea
                    aria-label="Pesan untuk agent"
                    placeholder="Contoh: periksa beban CPU dan pembagian bandwidth…"
                    value={chat}
                    onChange={(e) => setChat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!busy && !pending) void sendChat();
                      }
                    }}
                  />
                  <div className="row spread">
                    <small>Enter untuk kirim · Shift + Enter baris baru</small>
                    <button
                      className="primary"
                      disabled={!chat.trim() || busy || pending}
                    >
                      <Send size={16} />
                      Kirim
                    </button>
                  </div>
                </form>
              </section>
              <aside className="stack">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Konteks pekerjaan</h2>
                  </div>
                  <dl>
                    <div>
                      <dt>Perangkat</dt>
                      <dd>{router.name}</dd>
                    </div>
                    <div>
                      <dt>Evidence terakhir</dt>
                      <dd>{date(snapshot?.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>
                        {state.settings.aiEnabled
                          ? "Endpoint model dikonfigurasi"
                          : "Belum diaktifkan"}
                      </dd>
                    </div>
                  </dl>
                  <div className="panel-note">
                    Mode lokal memeriksa kondisi, bandwidth, jaringan, HotSpot,
                    log, dan backup sesuai permintaan. Percakapan bebas memakai
                    model yang Anda atur di Pengaturan.
                  </div>
                  <button
                    className="text-button padded"
                    onClick={() => setView("settings")}
                  >
                    Pengaturan model <ArrowUpRight size={14} />
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Langkah terakhir</h2>
                  </div>
                  <div className="step-list">
                    {jobs[0]?.steps.slice(-6).map((s, i) => (
                      <div key={i}>
                        <span className="step-dot" />
                        <span>{s.slice(0, 170)}</span>
                      </div>
                    )) || <p className="muted">Belum ada pekerjaan.</p>}
                  </div>
                </section>
              </aside>
            </div>
          )}
          {view === "diagnostics" && router && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Terminal diagnostik</h2>
                  <Badge>Read-only</Badge>
                </div>
                <form
                  className="command-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runRouter(
                      "diagnostic",
                      { id: selected, command },
                      "Diagnostik dimulai.",
                    );
                  }}
                >
                  <Terminal size={18} />
                  <input
                    aria-label="Perintah diagnostik"
                    className="mono"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                  />
                  <button className="primary" disabled={busy || pending}>
                    <Play size={16} />
                    Jalankan
                  </button>
                </form>
                <div className="quick-commands">
                  {[
                    "/system resource print",
                    "/queue tree print stats",
                    "/ip route print detail",
                    "/ip hotspot active print count-only",
                    "/log print",
                  ].map((c) => (
                    <button
                      className="compact mono"
                      onClick={() => setCommand(c)}
                      key={c}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <div className="diagnostics-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Evidence snapshot</h2>
                    <select
                      aria-label="Pilih evidence"
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                    >
                      {Object.keys(snapshot?.data || {}).map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <pre className="evidence-output">
                    {snapshot?.data[evidence] ||
                      "Pilih evidence atau ambil snapshot baru."}
                  </pre>
                  {snapshot && Object.keys(snapshot.errors).length > 0 && (
                    <details className="padded">
                      <summary>Catatan pengumpulan</summary>
                      <pre>{JSON.stringify(snapshot.errors, null, 2)}</pre>
                    </details>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Pekerjaan terbaru</h2>
                  </div>
                  <div className="job-list">
                    {jobs.slice(0, 10).map((j) => (
                      <button key={j.id} onClick={() => setSelectedJob(j)}>
                        <div>
                          <strong>{j.title}</strong>
                          <small>{date(j.startedAt)}</small>
                        </div>
                        <Badge
                          tone={
                            j.state === "failed"
                              ? "bad"
                              : j.state === "running"
                                ? "blue"
                                : "good"
                          }
                        >
                          {statusLabels[j.state]}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "skills" && (
            <div className="skills-grid">
              <section className="panel skill-list">
                {state.skills.map((s) => (
                  <button
                    className={s.name === selectedSkill ? "selected" : ""}
                    key={s.name}
                    onClick={() => chooseSkill(s)}
                  >
                    <div className="row spread">
                      <BookOpen size={18} />
                      <Badge>
                        {s.mode === "read-only" ? "Pemeriksaan" : "Perencanaan"}
                      </Badge>
                    </div>
                    <strong>{s.title}</strong>
                    <span>{s.purpose}</span>
                    <small>
                      v{s.version} · {s.domains.join(", ")}
                    </small>
                  </button>
                ))}
              </section>
              <section className="panel skill-editor">
                <div className="panel-heading">
                  <h2>
                    {selectedSkill
                      ? currentSkill?.title || "Skill baru"
                      : "Definisi skill"}
                  </h2>
                  {selectedSkill && (
                    <div className="row">
                      <button
                        disabled={pending}
                        onClick={() => {
                          try {
                            void run(
                              "skill.save",
                              JSON.parse(skillText),
                              "Skill disimpan.",
                            );
                          } catch {
                            setToast({ text: "JSON tidak valid.", bad: true });
                          }
                        }}
                      >
                        <Check size={15} />
                        Simpan
                      </button>
                      {currentSkill?.mode === "read-only" && (
                        <button
                          className="primary"
                          disabled={!router || busy || pending}
                          onClick={() =>
                            void runRouter(
                              "skill.run",
                              { id: selected, name: selectedSkill },
                              "Skill mulai dijalankan.",
                            )
                          }
                        >
                          <Play size={15} />
                          Jalankan
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {selectedSkill ? (
                  <>
                    <textarea
                      className="code-editor"
                      aria-label="Definisi skill JSON"
                      spellCheck={false}
                      value={skillText}
                      onChange={(e) => setSkillText(e.target.value)}
                    />
                    <div className="panel-note">
                      Skill disimpan sebagai definisi JSON. Semua command
                      melewati daftar izin diagnostik; skill perencanaan tidak
                      menjalankan perubahan.
                    </div>
                  </>
                ) : (
                  <Empty title="Pilih workflow untuk diperiksa">
                    Skill dari helper lama tersedia di sini. Tambahkan
                    pemeriksaan baru lewat editor JSON atau impor file.
                  </Empty>
                )}
              </section>
            </div>
          )}
          {view === "plans" && router && (
            <>
              <section className="panel plan-builder">
                <div>
                  <h2>Batas bandwidth HotSpot</h2>
                  <p>
                    Siapkan apply dan rollback dari nilai profile pada snapshot
                    live.
                  </p>
                </div>
                <RateForm
                  disabled={busy || pending}
                  profiles={records(
                    snapshot?.data["hotspot-user-profile"] || "",
                  ).map((r) => r.name)}
                  onCreate={async (profile, upload, download) => {
                    const result = await run(
                      "plan.rate",
                      { id: selected, profile, upload, download },
                      "Rencana siap ditinjau.",
                    );
                    if (result) setSelectedPlan(result.id);
                  }}
                />
              </section>
              <div className="plans-grid">
                <section className="panel plan-list">
                  {plans.length ? (
                    plans.map((p) => (
                      <button
                        className={plan?.id === p.id ? "selected" : ""}
                        onClick={() => setSelectedPlan(p.id)}
                        key={p.id}
                      >
                        <strong>{p.title}</strong>
                        <small>{date(p.createdAt)}</small>
                        <Badge
                          tone={
                            p.status === "applied"
                              ? "good"
                              : p.status === "unknown" ||
                                  p.status === "needs-review"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {statusLabels[p.status]}
                        </Badge>
                      </button>
                    ))
                  ) : (
                    <div className="small-empty">
                      Belum ada rencana untuk router ini.
                    </div>
                  )}
                </section>
                <section className="panel">
                  {plan ? (
                    <>
                      <div className="panel-heading">
                        <div>
                          <h2>{plan.title}</h2>
                          <small className="mono">
                            SHA256 {plan.hash.slice(0, 16)}…
                          </small>
                        </div>
                        <button
                          onClick={() =>
                            void run(
                              "plan.export",
                              plan.id,
                              "Paket rencana diekspor.",
                            )
                          }
                        >
                          <ArrowDownToLine size={15} />
                          Ekspor
                        </button>
                      </div>
                      <div className="padded">
                        <p>{plan.reason}</p>
                        <div className="script-grid">
                          <div>
                            <h3>Apply</h3>
                            <pre className="script">{plan.apply}</pre>
                          </div>
                          <div>
                            <h3>Rollback</h3>
                            <pre className="script">{plan.rollback}</pre>
                          </div>
                        </div>
                        <h3>Verifikasi target</h3>
                        {plan.verify.map((v, i) => (
                          <div className="verification" key={i}>
                            <code>{v.command}</code>
                            <small>
                              {v.row
                                ? `Tepat satu baris: ${Object.entries(v.row)
                                    .map(
                                      ([key, value]) =>
                                        `${key}=${JSON.stringify(value)}`,
                                    )
                                    .join(" · ")}`
                                : v.count !== undefined
                                  ? `Jumlah record: ${v.count}`
                                  : v.equals !== undefined
                                    ? `Nilai target: ${JSON.stringify(v.equals)}${v.valueType ? ` (${v.valueType})` : ""}`
                                    : `Harus memuat: ${v.contains.join(" · ")}`}
                            </small>
                          </div>
                        ))}
                        <details className="risk-details">
                          <summary>Kondisi awal & target rollback</summary>
                          <pre>
                            {JSON.stringify(
                              {
                                preconditions: plan.preconditions,
                                rollbackVerify: plan.rollbackVerify,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                        <details className="risk-details">
                          <summary>Catatan review · {plan.risk.length}</summary>
                          <ul>
                            {plan.risk.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </details>
                        {plan.result && (
                          <div className="notice">{plan.result}</div>
                        )}
                        <div className="plan-footer">
                          <span>
                            <ShieldCheck size={16} />
                            Backup wajib dibuat sebelum import.
                          </span>
                          {["needs-review", "unknown"].includes(
                            plan.status,
                          ) && (
                            <button
                              disabled={busy || pending}
                              onClick={() =>
                                void run(
                                  "plan.reconcile",
                                  plan.id,
                                  "Pemeriksaan state dimulai.",
                                )
                              }
                            >
                              <RefreshCw size={15} />
                              Periksa hasil
                            </button>
                          )}
                          {plan.status === "draft" ? (
                            <button
                              className="primary"
                              disabled={busy || pending}
                              onClick={() =>
                                setGrant({ plan, rollback: false })
                              }
                            >
                              Tinjau & beri persetujuan{" "}
                              <ChevronRight size={16} />
                            </button>
                          ) : ["applied", "needs-review", "unknown"].includes(
                              plan.status,
                            ) ? (
                            <button
                              disabled={busy || pending}
                              onClick={() => setGrant({ plan, rollback: true })}
                            >
                              <Undo2 size={16} />
                              Tinjau rollback
                            </button>
                          ) : (
                            <Badge>{statusLabels[plan.status]}</Badge>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Empty title="Perubahan yang bisa ditinjau">
                      Buat rencana manual, gunakan generator profile, atau minta
                      model agent menyiapkan rencana. Script tidak diterapkan
                      saat dibuat.
                    </Empty>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "history" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Backup konfigurasi</h2>
                    <small>
                      Export tersamarkan + backup biner terenkripsi · SHA256 dan
                      pembacaan ulang sebelum eksekusi
                    </small>
                  </div>
                  <button
                    disabled={!router}
                    onClick={() =>
                      void run("report.export", selected, "Laporan diekspor.")
                    }
                  >
                    <ArrowDownToLine size={16} />
                    Ekspor laporan
                  </button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Dibuat</th>
                      <th>RouterOS</th>
                      <th>Checksum SHA256</th>
                      <th className="right">Arsip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.backups
                      .filter((b) => b.routerId === selected)
                      .map((b) => (
                        <tr key={b.id}>
                          <td>{date(b.createdAt)}</td>
                          <td>
                            {b.version}
                            <small className="block">
                              {b.verifiedAt
                                ? "Export + biner · hash cocok"
                                : "Arsip lama · export saja"}
                            </small>
                          </td>
                          <td className="mono">{b.sha256.slice(0, 24)}…</td>
                          <td className="right">
                            <button
                              className="compact"
                              onClick={() => void run("backup.reveal", b.id)}
                            >
                              <FolderOpen size={14} />
                              Buka lokasi
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!state.backups.some((b) => b.routerId === selected) && (
                  <div className="small-empty">
                    Belum ada backup dari aplikasi ini.
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Pekerjaan</h2>
                </div>
                <div className="job-list">
                  {jobs.slice(0, 20).map((j) => (
                    <button key={j.id} onClick={() => setSelectedJob(j)}>
                      <div>
                        <strong>{j.title}</strong>
                        <small>{date(j.startedAt)}</small>
                      </div>
                      <Badge
                        tone={
                          j.state === "failed"
                            ? "bad"
                            : j.state === "running"
                              ? "blue"
                              : "good"
                        }
                      >
                        {statusLabels[j.state]}
                      </Badge>
                    </button>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Audit aktivitas</h2>
                  <small>500 catatan terbaru</small>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Tindakan</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.audit
                      .filter((a) => !a.routerId || a.routerId === selected)
                      .slice(0, 50)
                      .map((a) => (
                        <tr key={a.id}>
                          <td className="nowrap">{date(a.at)}</td>
                          <td className="mono">{a.action}</td>
                          <td>{a.detail}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {view === "settings" && (
            <SettingsPage
              settings={state.settings}
              modelCheck={state.modelCheck}
              secure={state.secureStorage}
              hasKey={state.hasAiKey}
              dataDir={state.dataDir}
              pending={pending}
              run={run}
            />
          )}
        </main>
        <footer className="statusbar">
          <div>
            <span className={`dot ${busy ? "busy" : ""}`} />
            {busy
              ? "Pekerjaan berjalan"
              : router
                ? `${router.name} · SSH ${router.host}:${router.port}`
                : "Workspace siap"}
          </div>
          <span>
            {state.secureStorage
              ? "Credential: keyring OS tersedia"
              : "Credential: penyimpanan sesi tersedia"}{" "}
            <span className="sep">·</span> {state.routers.length} router
          </span>
        </footer>
      </div>
      {toast && (
        <div
          className={`toast ${toast.bad ? "error" : ""}`}
          role={toast.bad ? "alert" : "status"}
        >
          <span>{toast.text}</span>
          <button
            className="icon"
            onClick={() => setToast(undefined)}
            aria-label="Tutup pesan"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {routerForm && (
        <RouterForm
          router={routerForm}
          secure={state.secureStorage}
          pending={pending}
          onClose={() => setRouterForm(null)}
          onSave={async (r, secret, persist) => {
            const saved = await run(
              "router.save",
              { router: r, secret, persist },
              "Router disimpan.",
            );
            if (saved) {
              setSelected(saved.id);
              setRouterForm(null);
              setView("routers");
            }
          }}
        />
      )}
      {connectionReport && (
        <Modal
          title="Hasil pemeriksaan koneksi"
          wide
          onClose={() => setConnectionReport(null)}
        >
          <p>
            <strong>{connectionReport.endpoint}</strong> ·{" "}
            {date(connectionReport.checkedAt)}
          </p>
          <p className="muted">
            Alamat IPv4 komputer:{" "}
            {connectionReport.localAddresses.join(", ") ||
              "Tidak ada alamat IPv4 aktif"}
          </p>
          <div className="connection-steps">
            {connectionReport.steps.map((step, i) => (
              <div key={i}>
                <Badge
                  tone={
                    step.state === "pass"
                      ? "good"
                      : step.state === "failed"
                        ? "bad"
                        : "neutral"
                  }
                >
                  {step.state === "pass"
                    ? "Berhasil"
                    : step.state === "failed"
                      ? "Gagal"
                      : "Belum dijalankan"}
                </Badge>
                <section>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                  {step.durationMs !== undefined && (
                    <small>{step.durationMs} ms</small>
                  )}
                </section>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button
              onClick={() => {
                const r = state.routers.find(
                  (r) => r.id === connectionReport.routerId,
                );
                setConnectionReport(null);
                if (r) setRouterForm(r);
              }}
            >
              Edit koneksi
            </button>
            {connectionReport.needsTrust && connectionReport.fingerprint && (
              <button
                className="primary"
                onClick={() => {
                  setTrust({
                    id: connectionReport.routerId,
                    fingerprint: connectionReport.fingerprint!,
                    connectAfterTrust: !connectionReport.errorCode,
                  });
                  setConnectionReport(null);
                }}
              >
                Verifikasi host key
              </button>
            )}
            {connectionReport.success && (
              <button
                className="primary"
                disabled={pending || busy}
                onClick={() => {
                  const id = connectionReport.routerId;
                  setConnectionReport(null);
                  void run("snapshot", id, "Mengambil data live router.");
                }}
              >
                Ambil data live
              </button>
            )}
            <button onClick={() => setConnectionReport(null)}>Tutup</button>
          </div>
        </Modal>
      )}
      {trust && (
        <Modal title="Verifikasi identitas SSH" onClose={() => setTrust(null)}>
          <p>
            Bandingkan sidik jari berikut dengan host key perangkat melalui
            jalur yang Anda percaya. Persetujuan ini menyimpan identitas server
            untuk koneksi berikutnya.
          </p>
          <div className="fingerprint">
            <KeyRound size={22} />
            <code>{trust.fingerprint}</code>
          </div>
          <p className="muted">
            Router: {state.routers.find((r) => r.id === trust.id)?.name} ·{" "}
            {state.routers.find((r) => r.id === trust.id)?.host}
          </p>
          <div className="modal-actions">
            <button onClick={() => setTrust(null)}>Batal</button>
            <button
              className="primary"
              disabled={pending}
              onClick={async () => {
                const id = trust.id;
                setPending(true);
                try {
                  const action = trust.action;
                  await api("router.trust", {
                    id: trust.id,
                    fingerprint: trust.fingerprint,
                  });
                  setTrust(null);
                  await refresh();
                  if (trust.connectAfterTrust === false) {
                    setToast({
                      text: "Host key tersimpan. Perbaiki credential di Edit koneksi sebelum menghubungkan.",
                    });
                  } else {
                    const report = (await run("router.diagnose", id)) as
                      ConnectionReport | undefined;
                    if (report?.success)
                      await run(
                        action?.method || "snapshot",
                        action?.input ?? id,
                        action?.success || "Mengambil data router.",
                      );
                    else if (report) setConnectionReport(report);
                  }
                } catch (e) {
                  setToast({ text: String(e), bad: true });
                } finally {
                  setPending(false);
                }
              }}
            >
              <ShieldCheck size={16} />
              {trust.connectAfterTrust === false
                ? "Percayai host key"
                : "Percayai & hubungkan"}
            </button>
          </div>
        </Modal>
      )}
      {remove && (
        <Modal title="Hapus dari inventory" onClose={() => setRemove(null)}>
          <p>
            Hapus koneksi <strong>{remove.name}</strong> dari aplikasi? Arsip
            snapshot, backup, dan audit tetap tersimpan. Konfigurasi router
            tidak berubah.
          </p>
          <div className="modal-actions">
            <button onClick={() => setRemove(null)}>Batal</button>
            <button
              className="danger"
              onClick={async () => {
                const deleted = await run(
                  "router.delete",
                  remove.id,
                  "Koneksi dihapus.",
                );
                if (deleted) setRemove(null);
              }}
            >
              Hapus koneksi
            </button>
          </div>
        </Modal>
      )}
      {selectedJob && (
        <Modal
          wide
          title="Detail pekerjaan"
          onClose={() => setSelectedJob(null)}
        >
          <JobDetails job={selectedJob} />
        </Modal>
      )}
      {planForm && router && (
        <PlanForm
          id={selected}
          pending={pending}
          onClose={() => setPlanForm(false)}
          onSave={async (value) => {
            const result = await run(
              "plan.prepare",
              value,
              "Rencana disimpan untuk review.",
            );
            if (result) {
              setSelectedPlan(result.id);
              setPlanForm(false);
            }
          }}
        />
      )}
      {grant && router && (
        <Grant
          plan={grant.plan}
          rollback={grant.rollback}
          router={router}
          pending={pending}
          onClose={() => setGrant(null)}
          onConfirm={async (confirmation) => {
            const job = await run(
              "plan.apply",
              {
                id: grant.plan.id,
                hash: grant.plan.hash,
                confirmation,
                rollback: grant.rollback,
              },
              "Persetujuan diterima. Backup sedang dibuat sebelum import.",
            );
            if (job) setGrant(null);
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  progress,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  progress?: number;
  icon?: ReactNode;
}) {
  return (
    <section className="metric">
      <div className="row spread">
        <span>{label}</span>
        {icon || <Gauge size={17} />}
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
        </div>
      )}
    </section>
  );
}
function CpuChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (!snapshots.length)
    return <div className="small-empty">Belum ada sampel CPU.</div>;
  return (
    <div className="chart">
      <div className="chart-y">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <div className="chart-bars">
        {snapshots.map((s) => (
          <div key={s.id} className="chart-column">
            <div className="bar-wrap">
              <div
                title={`${date(s.createdAt)} · CPU ${s.metrics.cpu}%`}
                className="chart-bar"
                style={{ height: `${Math.max(s.metrics.cpu || 0, 1)}%` }}
              />
              <span>{s.metrics.cpu}%</span>
            </div>
            <small>
              {new Date(s.createdAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
function RouterForm({
  router,
  secure,
  pending,
  onClose,
  onSave,
}: {
  router: Partial<Router>;
  secure: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (
    router: Partial<Router>,
    secret: string,
    persist: boolean,
  ) => Promise<void>;
}) {
  const [r, setR] = useState<Partial<Router>>({
    name: "",
    host: "",
    port: 22,
    user: "",
    site: "",
    auth: "key",
    keyPath: "",
    legacyRSA: false,
    expectedIdentity: "",
    notes: "",
    ...router,
  });
  const [secret, setSecret] = useState("");
  const [persist, setPersist] = useState(false);
  const [formError, setFormError] = useState("");
  const credentialAvailable =
    !!router.hasSecret &&
    ["host", "port", "user", "auth", "keyPath"].every(
      (key) => (router as any)[key] === (r as any)[key],
    );
  const field = (key: keyof Router, value: unknown) =>
    setR((x) => ({ ...x, [key]: value }));
  return (
    <Modal
      title={router.id ? "Pengaturan router" : "Tambah router"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(r, secret, persist);
        }}
      >
        <div className="form-grid">
          <Field label="Nama perangkat">
            <input
              required
              value={r.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Gateway kampus"
            />
          </Field>
          <Field label="Lokasi">
            <input
              value={r.site}
              onChange={(e) => field("site", e.target.value)}
              placeholder="Kampus utama / Gedung A"
            />
          </Field>
          <Field label="Alamat IP / hostname">
            <input
              required
              value={r.host}
              onChange={(e) => field("host", e.target.value)}
              placeholder="192.168.88.1"
            />
          </Field>
          <Field label="Port SSH">
            <input
              required
              type="number"
              min={1}
              max={65535}
              value={r.port}
              onChange={(e) => field("port", Number(e.target.value))}
            />
          </Field>
          <Field label="Username RouterOS">
            <input
              required
              autoComplete="off"
              value={r.user}
              onChange={(e) => field("user", e.target.value)}
            />
          </Field>
          <Field label="Metode autentikasi">
            <select
              value={r.auth}
              onChange={(e) => field("auth", e.target.value)}
            >
              <option value="key">SSH private key</option>
              <option value="password">Password</option>
            </select>
          </Field>
        </div>
        {r.auth === "key" && (
          <Field
            label="File SSH private key"
            hint="Pilih file key yang tersedia pada komputer ini."
          >
            <div className="input-action">
              <input
                required
                value={r.keyPath}
                onChange={(e) => field("keyPath", e.target.value)}
                placeholder="Lokasi file key"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const path = await api("dialog.key");
                    if (path) field("keyPath", path);
                    setFormError("");
                  } catch (e) {
                    setFormError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <FolderOpen size={16} />
                Pilih
              </button>
            </div>
          </Field>
        )}
        <Field
          label={
            r.auth === "key" ? "Passphrase key (jika ada)" : "Password RouterOS"
          }
          hint={
            credentialAvailable
              ? "Credential sudah tersedia. Kosongkan untuk mempertahankannya."
              : "Credential dapat dipakai hanya selama sesi aplikasi ini."
          }
        >
          <input
            type="password"
            required={r.auth === "password" && !credentialAvailable}
            autoComplete="new-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </Field>
        <label className="inline-check">
          <input
            type="checkbox"
            disabled={!secure}
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
          />
          Simpan credential dengan enkripsi OS{" "}
          {secure ? "" : "(keyring tidak tersedia)"}
        </label>
        <Field
          label="Identity yang diharapkan"
          hint="Jika diisi, koneksi ditolak saat identity router berbeda."
        >
          <input
            value={r.expectedIdentity}
            onChange={(e) => field("expectedIdentity", e.target.value)}
            placeholder="Contoh: Invada"
          />
        </Field>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={r.legacyRSA}
            onChange={(e) => field("legacyRSA", e.target.checked)}
          />
          Kompatibilitas host key RSA lama (RouterOS 6)
        </label>
        <Field label="Catatan">
          <textarea
            rows={2}
            value={r.notes}
            onChange={(e) => field("notes", e.target.value)}
          />
        </Field>
        {formError && <p className="notice warn">{formError}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Batal
          </button>
          <button className="primary" disabled={pending}>
            <Check size={16} />
            Simpan router
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RateForm({
  profiles,
  onCreate,
  disabled,
}: {
  profiles: string[];
  onCreate: (p: string, u: string, d: string) => Promise<void>;
  disabled: boolean;
}) {
  const [profile, setProfile] = useState("");
  const [up, setUp] = useState("");
  const [down, setDown] = useState("");
  return (
    <form
      className="rate-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onCreate(profile, up, down);
      }}
    >
      <Field label="Profile">
        <input
          required
          list="profiles"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="mahasiswa"
        />
        <datalist id="profiles">
          {profiles.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Upload">
        <input
          required
          placeholder="Contoh: 2M"
          value={up}
          onChange={(e) => setUp(e.target.value)}
        />
      </Field>
      <Field label="Download">
        <input
          required
          placeholder="Contoh: 8M"
          value={down}
          onChange={(e) => setDown(e.target.value)}
        />
      </Field>
      <button disabled={disabled}>
        <FileCode2 size={16} />
        Siapkan rencana
      </button>
    </form>
  );
}
function PlanForm({
  id,
  pending,
  onClose,
  onSave,
}: {
  id: string;
  pending: boolean;
  onClose: () => void;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [apply, setApply] = useState("");
  const [rollback, setRollback] = useState("");
  const [preconditions, setPreconditions] = useState("[]");
  const [verify, setVerify] = useState("[]");
  const [rollbackVerify, setRollbackVerify] = useState("[]");
  const [error, setError] = useState("");
  return (
    <Modal wide title="Rencana perubahan manual" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setError("");
            void onSave({
              routerId: id,
              title,
              reason,
              apply,
              rollback,
              verify: JSON.parse(verify),
              rollbackVerify: JSON.parse(rollbackVerify),
              preconditions: JSON.parse(preconditions),
            });
          } catch {
            setError("JSON verifikasi tidak valid.");
          }
        }}
      >
        <Field label="Judul perubahan">
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Tujuan, dampak layanan, dan waktu pelaksanaan">
          <textarea
            required
            minLength={5}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="script-grid">
          <Field label="Apply .rsc">
            <button
              type="button"
              className="compact"
              onClick={async () => {
                const text = await api("rsc.read");
                if (text) setApply(text);
              }}
            >
              Buka file
            </button>
            <textarea
              className="code-editor short"
              required
              value={apply}
              onChange={(e) => setApply(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Field label="Rollback .rsc">
            <button
              type="button"
              className="compact"
              onClick={async () => {
                const text = await api("rsc.read");
                if (text) setRollback(text);
              }}
            >
              Buka file
            </button>
            <textarea
              className="code-editor short"
              required
              value={rollback}
              onChange={(e) => setRollback(e.target.value)}
              spellCheck={false}
            />
          </Field>
        </div>
        <div className="script-grid">
          <Field label="Verifikasi apply (JSON)">
            <textarea
              className="mono"
              rows={5}
              value={verify}
              onChange={(e) => setVerify(e.target.value)}
            />
          </Field>
          <Field label="Verifikasi rollback (JSON)">
            <textarea
              className="mono"
              rows={5}
              value={rollbackVerify}
              onChange={(e) => setRollbackVerify(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Kondisi awal sebelum apply (JSON, opsional)"
          hint="Isi pemeriksaan nilai lama untuk menghentikan apply jika konfigurasi berubah setelah rencana dibuat."
        >
          <textarea
            className="mono"
            rows={3}
            value={preconditions}
            onChange={(e) => setPreconditions(e.target.value)}
          />
        </Field>
        <p className="muted">
          Setiap pemeriksaan menjalankan command read-only dan mencocokkan semua
          teks pada contains. Gunakan nilai target yang spesifik; koneksi
          berhasil saja tidak membuktikan konfigurasi benar.
        </p>
        {error && <div className="notice error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Batal
          </button>
          <button className="primary" disabled={pending}>
            <FileCode2 size={16} />
            Simpan untuk review
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Grant({
  plan,
  router,
  rollback,
  pending,
  onClose,
  onConfirm,
}: {
  plan: Plan;
  router: Router;
  rollback: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const phrase = `${router.name} / ${plan.hash.slice(0, 8)}`;
  return (
    <Modal
      wide
      title={rollback ? "Persetujuan rollback" : "Persetujuan perubahan"}
      onClose={onClose}
    >
      <div className="grant-summary">
        <RouterIcon size={24} />
        <div>
          <strong>
            {router.name} · {router.host}
          </strong>
          <p>{plan.title}</p>
        </div>
        <Badge tone="warn">Mengubah konfigurasi</Badge>
      </div>
      <p>{plan.reason}</p>
      <pre className="script grant-script">
        {rollback ? plan.rollback : plan.apply}
      </pre>
      <div className="notice">
        Export dan backup biner terenkripsi harus berhasil diunduh dan diperiksa
        sebelum import. Jika backup gagal, eksekusi berhenti. Import dapat
        selesai sebagian jika koneksi putus; aplikasi tidak mengulangnya
        otomatis. Verifikasi dilakukan sesudah import.
      </div>
      <Field
        label={`Ketik persis: ${phrase}`}
        hint="Konfirmasi ini hanya berlaku untuk router dan isi rencana yang ditampilkan."
      >
        <input
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div className="modal-actions">
        <button onClick={onClose}>Batal</button>
        <button
          className="danger"
          disabled={text !== phrase || pending}
          onClick={() => void onConfirm(text)}
        >
          {rollback ? <Undo2 size={16} /> : <Check size={16} />}Setujui{" "}
          {rollback ? "rollback" : "& terapkan"}
        </button>
      </div>
    </Modal>
  );
}
function SettingsPage({
  settings,
  modelCheck,
  secure,
  hasKey,
  dataDir,
  pending,
  run,
}: {
  settings: Settings;
  modelCheck?: ModelCheck;
  secure: boolean;
  hasKey: boolean;
  dataDir: string;
  pending: boolean;
  run: (method: string, input?: unknown, success?: string) => Promise<any>;
}) {
  const [s, setS] = useState(settings);
  const [key, setKey] = useState("");
  const [persist, setPersist] = useState(false);
  const checked =
    modelCheck?.endpoint === s.aiBaseUrl && modelCheck.model === s.aiModel
      ? modelCheck
      : undefined;
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Model agent</h2>
            <small>
              API kompatibel Chat Completions, termasuk Ollama lokal
            </small>
          </div>
          <Badge tone={s.aiEnabled && checked?.success ? "good" : "neutral"}>
            {s.aiEnabled
              ? checked?.success
                ? "Endpoint terverifikasi"
                : "Endpoint belum terverifikasi"
              : "Workflow lokal"}
          </Badge>
        </div>
        <form
          className="padded"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "settings.save",
              { settings: s, apiKey: key || undefined, persist },
              "Pengaturan disimpan.",
            ).then((saved) => {
              if (saved) setKey("");
            });
          }}
        >
          <label className="inline-check">
            <input
              type="checkbox"
              checked={s.aiEnabled}
              onChange={(e) => setS({ ...s, aiEnabled: e.target.checked })}
            />
            Gunakan model untuk percakapan agent
          </label>
          <Field
            label="Base URL API"
            hint="Contoh model lokal: http://127.0.0.1:11434/v1"
          >
            <input
              required
              type="url"
              value={s.aiBaseUrl}
              onChange={(e) => setS({ ...s, aiBaseUrl: e.target.value })}
            />
          </Field>
          <Field label="Nama model">
            <input
              list="available-models"
              required={s.aiEnabled}
              value={s.aiModel}
              onChange={(e) => setS({ ...s, aiModel: e.target.value })}
            />
          </Field>
          <datalist id="available-models">
            {modelCheck?.availableModels.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <Field
            label="API key (jika diperlukan)"
            hint={
              hasKey
                ? "API key sudah tersedia."
                : "Ollama lokal biasanya tidak membutuhkan API key."
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={persist}
              disabled={!secure}
              onChange={(e) => setPersist(e.target.checked)}
            />
            Simpan API key dengan enkripsi OS
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={s.shareEvidence}
              onChange={(e) => setS({ ...s, shareEvidence: e.target.checked })}
            />
            Saya mengizinkan pesan dan evidence router dikirim ke endpoint di
            atas.
          </label>
          <p className="muted">
            Evidence dapat memuat alamat jaringan dan nama perangkat. Model
            hanya mendapat tool diagnostik serta pembuatan rencana. Persetujuan
            apply tetap dilakukan di aplikasi.
          </p>
          {checked && (
            <div className={`notice ${checked.success ? "" : "error"}`}>
              {checked.success
                ? `Endpoint dan model tersedia. Diperiksa ${date(checked.checkedAt)}. Kemampuan tool calling diperiksa saat agent digunakan.`
                : checked.error}
            </div>
          )}
          {modelCheck?.availableModels.length ? (
            <p className="muted">
              Model tersedia: {modelCheck.availableModels.join(", ")}
            </p>
          ) : null}
          <div className="row">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run("model.check", {
                  settings: s,
                  apiKey: key || undefined,
                })
              }
            >
              <Network size={16} />
              Periksa endpoint
            </button>
            <button className="primary" disabled={pending}>
              <Check size={16} />
              Simpan pengaturan
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={() =>
                  void run("secret.clear", "ai", "API key dihapus.")
                }
              >
                <Trash2 size={15} />
                Hapus key
              </button>
            )}
          </div>
        </form>
      </section>
      <div className="stack">
        <section className="panel">
          <div className="panel-heading">
            <h2>Workspace lokal</h2>
            <Database size={18} />
          </div>
          <div className="padded">
            <p>
              Inventory, snapshot, skill, rencana, dan riwayat disimpan dalam
              SQLite pada komputer ini.
            </p>
            <code className="path">{dataDir}</code>
            <button onClick={() => void run("data.open")}>
              <FolderOpen size={16} />
              Buka folder data
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Migrasi helper lama</h2>
          </div>
          <div className="padded">
            <p>
              Impor routers.json dan skill pack. Data dashboard diambil melalui
              koneksi aplikasi ini. Pilih ulang lokasi SSH key jika Anda pindah
              komputer atau sistem operasi.
            </p>
            <button
              onClick={() =>
                void run("legacy.import", undefined, "Impor workspace selesai.")
              }
            >
              <ArrowDownToLine size={16} />
              Pilih folder helper
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Alur perubahan</h2>
          </div>
          <ol className="workflow">
            <li>Siapkan apply dan rollback</li>
            <li>Review dampak serta verifikasi</li>
            <li>Berikan persetujuan spesifik</li>
            <li>Backup → import → snapshot</li>
            <li>Periksa target dan hasil pekerjaan</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
