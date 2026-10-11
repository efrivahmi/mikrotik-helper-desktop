import { mkdirSync, writeFileSync } from "node:fs";
import { CONFIG_MODULES, RECIPES } from "../src/shared/automation";
import { SkillSchema } from "../src/shared/model";
const directory = new URL("../resources/skills/", import.meta.url);
mkdirSync(directory, { recursive: true });
for (const module of CONFIG_MODULES) {
  const skill = SkillSchema.parse({
    name: `inspect-${module.id}`,
    title: `Periksa ${module.title}`,
    version: "1.2.0",
    mode: "read-only",
    purpose: `Baca konfigurasi ${module.title} langsung melalui SSH. Ketersediaan mengikuti RouterOS/package/hardware.`,
    domains: [module.id, module.category],
    commands: [
      `/${module.menu} print${module.singleton ? "" : " detail without-paging"}`,
    ],
    checks: [
      "Identitas perangkat dan versi sesuai",
      "Target statis dan selector unik",
      "Dampak pada management dan user aktif",
    ],
    safety: [
      "Tidak mengubah konfigurasi",
      "Gunakan Konfigurasi untuk rencana; backup dan grant wajib",
    ],
  });
  writeFileSync(
    new URL(`inspect-${module.id}.json`, directory),
    JSON.stringify(skill, null, 2) + "\n",
  );
}
for (const recipe of RECIPES) {
  const skill = SkillSchema.parse({
    name: `configure-${recipe.id}`,
    title: recipe.title,
    version: "1.2.0",
    mode: "plan-only",
    purpose: recipe.description,
    domains: recipe.modules,
    commands: [],
    "required-input": recipe.fields.map((f) => f.label),
    workflow: [
      "Buka Konfigurasi dan pilih paket",
      "Baca evidence SSH",
      "Isi jalur management dan kebutuhan",
      "Susun apply, rollback, precondition, verifikasi",
      "Review dan grant router/hash",
      "Backup export + biner terenkripsi wajib",
      "Apply dan verifikasi; periksa layanan dari client",
    ],
    safety: [
      "Tidak memberi izin apply otomatis",
      "Backup gagal menghentikan eksekusi",
      "Import tidak atomik; koneksi putus tidak memicu retry",
      "Tidak reset atau reboot router",
    ],
    recipeId: recipe.id,
  });
  writeFileSync(
    new URL(`configure-${recipe.id}.json`, directory),
    JSON.stringify(skill, null, 2) + "\n",
  );
}
console.log(
  `${CONFIG_MODULES.length} skill pembacaan dan ${RECIPES.length} paket konfigurasi dibuat.`,
);
