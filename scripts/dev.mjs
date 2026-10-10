import { spawn } from "node:child_process";
import { createServer } from "vite";
await import("./build-main.mjs");
const server = await createServer();
await server.listen();
const child = spawn("node_modules/.bin/electron", ["."], {
  stdio: "inherit",
  env: { ...process.env, HELPER_DEV_URL: "http://127.0.0.1:5178" },
});
child.on("exit", async (code) => {
  await server.close();
  process.exit(code || 0);
});
process.on("SIGINT", () => child.kill());
