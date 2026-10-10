import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Store } from "../src/main/store";
import { Engine, type Vault } from "../src/main/engine";
import { Session } from "../src/main/transport";
import type { Job, Plan, Snapshot, Backup } from "../src/shared/model";

const vault: Vault = {
  available: () => false,
  get: () => undefined,
  set: () => {},
  delete: () => {},
  has: () => false,
};
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "mh-engine-"));
  const store = new Store(dir);
  const engine = new Engine(store, vault, resolve("resources/skills"));
  const router = engine.saveRouter({
    name: "Lab",
    host: "192.0.2.1",
    user: "tester",
    keyPath: "/tmp/test-key",
  });
  const calls: string[] = [];
  let rate = "2M/8M",
    failBackup = false,
    failImport = false;
  const fake = {
    exec: async (command: string) => {
      calls.push(command);
      if (command.startsWith("/system identity")) return "name: Lab";
      if (command.startsWith("/system resource"))
        return "version: 6.49.19\ncpu-load: 30%";
      if (command.startsWith("/export")) {
        if (failBackup) throw new Error("backup denied");
        return "# RouterOS export configuration\n/system identity\nset name=Lab\n/ip hotspot user\nadd name=test password=do-not-save-this-secret\n";
      }
      if (command.startsWith("/import")) {
        if (failImport) throw new Error("TIMEOUT: unknown result");
        rate = rate === "2M/8M" ? "3M/10M" : "2M/8M";
        return "Script file loaded and executed successfully";
      }
      if (command.includes("user profile"))
        return `name="student" rate-limit="${rate}"`;
      return "0";
    },
    upload: async () => {
      calls.push("UPLOAD");
    },
    close: () => {
      calls.push("CLOSE");
    },
  };
  const patch = mock.method(
    Session,
    "connect",
    async () => fake as unknown as Session,
  );
  const create = () =>
    engine.prepare({
      routerId: router.id,
      title: "Profile student",
      reason: "Test of the complete approval flow",
      apply:
        '# AGENT-TEST\n/ip hotspot user profile set [find name="student"] rate-limit="3M/10M"',
      rollback:
        '# AGENT-TEST\n/ip hotspot user profile set [find name="student"] rate-limit="2M/8M"',
      verify: [
        {
          command: "/ip hotspot user profile print detail",
          contains: ['rate-limit="3M/10M"'],
        },
      ],
      rollbackVerify: [
        {
          command: "/ip hotspot user profile print detail",
          contains: ['rate-limit="2M/8M"'],
        },
      ],
      preconditions: [
        {
          command: "/ip hotspot user profile print detail",
          contains: ['rate-limit="2M/8M"'],
        },
      ],
    });
  return {
    store,
    engine,
    router,
    calls,
    create,
    setBackupFail: () => {
      failBackup = true;
    },
    setImportFail: () => {
      failImport = true;
    },
    setRate: (v: string) => {
      rate = v;
    },
    cleanup: () => {
      patch.mock.restore();
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
async function finish(s: ReturnType<typeof setup>, id: string) {
  for (let n = 0; n < 200; n++) {
    const job = s.store.get<Job>("job", id)!;
    if (job.state !== "running") return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Job did not complete");
}
test("incorrect confirmation and edited plan digest cannot execute", () => {
  const s = setup();
  try {
    const p = s.create();
    assert.throws(() => s.engine.apply(p.id, p.hash, "wrong"));
    assert.throws(() =>
      s.engine.apply(p.id, "bad", `Lab / ${p.hash.slice(0, 8)}`),
    );
    assert.equal(s.calls.length, 0);
  } finally {
    s.cleanup();
  }
});
test("plan is tied to the selected router connection", () => {
  const s = setup();
  try {
    const p = s.create();
    s.engine.saveRouter({ ...s.router, host: "192.0.2.99" });
    assert.throws(
      () => s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`),
      /identitas router berubah/,
    );
    assert.equal(s.calls.length, 0);
  } finally {
    s.cleanup();
  }
});
test("backup failure prevents upload and mutation", async () => {
  const s = setup();
  try {
    const p = s.create();
    s.setBackupFail();
    const id = s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`);
    const job = await finish(s, id);
    assert.equal(job.state, "failed");
    assert.ok(!s.calls.some((c) => c === "UPLOAD" || c.startsWith("/import")));
    assert.equal(s.store.get<Plan>("plan", p.id)?.status, "draft");
  } finally {
    s.cleanup();
  }
});
test("changed initial state stops a stale rate plan before backup", async () => {
  const s = setup();
  try {
    const p = s.create();
    s.setRate("5M/20M");
    const job = await finish(
      s,
      s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`),
    );
    assert.equal(job.state, "failed");
    assert.ok(!s.calls.some((c) => c.startsWith("/export") || c === "UPLOAD"));
  } finally {
    s.cleanup();
  }
});
test("apply and rollback each require backup and verify target state", async () => {
  const s = setup();
  try {
    const p = s.create();
    const first = s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`);
    assert.throws(() => s.engine.snapshot(s.router.id), /sedang berjalan/);
    assert.equal((await finish(s, first)).state, "done");
    assert.equal(s.store.get<Plan>("plan", p.id)?.status, "applied");
    const backup = s.store.all<Backup>("backup")[0];
    const contents = readFileSync(backup.path, "utf8");
    assert.ok(!contents.includes("do-not-save-this-secret"));
    assert.ok(
      s.calls.findIndex((c) => c.startsWith("/export")) <
        s.calls.indexOf("UPLOAD"),
    );
    assert.equal(
      (
        await finish(
          s,
          s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`, true),
        )
      ).state,
      "done",
    );
    assert.equal(s.store.get<Plan>("plan", p.id)?.status, "rolled-back");
    assert.equal(s.store.all("backup").length, 2);
  } finally {
    s.cleanup();
  }
});
test("ambiguous import is not retried; further changes blocked until reconciliation", async () => {
  const s = setup();
  try {
    const p = s.create();
    s.setImportFail();
    await finish(
      s,
      s.engine.apply(p.id, p.hash, `Lab / ${p.hash.slice(0, 8)}`),
    );
    assert.equal(s.store.get<Plan>("plan", p.id)?.status, "unknown");
    assert.equal(s.calls.filter((c) => c.startsWith("/import")).length, 1);
    const next = s.create();
    assert.throws(
      () =>
        s.engine.apply(next.id, next.hash, `Lab / ${next.hash.slice(0, 8)}`),
      /belum terverifikasi/,
    );
    s.setRate("3M/10M");
    assert.equal((await finish(s, s.engine.reconcile(p.id))).state, "done");
    assert.equal(s.store.get<Plan>("plan", p.id)?.status, "applied");
  } finally {
    s.cleanup();
  }
});
test("rate generator binds old value and does not accept an unchanged ceiling", () => {
  const s = setup();
  try {
    const snap: Snapshot = {
      id: s.store.id(),
      routerId: s.router.id,
      createdAt: new Date().toISOString(),
      source: "live",
      data: { "hotspot-user-profile": '0 name="student" rate-limit="2M/8M"' },
      errors: {},
      metrics: {},
    };
    s.store.put("snapshot", snap.id, snap);
    assert.throws(
      () => s.engine.ratePlan(s.router.id, "student", "2M", "8M"),
      /sama/,
    );
    const p = s.engine.ratePlan(s.router.id, "student", "3M", "10M");
    assert.ok(p.preconditions[0].contains.includes('rate-limit="2M/8M"'));
    assert.ok(p.rollback.includes("2M/8M"));
  } finally {
    s.cleanup();
  }
});
test("skill packs cannot introduce executable scripts", () => {
  const s = setup();
  try {
    assert.throws(() =>
      s.engine.saveSkill({
        name: "malicious",
        title: "Bad skill",
        version: "1",
        mode: "read-only",
        purpose: "test",
        domains: [],
        commands: ["/system reboot"],
      }),
    );
  } finally {
    s.cleanup();
  }
});
test("expected identity mismatch prevents all configuration work", async () => {
  const s = setup();
  try {
    s.engine.saveRouter({ ...s.router, expectedIdentity: "Different Gateway" });
    const id = s.engine.backup(s.router.id);
    const job = await finish(s, id);
    assert.equal(job.state, "failed");
    assert.match(job.error || "", /Identitas berbeda/);
    assert.ok(!s.calls.some((c) => c.startsWith("/export") || c === "UPLOAD"));
  } finally {
    s.cleanup();
  }
});
test("restart preserves ambiguous changes and marks interrupted jobs failed", () => {
  const s = setup();
  try {
    const plan = s.create();
    s.store.put("plan", plan.id, { ...plan, status: "applying" });
    const id = s.store.id();
    s.store.put("job", id, {
      id,
      routerId: s.router.id,
      title: "Interrupted import",
      state: "running",
      startedAt: new Date().toISOString(),
      steps: [],
    });
    new Engine(s.store, vault, resolve("resources/skills"));
    assert.equal(s.store.get<Plan>("plan", plan.id)?.status, "unknown");
    assert.equal(s.store.get<Job>("job", id)?.state, "failed");
  } finally {
    s.cleanup();
  }
});
