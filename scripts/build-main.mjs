import { build } from "esbuild";
await build({
  entryPoints: ["src/main/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/main/main.cjs",
  external: ["electron", "ssh2"],
});
await build({
  entryPoints: ["src/main/preload.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/main/preload.cjs",
  external: ["electron"],
});
