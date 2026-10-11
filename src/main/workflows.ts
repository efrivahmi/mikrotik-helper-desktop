import type { Snapshot } from "../shared/model";
import { detailRows } from "../shared/routeros";
import { SNAPSHOT_KEYS } from "./policy";

export type LocalWorkflow =
  "backup" | "bandwidth" | "network" | "hotspot" | "logs" | "snapshot";

export function localWorkflow(text: string): LocalWorkflow | undefined {
  if (
    /\b(ubah|seting|setting|konfigurasi ulang|pasang|hapus|reset|reboot|restart|terapkan|atur)\b/i.test(
      text,
    ) &&
    !/\bbackup\b/i.test(text)
  )
    return undefined;
  if (/\bbackup\b/i.test(text)) return "backup";
  if (/\b(bandwidth|bandwith|pemerataan|merata|pcq|queue|qos)\b/i.test(text))
    return "bandwidth";
  if (/\b(log|logs|error|kesalahan)\b/i.test(text)) return "logs";
  if (/\b(hotspot|hot spot|user|pengguna|profile|profil)\b/i.test(text))
    return "hotspot";
  if (
    /\b(jaringan|network|route|routing|dhcp|dns|interface|switch|cabang|access point|ap|wifi|wi-fi|vlan)\b/i.test(
      text,
    )
  )
    return "network";
  if (
    /\b(kondisi|normal|beban|cpu|memori|resource|snapshot|status|periksa|cek|diagnosa|diagnostik)\b/i.test(
      text,
    )
  )
    return "snapshot";
  return undefined;
}

export function workflowKeys(workflow: LocalWorkflow): string[] {
  const extra: Partial<Record<LocalWorkflow, string[]>> = {
    bandwidth: ["queue-simple", "mangle-stats"],
    network: [
      "addresses",
      "routes",
      "bridges",
      "bridge-ports",
      "vlans",
      "services",
      "dns",
      "dhcp",
    ],
    hotspot: ["hotspot", "hotspot-active"],
    logs: ["logs"],
  };
  return [...new Set([...SNAPSHOT_KEYS, ...(extra[workflow] || [])])];
}

const rows = (snapshot: Snapshot, key: string) =>
  detailRows(snapshot.data[key] || "");
const count = (snapshot: Snapshot, key: string) =>
  Object.hasOwn(snapshot.data, key)
    ? rows(snapshot, key).length
    : "tidak terbaca";
const rate = (value?: number) =>
  value === undefined ? "perlu dua sampel" : `${(value / 1e6).toFixed(2)} Mbps`;

