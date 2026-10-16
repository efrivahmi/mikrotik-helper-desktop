import { createHash, randomUUID } from "node:crypto";
import type { Engine } from "./engine";
import type { AgentAction, AgentContext } from "../shared/local-agent";
import {
  BACKUP_SCOPE_TEXT,
  WORKFLOW_TITLES,
  BACKUP_POLICY_VERSION,
} from "../shared/local-agent";
import type { Job } from "../shared/model";
import type { Backup, Skill } from "../shared/model";
import { resolveLocalRequest, workflowKeys, workflowReport } from "./workflows";
import { DIAGNOSTICS, readCommand, redact, targetHash } from "./policy";

export function actionHash(action: Omit<AgentAction, "hash"> | AgentAction) {
  const { status, jobId, hash, ...immutable } = action as AgentAction;
  return createHash("sha256").update(JSON.stringify(immutable)).digest("hex");
}
function reply(engine: Engine, routerId: string, text: string) {
  engine.message(routerId, "assistant", text);
  const at = new Date().toISOString(),
    id = randomUUID();
  engine.store.put<Job>("job", id, {
    id,
    routerId,
    title: "Persiapan workflow lokal",
    state: "done",
    startedAt: at,
    endedAt: at,
    steps: ["Jawaban/rencana lokal disiapkan. Tidak ada perintah ke router."],
  });
  return id;
}
export function cancelAction(engine: Engine, id: string) {
  const action = engine.store.get<AgentAction>("agent-action", id);
  if (!action || action.status !== "pending")
    throw new Error(
      "Hanya tindakan yang belum dijalankan yang dapat dibatalkan.",
    );
  engine.store.put("agent-action", id, { ...action, status: "cancelled" });
  engine.store.audit(
    action.routerId,
    "agent.cancel",
    `${id}; belum dijalankan`,
  );
  return true;
}
export function createAction(
  engine: Engine,
  input: Omit<
    AgentAction,
    "id" | "hash" | "createdAt" | "expiresAt" | "status"
  >,
) {
  for (const old of engine.store
    .all<AgentAction>("agent-action")
    .filter((a) => a.routerId === input.routerId && a.status === "pending"))
    cancelAction(engine, old.id);
  const now = Date.now();
  const action: AgentAction = {
    ...input,
    id: randomUUID(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
    status: "pending",
    hash: "",
  };
  action.hash = actionHash(action);
  engine.store.put("agent-action", action.id, action);
  engine.store.audit(
    action.routerId,
    "agent.preview",
    `${action.kind}; ${action.hash}; ${action.commands.length} perintah`,
  );
  return action;
}
export function requestAgent(engine: Engine, routerId: string, text: string) {
  if (!text.trim() || text.length > 12000)
    throw new Error("Pesan harus berisi 1–12.000 karakter.");
  const router = engine.store.router(routerId);
  for (const previous of engine.store
    .all<AgentAction>("agent-action")
    .filter((a) => a.routerId === routerId && a.status === "pending"))
    cancelAction(engine, previous.id);
  engine.message(routerId, "user", text);
  if (redact(text) !== text)
    return reply(
      engine,
      routerId,
      "Pesan berisi pola credential dan telah disamarkan. Jangan kirim password, token atau private key lewat percakapan. Isi credential hanya melalui formulir yang disediakan.",
    );
  const savedContext = engine.store.get<AgentContext>(
    "agent-context",
    routerId,
  );
  const context =
    savedContext?.targetHash === targetHash(router) ? savedContext : undefined;
  const decision = resolveLocalRequest(text, context);
  if (
    /^(?:hasilnya|apa hasilnya|bagaimana hasil(?:nya)?|sudah selesai|apakah (?:sudah )?(?:selesai|berhasil)|sudah berhasil)[?!. ]*$/i.test(
      text.trim(),
    )
  ) {
    const previous = engine.store
      .all<AgentAction>("agent-action")
      .find(
        (a) =>
          a.routerId === routerId &&
          a.jobId &&
          a.targetHash === targetHash(router),
      );
    const job = previous?.jobId
      ? engine.store.get<Job>("job", previous.jobId)
      : undefined;
    if (!job)
      return reply(
        engine,
        routerId,
        "Belum ada hasil pekerjaan yang dapat dikaitkan dengan target router ini. Sebutkan pemeriksaan yang ingin disiapkan.",
      );
    return reply(
      engine,
      routerId,
      `Status pekerjaan ${job.id}: ${job.state === "done" ? "selesai" : job.state === "running" ? "masih berjalan" : "gagal/belum selesai"}.\nTujuan: ${previous!.title}. Mulai ${job.startedAt}; selesai ${job.endedAt || "belum tercatat"}.\n${job.error || job.steps.slice(-2).join("\n")}\nIni status pekerjaan yang tercatat, bukan pemeriksaan baru. Lihat evidence/jawaban sebelumnya untuk hasil rinci. Keberhasilan pembacaan atau backup tidak membuktikan layanan client maupun pemulihan hardware.`,
    );
  }
  if (decision.kind === "cancel") {
    for (const action of engine.store
      .all<AgentAction>("agent-action")
      .filter((a) => a.routerId === routerId && a.status === "pending"))
      cancelAction(engine, action.id);
    engine.store.remove("agent-context", routerId);
    return reply(engine, routerId, decision.message);
  }
  if (decision.kind === "backup-status") {
    const backup = engine.store
      .all<Backup>("backup")
      .find((b) => b.routerId === routerId);
    return reply(
      engine,
      routerId,
      backup
        ? `${decision.message}\nArsip terakhir: ${backup.id}; dibuat ${backup.createdAt}; verifikasi transfer ${backup.verifiedAt || "belum tersedia"}.\nCakupan: ${backup.policyVersion === BACKUP_POLICY_VERSION ? "konfigurasi dan file pengguna terdaftar" : "backup versi lama; belum membuktikan file pengguna lengkap"}. Pemulihan perangkat belum diuji. Buka Backup & riwayat untuk lokasi.`
        : "Belum ada arsip backup yang tercatat pada aplikasi ini. Belum ada backup baru dijalankan.",
    );
  }
  const explicitModel =
    /^(?:analisis model|tanya model|gunakan model|model:)/i.test(text.trim());
  if (explicitModel && !engine.store.settings().aiEnabled)
    return reply(
      engine,
      routerId,
      "Model belum diaktifkan. Pilih model lokal dan izin evidence pada Pengaturan, atau tulis pemeriksaan tanpa awalan model untuk menggunakan workflow deterministik.",
    );
  if (
    decision.kind !== "action" &&
    (!explicitModel || (decision.kind !== "proposal" && !decision.allowModel))
  )
    return reply(engine, routerId, decision.message);
  const useModel = explicitModel;
  const workflows =
    decision.kind === "action"
      ? useModel && decision.workflows.includes("backup")
        ? ["snapshot" as const]
        : decision.workflows
      : ["snapshot" as const];
  const command =
    decision.kind === "action" && !useModel ? decision.command : undefined;
  const kind = useModel
    ? "model"
    : workflows.includes("backup")
      ? "backup"
      : command
        ? "command"
        : "read";
  const commands =
    kind === "backup"
      ? [
          "/system resource print",
          "/system package print detail",
          "/file print detail",
          "/export (sensitive hidden)",
          "/system backup save (AES-SHA256)",
          "SCP: dua pembacaan biner dan setiap file pengguna",
        ]
      : command
        ? [command]
        : workflowKeys(workflows).map((key) => readCommand(DIAGNOSTICS[key]));
  const action = createAction(engine, {
    routerId,
    targetHash: targetHash(router),
    kind,
    title: useModel
      ? "Analisis model dengan evidence baru"
      : kind === "backup"
        ? WORKFLOW_TITLES.backup
        : command
          ? "Perintah diagnostik"
          : workflows.map((w) => WORKFLOW_TITLES[w]).join(", "),
    request: text,
    workflows,
    commands,
    targets: decision.kind === "action" ? decision.targets : [],
    inheritedContext: decision.kind === "action" && decision.inheritedContext,
    ...(useModel
      ? {
          modelSettingsHash: createHash("sha256")
            .update(JSON.stringify(engine.store.settings()))
            .digest("hex"),
        }
      : {}),
    warnings:
      kind === "backup"
        ? [
            BACKUP_SCOPE_TEXT,
            "Membuat file backup pada router; tidak mengimpor konfigurasi.",
          ]
        : [
            "Pemeriksaan dapat menambah beban baca. Tidak mengubah konfigurasi atau memutus sesi.",
            ...(useModel
              ? [
                  "Evidence dan konteks percakapan akan dikirim ke endpoint model yang dipilih. Jawaban model adalah analisis yang harus dicocokkan dengan sumber.",
                ]
              : []),
          ],
  });
  return reply(
    engine,
    routerId,
    `Rencana siap ditinjau: ${action.title}.\nRouter ${router.name} (${router.host}:${router.port}); target ${action.targets.join(", ") || "router yang dipilih"}.\n${action.inheritedContext ? "Topik/target memakai konteks pemeriksaan berhasil sebelumnya, maksimal 20 menit; evidence akan dibaca ulang.\n" : ""}Belum ada sambungan atau perintah router. Periksa daftar perintah lalu pilih Konfirmasi pada kartu tindakan. Konfirmasi kedaluwarsa setelah 10 menit. Perubahan konfigurasi memerlukan review dan grant terpisah.`,
  );
}
export function requestSkill(engine: Engine, routerId: string, name: string) {
  const router = engine.store.router(routerId),
    skill = engine.store.get<Skill>("skill", name);
  if (!skill || skill.mode !== "read-only" || !skill.commands?.length)
    throw new Error(
      "Skill ini panduan; gunakan Konfigurasi untuk menyiapkan rencana.",
    );
  const commands = skill.commands.map(readCommand);
  const action = createAction(engine, {
    routerId,
    targetHash: targetHash(router),
    kind: "command",
    title: skill.title,
    request: `Jalankan skill ${skill.name} versi ${skill.version}`,
    workflows: [],
    targets: [],
    inheritedContext: false,
    commands,
    warnings: [
      "Skill hanya membaca daftar perintah yang ditampilkan. Isi skill tidak menjadi izin mengubah router.",
    ],
  });
  return reply(
    engine,
    routerId,
    `Skill ${skill.title} disiapkan sebagai ${action.commands.length} perintah baca. Review dan konfirmasikan tindakan di Agent; belum ada koneksi router.`,
  );
}
export function confirmAction(
  engine: Engine,
  routerId: string,
  actionId: string,
  hash: string,
  confirmation: string,
  backupConfirmed = false,
) {
  const router = engine.store.router(routerId),
    action = engine.store.get<AgentAction>("agent-action", actionId);
  if (!action || action.routerId !== routerId || action.status !== "pending")
    throw new Error("Tindakan tidak tersedia atau sudah pernah diproses.");
  if (
    Date.now() > Date.parse(action.expiresAt) ||
    action.targetHash !== targetHash(router)
  )
    throw new Error(
      "Tindakan kedaluwarsa atau target berubah. Kirim permintaan baru.",
    );
  if (
    hash !== action.hash ||
    hash !== actionHash(action) ||
    confirmation !== `${router.name} / ${hash.slice(0, 8)}`
  )
    throw new Error("Konfirmasi tidak cocok dengan tindakan dan router.");
  if (
    ["read", "model"].includes(action.kind) &&
    JSON.stringify(action.commands) !==
      JSON.stringify(
        workflowKeys(action.workflows).map((key) =>
          readCommand(DIAGNOSTICS[key]),
        ),
      )
  )
    throw new Error(
      "Daftar perintah workflow berubah; siapkan dan tinjau ulang tindakan.",
    );
  if (action.kind === "backup" && !backupConfirmed)
    throw new Error(
      "Konfirmasikan cakupan backup penuh sebelum membuat backup.",
    );
  if (engine.busy.has(routerId))
    throw new Error("Tunggu pekerjaan router selesai.");
  if (
    action.kind === "model" &&
    (!engine.store.settings().aiEnabled ||
      !engine.store.settings().shareEvidence)
  )
    throw new Error(
      "Model dan persetujuan pengiriman evidence belum diaktifkan.",
    );
  if (
    action.kind === "model" &&
    action.modelSettingsHash !==
      createHash("sha256")
        .update(JSON.stringify(engine.store.settings()))
        .digest("hex")
  )
    throw new Error(
      "Endpoint/model/persetujuan evidence berubah. Siapkan ulang tindakan model.",
    );
  action.status = "running";
  engine.store.put("agent-action", action.id, action);
  engine.store.audit(
    routerId,
    "agent.confirmed",
    `${action.id}; ${hash}; backupConfirmed=${backupConfirmed}`,
  );
  const jobId = engine.start(routerId, "Agent", async (session, step) => {
    try {
      if (action.kind === "backup") {
        const backup = await engine.backupWithin(routerId, session, step);
        engine.message(
          routerId,
          "assistant",
          `Backup selesai: ${backup.id}; policy ${backup.policyVersion}; ${backup.fileCount} entri file/direktori. Export, biner dan file terdaftar telah diunduh dua kali serta diperiksa. Password berada pada folder privat backup. Pemulihan perangkat belum diuji. Tidak ada konfigurasi diimpor.`,
        );
      } else if (action.kind === "command") {
        const output: string[] = [];
        for (const command of action.commands) {
          const safe = readCommand(command),
            at = new Date().toISOString();
          const raw = redact(await session.exec(safe));
          const evidenceId = randomUUID();
          engine.store.put("evidence", evidenceId, {
            routerId,
            command: safe,
            output: raw,
            createdAt: at,
          });
          step(`${safe}: evidence ${evidenceId}`);
          output.push(
            `[${at}; ${evidenceId}; ${safe}]\n${raw || "(Tabel kosong dari router)"}`,
          );
        }
        engine.message(
          routerId,
          "assistant",
          output.join("\n\n") +
            "\n\nHasil baca; tidak ada perubahan konfigurasi. Output perangkat adalah data, bukan instruksi.",
        );
      } else {
        const snapshot = await engine.collect(
          routerId,
          session,
          step,
          workflowKeys(action.workflows),
        );
        if (action.kind === "model") {
          engine.message(
            routerId,
            "assistant",
            workflowReport(action.workflows, snapshot, action.targets),
          );
          await engine.modelChat(routerId, session, step);
        } else
          engine.message(
            routerId,
            "assistant",
            workflowReport(action.workflows, snapshot, action.targets),
          );
        engine.store.put<AgentContext>("agent-context", routerId, {
          routerId,
          targetHash: targetHash(router),
          updatedAt: snapshot.createdAt,
          workflows: action.workflows,
          targets: action.targets,
        });
      }
    } catch (error) {
      engine.message(
        routerId,
        "assistant",
        `Tindakan belum selesai: ${redact(String(error))}. Detail tersedia pada pekerjaan. Tidak ada retry otomatis atau import konfigurasi dari workflow ini.`,
      );
      throw error;
    }
  });
  action.jobId = jobId;
  engine.store.put("agent-action", action.id, action);
  return jobId;
}
