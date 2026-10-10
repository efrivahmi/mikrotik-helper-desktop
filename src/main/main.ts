import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { join, resolve } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { Store } from "./store";
import { Engine, type Vault } from "./engine";
import { modelEndpoint } from "./model-client";
import {
  SettingsSchema,
  type Plan,
  type Router,
  type Snapshot,
  type Job,
} from "../shared/model";

let window: BrowserWindow, store: Store, engine: Engine;
const sessions = new Map<string, string>();
const uuid = z.string().uuid();
const devURL = !app.isPackaged ? process.env.HELPER_DEV_URL : undefined;
const renderer = join(__dirname, "../renderer/index.html");
const pendingDialogs = new Set<string>();
if (process.env.HELPER_DATA_DIR && !app.isPackaged)
  app.setPath("userData", resolve(process.env.HELPER_DATA_DIR));
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on("second-instance", () => {
  window?.show();
  window?.focus();
});

function allowed(event: IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !(
      url === pathToFileURL(renderer).href ||
      (devURL && url?.startsWith(devURL + "/"))
    )
  )
    throw new Error("Sumber IPC tidak diizinkan.");
}
function handle(name: string, fn: (input: any) => unknown) {
  ipcMain.handle("helper:" + name, async (event, input) => {
    allowed(event);
    try {
      return { ok: true, data: await fn(input) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

async function create() {
  store = new Store(app.getPath("userData"));
  const vault: Vault = {
    available: () =>
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text"),
    get: (id) => {
      if (sessions.has(id)) return sessions.get(id);
      const stored = store.get<string>("secret", id);
      if (!stored) return undefined;
      if (!vault.available())
        throw new Error(
          "Penyimpanan credential OS terkunci/tidak tersedia. Masukkan credential untuk sesi ini.",
        );
      return safeStorage.decryptString(Buffer.from(stored, "base64"));
    },
    set: (id, value, persist) => {
      if (persist && !vault.available())
        throw new Error(
          "Keyring OS tidak tersedia. Gunakan credential untuk sesi saja.",
        );
      if (persist) {
        store.put(
          "secret",
          id,
          safeStorage.encryptString(value).toString("base64"),
        );
        sessions.delete(id);
      } else {
        sessions.set(id, value);
        store.remove("secret", id);
      }
    },
    delete: (id) => {
      sessions.delete(id);
      store.remove("secret", id);
    },
    has: (id) => sessions.has(id) || !!store.get("secret", id),
  };
  engine = new Engine(
    store,
    vault,
    app.isPackaged
      ? join(process.resourcesPath, "skills")
      : join(app.getAppPath(), "resources/skills"),
  );
  handle("state", (p) =>
    engine.state(p === undefined ? undefined : uuid.parse(p)),
  );
  handle("job.read", (p) => {
    const job = store.get("job", uuid.parse(p));
    if (!job) throw new Error("Pekerjaan tidak ditemukan.");
    return job;
  });
  handle("router.save", (p) => {
    const input = z
      .object({
        router: z.unknown(),
        secret: z.string().max(10000).optional(),
        persist: z.boolean().default(false),
      })
      .parse(p);
    return engine.saveRouter(input.router, input.secret, input.persist);
  });
  handle("router.delete", (p) => engine.deleteRouter(uuid.parse(p)));
  handle("router.probe", (p) => engine.probe(uuid.parse(p)));
  handle("router.diagnose", (p) => engine.diagnoseConnection(uuid.parse(p)));
  handle("model.check", (p) => {
    const v = z
      .object({
        settings: SettingsSchema,
        apiKey: z.string().max(10000).optional(),
      })
      .parse(p);
    return engine.checkModel(v.settings, v.apiKey);
  });
  handle("router.trust", (p) => {
    const v = z.object({ id: uuid, fingerprint: z.string().max(100) }).parse(p);
    return engine.trust(v.id, v.fingerprint);
  });
  handle("snapshot", (p) => engine.snapshot(uuid.parse(p)));
  handle("backup", (p) => engine.backup(uuid.parse(p)));
  handle("diagnostic", (p) => {
    const v = z.object({ id: uuid, command: z.string().max(1000) }).parse(p);
    return engine.diagnostic(v.id, v.command);
  });
  handle("skill.run", (p) => {
    const v = z.object({ id: uuid, name: z.string().max(100) }).parse(p);
    return engine.skill(v.id, v.name);
  });
  handle("skill.save", (p) => engine.saveSkill(p));
  handle("plan.prepare", (p) => engine.prepare(p));
  handle("plan.reconcile", (p) => engine.reconcile(uuid.parse(p)));
  handle("plan.rate", (p) => {
    const v = z
      .object({
        id: uuid,
        profile: z.string(),
        upload: z.string(),
        download: z.string(),
      })
      .parse(p);
    return engine.ratePlan(v.id, v.profile, v.upload, v.download);
  });
  handle("plan.apply", (p) => {
    const v = z
      .object({
        id: uuid,
        hash: z.string(),
        confirmation: z.string(),
        rollback: z.boolean().default(false),
      })
      .parse(p);
    return engine.apply(v.id, v.hash, v.confirmation, v.rollback);
  });
  handle("plan.export", async (p) => {
    const plan = store.get<Plan>("plan", uuid.parse(p));
    if (!plan) throw new Error("Rencana tidak ditemukan.");
    const target = await dialog.showOpenDialog(window, {
      title: "Simpan paket rencana",
      properties: ["openDirectory", "createDirectory"],
    });
    if (target.canceled) return null;
    const dir = join(target.filePaths[0], `plan-${plan.id}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "apply.rsc"), plan.apply, { mode: 0o600 });
    writeFileSync(join(dir, "rollback.rsc"), plan.rollback, { mode: 0o600 });
    writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2), {
      mode: 0o600,
    });
    return dir;
  });
  handle("chat", (p) => {
    const v = z.object({ id: uuid, text: z.string().max(12000) }).parse(p);
    return engine.chat(v.id, v.text);
  });
  handle("settings.save", (p) => {
    const v = z
      .object({
        settings: SettingsSchema,
        apiKey: z.string().max(10000).optional(),
        persist: z.boolean().default(false),
      })
      .parse(p);
    modelEndpoint(v.settings);
    if (v.settings.aiEnabled && !v.settings.aiModel.trim())
      throw new Error("Pilih nama model sebelum mengaktifkan model agent.");
    if (v.apiKey) vault.set("ai", v.apiKey, v.persist);
    store.put("settings", "main", v.settings);
    store.audit("", "settings.save", "Pengaturan agent disimpan.");
  });
  handle("secret.clear", (p) => {
    const id = z.string().parse(p);
    if (id !== "ai") uuid.parse(id);
    vault.delete(id);
  });
  handle("dialog.key", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Pilih SSH private key",
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("legacy.import", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Pilih folder mikrotik-helper-agent",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : engine.importLegacy(result.filePaths[0]);
  });
  handle("skill.import", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Impor skill JSON",
      properties: ["openFile"],
      filters: [{ name: "Skill JSON", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    const content = readFileSync(result.filePaths[0], "utf8");
    if (content.length > 200000) throw new Error("File skill terlalu besar.");
    return engine.saveSkill(JSON.parse(content));
  });
  handle("rsc.read", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Pilih script RouterOS",
      properties: ["openFile"],
      filters: [{ name: "RouterOS", extensions: ["rsc"] }],
    });
    if (result.canceled) return null;
    const content = readFileSync(result.filePaths[0], "utf8");
    if (content.length > 100000) throw new Error("Script terlalu besar.");
    return content;
  });
  handle("data.open", () => shell.openPath(store.dir));
  handle("backup.reveal", (p) => {
    const record = store.get<{ path: string }>("backup", uuid.parse(p));
    if (!record) throw new Error("Backup tidak ditemukan.");
    shell.showItemInFolder(record.path);
  });
  handle("report.export", async (p) => {
    const id = uuid.parse(p);
    const state = engine.state();
    const router = store.router(id);
    const result = await dialog.showSaveDialog(window, {
      title: "Ekspor laporan",
      defaultPath: `${router.name}-report.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const report = {
      createdAt: new Date().toISOString(),
      router: { name: router.name, host: router.host, site: router.site },
      snapshots: store
        .all<Snapshot>("snapshot")
        .filter((s) => s.routerId === id),
      jobs: store.all<Job>("job").filter((j) => j.routerId === id),
      audit: state.audit.filter((a) => a.routerId === id),
    };
    writeFileSync(result.filePath, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
    return result.filePath;
  });
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1060,
    minHeight: 720,
    title: "MikroTik Helper",
    backgroundColor: "#f4f6f8",
    icon: join(app.getAppPath(), "build/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  window.on("close", (event) => {
    if (engine.busy.size) {
      event.preventDefault();
      if (pendingDialogs.has("close")) return;
      pendingDialogs.add("close");
      void dialog
        .showMessageBox(window, {
          type: "info",
          title: "Pekerjaan masih berjalan",
          message: "Tunggu pekerjaan selesai sebelum menutup aplikasi.",
          buttons: ["Kembali"],
        })
        .finally(() => pendingDialogs.delete("close"));
    }
  });
  if (devURL) await window.loadURL(devURL);
  else await window.loadFile(renderer);
}
if (single)
  app
    .whenReady()
    .then(create)
    .catch((error) => {
      dialog.showErrorBox("MikroTik Helper gagal dibuka", String(error));
      app.quit();
    });
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => store?.close());
