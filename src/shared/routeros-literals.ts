export const routerQuote = (value: string) => {
  if (/[\x00-\x1f\x7f]/.test(value))
    throw new Error("Nilai RouterOS tidak boleh mengandung karakter kontrol.");
  return '"' + value.replace(/[\\"$]/g, (c) => "\\" + c) + '"';
};
export const selectorText = (selector: Record<string, string>) => {
  if (!Object.keys(selector).length)
    throw new Error("Selector target harus eksplisit.");
  return Object.entries(selector)
    .map(([key, value]) => {
      if (!/^[a-zA-Z][\w.-]*$/.test(key))
        throw new Error("Nama properti selector tidak valid.");
      return `${key}=${routerQuote(value)}`;
    })
    .join(" and ");
};
export function singletonFields(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  let current = "";
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+):\s*(.*)$/);
    if (match) {
      current = match[1];
      result[current] = match[2].trim();
    } else if (current && line.trim()) result[current] += line.trim();
  }
  return result;
}
