import { isSecretField } from "./automation";
export const PROPERTY_LABELS: Record<string, string> = {
  name: "Nama",
  comment: "Catatan",
  address: "Alamat IP",
  interface: "Interface",
  disabled: "Nonaktifkan",
  enabled: "Aktifkan",
  port: "Port layanan",
  mtu: "MTU",
  network: "Alamat jaringan",
  servers: "DNS upstream",
  "dns-server": "DNS untuk client",
  "allow-remote-requests": "Layani DNS untuk client",
  "vlan-id": "VLAN ID",
  "vlan-ids": "VLAN ID",
  pvid: "VLAN untuk trafik tanpa tag (PVID)",
  bridge: "Bridge",
  tagged: "Port trunk / tagged",
  untagged: "Port access / untagged",
  "vlan-filtering": "Aktifkan filtering VLAN",
  "ingress-filtering": "Periksa VLAN saat masuk",
  "frame-types": "Jenis frame yang diterima",
  "protocol-mode": "Pencegahan loop bridge",
  "address-pool": "Pool alamat",
  ranges: "Rentang alamat",
  "lease-time": "Lama sewa DHCP",
  gateway: "Gateway",
  "mac-address": "MAC perangkat",
  server: "Server",
  "conflict-detection": "Deteksi konflik alamat",
  "use-peer-dns": "Gunakan DNS dari ISP",
  "add-default-route": "Tambahkan route internet",
  "default-route-distance": "Prioritas route ISP (distance)",
  "dst-address": "Alamat tujuan",
  "src-address": "Alamat sumber",
  distance: "Distance route",
  "check-gateway": "Pemeriksaan gateway",
  chain: "Chain",
  action: "Tindakan rule",
  protocol: "Protokol",
  "dst-port": "Port tujuan",
  "src-port": "Port sumber",
  "in-interface": "Interface masuk",
  "out-interface": "Interface keluar",
  "to-addresses": "IP tujuan NAT",
  "to-ports": "Port tujuan NAT",
  "connection-state": "Status koneksi",
  target: "IP / subnet yang dibatasi",
  parent: "Queue / interface induk",
  priority: "Prioritas queue (1 tertinggi, 8 terendah)",
  "max-limit": "Batas bandwidth",
  "limit-at": "Jaminan bandwidth",
  "pcq-rate": "Batas PCQ per client",
  "pcq-classifier": "Pembagi trafik PCQ",
  "rate-limit": "Batas upload / download",
  "shared-users": "Login serentak per akun",
  profile: "Profil",
  "login-by": "Cara login",
  "html-directory": "Direktori portal",
  ssid: "Nama WiFi (SSID)",
  country: "Negara / aturan radio",
  "authentication-types": "Jenis autentikasi",
  passphrase: "Password WiFi",
  password: "Password",
  "security-profile": "Profil keamanan",
  security: "Profil keamanan",
  "listen-port": "Port WireGuard",
  "endpoint-address": "Alamat peer",
  "endpoint-port": "Port peer",
  "allowed-address": "Subnet peer yang diizinkan",
  "public-key": "Public key peer",
  "allowed-interface-list": "Daftar interface yang diizinkan",
  "discover-interface-list": "Daftar interface discovery",
  "time-zone-name": "Zona waktu",
};
export function propertyInput(
  moduleId: string,
  key: string,
): {
  kind:
    | "text"
    | "secret"
    | "boolean"
    | "interface"
    | "rate"
    | "rate-pair"
    | "select";
  options?: string[];
  hint?: string;
} {
  if (isSecretField(key)) return { kind: "secret" };
  if (
    [
      "disabled",
      "enabled",
      "allow-remote-requests",
      "vlan-filtering",
      "ingress-filtering",
      "add-default-route",
      "use-peer-dns",
      "use-peer-ntp",
      "conflict-detection",
      "hw",
      "log",
      "add-arp",
      "use-radius",
      "only-one",
      "auto-negotiation",
      "full-duplex",
      "igmp-snooping",
      "transparent-proxy",
      "passthrough",
      "fib",
    ].includes(key)
  )
    return { kind: "boolean", options: ["yes", "no"] };
  if (["interface", "in-interface", "out-interface"].includes(key))
    return { kind: "interface" };
  if (
    ["max-limit", "limit-at"].includes(key) &&
    ["simple-queue", "queue-tree"].includes(moduleId)
  )
    return {
      kind: moduleId === "simple-queue" ? "rate-pair" : "rate",
      hint: "Satuan bit per detik. Nilai 0 berarti tanpa batas.",
    };
  if (key === "pcq-rate")
    return {
      kind: "rate",
      hint: "0 membagi kapasitas total secara merata di antara substream aktif.",
    };
  if (key === "rate-limit")
    return {
      kind: "text",
      hint: "Upload/download; format RouterOS lanjutan (burst/threshold/time) juga dapat digunakan.",
    };
  if (key === "priority")
    return {
      kind: "text",
      hint:
        moduleId === "simple-queue"
          ? "Upload/download, masing-masing 1–8."
          : "1 paling tinggi, 8 paling rendah.",
    };
  if (key === "protocol-mode")
    return { kind: "select", options: ["rstp", "mstp", "stp", "none"] };
  if (key === "frame-types")
    return {
      kind: "select",
      options: [
        "admit-all",
        "admit-only-vlan-tagged",
        "admit-only-untagged-and-priority-tagged",
      ],
    };
  if (key === "check-gateway")
    return { kind: "select", options: ["none", "ping", "arp"] };
  if (key === "protocol")
    return {
      kind: "text",
      hint: "Pilih nama protocol RouterOS; port memerlukan TCP/UDP atau protocol transport sejenis.",
    };
  if (["vlan-id", "vlan-ids", "pvid"].includes(key))
    return {
      kind: "text",
      hint: "1–4094. Satu VLAN per baris access/untagged.",
    };
  if (key === "address" || key.endsWith("-address"))
    return {
      kind: "text",
      hint:
        moduleId === "ip-address"
          ? "Alamat host dan prefix subnet, misalnya format IPv4/24."
          : "Gunakan format alamat yang sesuai menu; jangan memakai alamat network/broadcast untuk host.",
    };
  return { kind: "text" };
}
export const RECIPE_DEFAULTS: Record<string, string> = {
  distance: "1",
  priority: "8",
  sharedUsers: "1",
  protocol: "tcp",
};
export const RECIPE_HINTS: Record<string, string> = {
  address:
    "Isi IP yang direncanakan beserta prefix subnet. Alamat dan interface router lama tetap perlu diperiksa.",
  dns: "Alamat resolver yang dapat dijangkau client, dipisahkan koma. Dapat diisi dari DNS router yang terbaca.",
  target:
    "Gunakan /32 untuk satu perangkat, atau prefix subnet untuk kelompok client.",
  distance:
    "Angka lebih kecil dipilih lebih dulu. Nilai awal 1 untuk route utama; sesuaikan bila sudah ada ISP lain.",
  priority: "1 paling tinggi, 8 paling rendah. Nilai awal 8 untuk trafik umum.",
  sharedUsers: "Nilai awal 1: satu login serentak per akun.",
  country:
    "Gunakan nama regulatory country yang didukung driver RouterOS dan lokasi perangkat sebenarnya.",
};
