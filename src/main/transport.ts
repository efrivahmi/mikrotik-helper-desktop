import ssh2, { type Client as SSHClient, type ConnectConfig } from "ssh2";
const { Client, utils } = ssh2;
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import type { Router } from "../shared/model";
import { remoteError } from "./policy";
import { routerQuote } from "../shared/routeros-literals";

export class ConnectionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}
export function connectionError(
  router: Router,
  error: unknown,
): ConnectionError {
  if (error instanceof ConnectionError) return error;
  const err = error as { code?: string; level?: string; message?: string };
  const message = err?.message || String(error);
  const target = `${router.host}:${router.port}`;
  if (err?.code === "ENOENT")
    return new ConnectionError(
      "KEY_MISSING",
      "File private key tidak ditemukan. Pilih ulang lokasi key di pengaturan router pada komputer ini.",
    );
  if (["EACCES", "EPERM"].includes(err?.code || ""))
    return new ConnectionError(
      "KEY_ACCESS",
      "File private key tidak dapat dibaca oleh aplikasi. Periksa akses file pada komputer ini.",
    );
  if (/passphrase|encrypted private key|privateKey|private key/i.test(message))
    return new ConnectionError(
      "KEY_INVALID",
      "Private key tidak dapat digunakan. Periksa format key dan isi passphrase jika key terenkripsi.",
    );
  if (
    err?.level === "client-authentication" ||
    /authentication|auth methods|permission denied/i.test(message)
  )
    return new ConnectionError(
      "AUTH_FAILED",
      `Autentikasi ${router.user}@${target} ditolak. Periksa username, password/passphrase, dan public key yang terpasang pada RouterOS.`,
    );
  if (/no matching|handshake failed/i.test(message))
    return new ConnectionError(
      "SSH_ALGORITHM",
      `Negosiasi SSH ${target} gagal: ${message}. Periksa opsi kompatibilitas RSA untuk RouterOS lama.`,
    );
  if (err?.code === "ECONNREFUSED")
    return new ConnectionError(
      "TCP_REFUSED",
      `Port SSH ${target} menolak sambungan. Periksa port SSH serta service/firewall management melalui jalur administrasi yang tersedia.`,
    );
  if (["ENOTFOUND", "EAI_AGAIN"].includes(err?.code || ""))
    return new ConnectionError(
      "DNS_FAILED",
      `Alamat ${router.host} tidak dapat diterjemahkan. Periksa hostname dan DNS komputer ini.`,
    );
  if (["EHOSTUNREACH", "ENETUNREACH"].includes(err?.code || ""))
    return new ConnectionError(
      "NO_ROUTE",
      `Jalur jaringan ke ${target} tidak tersedia. Sambungkan LAN/VPN management lalu ulangi pemeriksaan.`,
    );
  if (err?.code === "ETIMEDOUT" || /timeout|timed out/i.test(message))
    return new ConnectionError(
      "TCP_TIMEOUT",
      `Sambungan ${target} timeout. Periksa LAN/VPN, alamat/port, dan izin source address pada firewall management.`,
    );
  return new ConnectionError(
    "SSH_FAILED",
    `Sambungan SSH ${target} gagal: ${message}`,
  );
}
export function validateCredentials(router: Router, secret?: string) {
  try {
    config(router, secret);
  } catch (error) {
    throw connectionError(router, error);
  }
}

export const fingerprint = (key: Buffer) =>
  "SHA256:" +
  createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
