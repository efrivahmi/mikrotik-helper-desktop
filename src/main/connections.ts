import { lookup } from "node:dns/promises";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { randomUUID } from "node:crypto";
import type { ConnectionReport, Router } from "../shared/model";
import {
  Session,
  probe,
  validateCredentials,
  connectionError,
  ConnectionError,
} from "./transport";
import { redact } from "./policy";

async function tcp(host: string, port: number) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port, timeout: 6000 });
    const timer = setTimeout(
      () =>
        finish(
          new ConnectionError(
            "TCP_TIMEOUT",
            "Sambungan TCP timeout. Periksa LAN/VPN, alamat/port, dan firewall management.",
          ),
        ),
      6500,
    );
    let settled = false;
    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve();
    }
    socket.once("connect", () => finish());
    socket.once("error", finish);
    socket.once("timeout", () =>
      finish(
        new ConnectionError(
          "TCP_TIMEOUT",
          "Sambungan TCP timeout. Periksa LAN/VPN, alamat/port, dan firewall management.",
        ),
      ),
    );
  });
}

export async function inspectConnection(
  router: Router,
  secret: string | undefined,
  checkIdentity: (session: Session) => Promise<string>,
  credentialError?: ConnectionError,
): Promise<ConnectionReport> {
  const report: ConnectionReport = {
    id: randomUUID(),
    routerId: router.id,
    checkedAt: new Date().toISOString(),
    endpoint: `${router.host}:${router.port}`,
    localAddresses: [],
    success: false,
    needsTrust: false,
    steps: [],
  };
  for (const entries of Object.values(networkInterfaces()))
    for (const address of entries || [])
      if (!address.internal && address.family === "IPv4")
        report.localAddresses.push(address.address);
  let credentialOK = true;
  try {
    if (credentialError) throw credentialError;
    validateCredentials(router, secret);
    report.steps.push({
      label: "Credential lokal",
      state: "pass",
      detail:
        router.auth === "key"
          ? "Private key dapat dibaca dan dibuka; key tidak dikirim ke laporan."
          : "Password tersedia untuk sesi koneksi.",
    });
  } catch (error) {
    credentialOK = false;
    const err = connectionError(router, error);
    report.errorCode = err.code;
    report.steps.push({
      label: "Credential lokal",
      state: "failed",
      detail: redact(err.message),
    });
  }
  async function step(label: string, operation: () => Promise<string>) {
    const started = Date.now();
    try {
      const detail = await operation();
      report.steps.push({
        label,
        state: "pass",
        detail,
        durationMs: Date.now() - started,
      });
      return true;
    } catch (error) {
      const err = connectionError(router, error);
      report.errorCode = err.code;
      report.steps.push({
        label,
        state: "failed",
        detail: redact(err.message),
        durationMs: Date.now() - started,
      });
      return false;
    }
  }
  if (
    !(await step("Alamat tujuan", async () => {
      const result = await lookup(router.host);
      report.resolvedAddress = result.address;
      return result.address;
    }))
  )
    return report;
  if (
    !(await step("Port SSH", async () => {
      await tcp(report.resolvedAddress!, router.port);
      return `Port ${router.port} menerima sambungan TCP.`;
    }))
  )
    return report;
  if (
    !(await step("Identitas server SSH", async () => {
      report.fingerprint = await probe(router);
      if (router.fingerprint && report.fingerprint !== router.fingerprint)
        throw new ConnectionError(
          "HOST_CHANGED",
          "Host key berbeda dari key yang tersimpan. Periksa perangkat melalui jalur administrasi yang dipercaya.",
        );
      return report.fingerprint;
    }))
  )
    return report;
  if (!router.fingerprint) {
    report.needsTrust = true;
    report.steps.push({
      label: "Autentikasi dan identity RouterOS",
      state: "skipped",
      detail:
        "Verifikasi host key untuk melanjutkan autentikasi. Belum ada data router yang diambil.",
    });
    return report;
  }
  if (!credentialOK) {
    report.steps.push({
      label: "Autentikasi dan identity RouterOS",
      state: "skipped",
      detail: "Perbaiki credential lokal kemudian ulangi pemeriksaan.",
    });
    return report;
  }
  let session: Session | undefined;
  try {
    report.success = await step(
      "Autentikasi dan identity RouterOS",
      async () => {
        session = await Session.connect(router, secret);
        return await checkIdentity(session);
      },
    );
  } finally {
    session?.close();
  }
  return report;
}
