import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

// This check uses the existing workspace. It never creates routers, sample snapshots,
// credentials, plans, or host trust, and never applies configuration.
const args = process.argv.slice(2);
const live = args.includes("--connect");
const routerIndex = args.indexOf("--router");
const requested = routerIndex >= 0 ? args[routerIndex + 1] : undefined;
const dataDir = process.env.HELPER_DATA_DIR || (process.platform === "win32"
  ? join(process.env.APPDATA || homedir(), "MikroTik Helper")
  : process.platform === "darwin" ? join(homedir(), "Library/Application Support/MikroTik Helper")
  : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "MikroTik Helper"));
let app;
try {
  app = await electron.launch({ args: [resolve(".")], env: { ...process.env, HELPER_DATA_DIR: dataDir }, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("heading", { name: "Ringkasan jaringan" }).waitFor();
  for (const label of ["Router", "Agent", "Diagnostik", "Pustaka skill", "Perubahan", "Backup & riwayat", "Pengaturan", "Ringkasan"]) {
    await page.locator("nav").getByRole("button", { name: label, exact: true }).click();
    await page.locator("h1").waitFor();
  }
  let state = await page.evaluate(() => window.helper.invoke("state"));
  assert.ok(state.snapshots.every((s) => s.source === "live"), "Dashboard must only use actual application collections.");
  if (live) {
    const router = requested ? state.routers.find((r) => r.id === requested || r.name === requested) : state.routers[0];
    if (!router) throw new Error("Belum ada router nyata di inventory. Tambahkan router melalui aplikasi lalu ulangi pemeriksaan.");
    const report = await page.evaluate((id) => window.helper.invoke("router.diagnose", id), router.id);
    console.log(JSON.stringify({ router: router.name, report }, null, 2));
    if (report.success) {
      const jobId = await page.evaluate((id) => window.helper.invoke("snapshot", id), router.id);
      const deadline = Date.now() + 180000;
      let job;
      do {
        job = await page.evaluate((id) => window.helper.invoke("job.read", id), jobId);
        if (job.state !== "running") break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } while (Date.now() < deadline);
      assert.equal(job.state, "done", job.error || "Pengambilan snapshot belum selesai.");
      state = await page.evaluate((id) => window.helper.invoke("state", id), router.id);
      const snapshot = state.snapshots.find((s) => s.routerId === router.id);
      assert.ok(snapshot?.metrics.identity && snapshot.metrics.cpu !== undefined, "Snapshot inti harus berasal dari router.");
      console.log(`LIVE PASS: ${snapshot.metrics.identity}, RouterOS ${snapshot.metrics.version}, snapshot ${snapshot.createdAt}.`);
    } else {
      console.log(report.needsTrust ? "LIVE INCOMPLETE: host key membutuhkan verifikasi administrator." : "LIVE FAILED: lihat tahap pemeriksaan koneksi. Tidak ada nilai pengganti.");
      process.exitCode = 2;
    }
  }
  assert.deepEqual(errors, []);
  console.log("UI PASS: delapan halaman terbuka pada workspace asli; tanpa seed data, perubahan router, atau host trust otomatis.");
  if (args.includes("--capture")) {
    mkdirSync("docs/screenshots", { recursive: true });
    await page.screenshot({ path: "docs/screenshots/real-workspace.png" });
  }
} finally { if (app) await app.close(); }
