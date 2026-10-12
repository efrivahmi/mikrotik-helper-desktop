import { mkdirSync, writeFileSync } from "node:fs";
import { CONFIG_MODULES, RECIPES } from "../src/shared/automation";
import { SkillSchema } from "../src/shared/model";
import { STANDARD_SOURCES, STANDARDS_VERSION } from "../src/shared/standards";
import pkg from "../package.json";
import {
  QUICK_PURPOSES,
  QUICK_DISCOVERY_MODULES,
} from "../src/shared/quick-setup";
const directory = new URL("../resources/skills/", import.meta.url);
mkdirSync(directory, { recursive: true });
for (const module of CONFIG_MODULES) {
  const skill = SkillSchema.parse({
    name: `inspect-${module.id}`,
    title: `Periksa ${module.title}`,
    version: pkg.version,
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
      "Gunakan pemeriksaan aturan konfigurasi sebelum membuat perubahan",
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
    version: pkg.version,
    mode: "plan-only",
    purpose: recipe.description,
    domains: recipe.modules,
    commands: [],
    "required-input": recipe.fields.map((f) => f.label),
    workflow: [
      "Buka Konfigurasi dan pilih paket",
      "Baca evidence SSH",
      "Isi jalur management dan kebutuhan",
      "Periksa aturan dan perbaiki semua pelanggaran",
      "Susun apply, rollback, precondition, verifikasi",
      "Review, akui peringatan dan grant router/hash",
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
    standards: {
      version: STANDARDS_VERSION,
      sources: STANDARD_SOURCES,
      scope: "configuration-delta",
      certification: false,
    },
  });
  writeFileSync(
    new URL(`configure-${recipe.id}.json`, directory),
    JSON.stringify(skill, null, 2) + "\n",
  );
}
writeFileSync(
  new URL("configure-quick-setup.json", directory),
  JSON.stringify(
    SkillSchema.parse({
      name: "configure-quick-setup",
      title: "Quick Setup berdasarkan kebutuhan",
      version: pkg.version,
      mode: "plan-only",
      purpose:
        "Panduan koneksi dan rancangan port/LAN/VLAN, IP, DHCP, ISP, firewall, PCQ dan HotSpot dari pilihan pengguna serta evidence SSH.",
      domains: [
        "quick-setup",
        "management",
        "vlan",
        "dhcp",
        "isp",
        "firewall",
        "qos",
        "hotspot",
      ],
      commands: [],
      checks: [
        "Jalur management dipertahankan",
        "Port lama tidak dilepas",
        "IP usulan tidak bertumpuk dengan konfigurasi yang terbaca",
        "Review standar, dependensi dan kapasitas",
      ],
      workflow: [
        "Ikuti Panduan koneksi",
        "Baca router untuk Quick Setup",
        "Pilih kebutuhan dan desain",
        "Pilih port serta rencana IP",
        "Pilih layanan",
        "Review dan grant",
        "Backup baru terverifikasi sebelum apply",
        "Periksa konfigurasi dan layanan client",
      ],
      safety: [
        "Tidak mengubah perangkat saat memilih preset",
        "Tidak reset atau reboot",
        "Password tidak disertakan profil",
        "Backup gagal menghentikan eksekusi",
      ],
      quickSetup: {
        version: "1.0",
        purposes: QUICK_PURPOSES.map((p) => p.id),
        evidenceMenus: QUICK_DISCOVERY_MODULES,
      },
      standards: {
        version: STANDARDS_VERSION,
        sources: STANDARD_SOURCES,
        scope: "configuration-delta",
        certification: false,
      },
    }),
    null,
    2,
  ) + "\n",
);
console.log(
  `${CONFIG_MODULES.length} skill pembacaan, ${RECIPES.length} paket dan Quick Setup dibuat.`,
);
