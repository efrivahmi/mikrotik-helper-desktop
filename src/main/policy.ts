import { createHash } from "node:crypto";
import type { PlanInput, Snapshot, Router } from "../shared/model";

export const MENUS = [
  "system identity",
  "system resource",
  "system routerboard",
  "system package",
  "system clock",
  "system health",
  "interface",
  "interface ethernet",
  "interface vlan",
  "interface bridge",
  "interface bridge port",
  "interface bridge vlan",
  "interface l2tp-client",
  "interface wireguard",
  "ip address",
  "ip neighbor",
  "ip route",
  "routing route",
  "routing rule",
  "ip firewall filter",
  "ip firewall nat",
  "ip firewall mangle",
  "ip firewall address-list",
  "ip firewall connection",
  "ip service",
  "ip dns",
  "ip dhcp-server",
  "ip dhcp-server network",
  "ip dhcp-server lease",
  "ip pool",
  "ip hotspot",
  "ip hotspot active",
  "ip hotspot host",
  "ip hotspot user profile",
  "ip hotspot profile",
  "queue simple",
  "queue tree",
  "queue type",
  "ip ipsec active-peers",
  "ip ipsec policy",
  "log",
  "interface wireless registration-table",
  "interface wifi registration-table",
  "caps-man registration-table",
];

