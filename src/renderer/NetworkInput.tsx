import { useState } from "react";
export function NetworkInput({
  value,
  onChange,
  label,
  required = false,
  defaultPrefix = 24,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
  defaultPrefix?: number;
}) {
  const [preferred, setPreferred] = useState(defaultPrefix);
  const parts = value.split("/");
  if (value && (parts.length > 2 || value.includes(":")))
    return (
      <input
        aria-label={label}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  const ip = parts[0] || "",
    prefix = parts[1] ?? String(preferred);
  return (
    <div className="network-input">
      <input
        aria-label={label}
        placeholder="Alamat IPv4"
        required={required}
        value={ip}
        onChange={(e) =>
          onChange(
            e.target.value.includes("/")
              ? e.target.value
              : e.target.value
                ? `${e.target.value}/${prefix}`
                : "",
          )
        }
      />
      <select
        aria-label={`Prefix ${label}`}
        value={prefix}
        onChange={(e) => {
          setPreferred(Number(e.target.value));
          if (ip) onChange(`${ip}/${e.target.value}`);
        }}
      >
        {Array.from({ length: 33 }, (_, i) => (
          <option key={i} value={i}>
            /{i}
            {i === 32 ? " · satu IP" : i === 24 ? " · 256 alamat" : ""}
          </option>
        ))}
        {parts[1] && !/^([0-9]|[12][0-9]|3[0-2])$/.test(parts[1]) && (
          <option value={parts[1]}>{parts[1]} · perbaiki prefix</option>
        )}
      </select>
    </div>
  );
}
