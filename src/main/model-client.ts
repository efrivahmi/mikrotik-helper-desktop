import type { ModelCheck, Settings } from "../shared/model";
import { redact } from "./policy";

export function modelEndpoint(settings: Settings) {
  const url = new URL(settings.aiBaseUrl);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("Endpoint harus HTTPS atau HTTP localhost.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Endpoint harus tanpa credential, query, atau fragment.");
  return settings.aiBaseUrl.replace(/\/+$/, "");
}
export async function boundedJson(response: Response): Promise<any> {
  if (!response.ok)
    throw new Error(`Endpoint model merespons HTTP ${response.status}.`);
  if (!response.body) throw new Error("Respons model kosong.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 2 * 1024 * 1024)
        throw new Error("Respons model melebihi batas 2 MiB.");
      chunks.push(item.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
}
export async function inspectModel(
  settings: Settings,
  key?: string,
): Promise<ModelCheck> {
  const check: ModelCheck = {
    checkedAt: new Date().toISOString(),
    endpoint: settings.aiBaseUrl,
    model: settings.aiModel,
    availableModels: [],
    success: false,
  };
  try {
    const json = await boundedJson(
      await fetch(modelEndpoint(settings) + "/models", {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      }),
    );
    if (!Array.isArray(json.data))
      throw new Error(
        "Endpoint /models tidak memberikan daftar model yang valid.",
      );
    check.availableModels = json.data
      .map((m: any) => m.id)
      .filter((id: unknown): id is string => typeof id === "string")
      .slice(0, 100);
    if (!settings.aiModel.trim())
      throw new Error("Pilih nama model dari daftar yang tersedia.");
    if (!check.availableModels.includes(settings.aiModel))
      throw new Error(
        `Model ${settings.aiModel} belum tersedia pada endpoint ini. Pilih model dari daftar atau pasang model pada server lokal.`,
      );
    check.success = true;
  } catch (error) {
    const err = error as {
      cause?: { code?: string };
      name?: string;
      message?: string;
    };
    check.error = redact(
      err.cause?.code === "ECONNREFUSED"
        ? "Server model belum berjalan atau port endpoint salah. Jalankan server Ollama/API kemudian periksa lagi."
        : err.name === "TimeoutError"
          ? "Endpoint model timeout; periksa alamat dan koneksi server."
          : err.message || String(error),
    );
  }
  return check;
}
