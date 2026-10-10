import type { InterfaceTraffic, Snapshot } from "./model";

export function detailRows(raw: string): Record<string, string>[] {
  const starts = [...raw.matchAll(/(?:^|\n)\s*(\d+)\s+([^\n]*)/g)];
  return starts.map((match, i) => {
    const block = raw.slice(match.index, starts[i + 1]?.index ?? raw.length);
    const row: Record<string, string> = {
      index: match[1],
      flags: (match[2].split(/(?:[\w-]+=|;;;)/)[0] || "").trim(),
    };
    for (const kv of block.matchAll(
      /([\w-]+)=(?:"((?:\\.|[^"\\])*)"|([\s\S]*?))(?=\s+[\w-]+=|\s*$)/g,
    ))
      row[kv[1]] = (kv[2] ?? kv[3]).trim().replace(/\\"/g, '"');
    return row;
  });
}
function uptime(raw?: string): number | undefined {
  if (!raw) return undefined;
  const units: Record<string, number> = {
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1,
  };
  const parts = [...raw.matchAll(/(\d+)([wdhms])/g)];
  if (!parts.length) return undefined;
  return parts.reduce(
    (total, part) => total + Number(part[1]) * units[part[2]],
    0,
  );
}
export function trafficSamples(
  current: Snapshot,
  previous?: Snapshot,
): InterfaceTraffic[] {
  const now = current.capturedAt?.["interface-stats"] || current.createdAt;
  const before =
    previous?.capturedAt?.["interface-stats"] || previous?.createdAt;
  const interval = before ? (Date.parse(now) - Date.parse(before)) / 1000 : 0;
  const reboot =
    previous &&
    uptime(current.metrics.uptime) !== undefined &&
    uptime(previous.metrics.uptime) !== undefined &&
    uptime(current.metrics.uptime)! < uptime(previous.metrics.uptime)!;
  const oldRows =
    previous &&
    !reboot &&
    previous.routerId === current.routerId &&
    interval >= 1 &&
    interval <= 900
      ? detailRows(previous.data["interface-stats"] || "")
      : [];
  return detailRows(current.data["interface-stats"] || "").flatMap((row) => {
    const rx = (row["rx-byte"] || "").replace(/\s/g, "");
    const tx = (row["tx-byte"] || "").replace(/\s/g, "");
    if (!row.name || !/^\d+$/.test(rx) || !/^\d+$/.test(tx)) return [];
    const sample: InterfaceTraffic = {
      name: row.name,
      rxBytes: rx,
      txBytes: tx,
      measuredAt: now,
    };
    const old = oldRows.find((r) => r.name === row.name);
    if (old) {
      const oldRx = (old["rx-byte"] || "").replace(/\s/g, "");
      const oldTx = (old["tx-byte"] || "").replace(/\s/g, "");
      if (
        /^\d+$/.test(oldRx) &&
        /^\d+$/.test(oldTx) &&
        BigInt(rx) >= BigInt(oldRx) &&
        BigInt(tx) >= BigInt(oldTx)
      ) {
        sample.rxBps = (Number(BigInt(rx) - BigInt(oldRx)) * 8) / interval;
        sample.txBps = (Number(BigInt(tx) - BigInt(oldTx)) * 8) / interval;
        sample.intervalSeconds = interval;
      }
    }
    return [sample];
  });
}
