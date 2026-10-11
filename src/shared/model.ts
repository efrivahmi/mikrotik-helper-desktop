import { z } from "zod";
import type { AutomationEvidence, AutomationRequest } from "./automation";

export const RouterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  host: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9.:-]+$/),
  port: z.number().int().min(1).max(65535).default(22),
  user: z.string().trim().min(1).max(64),
  site: z.string().max(80).default(""),
  auth: z.enum(["key", "password"]).default("key"),
  keyPath: z.string().max(1000).default(""),
  legacyRSA: z.boolean().default(false),
  expectedIdentity: z.string().max(100).default(""),
  notes: z.string().max(2000).default(""),
});
export type Router = z.infer<typeof RouterSchema> & {
  id: string;
  fingerprint?: string;
  hasSecret?: boolean;
};
export const VerificationSchema = z
  .object({
    command: z.string().max(1000),
    contains: z.array(z.string().min(1).max(200)).max(10),
    notContains: z.array(z.string().min(1).max(200)).max(10).default([]),
    row: z.record(z.string().regex(/^[\w-]+$/), z.string().max(200)).optional(),
    equals: z.string().max(2000).optional(),
    valueType: z
      .enum(["text", "boolean", "rate", "rate-pair", "time", "list"])
      .optional(),
    count: z.number().int().min(0).max(100000).optional(),
  })
  .refine(
    (v) =>
      v.contains.length > 0 ||
      (v.row && Object.keys(v.row).length > 0) ||
      v.equals !== undefined ||
      v.count !== undefined,
    {
      message:
        "Verifikasi membutuhkan teks target atau nilai properti baris RouterOS.",
    },
  );
export const PlanInputSchema = z.object({
  routerId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  reason: z.string().min(5).max(4000),
  apply: z.string().min(5).max(100000),
  rollback: z.string().min(5).max(100000),
  verify: z.array(VerificationSchema).min(1).max(512),
  rollbackVerify: z.array(VerificationSchema).min(1).max(512),
  preconditions: z.array(VerificationSchema).max(512).default([]),
  secretBindings: z
    .record(z.string().regex(/^__SECRET_[a-f0-9-]+__$/), z.string().uuid())
    .optional(),
  automation: z
    .object({
      name: z.string(),
      recipeId: z.string().optional(),
      jobId: z.string().uuid().optional(),
      evidenceId: z.string().uuid(),
      managementSubnet: z.string(),
      managementInterface: z.string(),
      alternateAccess: z.boolean(),
      menus: z.array(z.string()),
      identityBefore: z.string().optional(),
      identityAfter: z.string().optional(),
    })
    .optional(),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;
export type Plan = PlanInput & {
  id: string;
  createdAt: string;
  hash: string;
  targetHash: string;
  risk: string[];
  status:
    | "draft"
    | "applying"
    | "applied"
    | "needs-review"
    | "unknown"
    | "rolling-back"
    | "rolled-back";
  backupId?: string;
  result?: string;
};
export const SkillSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{2,60}$/),
    title: z.string().min(3).max(150),
    version: z.string().max(30),
    mode: z.enum(["read-only", "plan-only"]),
    purpose: z.string().max(3000),
    domains: z.array(z.string()).max(30),
    commands: z.array(z.string().max(1000)).max(50).default([]),
    checks: z.array(z.string()).default([]),
    safety: z.array(z.string()).default([]),
  })
  .passthrough();
export type Skill = z.infer<typeof SkillSchema>;
export interface Snapshot {
  id: string;
  routerId: string;
  createdAt: string;
  source: "live";
  capturedAt?: Record<string, string>;
  data: Record<string, string>;
  errors: Record<string, string>;
  metrics: {
    identity?: string;
    version?: string;
    board?: string;
    uptime?: string;
    cpu?: number;
    freeMemory?: string;
    totalMemory?: string;
    activeUsers?: number;
    hostCount?: number;
    simpleQueues?: number;
    interfaceTraffic?: InterfaceTraffic[];
  };
}
export interface InterfaceTraffic {
  name: string;
  rxBytes: string;
  txBytes: string;
  rxBps?: number;
  txBps?: number;
  intervalSeconds?: number;
  measuredAt: string;
}
export interface Job {
  id: string;
  routerId: string;
  title: string;
  state: "running" | "done" | "failed";
  startedAt: string;
  endedAt?: string;
  steps: string[];
  error?: string;
}
export interface Audit {
  id: number;
  at: string;
  routerId: string;
  action: string;
  detail: string;
}
export interface Backup {
  id: string;
  routerId: string;
  createdAt: string;
  path: string;
  sha256: string;
  version: string;
  binaryPath?: string;
  binarySha256?: string;
  passwordPath?: string;
  verifiedAt?: string;
}
export interface DeploymentProfile {
  id: string;
  name: string;
  createdAt: string;
  request: Omit<AutomationRequest, "routerId" | "evidenceId">;
}
export interface Message {
  id: string;
  routerId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}
export const SettingsSchema = z.object({
  aiEnabled: z.boolean().default(false),
  aiBaseUrl: z.string().max(400).default("http://127.0.0.1:11434/v1"),
  aiModel: z.string().max(100).default(""),
  shareEvidence: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type ConnectionStatus =
  | "untested"
  | "checking"
  | "trust-required"
  | "connecting"
  | "reachable"
  | "unreachable"
  | "auth-failed"
  | "host-key-changed"
  | "identity-mismatch";
export interface ConnectionState {
  routerId: string;
  status: ConnectionStatus;
  checkedAt?: string;
  lastSuccessAt?: string;
  error?: string;
  code?: string;
  identity?: string;
}
export interface ConnectionReport {
  id: string;
  routerId: string;
  checkedAt: string;
  endpoint: string;
  localAddresses: string[];
  resolvedAddress?: string;
  fingerprint?: string;
  success: boolean;
  needsTrust: boolean;
  errorCode?: string;
  steps: {
    label: string;
    state: "pass" | "failed" | "skipped";
    detail: string;
    durationMs?: number;
  }[];
}
export interface ModelCheck {
  checkedAt: string;
  endpoint: string;
  model: string;
  availableModels: string[];
  success: boolean;
  error?: string;
}
export interface AppState {
  routers: Router[];
  connections: ConnectionState[];
  connectionReports: ConnectionReport[];
  modelCheck?: ModelCheck;
  snapshots: Snapshot[];
  skills: Skill[];
  plans: Plan[];
  jobs: Job[];
  audit: Audit[];
  backups: Backup[];
  messages: Message[];
  settings: Settings;
  dataDir: string;
  version: string;
  secureStorage: boolean;
  hasAiKey: boolean;
  automationEvidence?: AutomationEvidence[];
  deploymentProfiles?: DeploymentProfile[];
}
