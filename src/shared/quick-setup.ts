import { z } from "zod";
import { detailRows } from "./routeros";
import { ipv4Subnet } from "./standards";
import type { AutomationEvidence } from "./automation";

export const QUICK_VERSION = "1.0";
export const QUICK_DISCOVERY_MODULES = [
  "interfaces",
  "ethernet",
  "bridge",
  "bridge-port",
  "bridge-vlan",
  "interface-list",
  "interface-list-member",
  "vlan",
  "ip-address",
  "ip-pool",
  "dhcp-server",
  "dhcp-network",
  "dhcp-lease",
  "dhcp-client",
  "pppoe-client",
  "static-route",
  "firewall-filter",
  "firewall-nat",
  "simple-queue",
  "queue-type",
  "dns",
];
export const QUICK_PURPOSES = [
  {
    id: "home",
    title: "Rumah / toko kecil",
    description: "Satu LAN bersama, DHCP dan proteksi internet.",
    topology: "bridge",
    labels: ["LAN"],
    hotspot: false,
    isolate: false,
  },
  {
    id: "office",
    title: "Kantor",
    description: "Pisahkan staf, tamu dan perangkat dengan VLAN.",
    topology: "vlan",
    labels: ["Staf", "Tamu", "Perangkat"],
    hotspot: false,
    isolate: true,
  },
  {
    id: "school",
    title: "Sekolah / kampus",
    description: "Pilihan jaringan staf, mahasiswa, tamu dan perangkat.",
    topology: "vlan",
    labels: ["Staf", "Mahasiswa", "Tamu", "Perangkat"],
    hotspot: false,
    isolate: true,
  },
  {
    id: "hotspot",
    title: "HotSpot / WiFi tamu",
    description: "LAN pengelola dan jaringan tamu dengan login HotSpot.",
    topology: "vlan",
    labels: ["Pengelola", "Tamu"],
    hotspot: true,
    isolate: true,
  },
  {
    id: "branch",
    title: "Cabang / port terpisah",
    description: "Setiap port LAN memiliki subnet sendiri.",
    topology: "routed",
    labels: ["LAN cabang", "Perangkat"],
    hotspot: false,
    isolate: true,
  },
  {
    id: "custom",
    title: "Susun sendiri",
    description: "Mulai dari satu jaringan lalu pilih layanan yang dibutuhkan.",
    topology: "bridge",
    labels: ["LAN"],
    hotspot: false,
    isolate: false,
  },
] as const;
export const ADDRESS_PLANS = [
  {
    id: "private10",
    title: "10.site.x.1 /24",
    hint: "Ruang privat 10/8; kode lokasi membedakan cabang.",
  },
  {
    id: "private172",
    title: "172.16.x.1 /24",
    hint: "Pilihan dalam ruang privat 172.16/12.",
  },
  {
    id: "private192",
    title: "192.168.x.1 /24",
    hint: "Pilihan dalam ruang privat 192.168/16.",
  },
] as const;
export const DNS_PRESETS = [
  { id: "observed", title: "DNS yang terbaca dari router", servers: "" },
  {
    id: "cloudflare",
    title: "Cloudflare (1.1.1.1 / 1.0.0.1)",
    servers: "1.1.1.1,1.0.0.1",
  },
  {
    id: "google",
    title: "Google (8.8.8.8 / 8.8.4.4)",
    servers: "8.8.8.8,8.8.4.4",
  },
  { id: "manual", title: "Isi DNS sendiri", servers: "" },
] as const;
export const QuickSetupSchema = z.object({
  version: z.literal(QUICK_VERSION),
  purpose: z.enum(["home", "office", "school", "hotspot", "branch", "custom"]),
  topology: z.enum(["bridge", "routed", "vlan"]),
  managementPort: z.string().max(100),
  site: z.number().int().min(1).max(254),
  addressPlan: z.enum(["", "private10", "private172", "private192", "custom"]),
  dns: z.string().max(500),
  internet: z.object({
    mode: z.enum(["keep", "dhcp", "static", "pppoe"]),
    interface: z.string().max(100),
    address: z.string().max(80).default(""),
    gateway: z.string().max(80).default(""),
    user: z.string().max(100).default(""),
    password: z.string().max(1000).default(""),
    distance: z.number().int().min(1).max(255).default(1),
  }),
  segments: z
    .array(
      z.object({
        id: z.string().regex(/^s[1-4]$/),
        label: z.string().trim().min(1).max(50),
        attachment: z.enum(["new", "existing"]),
        interface: z.string().max(100),
        address: z.string().max(80),
        vlan: z.number().int().min(1).max(4094),
        dhcp: z.enum(["server", "none", "preserve"]),
        range: z.string().max(100),
        service: z.enum(["lan", "hotspot"]),
        shaping: z.enum(["none", "pcq", "limit"]),
        upload: z.string().max(40),
        download: z.string().max(40),
        hotspot: z.object({
          domain: z.string().max(100),
          user: z.string().max(100),
          password: z.string().max(1000),
          upload: z.string().max(40),
          download: z.string().max(40),
          sharedUsers: z.number().int().min(1).max(100),
        }),
      }),
    )
    .min(1)
    .max(4),
  ports: z
    .array(
      z.object({
        interface: z.string().max(100),
        role: z.enum(["keep", "wan", "lan", "access", "trunk"]),
        segment: z.string().max(10),
        segments: z.array(z.string().max(10)).max(4),
      }),
    )
    .max(64),
  firewall: z.boolean(),
  isolate: z.boolean(),
  disableFastTrack: z.boolean(),
});
export type QuickSetupConfig = z.infer<typeof QuickSetupSchema>;
export function emptySegment(
  index: number,
  label = "LAN",
): QuickSetupConfig["segments"][number] {
  return {
    id: `s${index + 1}`,
    label,
    attachment: "new",
    interface: "",
    address: "",
    vlan: (index + 1) * 10,
    dhcp: "server",
    range: "",
    service: "lan",
    shaping: "none",
    upload: "",
    download: "",
    hotspot: {
      domain: "",
      user: "",
      password: "",
      upload: "",
      download: "",
      sharedUsers: 1,
    },
  };
}
export function emptyQuickSetup(): QuickSetupConfig {
  return {
    version: QUICK_VERSION,
    purpose: "custom",
    topology: "bridge",
    managementPort: "",
    site: 1,
    addressPlan: "",
    dns: "",
    internet: {
      mode: "keep",
      interface: "",
      address: "",
      gateway: "",
      user: "",
      password: "",
      distance: 1,
    },
    segments: [emptySegment(0)],
    ports: [],
    firewall: true,
    isolate: false,
    disableFastTrack: false,
  };
}
export function quickModules(config: QuickSetupConfig): string[] {
  return [
    ...new Set([
      ...QUICK_DISCOVERY_MODULES,
      ...(config.segments.some((s) => s.service === "hotspot")
        ? [
            "hotspot-server",
            "hotspot-profile",
            "hotspot-user-profile",
            "hotspot-user",
          ]
        : []),
    ]),
  ];
}
export function addressCandidates(index: number, site: number) {
  const octet = (index + 1) * 10;
  return ADDRESS_PLANS.flatMap((plan) =>
    [octet, octet + 100].map((n) => ({
      plan: plan.id,
      address:
        plan.id === "private10"
          ? `10.${site}.${n}.1/24`
          : plan.id === "private172"
            ? `172.16.${n}.1/24`
            : `192.168.${n}.1/24`,
    })),
  );
}
export function addressConflict(
  address: string,
  e: AutomationEvidence,
): string | undefined {
  let net;
  try {
    net = ipv4Subnet(address);
  } catch {
    return "Format IP/prefix belum valid";
  }
  for (const id of ["ip-address", "dhcp-network", "static-route"])
    for (const row of detailRows(e.data[id] || "")) {
      if (row.disabled === "yes") continue;
      try {
        const other = ipv4Subnet(
          id === "static-route" ? row["dst-address"] : row.address,
        );
        if (id === "static-route" && other.prefix < 8) continue;
        if (net.start <= other.end && other.start <= net.end)
          return `${id === "static-route" ? "Route" : "Subnet"} ${other.network} sudah terbaca${row.interface ? ` pada ${row.interface}` : ""}`;
      } catch {
        continue;
      }
    }
  return undefined;
}
export function protectedManagementPorts(
  e: AutomationEvidence,
  managementInterface: string,
  explicitPort: string,
): Set<string> {
  const protectedPorts = new Set<string>(explicitPort ? [explicitPort] : []),
    seen = new Set<string>();
  const expand = (name: string) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    protectedPorts.add(name);
    for (const p of detailRows(e.data["bridge-port"] || ""))
      if (p.bridge === name) expand(p.interface);
    for (const id of ["vlan", "pppoe-client"])
      for (const p of detailRows(e.data[id] || ""))
        if (p.name === name) expand(p.interface);
  };
  expand(managementInterface);
  return protectedPorts;
}
export function portUsage(e: AutomationEvidence, name: string): string[] {
  const reasons: string[] = [];
  for (const p of detailRows(e.data["bridge-port"] || ""))
    if (p.interface === name) reasons.push(`anggota ${p.bridge}`);
  for (const id of [
    "ip-address",
    "dhcp-server",
    "dhcp-client",
    "hotspot-server",
    "pppoe-client",
    "vlan",
  ])
    for (const p of detailRows(e.data[id] || ""))
      if (p.interface === name)
        reasons.push(
          id === "ip-address" ? p.address : `${id}: ${p.name || "aktif"}`,
        );
  return reasons;
}