export function workflowReport(
  workflow: LocalWorkflow,
  snapshot: Snapshot,
): string {
  const m = snapshot.metrics;
  const lines = [
    `Data SSH diambil ${new Date(snapshot.createdAt).toLocaleString("id-ID")}.`,
    `${m.identity} · RouterOS ${m.version || "tidak terbaca"} · uptime ${m.uptime || "tidak terbaca"}`,
    `CPU ${m.cpu === undefined ? "tidak terbaca" : `${m.cpu}%`} · memori bebas ${m.freeMemory || "tidak terbaca"} / ${m.totalMemory || "tidak terbaca"}`,
    `HotSpot aktif ${m.activeUsers ?? "tidak terbaca"} · host ${m.hostCount ?? "tidak terbaca"} · simple queue ${m.simpleQueues ?? "tidak terbaca"}`,
  ];
  if (workflow === "bandwidth") {
    const types = rows(snapshot, "queue-types");
    const trees = rows(snapshot, "queue-tree");
    const pcqTypes = types.filter((r) => r.kind === "pcq");
    const used = trees.filter(
      (r) =>
        !r.flags.includes("X") &&
        pcqTypes.some((t) => r.queue?.split(/[,/]/).includes(t.name)),
    );
    lines.push(
      "",
      "Pembagian bandwidth:",
      `Queue Tree ${count(snapshot, "queue-tree")} · jenis PCQ ${Object.hasOwn(snapshot.data, "queue-types") ? pcqTypes.length : "tidak terbaca"} · queue aktif yang merujuk PCQ ${Object.hasOwn(snapshot.data, "queue-tree") && Object.hasOwn(snapshot.data, "queue-types") ? used.length : "tidak terbaca"}`,
    );
    for (const r of used.slice(0, 16)) {
      const type = pcqTypes.find((t) =>
        r.queue?.split(/[,/]/).includes(t.name),
      );
      lines.push(
        `• ${r.name}: parent=${r.parent || "tidak terbaca"}, packet-mark=${r["packet-mark"] || "tidak terbaca"}, max-limit=${r["max-limit"] || "tidak terbaca"}, classifier=${type?.["pcq-classifier"] || "tidak terbaca"}`,
      );
    }
    for (const r of rows(snapshot, "hotspot-user-profile").slice(0, 16))
      lines.push(
        `• Profil ${r.name}: rate-limit=${r["rate-limit"] === "" ? "tanpa batas per profil" : (r["rate-limit"] ?? "tidak terbaca")}, shared-users=${r["shared-users"] ?? "tidak terbaca"}`,
      );
    lines.push(
      "",
      "Keberadaan PCQ belum membuktikan semua cabang mendapat bagian merata. Cocokkan classifier, packet-mark, subnet, parent, dan kapasitas uplink. Counter drop adalah kumulatif; diperlukan sampel berurutan untuk menilai laju saat ini.",
    );
  } else if (workflow === "network") {
    lines.push("", "Interface dan tetangga (hingga 24 baris per kategori):");
    for (const r of (m.interfaceTraffic || []).slice(0, 24))
      lines.push(`• ${r.name}: RX ${rate(r.rxBps)}, TX ${rate(r.txBps)}`);
    for (const r of rows(snapshot, "neighbors").slice(0, 24))
      lines.push(
        `• ${r.identity || r["mac-address"] || "Tetangga"}: interface=${r.interface || "tidak terbaca"}, address=${r.address || "tidak terbaca"}, board=${r.board || "tidak terbaca"}`,
      );
    lines.push(
      `Alamat IP ${count(snapshot, "addresses")} · route ${count(snapshot, "routes")} · bridge port ${count(snapshot, "bridge-ports")} · VLAN ${count(snapshot, "vlans")}`,
    );
    lines.push(
      "Beban CPU AP/switch memerlukan sambungan tersendiri ke perangkat tersebut. Data interface router menunjukkan lalu lintas pada router yang dipilih.",
    );
  } else if (workflow === "hotspot") {
    lines.push("", "Profil HotSpot:");
    for (const r of rows(snapshot, "hotspot-user-profile").slice(0, 24))
      lines.push(
        `• ${r.name}: rate-limit=${r["rate-limit"] === "" ? "tanpa batas per profil" : (r["rate-limit"] ?? "tidak terbaca")}, shared-users=${r["shared-users"] ?? "tidak terbaca"}`,
      );
    lines.push("", "Sesi aktif (hingga 24 baris):");
    for (const r of rows(snapshot, "hotspot-active").slice(0, 24))
      lines.push(
        `• ${r.user || "user tidak terbaca"}: ${r.address || "alamat tidak terbaca"}, uptime=${r.uptime || "tidak terbaca"}`,
      );
  } else if (workflow === "logs") {
    lines.push(
      "",
      "Log terakhir yang dikembalikan router:",
      (snapshot.data.logs || "Log tidak tersedia.")
        .split("\n")
        .slice(-50)
        .join("\n"),
    );
  } else {
    lines.push(
      "",
      `Interface terbaca ${count(snapshot, "interfaces")} · tetangga ${count(snapshot, "neighbors")}`,
    );
    lines.push(
      "Satu snapshot menunjukkan kondisi pada waktu pengambilan. Gunakan sampel berurutan untuk memeriksa lonjakan beban dan lalu lintas.",
    );
  }
  const errors = Object.entries(snapshot.errors);
  if (errors.length)
    lines.push(
      "",
      "Bagian yang belum terbaca:",
      ...errors.map(([key, error]) => `• ${key}: ${error}`),
    );
  lines.push(
    "",
    "Output mentah dan waktu pengambilan tersedia di Diagnostik. Konfigurasi router tidak diubah.",
  );
  return lines.join("\n");
}
