import { z } from "zod";
import {
  configModule,
  type AutomationEvidence,
  type AutomationRequest,
  type ConfigOperation,
} from "./automation";
import { detailRows } from "./routeros";
import { singletonFields } from "./routeros-literals";

export const STANDARDS_VERSION = "2026.10.2";
export const STANDARD_SOURCES = {
  mtcna: {
    title: "MTCNA — kurikulum dasar",
    url: "https://i.mt.lv/cdn/training_pdf/mtcna_outline_2019181161836.pdf",
    kind: "Kurikulum",
  },
  cidr: {
    title: "RFC 4632 — CIDR",
    url: "https://www.rfc-editor.org/info/rfc4632/",
    kind: "Standar protokol",
  },
  private: {
    title: "RFC 1918 — alamat privat",
    url: "https://www.rfc-editor.org/info/rfc1918/",
    kind: "Acuan alamat",
  },
  dhcp: {
    title: "RFC 2131 — DHCP",
    url: "https://www.rfc-editor.org/info/rfc2131/",
    kind: "Standar protokol",
  },
  bridge: {
    title: "IEEE 802.1Q / implementasi VLAN RouterOS",
    url: "https://help.mikrotik.com/docs/spaces/ROS/pages/28606465/Bridge+VLAN+Table",
    kind: "Implementasi vendor",
  },
  ieee: {
    title: "IEEE 802.1Q-2022 — bridges",
    url: "https://1.ieee802.org/maintenance/802-1q-2022-rev/",
    kind: "Standar jaringan",
  },
  queues: {
    title: "RouterOS — Queue / HTB / PCQ",
    url: "https://manual.mikrotik.com/docs/firewall-and-quality-of-service/queues/",
    kind: "Implementasi vendor",
  },
  security: {
    title: "RouterOS — pengamanan router",
    url: "https://help.mikrotik.com/docs/spaces/ROS/pages/328353/Securing+your+router",
    kind: "Pedoman vendor",
  },
  wifi: {
    title: "RouterOS — WiFi",
    url: "https://manual.mikrotik.com/docs/wireless/wifi/",
    kind: "Implementasi vendor",
  },
  backup: {
    title: "RouterOS — backup",
    url: "https://manual.mikrotik.com/docs/getting-started/configuration-management/backup/",
    kind: "Implementasi vendor",
  },
  pcc: {
    title: "RouterOS — PCC",
    url: "https://manual.mikrotik.com/docs/high-availability-solutions/load-balancing/per-connection-classifier/",
    kind: "Implementasi vendor",
  },
} as const;
export const StandardsReportSchema = z.object({
  version: z.string().max(30),
  evidenceId: z.string().uuid(),
  checkedAt: z.string(),
  scope: z.literal("configuration-delta"),
  rules: z.array(z.string().max(80)).max(100),
  findings: z
    .array(
      z.object({
        id: z.string().max(120),
        severity: z.enum(["error", "warning"]),
        message: z.string().max(1000),
        source: z.enum(
          Object.keys(STANDARD_SOURCES) as [
            keyof typeof STANDARD_SOURCES,
            ...Array<keyof typeof STANDARD_SOURCES>,
          ],
        ),
        operation: z.number().int().min(0).optional(),
      }),
    )
    .max(1000),
});
export type StandardsReport = z.infer<typeof StandardsReportSchema>;

