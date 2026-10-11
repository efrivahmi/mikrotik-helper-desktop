import { bandwidthBps } from "../shared/standards";
import { useState } from "react";
const units = [
  { value: "M", label: "Mbps" },
  { value: "k", label: "kbps" },
  { value: "G", label: "Gbps" },
  { value: "", label: "bps" },
];
export function RateInput({
  value,
  onChange,
  label,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
}) {
  const [preferredUnit, setPreferredUnit] = useState("M");
  const m = value.match(/^(\d*(?:\.\d*)?)([kMG]?)$/);
  // Never silently rewrite a loaded advanced value or convert an empty value to a real setting.
  const number = m ? m[1] : "",
    unit = m && value ? m[2] : preferredUnit;
  if (!m)
    return (
      <div className="rate-input">
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <small>Nilai RouterOS</small>
      </div>
    );
  return (
    <div className="rate-input">
      <input
        type="number"
        step="any"
        min="0"
        required={required}
        aria-label={label}
        value={number}
        onChange={(e) =>
          onChange(e.target.value ? `${e.target.value}${unit}` : "")
        }
      />
      <select
        aria-label={`Satuan ${label}`}
        value={unit}
        onChange={(e) => {
          setPreferredUnit(e.target.value);
          if (!number) return;
          try {
            const n = bandwidthBps(value),
              scale =
                e.target.value === "M"
                  ? 1e6
                  : e.target.value === "k"
                    ? 1e3
                    : e.target.value === "G"
                      ? 1e9
                      : 1;
            onChange(`${n / scale}${e.target.value}`);
          } catch {
            onChange(`${number}${e.target.value}`);
          }
        }}
      >
        {units.map((u) => (
          <option key={u.label} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}
