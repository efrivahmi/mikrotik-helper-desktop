import {
  createHash,
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { detailRows } from "../shared/routeros";
import { BACKUP_POLICY_VERSION } from "../shared/local-agent";
import { readCommand } from "./policy";
import type { Session } from "./transport";

export const digest = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
type Row = Record<string, string>;
export function durableWrite(filename: string, data: Buffer | string) {
  writeFileSync(filename, data, { mode: 0o600, flag: "wx" });
  const fd = openSync(filename, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (digest(readFileSync(filename)) !== digest(data))
    throw new Error("Pembacaan ulang arsip lokal berbeda.");
}
async function table(
  session: Session,
  menu: string,
  properties: string,
): Promise<Row[]> {
  const raw = await session.exec(
    readCommand(`/${menu} print detail proplist=${properties}`),
  );
  const count = await session.exec(readCommand(`/${menu} print count-only`));
  const rows = detailRows(raw);
  if (!/^\d+$/.test(count.trim()) || rows.length !== Number(count.trim()))
    throw new Error(
      `Inventaris ${menu} tidak lengkap atau berubah; backup penuh dihentikan.`,
    );
  return rows;
}
export async function fullBackupInventory(session: Session) {
  const packages = await table(
    session,
    "system package",
    "name,version,disabled",
  );
  if (!packages.length)
    throw new Error(
      "Daftar package tidak tersedia; cakupan backup belum diketahui.",
    );
  const unsupported = packages.filter((p) =>
    /(?:user[- ]?manager|dude|container)/i.test(p.name || ""),
  );
  if (unsupported.length)
    throw new Error(
      `Backup penuh belum didukung untuk database/penyimpanan package ${unsupported.map((p) => p.name).join(", ")}. Siapkan prosedur khusus dahulu; konfigurasi tidak akan diimpor.`,
    );
  const files = await table(
    session,
    "file",
    "name,type,size,creation-time,last-modified",
  );
  if (files.length > 2000)
    throw new Error(
      "Lebih dari 2.000 entri file; siapkan prosedur backup penuh tersendiri.",
    );
  if (
    files.some((f) => !f.name || !f.type) ||
    new Set(files.map((f) => f.name)).size !== files.length
  )
    throw new Error("Inventaris file tidak unik/lengkap.");
  if (
    files.some(
      (f) =>
        f.name.length > 1000 ||
        !/^[a-zA-Z0-9_. ()@,+/-]+$/.test(f.name) ||
        f.name.startsWith("/") ||
        f.name
          .split("/")
          .some(
            (part) =>
              !part || part === "." || part === ".." || part.startsWith("-"),
          ),
    )
  )
    throw new Error(
      "Ada path file/direktori yang belum dapat diarsipkan secara aman. Cakupan backup belum penuh.",
    );
  return { files, packages };
}
const fileSignature = (files: Row[], excluded: string) =>
  JSON.stringify(
    files
      .filter((f) => f.name !== excluded)
      .map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        modified: f["last-modified"] ?? f["creation-time"],
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

export async function archiveUserFiles(
  session: Session,
  inventory: Awaited<ReturnType<typeof fullBackupInventory>>,
  directory: string,
  backupId: string,
  currentBinary: string,
  password: string,
  step: (message: string) => void,
) {
  const dir = join(directory, `${backupId}.files`);
  mkdirSync(dir, { mode: 0o700 });
  const salt = randomBytes(32),
    key = scryptSync(password, salt, 32);
  const records: {
    name: string;
    type: string;
    archive?: string;
    sha256?: string;
    encryptedSha256?: string;
    bytes?: number;
  }[] = [];
  let totalBytes = 0;
  try {
    for (const file of inventory.files) {
      if (["directory", "disk"].includes(file.type)) {
        records.push({ name: file.name, type: file.type });
        continue;
      }
      if (records.length % 10 === 0)
        step(
          `Mengarsipkan file pengguna (${records.length}/${inventory.files.length})…`,
        );
      const first = await session.downloadFile(file.name),
        second = await session.downloadFile(file.name);
      if (digest(first) !== digest(second))
        throw new Error(
          "File pengguna berubah pada dua pembacaan; backup penuh dihentikan.",
        );
      totalBytes += first.length;
      if (totalBytes > 512 * 1024 * 1024)
        throw new Error(
          "Arsip file melebihi 512 MiB; siapkan prosedur backup penuh tersendiri.",
        );
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(file.name));
      const encrypted = Buffer.concat([cipher.update(first), cipher.final()]);
      const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
      const archive = digest(file.name) + ".aesgcm";
      durableWrite(join(dir, archive), payload);
      const saved = readFileSync(join(dir, archive));
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        saved.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(file.name));
      decipher.setAuthTag(saved.subarray(12, 28));
      const restored = Buffer.concat([
        decipher.update(saved.subarray(28)),
        decipher.final(),
      ]);
      if (digest(restored) !== digest(first))
        throw new Error("Pembacaan ulang/dekripsi file pengguna berbeda.");
      records.push({
        name: file.name,
        type: file.type,
        archive,
        sha256: digest(first),
        encryptedSha256: digest(payload),
        bytes: first.length,
      });
    }
    const after = await fullBackupInventory(session);
    if (
      fileSignature(inventory.files, currentBinary) !==
        fileSignature(after.files, currentBinary) ||
      JSON.stringify(inventory.packages) !== JSON.stringify(after.packages)
    )
      throw new Error(
        "Inventaris file/package berubah selama backup; import dihentikan.",
      );
    const manifest = {
      policyVersion: BACKUP_POLICY_VERSION,
      createdAt: new Date().toISOString(),
      coverage: "configuration-and-user-files" as const,
      fileEncryption: {
        algorithm: "aes-256-gcm",
        keyDerivation: "scrypt",
        salt: salt.toString("base64"),
        header: "12-byte IV + 16-byte authentication tag + ciphertext",
        aad: "UTF-8 remote filename",
        password: "adjacent backup password file",
      },
      directoriesAndFiles: records,
      totalBytes,
      packages: inventory.packages,
      binaryArchivedSeparately: currentBinary,
      twoReadsMatch: true,
      localDecryptRereadVerified: true,
      restoreTested: false,
      limitations: [
        "Cakupan adalah konfigurasi RouterOS dan seluruh file pengguna yang terdaftar, bukan image disk/firmware.",
        "User Manager, The Dude dan container memerlukan prosedur tersendiri dan memblokir jalur ini bila terdeteksi.",
        "Snapshot konfigurasi/file bukan transaksi atomik. Pemulihan perangkat belum diuji.",
      ],
    };
    const manifestPath = join(directory, `${backupId}.files-manifest.json`);
    const content = JSON.stringify(manifest, null, 2) + "\n";
    durableWrite(manifestPath, content);
    return {
      filesManifestPath: manifestPath,
      filesManifestSha256: digest(content),
      fileCount: records.length,
      coverage: manifest.coverage,
      policyVersion: BACKUP_POLICY_VERSION,
      restoreTested: false as const,
    };
  } finally {
    key.fill(0);
  }
}
