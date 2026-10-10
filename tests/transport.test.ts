import test from "node:test";
import assert from "node:assert/strict";
import ssh2 from "ssh2";
const { Server } = ssh2;
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { Session, probe } from "../src/main/transport";
import type { Router } from "../src/shared/model";

test("SSH host pinning, command errors and SCP upload against an isolated local server", async () => {
  const key = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  }).privateKey;
  let uploaded = "";
  const server = new Server({ hostKeys: [key] }, (client) => {
    client.on("error", () => {});
    client.on("authentication", (ctx) =>
      ctx.method === "password" && ctx.password === "test-password"
        ? ctx.accept()
        : ctx.reject(),
    );
    client.on("ready", () =>
      client.on("session", (accept) =>
        accept().on("exec", (accept, _reject, info) => {
          const stream = accept();
          if (info.command.startsWith("scp -t ")) {
            let data = Buffer.alloc(0),
              size = -1;
            stream.write(Buffer.from([0]));
            stream.on("data", (part: Buffer) => {
              data = Buffer.concat([data, part]);
              if (size < 0) {
                const nl = data.indexOf(10);
                if (nl < 0) return;
                const match = /^C0600 (\d+) AGENT-[\w-]+\.rsc$/.exec(
                  data.subarray(0, nl).toString(),
                );
                assert.ok(match);
                size = Number(match[1]);
                data = data.subarray(nl + 1);
                stream.write(Buffer.from([0]));
              }
              if (size >= 0 && data.length >= size + 1) {
                uploaded = data.subarray(0, size).toString();
                stream.write(Buffer.from([0]));
                stream.exit(0);
                stream.end();
              }
            });
          } else {
            stream.write(
              info.command === "bad"
                ? "failure: simulated error"
                : "name: Laboratory",
            );
            stream.exit(0);
            stream.end();
          }
        }),
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const router: Router = {
    id: randomUUID(),
    name: "Lab",
    host: "127.0.0.1",
    port: address.port,
    user: "test",
    auth: "password",
    keyPath: "",
    legacyRSA: false,
    site: "",
    expectedIdentity: "",
    notes: "",
  };
  let session: Session | undefined;
  try {
    const fp = await probe(router);
    assert.match(fp, /^SHA256:/);
    await assert.rejects(
      () =>
        Session.connect(
          { ...router, fingerprint: "SHA256:wrong" },
          "test-password",
        ),
      /Host key berubah/,
    );
    session = await Session.connect(
      { ...router, fingerprint: fp },
      "test-password",
    );
    assert.equal(
      await session.exec("/system identity print"),
      "name: Laboratory",
    );
    await assert.rejects(() => session!.exec("bad"), /simulated error/);
    await session.upload(
      `AGENT-${randomUUID()}.rsc`,
      "# test file\n/system identity print\n",
    );
    assert.match(uploaded, /# test file/);
    assert.throws(() => session!.upload("../evil", "bad"));
  } finally {
    session?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
