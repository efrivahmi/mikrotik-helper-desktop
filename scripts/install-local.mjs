import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = join(root, "release/linux-unpacked/mikrotik-helper-desktop");
if (!existsSync(executable))
  throw new Error("Build Linux terlebih dahulu: npm run dist:linux");
const entry = `[Desktop Entry]\nType=Application\nName=MikroTik Helper\nComment=Konsol desktop agent MikroTik\nExec="${executable}"\nIcon=${join(root, "build/icon.png")}\nTerminal=false\nCategories=Network;Utility;\nStartupWMClass=mikrotik-helper\n`;
const dir = join(homedir(), ".local/share/applications");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "mikrotik-helper.desktop"), entry);
const desktop = join(homedir(), "Desktop");
if (existsSync(desktop)) {
  const path = join(desktop, "MikroTik Helper.desktop");
  writeFileSync(path, entry);
  chmodSync(path, 0o755);
}
console.log(
  "Shortcut MikroTik Helper dipasang pada menu aplikasi dan Desktop.",
);