export function ipv4Number(ip: string): number {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(ip))
    throw new Error("Gunakan IPv4 empat oktet tanpa nol tambahan.");
  const parts = ip.split(".").map(Number);
  if (parts.some((n) => n > 255))
    throw new Error("Setiap oktet IPv4 harus 0–255.");
  return parts.reduce((n, p) => n * 256 + p, 0);
}
export const dottedIPv4 = (n: number) =>
  [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
export function ipv4Subnet(cidr: string) {
  const match = cidr.match(/^([^/]+)\/(0|[1-9]|[12]\d|3[0-2])$/);
  if (!match) throw new Error("Isi IPv4/prefix; prefix harus 0–32.");
  const n = ipv4Number(match[1]),
    prefix = Number(match[2]),
    size = 2 ** (32 - prefix),
    start = Math.floor(n / size) * size;
  return {
    ip: match[1],
    n,
    prefix,
    start,
    end: start + size - 1,
    network: `${dottedIPv4(start)}/${prefix}`,
  };
}
const cidrOrHost = (v: string) => ipv4Subnet(v.includes("/") ? v : `${v}/32`);
const unicast = (n: number) =>
  n > 0 && n < 224 * 2 ** 24 && Math.floor(n / 2 ** 24) !== 127;
const items = (v = "") =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const active = (r: Record<string, string>) =>
  !["yes", "true"].includes(r.disabled);
const enabled = (v?: string) => v === "yes" || v === "true";
const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number },
) => a.start <= b.end && b.start <= a.end;
const safeSubnet = (v: string) => {
  try {
    return cidrOrHost(v);
  } catch {
    return null;
  }
};
const isIPv6 = (value: string) => {
  if (!value.includes(":") || (value.match(/::/g) || []).length > 1)
    return false;
  let v = value;
  if (v.includes(".")) {
    const at = v.lastIndexOf(":"),
      tail = v.slice(at + 1);
    try {
      ipv4Number(tail);
    } catch {
      return false;
    }
    v = `${v.slice(0, at + 1)}0:0`;
  }
  const compressed = v.includes("::"),
    halves = v.split("::");
  const groups = halves.flatMap((h) => (h ? h.split(":") : []));
  return (
    groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) &&
    (compressed ? groups.length < 8 : groups.length === 8)
  );
};
export function bandwidthBps(value: string): number {
  const m = value.match(/^(\d+(?:\.\d+)?)([kKMG]?)$/);
  if (!m)
    throw new Error(
      "Bandwidth harus berupa angka dengan satuan bps, k, M atau G.",
    );
  const n =
    Number(m[1]) *
    { "": 1, k: 1000, K: 1000, M: 1000000, G: 1000000000 }[m[2]]!;
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(
      "Bandwidth harus menghasilkan jumlah bit per detik yang bulat.",
    );
  return n;
}
const rates = (v: string) => v.split("/").map(bandwidthBps);
const dependencies: Record<string, string[]> = {
  "ip-address": ["ip-address"],
  "ip-pool": [
    "ip-pool",
    "ip-address",
    "dhcp-lease",
    "dhcp-network",
    "dhcp-server",
  ],
  "dhcp-server": [
    "ip-pool",
    "ip-address",
    "dhcp-network",
    "dhcp-server",
    "bridge-port",
  ],
  "dhcp-network": ["dhcp-network", "ip-address", "ip-pool", "dhcp-server"],
  "dhcp-lease": ["dhcp-lease", "ip-address", "dhcp-server", "dhcp-network"],
  bridge: ["bridge", "bridge-port", "bridge-vlan"],
  "bridge-port": ["bridge", "bridge-port", "bridge-vlan"],
  "bridge-vlan": ["bridge", "bridge-port", "bridge-vlan"],
  "simple-queue": ["simple-queue", "queue-type", "firewall-filter"],
  "queue-tree": ["queue-tree", "queue-type", "firewall-filter"],
  "queue-type": ["simple-queue", "queue-tree", "queue-type", "firewall-filter"],
  dns: ["dns", "firewall-filter"],
  "firewall-mangle": ["firewall-mangle", "hotspot-server", "firewall-filter"],
};
export function standardsEvidenceMenus(ids: string[]) {
  return [...new Set(ids.flatMap((id) => [id, ...(dependencies[id] || [])]))];
}

