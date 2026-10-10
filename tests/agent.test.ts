import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Store } from "../src/main/store";
import { Engine, type Vault } from "../src/main/engine";
import { Session } from "../src/main/transport";
import {
  SettingsSchema,
  type Job,
  type Plan,
  type Message,
} from "../src/shared/model";

test("model tool loop can read and propose, but cannot apply a change", async () => {
  const requests: any[] = [];
  const commands: string[] = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    const body = JSON.parse(raw);
    requests.push(body);
    const make = (name: string, args: object) => ({
      id: "call-" + requests.length,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
    let reply: object;
    if (requests.length === 1)
      reply = {
        role: "assistant",
        content: null,
        tool_calls: [make("diagnose", { key: "resource" })],
      };
    else if (requests.length === 2)
      reply = {
        role: "assistant",
        content: null,
        tool_calls: [
          make("propose_change", {
            title: "Plan from model",
            reason: "Inspect before applying.",
            apply: '# AGENT-MODEL\n/system identity set name="New Name"',
            rollback: '# AGENT-MODEL\n/system identity set name="Lab"',
            verify: [
              { command: "/system identity print", contains: ["New Name"] },
            ],
            rollbackVerify: [
              { command: "/system identity print", contains: ["Lab"] },
            ],
          }),
        ],
      };
    else if (requests.length === 3)
      reply = {
        role: "assistant",
        content: null,
        tool_calls: [make("apply_change", { planId: "not-authorized" })],
      };
    else
      reply = {
        role: "assistant",
        content: "Rencana dibuat dan menunggu persetujuan.",
      };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: reply }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "mh-agent-")),
    store = new Store(dir);
  const vault: Vault = {
    available: () => false,
    get: () => undefined,
    set: () => {},
    delete: () => {},
    has: () => false,
  };
  const engine = new Engine(store, vault, resolve("resources/skills"));
  const router = engine.saveRouter({
    name: "Lab",
    host: "192.0.2.1",
    user: "operator",
    auth: "key",
    keyPath: "/tmp/test",
  });
  const patch = mock.method(
    Session,
    "connect",
    async () =>
      ({
        exec: async (c: string) => {
          commands.push(c);
          return c.includes("resource")
            ? "version: 6.49.19\ncpu-load: 30%"
            : "name: Lab";
        },
        close: () => {},
      }) as Session,
  );
  try {
    store.put(
      "settings",
      "main",
      SettingsSchema.parse({
        aiEnabled: true,
        shareEvidence: true,
        aiBaseUrl: `http://127.0.0.1:${port}/v1`,
        aiModel: "test-model",
      }),
    );
    const id = engine.chat(router.id, "Read the router and propose a change.");
    for (
      let n = 0;
      n < 300 && store.get<Job>("job", id)?.state === "running";
      n++
    )
      await new Promise((r) => setTimeout(r, 5));
    assert.equal(store.get<Job>("job", id)?.state, "done");
    assert.equal(requests.length, 4);
    assert.equal(store.all<Plan>("plan")[0].status, "draft");
    assert.equal(store.all("backup").length, 0);
    assert.ok(
      commands.every((c) => !c.includes("/import") && !c.includes(" set ")),
    );
    const last = requests[3].messages.findLast((m: any) => m.role === "tool");
    assert.match(last.content, /Tool tidak diizinkan/);
    assert.match(store.all<Message>("message")[0].text, /menunggu persetujuan/);
  } finally {
    patch.mock.restore();
    store.close();
    rmSync(dir, { recursive: true, force: true });
    await new Promise<void>((r) => server.close(() => r()));
  }
});
