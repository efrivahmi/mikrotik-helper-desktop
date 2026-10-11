import { contextBridge, ipcRenderer } from "electron";
const methods = new Set([
  "state",
  "job.read",
  "router.save",
  "router.delete",
  "router.probe",
  "router.diagnose",
  "model.check",
  "router.trust",
  "snapshot",
  "backup",
  "diagnostic",
  "skill.run",
  "skill.save",
  "automation.inspect",
  "automation.evidence",
  "automation.prepare",
  "automation.check",
  "standards.source",
  "profile.save",
  "profile.delete",
  "profile.import",
  "profile.export",
  "plan.prepare",
  "plan.rate",
  "plan.apply",
  "plan.reconcile",
  "plan.export",
  "chat",
  "settings.save",
  "secret.clear",
  "dialog.key",
  "legacy.import",
  "skill.import",
  "rsc.read",
  "data.open",
  "backup.reveal",
  "report.export",
]);
contextBridge.exposeInMainWorld("helper", {
  invoke: async (method: string, input?: unknown) => {
    if (!methods.has(method)) throw new Error("Operasi tidak diizinkan.");
    const result = await ipcRenderer.invoke("helper:" + method, input);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
});