/** Evaluates the requested delta against actual evidence, never grants execution. */
export function assessStandards(
  request: AutomationRequest,
  evidence: AutomationEvidence,
  operations: ConfigOperation[],
): StandardsReport {
  const report: StandardsReport = {
    version: STANDARDS_VERSION,
    evidenceId: evidence.id,
    checkedAt: new Date().toISOString(),
    scope: "configuration-delta",
    rules: [],
    findings: [],
  };
  const rules = new Set<string>();
  const add = (
    rule: string,
    severity: "error" | "warning",
    message: string,
    source: keyof typeof STANDARD_SOURCES,
    operation?: number,
  ) => {
    rules.add(rule);
    const id = `${rule}:${operation === undefined ? "plan" : operation + 1}`;
    if (!report.findings.some((f) => f.id === id && f.message === message))
      report.findings.push({ id, severity, message, source, operation });
  };
  const check = (
    rule: string,
    valid: boolean,
    message: string,
    source: keyof typeof STANDARD_SOURCES,
    operation?: number,
    severity: "error" | "warning" = "error",
  ) => {
    rules.add(rule);
    if (!valid) add(rule, severity, message, source, operation);
  };
  for (const id of standardsEvidenceMenus(operations.map((o) => o.moduleId)))
    check(
      "EVIDENCE",
      Object.hasOwn(evidence.data, id),
      `${configModule(id)?.title || id} belum terbaca; baca router kembali.`,
      "mtcna",
    );
  try {
    const mg = ipv4Subnet(request.managementSubnet);
    check(
      "MGMT-SCOPE",
      mg.prefix >= 8 && unicast(mg.n),
      "Alamat administrator harus berupa IPv4 unicast dengan prefix /8 atau lebih spesifik.",
      "security",
    );
  } catch {
    add(
      "MGMT-SCOPE",
      "error",
      "Isi alamat sumber administrator dalam format IPv4/prefix yang valid.",
      "cidr",
    );
  }
  check(
    "MGMT-INTERFACE",
    detailRows(evidence.data.interfaces || "").some(
      (r) => r.name === request.managementInterface,
    ),
    "Pilih interface management yang benar-benar terbaca dari router.",
    "security",
  );
  if (!request.alternateAccess)
    add(
      "MGMT-RECOVERY",
      "warning",
      "Akses cadangan belum dikonfirmasi. Pastikan cara pemulihan jika jalur SSH terputus.",
      "security",
    );
  const state = new Map<string, Record<string, string>[]>();
  for (const [id, value] of Object.entries(evidence.data))
    state.set(
      id,
      configModule(id)?.singleton
        ? [singletonFields(value)]
        : detailRows(value).map((r) => ({ ...r })),
    );
  const changed: {
    id: string;
    row: Record<string, string>;
    operation: number;
    values: Record<string, string>;
  }[] = [];
  for (const [i, o] of operations.entries()) {
    const m = configModule(o.moduleId),
      rows = state.get(o.moduleId) || [];
    if (!m) {
      add("CATALOG", "error", "Menu konfigurasi tidak terdaftar.", "mtcna", i);
      continue;
    }
    const matches = m.singleton
      ? rows
      : rows.filter((r) =>
          Object.entries(o.selector).every(([k, v]) => r[k] === v),
        );
    if (o.action !== "add" && matches.length !== 1) {
      add(
        "TARGET",
        "error",
        `${m.title}: pilih tepat satu object yang unik.`,
        "mtcna",
        i,
      );
      continue;
    }
    if (o.action === "remove") {
      add(
        "OBJECT-REMOVE",
        "warning",
        `${m.title}: object akan dihapus. Periksa seluruh referensi dan pemulihan object sebelum grant.`,
        "backup",
        i,
      );
      const target = matches[0];
      if (
        o.moduleId === "ip-pool" &&
        (state.get("dhcp-server") || []).some(
          (r) => active(r) && r["address-pool"] === target.name,
        )
      )
        add(
          "POOL-IN-USE",
          "error",
          "Pool masih digunakan DHCP server. Susun perubahan server terlebih dahulu.",
          "dhcp",
          i,
        );
      if (
        ["simple-queue", "queue-tree"].includes(o.moduleId) &&
        rows.some((r) => r !== target && active(r) && r.parent === target.name)
      )
        add(
          "QUEUE-IN-USE",
          "error",
          "Queue masih memiliki child; susun perubahan child terlebih dahulu.",
          "queues",
          i,
        );
      state.set(
        o.moduleId,
        rows.filter((r) => !matches.includes(r)),
      );
      continue;
    }
    const values = {
      ...o.values,
      ...(["enable", "disable"].includes(o.action)
        ? { disabled: o.action === "disable" ? "yes" : "no" }
        : {}),
    };
    const row =
      o.action === "add" ? { ...values } : Object.assign(matches[0], values);
    if (o.action === "add") rows.push(row);
    state.set(o.moduleId, rows);
    changed.push({ id: o.moduleId, row, operation: i, values });
  }
  const rows = (id: string) => (state.get(id) || []).filter(active);
  const interfaceNames = new Set([
    ...(state.get("interfaces") || []).map((r) => r.name),
    ...[
      "bridge",
      "vlan",
      "wireguard",
      "pppoe-client",
      "bonding",
      "gre",
      "ipip",
      "eoip",
      "vxlan",
    ].flatMap((id) => rows(id).map((r) => r.name)),
  ]);
  for (const { id, row: r, operation: i, values } of changed) {
    const label = configModule(id)?.title || id;
    // Validate supplied syntax even for a disabled object; topology checks use enabled objects.
    for (const [key, value] of Object.entries(values)) {
      if (
        ["interface", "in-interface", "out-interface"].includes(key) &&
        value &&
        !["switch-port", "interface-queue"].includes(id)
      )
        check(
          "INTERFACE-REFERENCE",
          interfaceNames.has(value.startsWith("!") ? value.slice(1) : value),
          `${label}: interface yang dipilih tidak ada atau belum dibuat dalam rencana.`,
          "mtcna",
          i,
        );
      if (
        [
          "disabled",
          "enabled",
          "vlan-filtering",
          "allow-remote-requests",
          "ingress-filtering",
          "conflict-detection",
        ].includes(key)
      )
        check(
          "BOOLEAN-VALUE",
          ["yes", "no", "true", "false"].includes(value) ||
            (key === "enabled" && value === "auto"),
          `${label}: pilih Ya/Tidak untuk ${key}.`,
          "mtcna",
          i,
        );
      if (["vlan-id", "pvid", "vlan-ids"].includes(key)) {
        const validRange =
          items(value).length > 0 &&
          items(value).every((x) => {
            const [a, b = a, ...rest] = x.split("-");
            return (
              !rest.length &&
              /^[1-9]\d*$/.test(a) &&
              /^[1-9]\d*$/.test(b) &&
              +a >= 1 &&
              +b <= 4094 &&
              +a <= +b
            );
          });
        const valid =
          key === "vlan-ids"
            ? validRange
            : /^[1-9]\d*$/.test(value) && Number(value) <= 4094;
        check(
          "VLAN-ID",
          valid,
          `${label}: VLAN ID/PVID memakai satu angka 1–4094. Daftar/rentang berurutan hanya tersedia pada tabel VLAN.`,
          "bridge",
          i,
        );
      }
      if (key === "priority" && ["simple-queue", "queue-tree"].includes(id))
        check(
          "QUEUE-PRIORITY",
          value.split("/").every((n) => /^[1-8]$/.test(n)) &&
            value.split("/").length === (id === "simple-queue" ? 2 : 1),
          "Prioritas queue harus 1–8; 1 paling tinggi. Simple Queue memakai upload/download.",
          "queues",
          i,
        );
      if (
        ["max-limit", "limit-at", "pcq-rate", "cake-bandwidth"].includes(key) &&
        ["simple-queue", "queue-tree", "queue-type"].includes(id)
      ) {
        try {
          const rate = rates(value);
          check(
            "QUEUE-UNITS",
            rate.length === (id === "simple-queue" ? 2 : 1),
            "Simple Queue memakai upload/download; Queue Tree dan queue type memakai satu nilai bps.",
            "queues",
            i,
          );
        } catch {
          add(
            "QUEUE-UNITS",
            "error",
            `${label}: gunakan bandwidth dalam bit per detik, k, M atau G.`,
            "queues",
            i,
          );
        }
      }
      if (
        [
          "port",
          "dst-port",
          "src-port",
          "to-ports",
          "listen-port",
          "endpoint-port",
          "authentication-port",
          "accounting-port",
        ].includes(key) &&
        value
      ) {
        check(
          "PORT-RANGE",
          items(value).every((x) => {
            const [a, b = a, ...rest] = x.split("-");
            return (
              !rest.length &&
              /^\d+$/.test(a) &&
              /^\d+$/.test(b) &&
              +a >= 1 &&
              +b <= 65535 &&
              +a <= +b
            );
          }),
          `${label}: port harus 1–65535 dengan rentang berurutan.`,
          "mtcna",
          i,
        );
      }
      if (["distance", "default-route-distance"].includes(key))
        check(
          "ROUTE-DISTANCE",
          /^\d+$/.test(value) && +value >= 1 && +value <= 255,
          "Distance route harus 1–255.",
          "mtcna",
          i,
        );
      if (id === "ip-address" && key === "address") {
        try {
          const s = ipv4Subnet(value);
          check(
            "IP-HOST",
            unicast(s.n) && (s.prefix >= 31 || (s.n > s.start && s.n < s.end)),
            "Alamat interface harus unicast dan bukan network/broadcast. /31 hanya untuk link point-to-point.",
            "cidr",
            i,
          );
        } catch {
          add(
            "IP-HOST",
            "error",
            "Alamat interface harus berupa IPv4/prefix yang valid.",
            "cidr",
            i,
          );
        }
      }
      if (
        [
          "static-route",
          "routing-rule",
          "firewall-filter",
          "firewall-nat",
          "firewall-raw",
          "firewall-mangle",
        ].includes(id) &&
        ["src-address", "dst-address"].includes(key) &&
        value
      ) {
        try {
          cidrOrHost(value.startsWith("!") ? value.slice(1) : value);
          rules.add("IP-CIDR");
        } catch {
          add(
            "IP-CIDR",
            "error",
            `${label}: ${key} harus IPv4 atau IPv4/prefix yang valid.`,
            "cidr",
            i,
          );
        }
      }
      if (key === "mac-address" && value)
        check(
          "MAC-ADDRESS",
          /^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}$/.test(value),
          "MAC address memakai enam pasangan heksadesimal dipisahkan titik dua.",
          "mtcna",
          i,
        );
      if (key === "rate-limit" && value) {
        try {
          const parts = value.trim().split(/\s+/),
            rate = rates(parts[0]);
          check(
            "PROFILE-RATE",
            rate.length >= 1 && rate.length <= 2,
            "Batas profil memakai upload/download dalam bit per detik.",
            "queues",
            i,
          );
          if (rate.some((n) => n === 0))
            add(
              "PROFILE-UNLIMITED",
              "warning",
              "Nilai bandwidth profil 0 berarti tanpa batas. Pastikan sesuai kapasitas layanan.",
              "queues",
              i,
            );
          if (parts.length > 1)
            add(
              "PROFILE-BURST",
              "warning",
              "Profil memakai format burst/threshold/time lanjutan. Periksa hubungan burst, minimum dan kapasitas uplink.",
              "queues",
              i,
            );
        } catch {
          add(
            "PROFILE-RATE",
            "error",
            "Batas profil tidak valid; isi upload/download dengan angka dan satuan bandwidth.",
            "queues",
            i,
          );
        }
      }
      if (
        ["dns-server", "servers"].includes(key) &&
        ["dns", "dhcp-network"].includes(id) &&
        value
      )
        check(
          "DNS-ADDRESS",
          items(value).every((x) => {
            try {
              return unicast(ipv4Number(x));
            } catch {
              return isIPv6(x);
            }
          }),
          "DNS harus berisi alamat resolver IPv4/IPv6, dipisahkan koma.",
          "mtcna",
          i,
        );
    }
    if (!active(r)) continue;
    if (id === "ip-address") {
      const s = safeSubnet(r.address);
      if (s)
        check(
          "IP-DUPLICATE",
          rows(id).filter((x) => safeSubnet(x.address)?.n === s.n).length <= 1,
          "Alamat IP ini sudah dipakai oleh interface router lain.",
          "mtcna",
          i,
        );
      if (s && rows("dhcp-server").some((x) => x.interface === r.interface)) {
        const privateIP =
          (s.n >= ipv4Number("10.0.0.0") &&
            s.n <= ipv4Number("10.255.255.255")) ||
          (s.n >= ipv4Number("172.16.0.0") &&
            s.n <= ipv4Number("172.31.255.255")) ||
          (s.n >= ipv4Number("192.168.0.0") &&
            s.n <= ipv4Number("192.168.255.255"));
        check(
          "LAN-ADDRESS",
          privateIP,
          "LAN DHCP memakai alamat di luar ruang privat RFC 1918. Pastikan alokasi publik/routing memang milik Anda.",
          "private",
          i,
          "warning",
        );
      }
    }
    if (id === "ip-pool") {
      for (const range of items(r.ranges)) {
        try {
          const [a, b = a, ...rest] = range.split("-"),
            start = ipv4Number(a),
            end = ipv4Number(b),
            span = { start, end };
          check(
            "POOL-RANGE",
            !rest.length && start <= end && unicast(start) && unicast(end),
            "Pool harus berisi rentang IPv4 unicast berurutan.",
            "dhcp",
            i,
          );
          check(
            "POOL-ROUTER-IP",
            !rows("ip-address").some((x) => {
              const s = safeSubnet(x.address);
              return s && s.n >= start && s.n <= end;
            }),
            "Pool mencakup alamat interface router; keluarkan alamat gateway/management dari pool.",
            "dhcp",
            i,
          );
          check(
            "POOL-OVERLAP",
            !rows(id)
              .filter((x) => x !== r && x.name !== r.name)
              .some((x) =>
                items(x.ranges).some((v) => {
                  try {
                    const [l, h = l] = v.split("-");
                    return overlaps(span, {
                      start: ipv4Number(l),
                      end: ipv4Number(h),
                    });
                  } catch {
                    return false;
                  }
                }),
              ),
            "Pool baru bertumpuk dengan pool lain. Pisahkan alokasi agar tidak terjadi IP ganda.",
            "dhcp",
            i,
          );
          for (const net of rows("dhcp-network")) {
            const s = safeSubnet(net.address);
            if (s && overlaps(span, s))
              check(
                "POOL-HOSTS",
                start > s.start && end < s.end,
                "Pool DHCP harus berada dalam satu subnet dan tidak mencakup network/broadcast.",
                "dhcp",
                i,
              );
          }
        } catch {
          add(
            "POOL-RANGE",
            "error",
            "Rentang pool harus IPv4-awal–IPv4-akhir atau satu IPv4.",
            "dhcp",
            i,
          );
        }
      }
      check("POOL-RANGE", !!r.ranges, "Isi rentang alamat pool.", "dhcp", i);
    }
    if (id === "dhcp-network") {
      try {
        const s = ipv4Subnet(r.address);
        check(
          "DHCP-SUBNET",
          s.n === s.start && s.prefix <= 30,
          "Network DHCP harus alamat jaringan dengan prefix /0–/30.",
          "dhcp",
          i,
        );
        check(
          "DHCP-GATEWAY",
          items(r.gateway).length > 0 &&
            items(r.gateway).every((g) => {
              const n = ipv4Number(g);
              return n > s.start && n < s.end;
            }),
          "Gateway DHCP harus alamat host dalam subnet yang sama.",
          "dhcp",
          i,
        );
        check(
          "DHCP-OVERLAP",
          !rows(id).some(
            (x) =>
              x !== r &&
              x.address !== r.address &&
              !!safeSubnet(x.address) &&
              overlaps(s, safeSubnet(x.address)!),
          ),
          "Subnet DHCP ini bertumpuk dengan network DHCP lain.",
          "dhcp",
          i,
        );
      } catch {
        add(
          "DHCP-SUBNET",
          "error",
          "Network/gateway DHCP harus berupa IPv4 yang valid.",
          "dhcp",
          i,
        );
      }
    }
    if (id === "dhcp-server") {
      check(
        "DHCP-INTERFACE",
        !rows("bridge-port").some((x) => x.interface === r.interface),
        "Gunakan interface bridge, bukan port anggota bridge, untuk DHCP server.",
        "mtcna",
        i,
      );
      check(
        "DHCP-DUPLICATE",
        rows(id).filter((x) => x.interface === r.interface).length <= 1,
        "Sudah ada DHCP server aktif pada interface ini.",
        "dhcp",
        i,
      );
      if (r["address-pool"] !== "static-only") {
        const pool = rows("ip-pool").find((x) => x.name === r["address-pool"]);
        check(
          "DHCP-POOL",
          !!pool,
          "Pilih pool yang sudah ada atau dibuat dalam rencana ini.",
          "dhcp",
          i,
        );
        if (pool)
          for (const range of items(pool.ranges)) {
            try {
              const [a, b = a] = range.split("-"),
                span = { start: ipv4Number(a), end: ipv4Number(b) };
              check(
                "DHCP-POOL-SUBNET",
                rows("ip-address").some((x) => {
                  const s = safeSubnet(x.address);
                  return (
                    x.interface === r.interface &&
                    s &&
                    span.start > s.start &&
                    span.end < s.end
                  );
                }),
                "Seluruh pool DHCP harus berada dalam subnet interface server.",
                "dhcp",
                i,
              );
            } catch {
              add(
                "DHCP-POOL-SUBNET",
                "error",
                "Pool DHCP tidak valid.",
                "dhcp",
                i,
              );
            }
          }
      }
      if (r["conflict-detection"] === "no")
        add(
          "DHCP-CONFLICT",
          "warning",
          "Pendeteksian konflik DHCP dimatikan; pastikan tidak ada alamat statis yang bertabrakan.",
          "dhcp",
          i,
        );
    }
    if (id === "dhcp-lease" && r.address && r.address !== "0.0.0.0") {
      try {
        const n = ipv4Number(r.address);
        check(
          "LEASE-ROUTER-IP",
          !rows("ip-address").some((x) => safeSubnet(x.address)?.n === n),
          "Reservasi DHCP tidak boleh menggunakan alamat router.",
          "dhcp",
          i,
        );
        check(
          "LEASE-DUPLICATE",
          !rows(id).some(
            (x) =>
              x !== r &&
              x.address === r.address &&
              x["mac-address"] !== r["mac-address"],
          ),
          "IP reservasi sudah dipakai lease dengan MAC berbeda.",
          "dhcp",
          i,
        );
      } catch {
        add(
          "LEASE-IP",
          "error",
          "Alamat reservasi DHCP tidak valid.",
          "dhcp",
          i,
        );
      }
    }
    if (id === "bridge-vlan") {
      const tag = items(r.tagged),
        untag = items(r.untagged);
      check(
        "VLAN-MEMBERSHIP",
        !tag.some((x) => untag.includes(x)),
        "Satu port tidak boleh tagged dan untagged pada baris VLAN yang sama.",
        "bridge",
        i,
      );
      check(
        "VLAN-ACCESS",
        !untag.length || /^\d+$/.test(r["vlan-ids"] || ""),
        "Untuk access/untagged, gunakan tepat satu VLAN ID per baris agar VLAN tidak bocor.",
        "bridge",
        i,
      );
      check(
        "VLAN-BRIDGE",
        rows("bridge").some((x) => x.name === r.bridge),
        "Pilih bridge yang sudah ada atau dibuat dalam rencana.",
        "bridge",
        i,
      );
      for (const port of [...tag, ...untag])
        check(
          "VLAN-PORT",
          port === r.bridge ||
            rows("bridge-port").some(
              (x) => x.bridge === r.bridge && x.interface === port,
            ),
          "Anggota VLAN harus merupakan CPU bridge atau port pada bridge yang sama.",
          "bridge",
          i,
        );
    }
    if (
      id === "bridge" &&
      enabled(r["vlan-filtering"]) &&
      Object.hasOwn(values, "vlan-filtering")
    ) {
      check(
        "VLAN-RECOVERY",
        request.alternateAccess,
        "Mengaktifkan VLAN filtering membutuhkan akses management cadangan yang sudah berfungsi.",
        "bridge",
        i,
      );
      add(
        "VLAN-CPU",
        "warning",
        "Periksa VLAN management, PVID, dan keanggotaan CPU bridge sebelum mengaktifkan filtering.",
        "bridge",
        i,
      );
    }
    if (
      id === "bridge" &&
      r["protocol-mode"] === "none" &&
      Object.hasOwn(values, "protocol-mode")
    )
      add(
        "BRIDGE-LOOP",
        "warning",
        "Pencegahan loop bridge dimatikan. Pastikan topologi tidak memiliki loop fisik; gunakan RSTP/MSTP bila diperlukan.",
        "bridge",
        i,
      );
    if (["simple-queue", "queue-tree"].includes(id)) {
      try {
        const max = rates(
            r["max-limit"] || (id === "simple-queue" ? "0/0" : "0"),
          ),
          min = rates(r["limit-at"] || (id === "simple-queue" ? "0/0" : "0"));
        check(
          "HTB-CIR",
          min.length === max.length &&
            min.every((n, j) => max[j] === 0 || n <= max[j]),
          "Jaminan bandwidth (limit-at) tidak boleh melebihi batas maksimum (max-limit).",
          "queues",
          i,
        );
        if (max.some((n) => n === 0))
          add(
            "QUEUE-UNLIMITED",
            "warning",
            "Nilai 0 berarti tanpa batas; queue ini tidak membatasi seluruh arah trafik.",
            "queues",
            i,
          );
      } catch {
        add(
          "QUEUE-UNITS",
          "error",
          "Nilai bandwidth queue tidak valid.",
          "queues",
          i,
        );
      }
      const ft = rows("firewall-filter").some(
        (x) => x.action === "fasttrack-connection",
      );
      // Interface queue trees are exempt from FastTrack's global HTB bypass.
      if (ft && (id === "simple-queue" || r.parent === "global"))
        add(
          "QUEUE-FASTTRACK",
          "warning",
          "FastTrack masih aktif dan dapat melewati shaping ini. Tentukan pengecualian atau penonaktifan sebelum memakai batas bandwidth.",
          "queues",
          i,
        );
      if (id === "simple-queue")
        for (const target of items(r.target)) {
          try {
            cidrOrHost(target);
            rules.add("QUEUE-TARGET");
          } catch {
            add(
              "QUEUE-TARGET",
              "warning",
              "Target queue bukan IPv4; cakupan interface/IPv6 perlu review manual.",
              "queues",
              i,
            );
          }
        }
    }
    if (id === "queue-type" && r.kind === "pcq")
      check(
        "PCQ-CLASSIFIER",
        items(r["pcq-classifier"]).length > 0 &&
          items(r["pcq-classifier"]).every((x) =>
            ["src-address", "dst-address", "src-port", "dst-port"].includes(x),
          ),
        "PCQ membutuhkan classifier yang valid. Umumnya src-address untuk upload dan dst-address untuk download.",
        "queues",
        i,
      );
    if (["firewall-filter", "firewall-nat", "firewall-raw"].includes(id)) {
      if (r["src-port"] || r["dst-port"])
        check(
          "FIREWALL-PORT-PROTOCOL",
          [
            "tcp",
            "udp",
            "sctp",
            "dccp",
            "udplite",
            "6",
            "17",
            "132",
            "33",
            "136",
          ].includes(r.protocol),
          "Pencocokan port membutuhkan protocol TCP/UDP atau protocol transport yang mendukung port.",
          "mtcna",
          i,
        );
      if (
        r.chain === "input" &&
        r.action === "accept" &&
        ![
          "src-address",
          "src-address-list",
          "in-interface",
          "in-interface-list",
          "connection-state",
          "protocol",
        ].some((k) => r[k])
      )
        add(
          "FIREWALL-OPEN-INPUT",
          "warning",
          "Rule menerima seluruh trafik ke router tanpa pembatas sumber/interface/state. Periksa scope dan urutan firewall.",
          "security",
          i,
        );
      if (
        id === "firewall-nat" &&
        r.action === "dst-nat" &&
        !r["src-address"] &&
        !r["dst-address"] &&
        !r["in-interface"]
      )
        add(
          "NAT-SCOPE",
          "warning",
          "Port forwarding belum dibatasi alamat atau interface masuk. Pastikan layanan tujuan tidak terbuka ke jaringan yang salah.",
          "security",
          i,
        );
    }
    if (
      id === "dns" &&
      enabled(r["allow-remote-requests"]) &&
      Object.hasOwn(values, "allow-remote-requests")
    )
      add(
        "DNS-FIREWALL",
        "warning",
        "Resolver router menerima permintaan client. Pastikan TCP/UDP 53 dari WAN diblok dan hanya LAN yang diizinkan; urutan firewall perlu review.",
        "security",
        i,
      );
    if (
      id === "ip-services" &&
      ["address", "disabled"].some((k) => Object.hasOwn(values, k)) &&
      (!r.address ||
        items(r.address).some((x) => x === "0.0.0.0/0" || x === "::/0"))
    )
      add(
        "SERVICE-SCOPE",
        "warning",
        "Layanan management menerima semua sumber. Batasi alamat administrator dan firewall WAN.",
        "security",
        i,
      );
    if (
      ["mac-server", "mac-winbox"].includes(id) &&
      r["allowed-interface-list"] === "all"
    )
      add(
        "MAC-SCOPE",
        "warning",
        "Akses MAC diizinkan pada seluruh interface. Gunakan daftar interface management/LAN.",
        "security",
        i,
      );
    if (["wifi-security", "wireless-security"].includes(id)) {
      const auth = items(r["authentication-types"]);
      if (
        auth.some((x) => ["wpa-psk", "wpa-eap"].includes(x)) ||
        r.mode === "static-keys-required"
      )
        add(
          "WIFI-LEGACY",
          "error",
          "WPA generasi pertama/WEP tidak tersedia dalam automation aman. Pilih WPA2 AES atau WPA3 sesuai radio.",
          "wifi",
          i,
        );
      if (
        !auth.length &&
        id === "wifi-security" &&
        Object.hasOwn(values, "authentication-types")
      )
        add(
          "WIFI-OPEN",
          "warning",
          "Profil WiFi tanpa autentikasi; periksa kebutuhan hotspot, isolasi client dan exposure LAN.",
          "wifi",
          i,
        );
      for (const key of ["passphrase", "wpa2-pre-shared-key"])
        if (values[key] !== undefined)
          check(
            "WIFI-PASSPHRASE",
            (values[key].length >= 8 && values[key].length <= 63) ||
              /^[a-fA-F0-9]{64}$/.test(values[key]),
            "Passphrase WPA harus 8–63 karakter atau PSK heksadesimal 64 karakter jika didukung driver.",
            "wifi",
            i,
          );
    }
    if (id.startsWith("ipv6-"))
      add(
        "IPV6-REVIEW",
        "warning",
        "Aturan subnet/topologi dalam pemeriksaan ini berfokus IPv4. Perubahan IPv6 membutuhkan review ND, DHCPv6, ICMPv6 dan firewall tersendiri.",
        "mtcna",
        i,
      );
    else if (
      ![
        "identity",
        "ip-address",
        "ip-services",
        "dns",
        "dns-static",
        "ip-pool",
        "arp",
        "neighbor-settings",
        "mac-server",
        "mac-winbox",
        "management-users",
        "management-groups",
        "interfaces",
        "ethernet",
        "bridge",
        "bridge-port",
        "bridge-vlan",
        "vlan",
        "interface-list",
        "interface-list-member",
        "dhcp-server",
        "dhcp-network",
        "dhcp-lease",
        "dhcp-client",
        "static-route",
        "routing-table",
        "routing-rule",
        "pppoe-client",
        "firewall-filter",
        "firewall-nat",
        "firewall-raw",
        "firewall-mangle",
        "firewall-address-list",
        "simple-queue",
        "queue-tree",
        "queue-type",
        "hotspot-server",
        "hotspot-profile",
        "hotspot-user-profile",
        "hotspot-user",
        "wifi",
        "wifi-security",
        "wifi-configuration",
        "wifi-capsman",
        "wifi-provisioning",
        "wireless",
        "wireless-security",
      ].includes(id)
    )
      add(
        "DOMAIN-REVIEW",
        "warning",
        `${label}: pemeriksaan otomatis belum mencakup seluruh aturan protocol/menu ini. Review desain, compatibility dan dependensi layanan diperlukan.`,
        "mtcna",
        i,
      );
  }
  for (const id of ["simple-queue", "queue-tree"]) {
    if (!changed.some((x) => x.id === id)) continue;
    for (const parent of rows(id).filter((p) =>
      changed.some(
        (c) => c.id === id && (c.row === p || c.row.parent === p.name),
      ),
    )) {
      const children = rows(id).filter((x) => x.parent === parent.name);
      if (!children.length) continue;
      try {
        const max = rates(
          parent["max-limit"] || (id === "simple-queue" ? "0/0" : "0"),
        );
        for (let j = 0; j < max.length; j++) {
          const total = children.reduce(
            (n, c) =>
              n +
              (rates(c["limit-at"] || (id === "simple-queue" ? "0/0" : "0"))[
                j
              ] || 0),
            0,
          );
          check(
            "HTB-PARENT",
            max[j] === 0 || total <= max[j],
            "Total jaminan child queue melebihi kapasitas parent. Kurangi limit-at atau sesuaikan parent.",
            "queues",
          );
          check(
            "HTB-CHILD",
            max[j] === 0 ||
              children.every((c) => {
                const v = rates(
                  c["max-limit"] || (id === "simple-queue" ? "0/0" : "0"),
                )[j];
                return v === 0 || v <= max[j];
              }),
            "Batas maksimum child queue melebihi kapasitas parent.",
            "queues",
          );
        }
      } catch {
        add(
          "HTB-PARENT",
          "warning",
          "Budget parent queue tidak dapat dihitung; periksa nilai bandwidth parent/child secara manual.",
          "queues",
        );
      }
    }
  }
  if (
    operations.some(
      (o) =>
        o.moduleId === "firewall-mangle" &&
        (o.values["per-connection-classifier"] ||
          o.values.action === "mark-routing"),
    )
  ) {
    check(
      "PCC-HOTSPOT",
      !rows("hotspot-server").length,
      "PCC/policy routing dalam automation umum tidak digabung dengan HotSpot aktif; pisahkan desain routing dahulu.",
      "pcc",
    );
    if (
      rows("firewall-filter").some((x) => x.action === "fasttrack-connection")
    )
      add(
        "PCC-FASTTRACK",
        "warning",
        "FastTrack dapat melewati policy routing. Periksa pengecualian connection mark/routing table.",
        "pcc",
      );
  }
  report.rules = [...rules].sort();
  return StandardsReportSchema.parse(report);
}

