import { _electron as electron } from "playwright";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const executable = process.argv[2];
if (!executable)
  throw new Error("Usage: node scripts/check-packaged.mjs <Linux executable>");
let app;
try {
  app = await electron.launch({
    executablePath: resolve(executable),
    timeout: 30000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Ringkasan jaringan" }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(
    await page.evaluate(() => typeof window.helper?.invoke),
    "function",
  );
  const state = await page.evaluate(() => window.helper.invoke("state"));
  assert.equal(state.version, "1.1.0");
  assert.equal(state.skills.length >= 4, true);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      packaged: await app.evaluate(({ app }) => app.isPackaged),
      dataDir: state.dataDir,
      routers: state.routers.length,
      skills: state.skills.length,
    }),
  );
  console.log(
    "PASS: packaged Linux application launches, renderer is isolated, SQLite and skill resources load. No router operation requested.",
  );
} finally {
  if (app) await app.close();
}