function config(router: Router, secret?: string): ConnectConfig {
  const result: ConnectConfig = {
    host: router.host,
    port: router.port,
    username: router.user,
    readyTimeout: 15000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 2,
  };
  if (router.auth === "key") {
    if (!router.keyPath)
      throw new ConnectionError(
        "KEY_MISSING",
        "Pilih file SSH private key pada pengaturan router.",
      );
    result.privateKey = readFileSync(
      router.keyPath.replace(/^~(?=\/|\\)/, homedir()),
    );
    const parsed = utils.parseKey(result.privateKey, secret);
    if (parsed instanceof Error)
      throw new ConnectionError(
        "KEY_INVALID",
        "Private key tidak dapat dibuka. Pilih private key OpenSSH/PEM dan isi passphrase jika key terenkripsi.",
      );
    const key = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!key || !key.isPrivateKey())
      throw new ConnectionError(
        "KEY_INVALID",
        "File yang dipilih adalah public key. Pilih private key pasangannya (bukan file .pub).",
      );
    if (secret) result.passphrase = secret;
  } else {
    if (!secret)
      throw new ConnectionError(
        "AUTH_MISSING",
        "Password belum diisi. Buka pengaturan router dan masukkan credential untuk sesi ini atau simpan dengan keyring OS.",
      );
    result.password = secret;
  }
  if (router.legacyRSA)
    result.algorithms = {
      serverHostKey: { append: ["ssh-rsa"], prepend: [], remove: [] },
    };
  return result;
}
export async function probe(router: Router): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let found = false;
    conn
      .on("error", (e) => {
        if (!found) {
          conn.destroy();
          reject(connectionError(router, e));
        }
      })
      .on("close", () => {
        if (!found)
          reject(
            new ConnectionError(
              "SSH_FAILED",
              "Sambungan berakhir sebelum host key diterima.",
            ),
          );
      });
    conn.connect({
      host: router.host,
      port: router.port,
      username: router.user,
      readyTimeout: 12000,
      algorithms: router.legacyRSA
        ? { serverHostKey: { append: ["ssh-rsa"], prepend: [], remove: [] } }
        : undefined,
      hostVerifier: (key: Buffer) => {
        found = true;
        resolve(fingerprint(key));
        queueMicrotask(() => conn.end());
        return false;
      },
    });
  });
}
export class Session {
  constructor(private conn: SSHClient) {}
  static async connect(router: Router, secret?: string): Promise<Session> {
    if (!router.fingerprint)
      throw new ConnectionError(
        "HOST_UNTRUSTED",
        "Host key belum dipercaya. Verifikasi sidik jari SSH di halaman Router.",
      );
    let cfg: ConnectConfig;
    try {
      cfg = config(router, secret);
    } catch (error) {
      throw connectionError(router, error);
    }
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let mismatch = false;
      let ready = false;
      conn.on("error", (err) => {
        if (!ready) {
          conn.destroy();
          reject(
            mismatch
              ? new ConnectionError(
                  "HOST_CHANGED",
                  "Host key berubah. Verifikasi identitas perangkat sebelum menyimpan host key baru.",
                )
              : connectionError(router, err),
          );
        }
      });
      conn.once("close", () => {
        if (!ready)
          reject(
            new ConnectionError(
              "SSH_FAILED",
              "Sambungan SSH berakhir sebelum autentikasi selesai.",
            ),
          );
      });
      conn.once("ready", () => {
        ready = true;
        resolve(new Session(conn));
      });
      conn.connect({
        ...cfg,
        hostVerifier: (key: Buffer) => {
          mismatch = fingerprint(key) !== router.fingerprint;
          return !mismatch;
        },
      });
    });
  }
  exec(command: string, timeout = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          fail(
            new Error(
              "TIMEOUT: hasil perintah belum diketahui; periksa state sebelum mencoba ulang.",
            ),
          );
          this.conn.destroy();
        }
      }, timeout);
      const disconnected = () =>
        fail(
          new ConnectionError(
            "SSH_DISCONNECTED",
            "Sambungan SSH terputus saat perintah berjalan; hasil belum diketahui. Periksa jaringan dan state router sebelum mengulang.",
          ),
        );
      const cleanup = () => {
        clearTimeout(timer);
        this.conn.off("error", disconnected);
        this.conn.off("end", disconnected);
        this.conn.off("close", disconnected);
      };
      const fail = (error: Error) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(error);
        }
      };
      this.conn.once("error", disconnected);
      this.conn.once("end", disconnected);
      this.conn.once("close", disconnected);
      this.conn.exec(command, (error, stream) => {
        if (error) {
          fail(error);
          return;
        }
        const collect = (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (Buffer.byteLength(output) > 8 * 1024 * 1024) {
            stream.close();
            fail(
              new Error("Output melebihi batas 8 MiB. Persempit diagnostik."),
            );
          }
        };
        stream.on("data", collect);
        stream.stderr.on("data", collect);
        stream.on("error", fail);
        stream.on("close", (code: number | null) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (
            (code !== null && code !== undefined && code !== 0) ||
            remoteError(output)
          )
            reject(new Error(output.trim() || `Perintah gagal (${code}).`));
          else resolve(output);
        });
      });
    });
  }
  download(name: string): Promise<Buffer> {
    if (!/^AGENT-[a-f0-9-]+\.backup$/.test(name))
      throw new Error("Nama backup tidak valid.");
    return this.downloadFile(name).then((buffer) => {
      if (buffer.length < 64)
        throw new Error("Biner backup kosong/terlalu pendek.");
      return buffer;
    });
  }
  downloadFile(name: string): Promise<Buffer> {
    if (
      !name ||
      name.length > 1000 ||
      !/^[a-zA-Z0-9_. ()@,+/-]+$/.test(name) ||
      name.startsWith("/") ||
      name
        .split("/")
        .some(
          (part) =>
            !part || part === "." || part === ".." || part.startsWith("-"),
        )
    )
      throw new Error(
        "Nama file tidak dapat diarsipkan secara aman; backup penuh dihentikan.",
      );
    const expectedName = name.split("/").at(-1)!;
    return new Promise((resolve, reject) => {
      let settled = false,
        buffer = Buffer.alloc(0),
        size = -1,
        channel: any;
      const timer = setTimeout(
        () => finish(new Error("Download backup SCP timeout.")),
        90000,
      );
      const finish = (error?: Error, data?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel?.close();
        error ? reject(error) : resolve(data!);
      };
      const closed = () =>
        finish(new Error("Sambungan terputus saat mengunduh backup."));
      this.conn.once("close", closed);
      this.conn.exec(`scp -f ${routerQuote(name)}`, (error, stream) => {
        if (error) {
          this.conn.removeListener("close", closed);
          return finish(error);
        }
        channel = stream;
        stream.once("close", () => {
          this.conn.removeListener("close", closed);
          if (!settled) finish(new Error("Download backup tidak lengkap."));
        });
        stream.on("error", finish);
        stream.stderr.on("data", () => {});
        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          if (buffer.length + chunk.length > 64 * 1024 * 1024 + 4096)
            return finish(new Error("Backup melebihi batas transfer 64 MiB."));
          buffer = Buffer.concat([buffer, chunk]);
          if (size < 0) {
            const newline = buffer.indexOf(10);
            if (newline < 0) return;
            const header = buffer.subarray(0, newline).toString("utf8");
            const match = header.match(/^C[0-7]{4} (\d+) (.+)$/);
            if (!match || match[2] !== expectedName)
              return finish(new Error("Header file backup SCP tidak valid."));
            size = Number(match[1]);
            if (
              !Number.isSafeInteger(size) ||
              size < 0 ||
              size > 64 * 1024 * 1024
            )
              return finish(new Error("Ukuran backup tidak valid."));
            buffer = buffer.subarray(newline + 1);
            stream.write(Buffer.from([0]));
          }
          if (buffer.length >= size + 1) {
            if (buffer[size] !== 0 || buffer.length !== size + 1)
              return finish(new Error("Transfer backup SCP gagal cocok."));
            const payload = Buffer.from(buffer.subarray(0, size));
            stream.write(Buffer.from([0]), () => finish(undefined, payload));
          }
        });
        stream.write(Buffer.from([0]));
      });
    });
  }
  upload(name: string, content: string): Promise<void> {
    if (!/^AGENT-[a-f0-9-]+\.rsc$/.test(name))
      throw new Error("Nama upload tidak valid.");
    const payload = Buffer.from(content, "utf8");
    return new Promise((resolve, reject) => {
      let settled = false,
        stage = 0;
      let errorText = "";
      const timer = setTimeout(
        () => finish(new Error("Upload SCP timeout; import belum dijalankan.")),
        30000,
      );
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        err ? reject(err) : resolve();
      };
      this.conn.exec(`scp -t ${name}`, (err, stream) => {
        if (err) return finish(err);
        stream.stderr.on("data", (b: Buffer) => {
          errorText += b.toString();
        });
        stream.on("error", finish);
        stream.on("data", (chunk: Buffer) => {
          for (const byte of chunk) {
            if (settled) return;
            if (byte !== 0) {
              stream.close();
              return finish(new Error("SCP ditolak oleh router. " + errorText));
            }
            if (stage === 0) {
              stage++;
              stream.write(`C0600 ${payload.length} ${name}\n`);
            } else if (stage === 1) {
              stage++;
              stream.write(payload);
              stream.write(Buffer.from([0]));
            } else if (stage === 2) {
              stage++;
              stream.end();
              finish();
            }
          }
        });
        stream.on("close", () => {
          if (!settled)
            finish(new Error("Upload SCP tidak lengkap. " + errorText));
        });
      });
    });
  }
  close() {
    this.conn.end();
  }
}
