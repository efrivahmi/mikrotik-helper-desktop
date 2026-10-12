import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Audit, Router, Settings } from "../shared/model";
import { SettingsSchema } from "../shared/model";
import { redact } from "./policy";

export class Store {
  db: DatabaseSync;
  constructor(public dir: string) {
    // Workspace baru tidak memiliki inventory atau evidence. Router hanya
    // ditambahkan lewat tindakan simpan/impor yang dipilih pengguna.
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dir, "helper.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,routerId TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL);",
    );
    try {
      chmodSync(join(dir, "helper.sqlite"), 0o600);
    } catch {
      /* OS ACL on Windows */
    }
  }
  put<T>(kind: string, id: string, data: T) {
    this.db
      .prepare(
        "INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      )
      .run(kind, id, JSON.stringify(data));
    return data;
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id);
    return row ? JSON.parse(row.data as string) : undefined;
  }
  all<T>(kind: string): T[] {
    return this.db
      .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((row) => JSON.parse(row.data as string));
  }
  recent<T>(kind: string, limit = 100): T[] {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind=? ORDER BY rowid DESC LIMIT ?",
      )
      .all(kind, limit)
      .map((row) => JSON.parse(row.data as string));
  }
  latestByRouter<T>(kind: string): T[] {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind=? AND rowid IN (SELECT MAX(rowid) FROM records WHERE kind=? GROUP BY json_extract(data,'$.routerId')) ORDER BY rowid DESC",
      )
      .all(kind, kind)
      .map((row) => JSON.parse(row.data as string));
  }
  remove(kind: string, id: string) {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
  }
  removeImportedSnapshots() {
    const result = this.db
      .prepare(
        "DELETE FROM records WHERE kind='snapshot' AND COALESCE(json_extract(data,'$.source'),'') != 'live'",
      )
      .run();
    if (Number(result.changes))
      this.audit(
        "",
        "data.cleanup",
        `${result.changes} snapshot impor/contoh dihapus. Dashboard memakai hasil koneksi aplikasi ini.`,
      );
    return Number(result.changes);
  }
  audit(routerId: string, action: string, detail: string) {
    this.db
      .prepare("INSERT INTO audit(at,routerId,action,detail) VALUES (?,?,?,?)")
      .run(
        new Date().toISOString(),
        routerId,
        action,
        redact(detail).slice(0, 8000),
      );
  }
  history(): Audit[] {
    return this.db
      .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 500")
      .all() as unknown as Audit[];
  }
  router(id: string): Router {
    const r = this.get<Router>("router", id);
    if (!r) throw new Error("Router tidak ditemukan.");
    return r;
  }
  settings(): Settings {
    return SettingsSchema.parse(this.get("settings", "main") || {});
  }
  id() {
    return randomUUID();
  }
  close() {
    this.db.close();
  }
}
