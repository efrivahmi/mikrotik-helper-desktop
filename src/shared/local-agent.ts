export const DEVELOPMENT_IDENTITY = "Development by ep";
export const LOCAL_AGENT_VERSION = "2.0";
export const BACKUP_POLICY_VERSION = "full-config-files-v1";
export const WORKFLOW_TITLES = {
  snapshot: "Kondisi router",
  bandwidth: "Bandwidth dan PCQ",
  network: "Interface, VLAN dan routing",
  hotspot: "HotSpot dan pemetaan alamat",
  dhcp: "DHCP, pool dan bentrok alamat",
  dns: "DNS",
  firewall: "Firewall dan NAT",
  vpn: "VPN",
  wireless: "WiFi dan registrasi radio",
  logs: "Log router",
  security: "Akses administrasi",
  capacity: "Lisensi dan kapasitas",
  backup: "Backup penuh konfigurasi dan file",
} as const;
export type LocalWorkflow = keyof typeof WORKFLOW_TITLES;
export interface AgentContext {
  routerId: string;
  targetHash: string;
  updatedAt: string;
  workflows: LocalWorkflow[];
  targets: string[];
}
export interface AgentAction {
  id: string;
  routerId: string;
  targetHash: string;
  createdAt: string;
  expiresAt: string;
  hash: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  kind: "read" | "backup" | "command" | "model";
  title: string;
  request: string;
  workflows: LocalWorkflow[];
  targets: string[];
  commands: string[];
  warnings: string[];
  inheritedContext: boolean;
  modelSettingsHash?: string;
  jobId?: string;
}
export const BACKUP_SCOPE_TEXT =
  "Export, biner sistem terenkripsi, seluruh file pengguna yang terdaftar, dan manifest checksum. " +
  "Database User Manager/The Dude, container atau penyimpanan khusus memerlukan prosedur tersendiri; " +
  "jika ditemukan, cakupan belum penuh dan perubahan dihentikan. Pemulihan perangkat belum diuji.";
