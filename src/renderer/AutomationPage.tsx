import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  FileCode2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  CONFIG_MODULES,
  RECIPES,
  configModule,
  isSecretField,
  type AutomationEvidence,
  type AutomationRequest,
  type ConfigOperation,
  type RecipeField,
} from "../shared/automation";
import { detailRows } from "../shared/routeros";
import { singletonFields } from "../shared/routeros-literals";
import type { AppState, Router } from "../shared/model";
import {
  ipv4Subnet,
  suggestDhcpRange,
  type StandardsReport,
} from "../shared/standards";
import {
  PROPERTY_LABELS,
  propertyInput,
  RECIPE_DEFAULTS,
  RECIPE_HINTS,
} from "../shared/config-inputs";
import { StandardsPanel } from "./StandardsPanel";
import { RateInput } from "./RateInput";
import { NetworkInput } from "./NetworkInput";
const api = window.helper.invoke;
type Run = (method: string, input?: any, success?: string) => Promise<any>;
function InputField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
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
const uniqueSelector = (
  rows: Record<string, string>[],
  row: Record<string, string>,
  moduleId: string,
) => {
  const m = configModule(moduleId)!;
  for (const k of ["name", "comment"]) {
    if (row[k] && rows.filter((r) => r[k] === row[k]).length === 1)
      return { [k]: row[k] };
  }
  const selector = Object.fromEntries(
    [...new Set([...m.keys, ...m.fields])]
      .filter(
        (k) =>
          row[k] &&
          !isSecretField(k) &&
          !["disabled", "password", "dynamic"].includes(k),
      )
      .slice(0, 8)
      .map((k) => [k, row[k]]),
  );
  return rows.filter((r) =>
    Object.entries(selector).every(([k, v]) => r[k] === v),
  ).length === 1
    ? selector
    : {};
};
export function AutomationPage({
  state,
  router,
  busy,
  pending,
  run,
  runRouter,
}: {
  state: AppState;
  router: Router;
  busy: boolean;
  pending: boolean;
  run: Run;
  runRouter: Run;
}) {
  const [mode, setMode] = useState<"recipe" | "menu">("recipe"),
    [chosen, setChosen] = useState(""),
    [query, setQuery] = useState("");
  const [name, setName] = useState(""),
    [params, setParams] = useState<Record<string, any>>({});
  const [managementSubnet, setManagementSubnet] = useState(""),
    [managementInterface, setManagementInterface] = useState(""),
    [alternateAccess, setAlternate] = useState(false),
    [persist, setPersist] = useState(false);
  const [evidence, setEvidence] = useState<AutomationEvidence | null>(null),
    [error, setError] = useState("");
  const [action, setAction] = useState<ConfigOperation["action"]>("set"),
    [record, setRecord] = useState("");
  const [properties, setProperties] = useState<
      { key: string; value: string; old: string }[]
    >([]),
    [operations, setOperations] = useState<ConfigOperation[]>([]);
  const [profileName, setProfileName] = useState("");
  const [step, setStep] = useState(0),
    [checking, setChecking] = useState(false);
  const [report, setReport] = useState<StandardsReport | null>(null),
    [checkedRequest, setCheckedRequest] = useState("");
  const latestRequest = useRef("");
  const [advancedProperties, setAdvancedProperties] = useState(false);
  const metadata = state.automationEvidence?.find(
    (e) => e.routerId === router.id,
  );
  useEffect(() => {
    setEvidence(null);
    setError("");
    setParams({});
    setOperations([]);
    setRecord("");
    setProperties([]);
    setManagementInterface("");
    setManagementSubnet("");
    setAlternate(false);
    setStep(0);
    setReport(null);
    setCheckedRequest("");
  }, [router.id]);
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
  const recipe =
      mode === "recipe" ? RECIPES.find((r) => r.id === chosen) : undefined,
    module = mode === "menu" ? configModule(chosen) : undefined;
  const interfaces = detailRows(evidence?.data.interfaces || "")
    .filter((r) => r.name)
    .map((r) => r.name);
  const rows =
    module && !module.singleton
      ? detailRows(evidence?.data[module.id] || "")
      : [];
  const selected = rows.find((r) => r.index === record);
  const singleton = module?.singleton
    ? singletonFields(evidence?.data[module.id] || "")
    : {};
  const moduleIds = recipe?.modules || [
    ...(module ? [module.id] : []),
    ...operations.map((o) => o.moduleId),
  ];
  const capable =
    !!evidence &&
    moduleIds.length > 0 &&
    moduleIds.every((id) => Object.hasOwn(evidence.data, id));
  const locked = busy || pending || checking;
  const changeChoice = (id: string) => {
    setChosen(id);
    const next = RECIPES.find((r) => r.id === id);
    setParams(
      Object.fromEntries(
        (next?.fields || [])
          .filter((f) => RECIPE_DEFAULTS[f.key] !== undefined)
          .map((f) => [f.key, RECIPE_DEFAULTS[f.key]]),
      ),
    );
    if (!id) setName("");
    else if (!name || mode === "recipe")
      setName(`${id.slice(0, 22)}-${Date.now().toString(36).slice(-6)}`);
    setRecord("");
    setProperties([]);
    setError("");
    setStep(0);
    setReport(null);
    setAdvancedProperties(false);
  };
  const request = (): AutomationRequest => ({
    routerId: router.id,
    evidenceId: evidence?.id || "",
    name,
    managementSubnet,
    managementInterface,
    alternateAccess,
    ...(mode === "recipe" ? { recipeId: chosen, params } : { operations }),
  });
  const fingerprint = JSON.stringify(request());
  latestRequest.current = fingerprint;
  const validReport = report && checkedRequest === fingerprint ? report : null;
  const checkRules = async () => {
    const source = request(),
      stamp = JSON.stringify(source);
    setError("");
    setChecking(true);
    setReport(null);
    try {
      const result = await api<StandardsReport>("automation.check", source);
      if (latestRequest.current === stamp) {
        setReport(result);
        setCheckedRequest(stamp);
      }
    } catch (e) {
      if (latestRequest.current === stamp)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };
  const sessionSources = [
    ...new Set(
      detailRows(evidence?.data.managementSessions || "")
        .filter((r) => r.name === router.user && r.via === "ssh")
        .map((r) => r.address)
        .filter((a) => {
          try {
            ipv4Subnet(`${a}/32`);
            return true;
          } catch {
            return false;
          }
        }),
    ),
  ];
  const endpointInterface = detailRows(evidence?.data["ip-address"] || "").find(
    (r) => r.address?.split("/")[0] === router.host,
  )?.interface;
  const suggestRange = () => {
    if (!evidence) return;
    try {
      const r = suggestDhcpRange(String(params.address || ""), evidence);
      setParams((p) => ({ ...p, range: `${r.start}-${r.end}` }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const propertyValue = (
    p: { key: string; value: string; old: string },
    i: number,
  ) => {
    const f = propertyInput(module?.id || "", p.key),
      update = (value: string) =>
        setProperties((v) => v.map((x, j) => (j === i ? { ...x, value } : x)));
    if (f.kind === "rate")
      return (
        <RateInput
          label={PROPERTY_LABELS[p.key] || p.key}
          value={p.value}
          onChange={update}
        />
      );
    if (
      f.kind === "rate-pair" ||
      (p.key === "rate-limit" &&
        /^\d*(?:\.\d*)?[kMG]?\/\d*(?:\.\d*)?[kMG]?$/.test(p.value || "/"))
    ) {
      const [up = "", down = ""] = p.value.split("/");
      return (
        <div className="rate-pair">
          <div>
            <small>Upload</small>
            <RateInput
              label="Upload"
              value={up}
              onChange={(v) => update(`${v}/${down}`)}
            />
          </div>
          <div>
            <small>Download</small>
            <RateInput
              label="Download"
              value={down}
              onChange={(v) => update(`${up}/${v}`)}
            />
          </div>
        </div>
      );
    }
    if (module?.id === "ip-address" && p.key === "address")
      return (
        <NetworkInput
          label="Alamat interface"
          value={p.value}
          onChange={update}
        />
      );
    if (["boolean", "select", "interface"].includes(f.kind))
      return (
        <select
          aria-label="Nilai baru"
          value={p.value}
          onChange={(e) => update(e.target.value)}
        >
          <option value="">Pilih nilai</option>
          {(f.kind === "interface" ? interfaces : f.options || []).map((v) => (
            <option key={v} value={v}>
              {f.kind === "boolean" ? (v === "yes" ? "Ya" : "Tidak") : v}
            </option>
          ))}
        </select>
      );
    return (
      <input
        aria-label="Nilai baru"
        type={f.kind === "secret" ? "password" : "text"}
        autoComplete="off"
        placeholder="Nilai baru"
        value={p.value}
        onChange={(e) => update(e.target.value)}
      />
    );
  };
  const enqueue = () => {
    if (!module) return;
    const selector =
      module.singleton || action === "add"
        ? {}
        : selected
          ? uniqueSelector(rows, selected, module.id)
          : {};
    if (
      !module.singleton &&
      action !== "add" &&
      !Object.keys(selector).length
    ) {
      setError(
        "Pilih record dengan selector unik. Record dinamis tidak dapat diubah.",
      );
      return;
    }
    const values = Object.fromEntries(
      properties.filter((p) => p.key).map((p) => [p.key, p.value]),
    );
    if (["add", "set"].includes(action) && !Object.keys(values).length) {
      setError("Tambahkan properti yang akan diisi atau diubah.");
      return;
    }
    if (
      new Set(properties.filter((p) => p.key).map((p) => p.key)).size !==
      properties.filter((p) => p.key).length
    ) {
      setError("Nama properti tidak boleh berulang.");
      return;
    }
    const originalValues = Object.fromEntries(
      properties
        .filter((p) => isSecretField(p.key) && p.old !== "")
        .map((p) => [p.key, p.old]),
    );
    setOperations((v) => [
      ...v,
      {
        moduleId: module.id,
        action,
        selector,
        values,
        ...(Object.keys(originalValues).length ? { originalValues } : {}),
      },
    ]);
    setProperties([]);
    setError("");
  };
  const input = (f: RecipeField) => {
    const value = params[f.key] ?? "",
      update = (v: any) => setParams((p) => ({ ...p, [f.key]: v }));
    if (f.kind === "boolean")
      return (
        <label className="inline-check">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => update(e.target.checked)}
          />
          {f.label}
        </label>
      );
    if (f.kind === "rate")
      return (
        <RateInput
          label={f.label}
          value={String(value)}
          onChange={update}
          required={f.required}
        />
      );
    if (f.kind === "address" || f.kind === "subnet")
      return (
        <NetworkInput
          label={f.label}
          value={String(value)}
          onChange={update}
          required={f.required}
          defaultPrefix={f.key === "target" || f.key === "source" ? 32 : 24}
        />
      );
    if (f.key === "range")
      return (
        <>
          <input
            required={f.required}
            value={value}
            onChange={(e) => update(e.target.value)}
            aria-label="Rentang DHCP"
          />
          <button
            type="button"
            disabled={
              locked ||
              !evidence ||
              !params.address ||
              !Object.hasOwn(evidence.data, "dhcp-lease")
            }
            onClick={suggestRange}
          >
            Hitung kandidat dari subnet
          </button>
          <small>
            Mengecualikan gateway, IP router, lease dan pool yang terbaca.
            Perangkat dengan IP statis di luar DHCP tetap perlu diperiksa.
          </small>
        </>
      );
    if (f.key === "dns") {
      const dns = singletonFields(evidence?.data.dns || ""),
        observed = dns.servers || dns["dynamic-servers"] || "";
      return (
        <>
          <input
            required={f.required}
            value={value}
            onChange={(e) => update(e.target.value)}
          />
          {observed && (
            <button type="button" onClick={() => update(observed)}>
              Gunakan DNS router: {observed}
            </button>
          )}
        </>
      );
    }
    if (f.kind === "wans")
      return (
        <div className="wan-list">
          {(Array.isArray(value) ? value : []).map((w: any, i: number) => (
            <div className="wan-entry" key={i}>
              <select
                aria-label={`Interface ISP ${i + 1}`}
                required
                value={w.interface || ""}
                onChange={(e) =>
                  update(
                    value.map((x: any, j: number) =>
                      j === i ? { ...x, interface: e.target.value } : x,
                    ),
                  )
                }
              >
                <option value="">Interface ISP</option>
                {interfaces.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <input
                required
                aria-label={`Gateway ISP ${i + 1}`}
                placeholder="Gateway ISP"
                value={w.gateway || ""}
                onChange={(e) =>
                  update(
                    value.map((x: any, j: number) =>
                      j === i ? { ...x, gateway: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                type="number"
                min="1"
                max="16"
                aria-label={`Bobot ISP ${i + 1}`}
                placeholder="Bobot"
                value={w.weight ?? ""}
                onChange={(e) =>
                  update(
                    value.map((x: any, j: number) =>
                      j === i ? { ...x, weight: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon"
                aria-label="Hapus ISP"
                onClick={() =>
                  update(value.filter((_: any, j: number) => j !== i))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={value.length >= 8}
            onClick={() =>
              update([...(Array.isArray(value) ? value : []), { weight: "1" }])
            }
          >
            <Plus size={14} />
            Tambah ISP
          </button>
          <small>
            Urutan menentukan prioritas failover. Bobot dipakai untuk PCC.
          </small>
        </div>
      );
    if (f.kind === "interfaces")
      return (
        <div className="interface-options">
          {interfaces.map((n) => (
            <label className="inline-check" key={n}>
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(n)}
                onChange={(e) =>
                  update(
                    e.target.checked
                      ? [...(Array.isArray(value) ? value : []), n]
                      : (Array.isArray(value) ? value : []).filter(
                          (x: string) => x !== n,
                        ),
                  )
                }
              />
              {n}
            </label>
          ))}
        </div>
      );
    if (f.kind === "interface" || f.kind === "select")
      return (
        <select
          required={f.required}
          value={value}
          onChange={(e) => update(e.target.value)}
        >
          <option value="">Pilih…</option>
          {(f.kind === "interface" ? interfaces : f.options || []).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      );
    const choices =
      f.key === "server"
        ? detailRows(evidence?.data["dhcp-server"] || "").map((r) => r.name)
        : f.key === "profile"
          ? detailRows(evidence?.data["hotspot-user-profile"] || "").map(
              (r) => r.name,
            )
          : [];
    return (
      <>
        <input
          required={f.required}
          type={
            f.kind === "secret"
              ? "password"
              : f.kind === "number"
                ? "number"
                : "text"
          }
          autoComplete="off"
          value={value}
          list={choices.length ? `automation-${f.key}` : undefined}
          onChange={(e) => update(e.target.value)}
        />
        {choices.length > 0 && (
          <datalist id={`automation-${f.key}`}>
            {choices.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
      </>
    );
  };
  const entries = mode === "recipe" ? RECIPES : CONFIG_MODULES;
  const filtered = entries.filter((x) =>
    `${x.title} ${x.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="automation-layout">
      <section className="panel automation-catalog">
        <div className="panel-heading">
          <h2>Katalog konfigurasi</h2>
        </div>
        <div className="padded">
          <div className="automation-tabs">
            <button
              className={mode === "recipe" ? "primary" : ""}
              onClick={() => {
                setMode("recipe");
                changeChoice("");
              }}
            >
              Paket ({RECIPES.length})
            </button>
            <button
              className={mode === "menu" ? "primary" : ""}
              onClick={() => {
                setMode("menu");
                changeChoice("");
              }}
            >
              Menu ({CONFIG_MODULES.length})
            </button>
          </div>
          <div className="search-box">
            <Search size={15} />
            <input
              aria-label="Cari konfigurasi"
              placeholder="Cari firewall, VLAN, PCQ…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="automation-catalog-list">
          {[...new Set(filtered.map((r) => r.category))].map((category) => (
            <div key={category}>
              <h3>{category}</h3>
              {filtered
                .filter((r) => r.category === category)
                .map((r) => (
                  <button
                    className={chosen === r.id ? "selected" : ""}
                    key={r.id}
                    onClick={() => changeChoice(r.id)}
                  >
                    {r.title}
                  </button>
                ))}
            </div>
          ))}
          {!filtered.length && (
            <p className="small-empty">Tidak ada konfigurasi yang cocok.</p>
          )}
        </div>
      </section>
      <div className="automation-workspace">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{recipe?.title || module?.title || "Pilih konfigurasi"}</h2>
              <small>
                {recipe?.description ||
                  (module && `/${module.menu}`) ||
                  "Isi kebutuhan, review rencana, lalu berikan persetujuan."}
              </small>
            </div>
            <button
              disabled={locked || !chosen}
              onClick={() =>
                void runRouter(
                  "automation.inspect",
                  { id: router.id, moduleIds },
                  "Pembacaan konfigurasi dimulai.",
                )
              }
            >
              <RefreshCw size={15} />
              Baca router
            </button>
          </div>
          <div className="padded">
            {chosen && (
              <ol
                className="configuration-steps"
                aria-label="Tahap konfigurasi"
              >
                {["Akses router", "Isi kebutuhan", "Periksa aturan"].map(
                  (title, i) => (
                    <li
                      key={title}
                      className={
                        step === i ? "current" : step > i ? "complete" : ""
                      }
                    >
                      <button
                        type="button"
                        disabled={locked || i > step}
                        onClick={() => setStep(i)}
                      >
                        <span>{i + 1}</span>
                        {title}
                      </button>
                    </li>
                  ),
                )}
              </ol>
            )}
            <div className="panel-note">
              Backup wajib sebelum eksekusi. Apply dan rollback berhenti jika
              backup gagal. Router baru harus sudah dapat diakses lewat SSH/IP
              atau VPN management.
            </div>
            {evidence ? (
              <p className="muted">
                Evidence SSH: {evidence.identity} · RouterOS {evidence.version}{" "}
                · {new Date(evidence.createdAt).toLocaleString("id-ID")}
              </p>
            ) : (
              <p className="muted">
                Belum ada evidence untuk router ini. Sambungkan lalu pilih Baca
                router.
              </p>
            )}
            {chosen && evidence && !capable && (
              <div className="notice">
                Baca ulang menu yang dipilih.{" "}
                {moduleIds
                  .filter((id) => !Object.hasOwn(evidence.data, id))
                  .map((id) => (
                    <p key={id}>
                      {configModule(id)?.title}:{" "}
                      {evidence.errors[id] || "belum dibaca"}
                    </p>
                  ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                if (step === 0) {
                  try {
                    ipv4Subnet(managementSubnet);
                    if (chosen === "firewall-baseline")
                      setParams((p) => ({
                        ...p,
                        management: managementSubnet,
                      }));
                    setStep(1);
                  } catch (error) {
                    setError(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                  return;
                }
                if (step === 1) {
                  setStep(2);
                  void checkRules();
                  return;
                }
                if (
                  !validReport ||
                  validReport.findings.some((f) => f.severity === "error")
                ) {
                  void checkRules();
                  return;
                }
                void runRouter(
                  "automation.prepare",
                  { request: request(), persist },
                  "Rencana sedang disusun; belum diterapkan.",
                );
              }}
            >
              {step === 0 && (
                <>
                  <h3>Jalur administrator</h3>
                  <p className="muted">
                    Pilih jalur yang dipakai untuk mengakses router. Pengaturan
                    ini melindungi akses Anda selama perubahan.
                  </p>
                  {sessionSources.length === 1 && (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        setManagementSubnet(`${sessionSources[0]}/32`);
                        if (endpointInterface)
                          setManagementInterface(endpointInterface);
                      }}
                    >
                      Gunakan sumber SSH terbaca: {sessionSources[0]}/32
                    </button>
                  )}
                  <div className="form-grid">
                    <InputField
                      label="Nama konfigurasi"
                      hint="Huruf, angka, _ atau -; 2–31 karakter. Menjadi tag objek AGENT."
                    >
                      <input
                        required
                        pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{1,30}"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </InputField>
                    <InputField label="Interface jalur management">
                      <select
                        required
                        value={managementInterface}
                        onChange={(e) => setManagementInterface(e.target.value)}
                      >
                        <option value="">Pilih dari router</option>
                        {interfaces.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </InputField>
                    <InputField
                      label="IP sumber administrator / prefix"
                      hint="Source administrator yang terlihat oleh router, termasuk bila melalui VPN atau NAT."
                    >
                      <NetworkInput
                        required
                        label="Alamat administrator"
                        value={managementSubnet}
                        onChange={setManagementSubnet}
                        defaultPrefix={32}
                      />
                    </InputField>
                    <InputField label="Akses cadangan">
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={alternateAccess}
                          onChange={(e) => setAlternate(e.target.checked)}
                        />
                        Saya memiliki jalur management lain yang sudah berfungsi
                      </label>
                    </InputField>
                  </div>
                </>
              )}
              {step === 1 && recipe && (
                <div className="form-grid automation-params">
                  {recipe.fields.map((f) => (
                    <InputField
                      key={f.key}
                      label={
                        f.kind === "boolean" ? "Persetujuan terkait" : f.label
                      }
                      hint={f.hint || RECIPE_HINTS[f.key]}
                    >
                      {input(f)}
                    </InputField>
                  ))}
                </div>
              )}
              {step === 1 && module?.readOnly && (
                <div className="notice">
                  Menu ini tersedia untuk pembacaan. Perubahan User Manager
                  memerlukan backup database khusus di luar backup sistem.
                </div>
              )}
              {step === 1 && module && !module.readOnly && (
                <div className="automation-menu">
                  <div className="form-grid">
                    <InputField label="Tindakan">
                      <select
                        value={action}
                        onChange={(e) => {
                          setAction(e.target.value as any);
                          setProperties([]);
                        }}
                      >
                        {[
                          "set",
                          ...(!module.physical && !module.singleton
                            ? ["add"]
                            : []),
                          ...(!module.singleton ? ["enable", "disable"] : []),
                          ...(!module.physical &&
                          !module.singleton &&
                          !module.ordered
                            ? ["remove"]
                            : []),
                        ].map((a) => (
                          <option key={a} value={a}>
                            {
                              {
                                set: "Ubah properti",
                                add: "Tambah object",
                                enable: "Aktifkan",
                                disable: "Nonaktifkan",
                                remove: "Hapus object",
                              }[a]
                            }
                          </option>
                        ))}
                      </select>
                    </InputField>
                    {!module.singleton && action !== "add" && (
                      <InputField label="Target dari router">
                        <select
                          value={record}
                          onChange={(e) => {
                            setRecord(e.target.value);
                            setProperties([]);
                          }}
                        >
                          <option value="">Pilih object</option>
                          {rows.map((r) => (
                            <option
                              key={r.index}
                              value={r.index}
                              disabled={r.dynamic === "yes"}
                            >
                              {r.name ||
                                r.comment ||
                                r.address ||
                                r.interface ||
                                r.index}
                              {r.dynamic === "yes" ? " · dinamis" : ""}
                            </option>
                          ))}
                        </select>
                      </InputField>
                    )}
                  </div>
                  {(selected || module.singleton) && (
                    <details>
                      <summary>Nilai yang terbaca</summary>
                      <pre className="script">
                        {JSON.stringify(selected || singleton, null, 2)}
                      </pre>
                    </details>
                  )}
                  {["set", "add"].includes(action) && (
                    <>
                      <h3>Properti yang akan diubah</h3>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={advancedProperties}
                          onChange={(e) =>
                            setAdvancedProperties(e.target.checked)
                          }
                        />
                        Tulis nama properti RouterOS secara manual
                      </label>
                      {properties.map((p, i) => (
                        <div className="property-block" key={i}>
                          <div className="property-entry">
                            {advancedProperties ? (
                              <input
                                aria-label="Nama properti"
                                list="automation-properties"
                                placeholder="Properti RouterOS"
                                value={p.key}
                                onChange={(e) =>
                                  setProperties((v) =>
                                    v.map((x, j) =>
                                      j === i
                                        ? { ...x, key: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <select
                                aria-label="Properti yang diubah"
                                value={p.key}
                                onChange={(e) =>
                                  setProperties((v) =>
                                    v.map((x, j) =>
                                      j === i
                                        ? {
                                            ...x,
                                            key: e.target.value,
                                            value: "",
                                            old: "",
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <option value="">Pilih pengaturan</option>
                                {module.fields.map((k) => (
                                  <option key={k} value={k}>
                                    {PROPERTY_LABELS[k] || k} ({k})
                                  </option>
                                ))}
                                {p.key && !module.fields.includes(p.key) && (
                                  <option value={p.key}>{p.key}</option>
                                )}
                              </select>
                            )}
                            {propertyValue(p, i)}
                            {isSecretField(p.key) && action !== "add" && (
                              <input
                                aria-label="Credential lama untuk rollback"
                                type="password"
                                autoComplete="off"
                                placeholder="Credential lama bila tersembunyi"
                                value={p.old}
                                onChange={(e) =>
                                  setProperties((v) =>
                                    v.map((x, j) =>
                                      j === i
                                        ? { ...x, old: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            )}
                            <button
                              className="icon"
                              type="button"
                              aria-label="Hapus properti"
                              onClick={() =>
                                setProperties((v) =>
                                  v.filter((_, j) => j !== i),
                                )
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {propertyInput(module.id, p.key).hint && (
                            <small className="muted">
                              {propertyInput(module.id, p.key).hint}
                            </small>
                          )}
                        </div>
                      ))}
                      <datalist id="automation-properties">
                        {module.fields.map((k) => (
                          <option key={k} value={k} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() =>
                          setProperties((v) => [
                            ...v,
                            { key: "", value: "", old: "" },
                          ])
                        }
                      >
                        <Plus size={14} />
                        Tambah properti
                      </button>
                    </>
                  )}
                  {module.ordered && (
                    <p className="muted">
                      Rule berurutan dapat ditambah, diubah atau dinonaktifkan.
                      Penghapusan memerlukan rencana pemulihan posisi khusus.
                    </p>
                  )}
                  <div className="automation-actions">
                    <button
                      type="button"
                      disabled={locked || !capable || operations.length >= 64}
                      onClick={enqueue}
                    >
                      Tambahkan ke rencana
                    </button>
                  </div>
                </div>
              )}
              {step > 0 && mode === "menu" && operations.length > 0 && (
                <div className="operation-list">
                  <h3>Operasi dalam rencana ({operations.length})</h3>
                  {operations.map((o, i) => (
                    <div key={i} className="row spread">
                      <span>
                        {i + 1}. {configModule(o.moduleId)?.title} · {o.action}{" "}
                        ·{" "}
                        {Object.entries(o.selector)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}
                      </span>
                      <button
                        type="button"
                        className="icon"
                        aria-label="Hapus operasi"
                        onClick={() =>
                          setOperations((v) => v.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {step === 2 && (
                <>
                  <h3>Ringkasan kebutuhan</h3>
                  <dl className="configuration-summary">
                    <dt>Router</dt>
                    <dd>
                      {router.name} · {evidence?.identity || "belum terbaca"}
                    </dd>
                    <dt>Konfigurasi</dt>
                    <dd>
                      {recipe?.title || `${operations.length} operasi menu`} ·{" "}
                      {name}
                    </dd>
                    <dt>Akses administrator</dt>
                    <dd>
                      {managementInterface} · {managementSubnet}
                    </dd>
                  </dl>
                  {recipe && (
                    <dl className="configuration-summary">
                      {recipe.fields
                        .filter((f) => f.kind !== "secret")
                        .map((f) => (
                          <div key={f.key}>
                            <dt>{f.label}</dt>
                            <dd>
                              {f.kind === "boolean"
                                ? params[f.key]
                                  ? "Ya"
                                  : "Tidak"
                                : Array.isArray(params[f.key])
                                  ? params[f.key]
                                      .map((x: any) =>
                                        typeof x === "object"
                                          ? `${x.interface || ""} · ${x.gateway || ""} · bobot ${x.weight || ""}`
                                          : x,
                                      )
                                      .join("; ")
                                  : String(params[f.key] || "—")}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <button
                    type="button"
                    disabled={locked || !capable}
                    onClick={() => void checkRules()}
                  >
                    {checking ? "Memeriksa…" : "Periksa ulang aturan"}
                  </button>
                  {validReport && <StandardsPanel report={validReport} />}
                  <p className="muted">
                    Pemeriksaan awal memakai pembacaan router di atas. Saat
                    rencana disusun dan sebelum eksekusi, backend membaca
                    kembali kondisi router.
                  </p>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      disabled={!state.secureStorage}
                      checked={persist}
                      onChange={(e) => setPersist(e.target.checked)}
                    />
                    Simpan credential rencana di keyring agar tersedia setelah
                    aplikasi ditutup
                  </label>
                  <p className="muted">
                    Tanpa keyring, credential berlaku sampai aplikasi ditutup.
                    Profil yang diekspor tidak menyertakan password. Pemeriksaan
                    konfigurasi tidak menggantikan uji layanan dari client.
                  </p>
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
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setStep(step - 1);
                      setError("");
                    }}
                  >
                    Kembali
                  </button>
                )}
                <button
                  className="primary"
                  disabled={
                    locked ||
                    !capable ||
                    !name ||
                    !managementSubnet ||
                    !managementInterface ||
                    (step > 0 && mode === "menu" && !operations.length) ||
                    (step === 2 &&
                      (!validReport ||
                        validReport.findings.some(
                          (f) => f.severity === "error",
                        )))
                  }
                >
                  <FileCode2 size={16} />
                  {step === 0
                    ? "Lanjut isi kebutuhan"
                    : step === 1
                      ? "Periksa aturan"
                      : "Siapkan rencana untuk review"}
                </button>
              </div>
            </form>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Profil konfigurasi</h2>
              <small>
                Gunakan ulang pada router lain; baca evidence baru dan isi ulang
                credential.
              </small>
            </div>
            <button
              disabled={locked}
              onClick={() =>
                void run("profile.import", undefined, "Profil diimpor.")
              }
            >
              <ArrowDownToLine size={15} />
              Impor
            </button>
          </div>
          <div className="padded">
            <div className="row">
              <input
                aria-label="Nama profil"
                placeholder="Nama profil"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <button
                disabled={
                  locked ||
                  !evidence ||
                  !chosen ||
                  !name ||
                  !managementSubnet ||
                  !managementInterface ||
                  profileName.trim().length < 2 ||
                  (mode === "menu" && !operations.length)
                }
                onClick={() =>
                  void run(
                    "profile.save",
                    { name: profileName, request: request() },
                    "Profil disimpan tanpa credential.",
                  )
                }
              >
                <Save size={15} />
                Simpan profil
              </button>
            </div>
            {(state.deploymentProfiles || [])
              .filter((p) => !p.request.quick)
              .map((p) => (
                <div className="profile-entry" key={p.id}>
                  <strong>{p.name}</strong>
                  <button
                    disabled={locked}
                    onClick={() => {
                      const r = p.request;
                      setMode(r.recipeId ? "recipe" : "menu");
                      setChosen(
                        r.recipeId || r.operations?.[0]?.moduleId || "",
                      );
                      setName(r.name);
                      setParams(r.params || {});
                      setOperations(r.operations || []);
                      setManagementInterface(r.managementInterface);
                      setManagementSubnet(r.managementSubnet);
                      setAlternate(false);
                      setStep(0);
                      setReport(null);
                      setCheckedRequest("");
                      setProperties([]);
                      setRecord("");
                      setError(
                        "Profil dimuat. Baca router dan periksa alamat/interface serta isi ulang credential.",
                      );
                    }}
                  >
                    Gunakan
                  </button>
                  <button
                    onClick={() =>
                      void run("profile.export", p.id, "Profil diekspor.")
                    }
                  >
                    Ekspor
                  </button>
                  <button
                    className="icon"
                    aria-label="Hapus profil"
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
    </div>
  );
}
