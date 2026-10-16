import { readFileSync, mkdirSync, writeFileSync, lstatSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash, scryptSync, createDecipheriv } from "node:crypto";

const [manifestArg, passwordArg, destinationArg, expectedHash] =
  process.argv.slice(2);
if (
  !manifestArg ||
  !passwordArg ||
  !destinationArg ||
  !/^[a-f0-9]{64}$/.test(expectedHash || "")
) {
  console.error(
    "Usage: node scripts/restore-user-files.mjs <manifest.json> <password-file> <NEW-local-directory> <manifest-SHA256>",
  );
  process.exit(2);
}
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
let key;
try {
  const manifestPath = resolve(manifestArg),
    raw = readFileSync(manifestPath);
  if (digest(raw) !== expectedHash) throw new Error("SHA256 manifest berbeda.");
  const manifest = JSON.parse(raw.toString("utf8"));
  if (
    manifest.policyVersion !== "full-config-files-v1" ||
    manifest.coverage !== "configuration-and-user-files" ||
    manifest.fileEncryption?.algorithm !== "aes-256-gcm"
  )
    throw new Error("Format/cakupan manifest tidak didukung.");
  const id = manifestPath.match(/([a-f0-9-]{36})\.files-manifest\.json$/)?.[1];
  if (!id) throw new Error("Nama manifest tidak valid.");
  const salt = Buffer.from(manifest.fileEncryption.salt, "base64");
  if (salt.length !== 32) throw new Error("Salt tidak valid.");
  const records = manifest.directoriesAndFiles;
  if (!Array.isArray(records) || records.length > 2000)
    throw new Error("Daftar file tidak valid.");
  const seen = new Set();
  for (const file of records) {
    if (
      typeof file.name !== "string" ||
      file.name.length > 1000 ||
      !/^[a-zA-Z0-9_. ()@,+/-]+$/.test(file.name) ||
      file.name.startsWith("/") ||
      file.name
        .split("/")
        .some(
          (part) => !part || [".", ".."].includes(part) || part.startsWith("-"),
        ) ||
      seen.has(file.name)
    )
      throw new Error("Nama/path file tidak aman/unik.");
    seen.add(file.name);
    if (
      !["directory", "disk"].includes(file.type) &&
      (!/^[a-f0-9]{64}\.aesgcm$/.test(file.archive || "") ||
        !/^[a-f0-9]{64}$/.test(file.sha256 || "") ||
        !/^[a-f0-9]{64}$/.test(file.encryptedSha256 || "") ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 0 ||
        file.bytes > 64 * 1024 * 1024)
    )
      throw new Error("Metadata file tidak valid.");
  }
  const destination = resolve(destinationArg),
    archiveDir = join(dirname(manifestPath), id + ".files");
  key = scryptSync(readFileSync(resolve(passwordArg), "utf8").trim(), salt, 32);
  mkdirSync(destination, { mode: 0o700 });
  let count = 0;
  for (const file of records) {
    const target = join(destination, ...file.name.split("/"));
    if (["directory", "disk"].includes(file.type)) {
      mkdirSync(target, { mode: 0o700, recursive: true });
      continue;
    }
    const encryptedPath = join(archiveDir, file.archive);
    if (!lstatSync(encryptedPath).isFile())
      throw new Error("Arsip bukan file biasa.");
    const payload = readFileSync(encryptedPath);
    if (
      payload.length !== file.bytes + 28 ||
      digest(payload) !== file.encryptedSha256
    )
      throw new Error("Ukuran/hash ciphertext berbeda.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      payload.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(file.name));
    decipher.setAuthTag(payload.subarray(12, 28));
    const plaintext = Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]);
    if (digest(plaintext) !== file.sha256)
      throw new Error("SHA256 file hasil dekripsi berbeda.");
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, plaintext, { mode: 0o600, flag: "wx" });
    if (digest(readFileSync(target)) !== file.sha256)
      throw new Error("Pembacaan ulang file lokal berbeda.");
    count++;
  }
  console.log(
    `${count} file didekripsi dan checksum diperiksa ke ${destination}. Tidak ada koneksi atau restore ke router.`,
  );
} catch (error) {
  console.error(
    "Pemulihan lokal belum selesai: " +
      error.message +
      ". Periksa folder output baru; file yang sudah dibuat tidak ditimpa otomatis.",
  );
  process.exitCode = 1;
} finally {
  key?.fill(0);
}