/** Suggests a range excluding addresses visible in evidence, not a claim that all hosts are free. */
export function suggestDhcpRange(
  address: string,
  evidence: AutomationEvidence,
) {
  const s = ipv4Subnet(address);
  if (s.prefix > 30)
    throw new Error(
      "DHCP memerlukan subnet dengan alamat host yang dapat dialokasikan.",
    );
  const blocked: { start: number; end: number }[] = [{ start: s.n, end: s.n }];
  for (const row of detailRows(evidence.data["ip-address"] || "")) {
    const a = safeSubnet(row.address);
    if (a) blocked.push({ start: a.n, end: a.n });
  }
  for (const row of detailRows(evidence.data["dhcp-lease"] || "")) {
    const a = safeSubnet(row.address);
    if (a) blocked.push({ start: a.n, end: a.n });
  }
  for (const row of detailRows(evidence.data["ip-pool"] || ""))
    for (const range of items(row.ranges)) {
      try {
        const [a, b = a] = range.split("-");
        blocked.push({ start: ipv4Number(a), end: ipv4Number(b) });
      } catch {
        throw new Error(
          "Pool yang terbaca tidak dapat dihitung; isi rentang setelah diperiksa.",
        );
      }
    }
  let cursor = s.start + 1,
    best = { start: 0, end: -1 };
  for (const span of blocked
    .filter((x) => overlaps(x, s))
    .sort((a, b) => a.start - b.start)) {
    if (span.start > cursor && span.start - cursor > best.end - best.start + 1)
      best = { start: cursor, end: Math.min(span.start - 1, s.end - 1) };
    cursor = Math.max(cursor, span.end + 1);
  }
  if (cursor < s.end && s.end - cursor > best.end - best.start + 1)
    best = { start: cursor, end: s.end - 1 };
  if (best.end < best.start)
    throw new Error(
      "Tidak ada rentang kandidat setelah mengecualikan alokasi yang terbaca.",
    );
  return {
    start: dottedIPv4(best.start),
    end: dottedIPv4(best.end),
    network: s.network,
    count: best.end - best.start + 1,
  };
}