export function readCommand(input: string): string {
  const command = input.trim().replace(/\s+/g, " ");
  if (/[;\r\n\[\]{}$`\\#]/.test(input) || input.length > 1000)
    throw new Error(
      "Hanya satu perintah diagnostik yang diizinkan. Script dan ekspresi tidak diizinkan.",
    );
  const match = command.match(/^\/([a-z -]+?) print(?: (.*))?$/);
  if (!match || !MENUS.includes(match[1]))
    throw new Error(
      "Menu/perintah ini belum tersedia di katalog diagnostik. Gunakan menu print yang didukung.",
    );
  const tail = match[2] || "";
  const tokens = tail.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const token of tokens) {
    if (
      [
        "detail",
        "terse",
        "count-only",
        "stats",
        "stats-detail",
        "without-paging",
        "where",
      ].includes(token)
    )
      continue;
    if (
      /^(name|comment|interface|dynamic|disabled|running|routing-mark|chain|topics|dst-address|src-address)=(?:[a-zA-Z0-9_.:/-]+|"[a-zA-Z0-9 _.:/@-]*")$/.test(
        token,
      )
    )
      continue;
    throw new Error(`Argumen diagnostik tidak diizinkan: ${token}`);
  }
  // Singleton menus have no paginated rows; RouterOS 6 rejects table options here.
  if (
    [
      "system identity",
      "system resource",
      "system routerboard",
      "system clock",
      "ip dns",
    ].includes(match[1])
  ) {
    if (tokens.some((t) => !["detail", "without-paging"].includes(t)))
      throw new Error("Menu singleton ini hanya mendukung print biasa.");
    return `/${match[1]} print`;
  }
  return (
    command +
    (tail.includes("without-paging") || tail.includes("count-only")
      ? ""
      : " without-paging")
  );
}
export function redact(text: string): string {
  return text
    .replace(
      /((?:password|passwd|secret|ipsec-secret|private-key|passphrase|token|api-key)\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\s;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[PRIVATE KEY REDACTED]",
    );
}
export function remoteError(output: string): boolean {
  return /(?:^|\n)\s*(?:syntax error|bad command name|expected end of command|failure:|error:|no such command|input does not match|expected value)/i.test(
    output,
  );
}
export function scriptReview(text: string): string[] {
  if (text.includes("\0")) throw new Error("Script mengandung karakter NUL.");
  const body = text
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");
  if (/\b(reset-configuration|reboot|shutdown|netinstall)\b/i.test(body))
    throw new Error(
      "Reset, reboot, shutdown, dan netinstall tidak didukung oleh apply umum.",
    );
  if (
    /(?:\/|\b)(?:system\s+(?:scheduler|script)|tool\s+(?:fetch|telnet|ssh)|execute)\b/i.test(
      body,
    ) ||
    /\b(?:password|secret|private-key|passphrase)\s*=/i.test(body)
  )
    throw new Error(
      "Script terjadwal, eksekusi eksternal, dan penulisan credential tidak didukung dalam rencana umum.",
    );
  const risks: string[] = [];
  if (/\b(remove|disable)\b/i.test(body))
    risks.push("Menghapus atau menonaktifkan objek.");
  if (
    /\b(route|vlan|bridge|address|interface|firewall|service|user|ipsec)\b/i.test(
      body,
    )
  )
    risks.push(
      "Dapat memengaruhi konektivitas, akses manajemen, atau layanan.",
    );
  if (/[:{}\[\]$]/.test(body))
    risks.push("Mengandung ekspresi RouterOS; tinjau semua cabang script.");
  if (!/AGENT-/i.test(body))
    risks.push("Belum ada tag AGENT- untuk identifikasi perubahan.");
  risks.push(
    "Pemeriksaan pola bukan pembuktian keamanan. Import RouterOS dapat selesai sebagian.",
  );
  return risks;
}
export function planHash(plan: PlanInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        routerId: plan.routerId,
        title: plan.title,
        reason: plan.reason,
        apply: plan.apply,
        rollback: plan.rollback,
        verify: plan.verify,
        rollbackVerify: plan.rollbackVerify,
        preconditions: plan.preconditions,
      }),
    )
    .digest("hex");
}
export function targetHash(router: Router): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        host: router.host,
        port: router.port,
        user: router.user,
        expectedIdentity: router.expectedIdentity,
        fingerprint: router.fingerprint,
      }),
    )
    .digest("hex");
}
export function matchesCheck(
  result: string,
  check: PlanInput["verify"][number],
): boolean {
  return (
    check.contains.every((text) => result.includes(text)) &&
    (check.notContains || []).every((text) => !result.includes(text))
  );
}
export function parseMetrics(
  data: Record<string, string>,
): Snapshot["metrics"] {
  const value = (text: string, key: string) =>
    text.match(new RegExp(`(?:^|\\n)\\s*${key}:\\s*(.+)`))?.[1]?.trim();
  const resource = data.resource || "";
  const count = (key: string) =>
    /^\d+$/.test((data[key] || "").trim())
      ? Number(data[key].trim())
      : undefined;
  return {
    identity: value(data.identity || "", "name"),
    version: value(resource, "version"),
    board: value(resource, "board-name"),
    uptime: value(resource, "uptime"),
    cpu: value(resource, "cpu-load")
      ? Number(value(resource, "cpu-load")!.replace("%", ""))
      : undefined,
    freeMemory: value(resource, "free-memory"),
    totalMemory: value(resource, "total-memory"),
    activeUsers: count("hotspot-active-count"),
    hostCount: count("hotspot-host-count"),
    simpleQueues: count("queue-simple-count"),
  };
}
export const DIAGNOSTICS: Record<string, string> = {
  identity: "/system identity print",
  resource: "/system resource print",
  interfaces: "/interface print detail",
  "interface-stats": "/interface print stats-detail",
  neighbors: "/ip neighbor print detail",
  vlans: "/interface vlan print detail",
  addresses: "/ip address print detail",
  routes: "/ip route print detail",
  services: "/ip service print detail",
  dns: "/ip dns print detail",
  dhcp: "/ip dhcp-server print detail",
  leases: "/ip dhcp-server lease print detail",
  hotspot: "/ip hotspot print detail",
  "hotspot-active-count": "/ip hotspot active print count-only",
  "hotspot-host-count": "/ip hotspot host print count-only",
  "hotspot-user-profile": "/ip hotspot user profile print detail",
  "mangle-detail": "/ip firewall mangle print detail",
  "mangle-stats": "/ip firewall mangle print stats",
  "queue-simple-count": "/queue simple print count-only",
  "queue-tree": "/queue tree print detail",
  "queue-tree-stats": "/queue tree print stats",
  "queue-types": "/queue type print detail",
  firewall: "/ip firewall filter print detail",
  nat: "/ip firewall nat print detail",
  vpn: "/ip ipsec active-peers print detail",
  logs: "/log print",
};
export const SNAPSHOT_KEYS = [
  "identity",
  "resource",
  "interfaces",
  "interface-stats",
  "neighbors",
  "hotspot-active-count",
  "hotspot-host-count",
  "hotspot-user-profile",
  "queue-simple-count",
  "queue-tree",
  "queue-tree-stats",
  "queue-types",
  "mangle-detail",
];
