import { z } from "zod";
import {
  CONFIG_MODULES,
  RECIPES,
  configModule,
  isSecretField,
  type ConfigOperation,
  type AutomationEvidence,
  type AutomationRequest,
} from "../shared/automation";
import { detailRows } from "../shared/routeros";
import {
  routerQuote,
  selectorText,
  singletonFields,
} from "../shared/routeros-literals";
import type { PlanInput, Router } from "../shared/model";

const values = z.record(
  z.string().regex(/^[a-zA-Z][\w.-]*$/),
  z.string().max(2000),
);
export const AutomationRequestSchema = z
  .object({
    routerId: z.string().uuid(),
    evidenceId: z.string().uuid(),
    name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,30}$/),
    recipeId: z.string().max(80).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    operations: z
      .array(
        z.object({
          moduleId: z.string(),
          action: z.enum(["add", "set", "remove", "enable", "disable"]),
          selector: values,
          values,
          originalValues: values.optional(),
          first: z.boolean().optional(),
        }),
      )
      .max(64)
      .optional(),
    managementSubnet: z.string().max(80),
    managementInterface: z.string().max(100),
    alternateAccess: z.boolean(),
  })
  .refine(
    (v) => !!v.recipeId || !!v.operations?.length,
    "Pilih paket atau operasi konfigurasi.",
  );
export function ipNumber(ip: string) {
  const parts = ip.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)
  )
    throw new Error(`Alamat IPv4 tidak valid: ${ip}`);
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}
export function subnet(cidr: string) {
  const [ip, prefixText] = cidr.split("/");
  if (!/^\d{1,2}$/.test(prefixText || ""))
    throw new Error("Alamat harus mencantumkan prefix CIDR.");
  const prefix = Number(prefixText);
  if (prefix > 32) throw new Error("Prefix IPv4 tidak valid.");
  const n = ipNumber(ip),
    size = 2 ** (32 - prefix),
    start = Math.floor(n / size) * size;
  const dotted = (v: number) =>
    [24, 16, 8, 0].map((s) => Math.floor(v / 2 ** s) % 256).join(".");
  return {
    ip,
    n,
    prefix,
    start,
    end: start + size - 1,
    network: `${dotted(start)}/${prefix}`,
  };
}
const overlaps = (a: ReturnType<typeof subnet>, b: ReturnType<typeof subnet>) =>
  a.start <= b.end && b.start <= a.end;
const list = (v: unknown) =>
  Array.isArray(v)
    ? v.map(String)
    : String(v || "")
        .split(/[,\s]+/)
        .filter(Boolean);
const text = (p: Record<string, unknown>, k: string) =>
  String(p[k] ?? "").trim();
const int = (
  p: Record<string, unknown>,
  k: string,
  min: number,
  max: number,
) => {
  const v = text(p, k);
  if (!/^\d+$/.test(v) || Number(v) < min || Number(v) > max)
    throw new Error(`${k} harus ${min}–${max}.`);
  return v;
};
const rate = (p: Record<string, unknown>, k: string) => {
  const v = text(p, k);
  if (!/^\d+(?:\.\d+)?[kMG]?$/.test(v) || parseFloat(v) <= 0)
    throw new Error(`${k}: isi bandwidth positif, misalnya 10M.`);
  return v;
};
const fields = (e: AutomationEvidence, id: string) =>
  detailRows(e.data[id] || "");
const mustInterface = (e: AutomationEvidence, name: string) => {
  if (!fields(e, "interfaces").some((r) => r.name === name))
    throw new Error(`Interface ${name} tidak ada pada router ini.`);
  return name;
};
const op = (
  moduleId: string,
  action: ConfigOperation["action"],
  values: Record<string, string>,
  selector: Record<string, string> = {},
  first = false,
): ConfigOperation => ({ moduleId, action, selector, values, first });
const portalDirectory = (request: AutomationRequest, e: AutomationEvidence) =>
  `${detailRows(e.data.files || "").some((r) => r.name === "flash") ? "flash/" : ""}AGENT-${request.name}-portal`;
export function recipeOperations(
  request: AutomationRequest,
  e: AutomationEvidence,
): ConfigOperation[] {
  const recipe = RECIPES.find((r) => r.id === request.recipeId);
  if (!recipe) throw new Error("Paket konfigurasi tidak ditemukan.");
  if (recipe.minVersion && Number(e.version.split(".")[0]) < recipe.minVersion)
    throw new Error(`Paket ini memerlukan RouterOS ${recipe.minVersion}.`);
  const p = request.params || {},
    n = `AGENT-${request.name}`,
    result: ConfigOperation[] = [];
  for (const f of recipe.fields) {
    const v = p[f.key];
    if (
      f.required &&
      (v === undefined || v === "" || (Array.isArray(v) && !v.length))
    )
      throw new Error(`Isi ${f.label}.`);
  }
  const add = (id: string, v: Record<string, string>, first = false) =>
    result.push(op(id, "add", v, {}, first));
  const set = (
    id: string,
    s: Record<string, string>,
    v: Record<string, string>,
  ) => result.push(op(id, "set", v, s));
  const iface = (key: string) => mustInterface(e, text(p, key));
  const nat = (wan: string) =>
    add("firewall-nat", {
      chain: "srcnat",
      action: "masquerade",
      "out-interface": wan,
    });
  const disableFastTrack = () => {
    const active = fields(e, "firewall-filter").filter(
      (r) => r.action === "fasttrack-connection" && r.disabled !== "yes",
    );
    if (active.length && !p.disableFastTrack)
      throw new Error(
        "FastTrack aktif melewati Queue/PCC. Izinkan penonaktifan FastTrack pada formulir atau tinjau rule tersebut dahulu.",
      );
    for (const r of active) {
      const same = fields(e, "firewall-filter").filter(
        (t) => t.chain === r.chain && t.action === r.action,
      );
      if (same.length !== 1 && !r.comment)
        throw new Error(
          "Rule FastTrack tidak memiliki selector unik. Beri komentar unik melalui rencana manual terlebih dahulu.",
        );
      set(
        "firewall-filter",
        r.comment
          ? { comment: r.comment }
          : { chain: r.chain, action: r.action },
        { disabled: "yes" },
      );
    }
  };
  const lan = (target: string) => {
    if (fields(e, "bridge-port").some((r) => r.interface === target))
      throw new Error(
        "LAN/DHCP harus menggunakan bridge atau VLAN, bukan port anggota bridge.",
      );
    const a = subnet(text(p, "address")),
      [begin, end] = text(p, "range").split("-");
    const lo = ipNumber(begin),
      hi = ipNumber(end);
    if (
      a.prefix > 30 ||
      lo > hi ||
      lo <= a.start ||
      hi >= a.end ||
      (a.n >= lo && a.n <= hi)
    )
      throw new Error(
        "Pool DHCP harus berada di subnet, tidak memuat gateway, network atau broadcast.",
      );
    if (fields(e, "dhcp-server").some((r) => r.interface === target))
      throw new Error(
        "Interface ini sudah memiliki DHCP server. Gunakan pengaturan per menu untuk mengubah server yang ada.",
      );
    for (const r of fields(e, "dhcp-network")) {
      try {
        if (overlaps(a, subnet(r.address)))
          throw new Error(
            "DHCP network bertumpuk dengan konfigurasi yang ada.",
          );
      } catch (err) {
        if (err instanceof Error && err.message.includes("bertumpuk"))
          throw err;
      }
    }
    const dns = text(p, "dns")
      .split(",")
      .map((v) => v.trim());
    dns.forEach(ipNumber);
    add("ip-address", { address: text(p, "address"), interface: target });
    add("ip-pool", { name: `${n}-pool`, ranges: text(p, "range") });
    add("dhcp-network", {
      address: a.network,
      gateway: a.ip,
      "dns-server": dns.join(","),
    });
    add("dhcp-server", {
      name: `${n}-dhcp`,
      interface: target,
      "address-pool": `${n}-pool`,
      "lease-time": "1h",
      disabled: "no",
    });
  };
  const wans = () => {
    if (!Array.isArray(p.wans) || p.wans.length < 2 || p.wans.length > 8)
      throw new Error("Pilih 2–8 ISP.");
    const w = p.wans.map((row: any, i: number) => ({
      interface: mustInterface(e, String(row.interface || "")),
      gateway: String(row.gateway || ""),
      weight: Number(row.weight || 1),
      distance: i + 1,
    }));
    for (const row of w) {
      ipNumber(row.gateway);
      if (!Number.isInteger(row.weight) || row.weight < 1 || row.weight > 16)
        throw new Error("Bobot ISP harus 1–16.");
    }
    if (new Set(w.map((r) => r.interface)).size !== w.length)
      throw new Error("Interface ISP tidak boleh sama.");
    return w;
  };
  switch (recipe.id) {
    case "management-ip":
      subnet(text(p, "address"));
      add("ip-address", {
        address: text(p, "address"),
        interface: iface("interface"),
      });
      break;
    case "vlan":
      add("vlan", {
        name: n,
        interface: iface("interface"),
        "vlan-id": int(p, "vlan", 1, 4094),
      });
      break;
    case "bridge": {
      const ports = list(p.ports);
      if (!ports.length) throw new Error("Pilih port anggota.");
      add("bridge", {
        name: n,
        "protocol-mode": "rstp",
        "vlan-filtering": "no",
      });
      for (const port of ports) {
        mustInterface(e, port);
        if (fields(e, "bridge-port").some((r) => r.interface === port))
          throw new Error(`${port} sudah menjadi anggota bridge.`);
        add("bridge-port", { bridge: n, interface: port });
      }
      break;
    }
    case "bridge-vlan": {
      const bridge = iface("bridge"),
        vlan = int(p, "vlan", 1, 4094),
        tagged = list(p.tagged),
        untagged = list(p.untagged);
      if (!request.alternateAccess)
        throw new Error(
          "VLAN filtering memerlukan akses management cadangan yang dikonfirmasi.",
        );
      if (tagged.some((v) => untagged.includes(v)))
        throw new Error("Port tagged dan untagged tidak boleh sama.");
      for (const port of [...tagged, ...untagged]) mustInterface(e, port);
      add("bridge-vlan", {
        bridge,
        "vlan-ids": vlan,
        tagged: tagged.join(","),
        untagged: untagged.join(","),
      });
      for (const port of untagged)
        set(
          "bridge-port",
          { interface: port, bridge },
          {
            pvid: vlan,
            "ingress-filtering": "yes",
            "frame-types": "admit-only-untagged-and-priority-tagged",
          },
        );
      set("bridge", { name: bridge }, { "vlan-filtering": "yes" });
      break;
    }
    case "lan-dhcp":
      lan(iface("interface"));
      break;
    case "vlan-dhcp":
      add("vlan", {
        name: n,
        interface: iface("parent"),
        "vlan-id": int(p, "vlan", 1, 4094),
      });
      lan(n);
      break;
    case "dhcp-reservation": {
      ipNumber(text(p, "ip"));
      if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(text(p, "mac")))
        throw new Error("MAC tidak valid.");
      if (!fields(e, "dhcp-server").some((r) => r.name === text(p, "server")))
        throw new Error("DHCP server tidak ditemukan.");
      if (
        fields(e, "dhcp-lease").some(
          (r) =>
            r.address === text(p, "ip") ||
            r["mac-address"]?.toUpperCase() === text(p, "mac").toUpperCase(),
        )
      )
        throw new Error("IP/MAC sudah memiliki lease; edit lease yang ada.");
      add("dhcp-lease", {
        address: text(p, "ip"),
        "mac-address": text(p, "mac").toUpperCase(),
        server: text(p, "server"),
      });
      break;
    }
    case "wan-dhcp": {
      const wan = iface("interface");
      if (fields(e, "dhcp-client").some((r) => r.interface === wan))
        throw new Error("DHCP client sudah ada pada interface ini.");
      add("dhcp-client", {
        interface: wan,
        "add-default-route": "yes",
        "default-route-distance": int(p, "distance", 1, 255),
        "use-peer-dns": "no",
        disabled: "no",
      });
      nat(wan);
      break;
    }
    case "wan-static": {
      const wan = iface("interface"),
        a = subnet(text(p, "address")),
        g = ipNumber(text(p, "gateway"));
      if (g <= a.start || g >= a.end || g === a.n)
        throw new Error(
          "Gateway ISP harus berada di subnet WAN dan berbeda dari IP WAN.",
        );
      add("ip-address", { interface: wan, address: text(p, "address") });
      add("static-route", {
        "dst-address": "0.0.0.0/0",
        gateway: `${text(p, "gateway")}%${wan}`,
        distance: int(p, "distance", 1, 255),
        "check-gateway": "ping",
      });
      nat(wan);
      break;
    }
    case "wan-pppoe":
      add("pppoe-client", {
        name: n,
        interface: iface("interface"),
        user: text(p, "user"),
        password: String(p.password),
        "add-default-route": "yes",
        "default-route-distance": int(p, "distance", 1, 255),
        "use-peer-dns": "no",
        disabled: "no",
      });
      nat(n);
      break;
    case "failover":
      for (const w of wans()) {
        add("static-route", {
          "dst-address": "0.0.0.0/0",
          gateway: `${w.gateway}%${w.interface}`,
          distance: String(w.distance),
          "check-gateway": "ping",
        });
        nat(w.interface);
      }
      break;
    case "pcc": {
      if (fields(e, "hotspot-server").some((r) => r.disabled !== "yes"))
        throw new Error(
          "PCC ini tidak diterapkan pada router dengan HotSpot aktif. Gunakan failover atau desain routing terpisah.",
        );
      if (
        fields(e, "firewall-mangle").some(
          (r) =>
            r.disabled !== "yes" &&
            ["mark-connection", "mark-routing"].includes(r.action),
        )
      )
        throw new Error(
          "Connection/routing mark aktif perlu ditinjau sebelum menambahkan PCC.",
        );
      disableFastTrack();
      const ws = wans(),
        total = ws.reduce((sum, w) => sum + w.weight, 0),
        l = iface("lan"),
        cidr = subnet(text(p, "subnet"));
      if (total > 16) throw new Error("Jumlah bobot PCC maksimal 16.");
      const skip = `${n}-local`;
      const networks = new Set([
        cidr.network,
        "224.0.0.0/4",
        "255.255.255.255/32",
        ...fields(e, "ip-address")
          .map((r) => {
            try {
              return subnet(r.address).network;
            } catch {
              return "";
            }
          })
          .filter(Boolean),
      ]);
      for (const address of networks)
        add("firewall-address-list", { list: skip, address });
      let bucket = 0;
      for (const w of ws) {
        const table = `${n}-isp${w.distance}`,
          mark = `${table}-conn`;
        add("routing-table", { name: table, fib: "yes" });
        add("firewall-mangle", {
          chain: "prerouting",
          action: "mark-connection",
          "in-interface": w.interface,
          "connection-state": "new",
          "connection-mark": "no-mark",
          "new-connection-mark": mark,
          passthrough: "yes",
        });
        for (let j = 0; j < w.weight; j++, bucket++)
          add("firewall-mangle", {
            chain: "prerouting",
            action: "mark-connection",
            "in-interface": l,
            "src-address": cidr.network,
            "dst-address-type": "!local",
            "dst-address-list": `!${skip}`,
            "connection-mark": "no-mark",
            "connection-state": "new",
            "per-connection-classifier": `both-addresses-and-ports:${total}/${bucket}`,
            "new-connection-mark": mark,
            passthrough: "yes",
          });
        add("firewall-mangle", {
          chain: "prerouting",
          action: "mark-routing",
          "in-interface": l,
          "src-address": cidr.network,
          "dst-address-type": "!local",
          "dst-address-list": `!${skip}`,
          "connection-mark": mark,
          "new-routing-mark": table,
          passthrough: "no",
        });
        add("firewall-mangle", {
          chain: "output",
          action: "mark-routing",
          "connection-mark": mark,
          "new-routing-mark": table,
          passthrough: "no",
        });
        add("static-route", {
          "dst-address": "0.0.0.0/0",
          gateway: `${w.gateway}%${w.interface}`,
          "routing-table": table,
          "check-gateway": "ping",
          distance: "1",
        });
        for (const fallback of ws.filter((x) => x.interface !== w.interface))
          add("static-route", {
            "dst-address": "0.0.0.0/0",
            gateway: `${fallback.gateway}%${fallback.interface}`,
            "routing-table": table,
            "check-gateway": "ping",
            distance: String(fallback.distance + 1),
          });
        add("static-route", {
          "dst-address": "0.0.0.0/0",
          gateway: `${w.gateway}%${w.interface}`,
          distance: String(w.distance),
          "check-gateway": "ping",
        });
        nat(w.interface);
      }
      break;
    }
    case "pcq":
    case "simple-queue":
    case "queue-tree": {
      disableFastTrack();
      const target = subnet(text(p, "target")).network,
        up = rate(p, "upload"),
        down = rate(p, "download");
      if (
        fields(e, "simple-queue").some(
          (r) =>
            r.disabled !== "yes" &&
            (r.target || "").split(",").some((c) => {
              try {
                return overlaps(subnet(c), subnet(target));
              } catch {
                return false;
              }
            }),
        )
      )
        throw new Error(
          "Target bertumpuk dengan simple queue aktif. Edit queue yang ada terlebih dahulu.",
        );
      if (recipe.id !== "simple-queue") {
        add("queue-type", {
          name: `${n}-up`,
          kind: "pcq",
          "pcq-classifier": "src-address",
          "pcq-rate": "0",
        });
        add("queue-type", {
          name: `${n}-down`,
          kind: "pcq",
          "pcq-classifier": "dst-address",
          "pcq-rate": "0",
        });
      }
      if (recipe.id !== "queue-tree")
        add("simple-queue", {
          name: n,
          target,
          "max-limit": `${up}/${down}`,
          ...(recipe.id === "pcq" ? { queue: `${n}-up/${n}-down` } : {}),
        });
      else {
        const wan = iface("wan"),
          priority = int(p, "priority", 1, 8);
        if (
          fields(e, "firewall-mangle").some(
            (r) => r.action === "mark-packet" && r.disabled !== "yes",
          )
        )
          throw new Error(
            "Ada packet marking aktif. Tinjau konflik QoS sebelum membuat Queue Tree baru.",
          );
        add("firewall-mangle", {
          chain: "forward",
          action: "mark-packet",
          "src-address": target,
          "out-interface": wan,
          "new-packet-mark": `${n}-up`,
          passthrough: "no",
        });
        add("firewall-mangle", {
          chain: "forward",
          action: "mark-packet",
          "dst-address": target,
          "in-interface": wan,
          "new-packet-mark": `${n}-down`,
          passthrough: "no",
        });
        add("queue-tree", {
          name: `${n}-up`,
          parent: wan,
          "packet-mark": `${n}-up`,
          queue: `${n}-up`,
          "max-limit": up,
          priority,
        });
        add("queue-tree", {
          name: `${n}-down`,
          parent: "global",
          "packet-mark": `${n}-down`,
          queue: `${n}-down`,
          "max-limit": down,
          priority,
        });
      }
      break;
    }
    case "firewall-baseline": {
      const wan = iface("wan"),
        l = iface("lan"),
        mg = subnet(text(p, "management")).network,
        input = `${n}-input`,
        forward = `${n}-forward`;
      if (mg !== subnet(request.managementSubnet).network)
        throw new Error(
          "Subnet administrator firewall harus sama dengan jalur management pada formulir.",
        );
      const rule = (chain: string, v: Record<string, string>) =>
        add("firewall-filter", { chain, ...v });
      rule(input, {
        action: "accept",
        "connection-state": "established,related,untracked",
      });
      rule(input, { action: "drop", "connection-state": "invalid" });
      rule(input, { action: "accept", "src-address": mg });
      rule(input, { action: "accept", protocol: "icmp" });
      rule(input, {
        action: "accept",
        "in-interface": l,
        protocol: "udp",
        "dst-port": "53,67",
      });
      rule(input, {
        action: "accept",
        "in-interface": l,
        protocol: "tcp",
        "dst-port": "53",
      });
      rule(input, { action: "drop", "in-interface": wan });
      rule(input, { action: "return" });
      rule(forward, {
        action: "accept",
        "connection-state": "established,related,untracked",
      });
      rule(forward, { action: "drop", "connection-state": "invalid" });
      rule(forward, { action: "accept", "connection-nat-state": "dstnat" });
      rule(forward, {
        action: "drop",
        "in-interface": wan,
        "connection-state": "new",
        "connection-nat-state": "!dstnat",
      });
      rule(forward, { action: "return" });
      add(
        "firewall-filter",
        { chain: "input", action: "jump", "jump-target": input },
        true,
      );
      add(
        "firewall-filter",
        { chain: "forward", action: "jump", "jump-target": forward },
        true,
      );
      break;
    }
    case "port-forward":
      add("firewall-nat", {
        chain: "dstnat",
        action: "dst-nat",
        "in-interface": iface("wan"),
        protocol: text(p, "protocol"),
        "dst-port": int(p, "port", 1, 65535),
        "src-address": subnet(text(p, "source")).network,
        "to-addresses": text(p, "server"),
        "to-ports": int(p, "serverPort", 1, 65535),
      });
      ipNumber(text(p, "server"));
      break;
    case "block-source":
      add("firewall-address-list", {
        list: n,
        address: subnet(text(p, "source")).network,
      });
      add(
        "firewall-raw",
        { chain: "prerouting", action: "drop", "src-address-list": n },
        true,
      );
      break;
    case "vlan-isolation": {
      const a = subnet(text(p, "subnetA")),
        b = subnet(text(p, "subnetB"));
      if (overlaps(a, b))
        throw new Error("Subnet isolasi tidak boleh bertumpuk.");
      add(
        "firewall-filter",
        {
          chain: "forward",
          action: "drop",
          "src-address": a.network,
          "dst-address": b.network,
        },
        true,
      );
      add(
        "firewall-filter",
        {
          chain: "forward",
          action: "drop",
          "src-address": b.network,
          "dst-address": a.network,
        },
        true,
      );
      break;
    }
    case "hotspot": {
      if (
        ["no", "false"].includes(
          singletonFields(e.data.deviceMode || "").hotspot,
        )
      )
        throw new Error(
          "HotSpot diblokir device-mode. Aktifkan melalui prosedur perangkat sebelum membuat konfigurasi.",
        );
      const target = iface("interface");
      if (fields(e, "hotspot-server").some((r) => r.interface === target))
        throw new Error("HotSpot sudah tersedia pada interface ini.");
      if (!/^[a-zA-Z0-9.-]+$/.test(text(p, "domain")))
        throw new Error("Domain portal tidak valid.");
      disableFastTrack();
      const html = p.createPortal
        ? portalDirectory(request, e)
        : text(p, "html");
      if (!Object.hasOwn(e.data, "files"))
        throw new Error(
          "Daftar file router wajib terbaca sebelum konfigurasi portal.",
        );
      if (
        p.createPortal &&
        detailRows(e.data.files).some(
          (r) => r.name === html || r.name.startsWith(html + "/"),
        )
      )
        throw new Error(
          "Direktori portal AGENT sudah ada. Gunakan nama konfigurasi lain agar file tidak tertimpa.",
        );
      if (
        !p.createPortal &&
        !detailRows(e.data.files || "").some(
          (r) => r.name === `${html}/login.html`,
        )
      )
        throw new Error(
          "Direktori portal belum memiliki login.html. Siapkan portal pada router atau pilih direktori yang tersedia; portal lama tidak ditimpa.",
        );
      lan(target);
      add("hotspot-profile", {
        name: n,
        "hotspot-address": subnet(text(p, "address")).ip,
        "dns-name": text(p, "domain"),
        "html-directory": html,
        "login-by": "http-chap,cookie",
      });
      add("hotspot-user-profile", {
        name: n,
        "rate-limit": `${rate(p, "upload")}/${rate(p, "download")}`,
        "shared-users": int(p, "sharedUsers", 1, 100),
      });
      add("hotspot-server", {
        name: n,
        interface: target,
        "address-pool": `${n}-pool`,
        profile: n,
        disabled: "no",
      });
      const wan = iface("wan");
      if (wan === target)
        throw new Error("Interface internet dan HotSpot tidak boleh sama.");
      const dns = singletonFields(e.data.dns || "");
      if (!Object.hasOwn(e.data, "dns"))
        throw new Error("Konfigurasi DNS belum dapat dibaca.");
      if (!["yes", "true"].includes(dns["allow-remote-requests"])) {
        const dnsChain = `${n}-dns`;
        add("firewall-filter", {
          chain: dnsChain,
          action: "accept",
          "in-interface": target,
          "src-address": subnet(text(p, "address")).network,
        });
        add("firewall-filter", { chain: dnsChain, action: "drop" });
        for (const protocol of ["udp", "tcp"])
          add(
            "firewall-filter",
            {
              chain: "input",
              action: "jump",
              protocol,
              "dst-port": "53",
              "jump-target": dnsChain,
            },
            true,
          );
        const resolver: Record<string, string> = {
          "allow-remote-requests": "yes",
        };
        if (!dns.servers && !dns["dynamic-servers"]) {
          const servers = text(p, "dns")
            .split(",")
            .map((v) => v.trim());
          if (servers.includes(subnet(text(p, "address")).ip))
            throw new Error(
              "DNS upstream tidak boleh menunjuk IP gateway router sendiri.",
            );
          resolver.servers = servers.join(",");
        }
        set("dns", {}, resolver);
      }
      add("firewall-nat", {
        chain: "srcnat",
        action: "masquerade",
        "src-address": subnet(text(p, "address")).network,
        "out-interface": wan,
      });
      add("hotspot-user", {
        name: text(p, "user"),
        password: String(p.password),
        profile: n,
        server: n,
      });
      break;
    }
    case "hotspot-user":
      if (
        !fields(e, "hotspot-user-profile").some(
          (r) => r.name === text(p, "profile"),
        )
      )
        throw new Error("Profil HotSpot tidak ditemukan.");
      if (!/^(?:0|\d+[wdhms](?:\d+[wdhms])*)$/.test(text(p, "uptime")))
        throw new Error("Batas uptime tidak valid.");
      add("hotspot-user", {
        name: text(p, "user"),
        password: String(p.password),
        profile: text(p, "profile"),
        "limit-uptime": text(p, "uptime"),
      });
      break;
    case "hotspot-profile":
      add("hotspot-user-profile", {
        name: n,
        "rate-limit": `${rate(p, "upload")}/${rate(p, "download")}`,
        "shared-users": int(p, "sharedUsers", 1, 100),
      });
      break;
    case "wifi":
    case "wireless":
    case "capsman": {
      const pass = String(p.password);
      if (pass.length < 8 || pass.length > 63)
        throw new Error("Passphrase WPA harus 8–63 karakter.");
      if (recipe.id === "wireless") {
        add("wireless-security", {
          name: n,
          mode: "dynamic-keys",
          "authentication-types": "wpa2-psk",
          "unicast-ciphers": "aes-ccm",
          "group-ciphers": "aes-ccm",
          "wpa2-pre-shared-key": pass,
        });
        set(
          "wireless",
          { name: iface("interface") },
          {
            mode: "ap-bridge",
            ssid: text(p, "ssid"),
            country: text(p, "country"),
            "security-profile": n,
            disabled: "no",
          },
        );
      } else {
        add("wifi-security", {
          name: n,
          "authentication-types": "wpa2-psk,wpa3-psk",
          passphrase: pass,
        });
        add("wifi-configuration", {
          name: n,
          mode: "ap",
          ssid: text(p, "ssid"),
          country: text(p, "country"),
          security: n,
        });
        if (recipe.id === "wifi")
          set(
            "wifi",
            { name: iface("interface") },
            { configuration: n, disabled: "no" },
          );
        else {
          const ifs = list(p.interfaces);
          ifs.forEach((v) => mustInterface(e, v));
          set(
            "wifi-capsman",
            {},
            { enabled: "yes", interfaces: ifs.join(",") },
          );
          add("wifi-provisioning", {
            action: "create-dynamic-enabled",
            "master-configuration": n,
            "supported-bands": text(p, "bands"),
          });
        }
      }
      break;
    }
    case "wireguard": {
      if (!/^[A-Za-z0-9+/]{43}=$/.test(text(p, "publicKey")))
        throw new Error("Public key WireGuard tidak valid.");
      subnet(text(p, "address"));
      add("wireguard", { name: n, "listen-port": int(p, "port", 1, 65535) });
      add("ip-address", { address: text(p, "address"), interface: n });
      add("wireguard-peer", {
        interface: n,
        "public-key": text(p, "publicKey"),
        "allowed-address": subnet(text(p, "allowed")).network,
        "endpoint-address": text(p, "endpoint"),
        "endpoint-port": int(p, "endpointPort", 1, 65535),
        "persistent-keepalive": "25s",
      });
      break;
    }
  }
  if (!result.length || result.length > 64)
    throw new Error(
      "Paket menghasilkan nol atau lebih dari 64 operasi; pecah menjadi tahap yang lebih kecil.",
    );
  return result;
}

export const propertyCommand = (
  moduleId: string,
  selector: Record<string, string>,
  key: string,
) => {
  const m = configModule(moduleId);
  if (!m || !/^[a-zA-Z][\w.-]*$/.test(key))
    throw new Error("Properti tidak valid.");
  return `:put [/${m.menu} get${m.singleton ? "" : ` [find where ${selectorText(selector)}]`} ${key}]`;
};
const blockedFields =
  /^(?:on-event|on-login|on-logout|on-up|on-down|source|script|lease-script|place-before|numbers)$/;
export async function compileAutomation(
  request: AutomationRequest,
  e: AutomationEvidence,
  router: Router,
  readOriginal: (
    moduleId: string,
    selector: Record<string, string>,
    key: string,
  ) => Promise<string>,
  stash: (value: string) => string,
): Promise<PlanInput> {
  const mg = subnet(request.managementSubnet);
  if (mg.prefix < 8)
    throw new Error(
      "Subnet management terlalu luas; gunakan jaringan administrator yang spesifik.",
    );
  mustInterface(e, request.managementInterface);
  const operations = request.recipeId
    ? recipeOperations(request, e)
    : request.operations || [];
  const current = new Map(CONFIG_MODULES.map((m) => [m.id, fields(e, m.id)]));
  const preconditions: PlanInput["preconditions"] = [],
    verify: PlanInput["verify"] = [],
    rollbackVerify: PlanInput["rollbackVerify"] = [];
  const guards: string[] = [],
    apply: string[] = [],
    rollback: string[][] = [];
  const touched = new Set<string>(),
    captured = new Map<string, string>();
  let identityBefore: string | undefined, identityAfter: string | undefined;
  const countCheck = (
    moduleId: string,
    selector: Record<string, string>,
    count: number,
  ) => ({
    command: `/${configModule(moduleId)!.menu} print count-only where ${selectorText(selector)}`,
    contains: [],
    count,
    notContains: [],
  });
  const valueCheck = (
    moduleId: string,
    selector: Record<string, string>,
    key: string,
    value: string,
  ): PlanInput["verify"][number] => ({
    command: propertyCommand(moduleId, selector, key),
    contains: [],
    equals: value,
    notContains: [],
    valueType:
      /^(?:disabled|enabled|fib|passthrough|add-default-route|use-peer-dns|use-peer-ntp|allow-remote-requests|vlan-filtering|ingress-filtering|hw|auto-negotiation|full-duplex|igmp-snooping|only-one|use-radius|conflict-detection|add-arp|published|advertise|eui-64|match-subdomain|force|read-access|write-access|verify-server-certificate|verify-client-certificate|require-client-certificate|time-zone-autodetect|transparent-proxy|local-forwarding|client-to-client-forwarding|store-on-disk|broadcast|multicast|manycast|use-local-clock|accept)$/.test(
        key,
      ) && /^(yes|no|true|false)$/.test(value)
        ? "boolean"
        : key === "rate-limit" || key === "max-limit" || key === "limit-at"
          ? "rate-pair"
          : key === "pcq-rate"
            ? "rate"
            : /time|keepalive|interval|lifetime/.test(key)
              ? "time"
              : [
                    "tagged",
                    "untagged",
                    "authentication-types",
                    "connection-state",
                    "servers",
                    "dns-server",
                    "allowed-address",
                    "interfaces",
                  ].includes(key)
                ? "list"
                : "text",
  });
  for (const [i, input] of operations.entries()) {
    const m = configModule(input.moduleId);
    if (!m) throw new Error("Menu automation tidak terdaftar.");
    if (!Object.hasOwn(e.data, m.id))
      throw new Error(
        `${m.title} belum berhasil dibaca: ${e.errors[m.id] || "Ambil evidence untuk menu ini."}`,
      );
    if (m.minVersion && Number(e.version.split(".")[0]) < m.minVersion)
      throw new Error(`${m.title} memerlukan RouterOS ${m.minVersion}.`);
    touched.add(m.menu);
    const rows = current.get(m.id)!;
    if (
      !m.singleton &&
      !Object.keys(input.selector).length &&
      input.action !== "add"
    )
      throw new Error("Pilih target unik pada tabel.");
    const selected = m.singleton
      ? []
      : rows.filter((r) =>
          Object.entries(input.selector).every(([k, v]) => r[k] === v),
        );
    if (Object.keys(input.selector).some(isSecretField))
      throw new Error("Selector tidak boleh memuat credential.");
    if (input.action !== "add" && !m.singleton && selected.length !== 1)
      throw new Error(`${m.title}: selector harus menunjuk tepat satu record.`);
    if (selected[0]?.dynamic === "yes")
      throw new Error(
        "Record dinamis tidak diubah; konfigurasi sumbernya melalui menu yang sesuai.",
      );
    const props = { ...input.values };
    if (input.action === "enable" || input.action === "disable")
      props.disabled = input.action === "disable" ? "yes" : "no";
    if (
      !m.singleton &&
      input.action !== "add" &&
      Object.keys(input.selector).some(
        (k) => Object.hasOwn(props, k) && props[k] !== input.selector[k],
      )
    )
      throw new Error(
        "Properti selector tidak boleh diubah dalam operasi ini. Pilih selector stabil seperti comment atau gunakan rencana manual untuk rename.",
      );
    if (m.readOnly)
      throw new Error(
        "User Manager memerlukan backup database tersendiri sebelum perubahan. Gunakan alur backup khusus User Manager terlebih dahulu.",
      );
    for (const [key, value] of Object.entries(props)) {
      if (!/^[a-zA-Z][\w.-]*$/.test(key) || blockedFields.test(key))
        throw new Error(
          `Properti ${key} tidak tersedia untuk automation umum.`,
        );
      routerQuote(value);
    }
    if (
      (input.action === "add" || input.action === "remove") &&
      (m.singleton || m.physical)
    )
      throw new Error(
        `${m.title}: buat/hapus interface fisik atau singleton tidak diizinkan.`,
      );
    if (
      !request.alternateAccess &&
      (m.id === "ip-services" ||
        m.id === "management-users" ||
        m.id === "management-groups" ||
        ((m.id === "bridge" ||
          m.id === "bridge-port" ||
          m.id === "interfaces" ||
          m.id === "ethernet" ||
          m.id === "wifi" ||
          m.id === "wireless") &&
          (input.selector.name === request.managementInterface ||
            input.selector.interface === request.managementInterface ||
            props.interface === request.managementInterface)))
    )
      throw new Error(
        "Perubahan ini dapat memutus management. Konfirmasikan jalur akses cadangan sebelum menyiapkan rencana.",
      );
    if (
      m.id === "ip-address" &&
      selected[0] &&
      subnet(selected[0].address).ip === router.host &&
      input.action !== "add"
    )
      throw new Error(
        "Alamat yang sedang digunakan untuk SSH dilindungi. Tambah alamat baru lalu ubah inventory dan sambungkan melalui alamat itu dahulu.",
      );
    if (m.id === "firewall-filter" || m.id === "firewall-raw") {
      const drop = (props.action || selected[0]?.action) === "drop";
      if (
        drop &&
        props["src-address"] &&
        overlaps(subnet(props["src-address"]), mg)
      )
        throw new Error("Rule drop mencakup subnet management.");
      if (
        drop &&
        (props.chain || selected[0]?.chain) === "input" &&
        !props["in-interface"] &&
        !props["src-address"] &&
        !request.recipeId &&
        !request.alternateAccess
      )
        throw new Error(
          "Input drop umum membutuhkan akses cadangan dan review jalur management.",
        );
    }
    if (
      request.recipeId === "block-source" &&
      overlaps(subnet(String(request.params?.source)), mg)
    )
      throw new Error("Source yang diblokir mencakup subnet administrator.");
    if (
      (m.id === "dhcp-network" ||
        m.id === "ip-pool" ||
        m.id === "dhcp-lease" ||
        m.id === "ip-address") &&
      input.action !== "add" &&
      [router.expectedIdentity, router.name].some(
        (v) => v.toLowerCase() === "invada",
      )
    )
      throw new Error(
        "Invada memiliki batas perlindungan IP perangkat dari pemilik. Perubahan IP/pool/lease yang ada harus memakai rencana terarah dengan bukti scope mahasiswa atau izin target khusus.",
      );
    if (
      m.id === "hotspot-profile" &&
      (router.name.toLowerCase() === "invada" ||
        router.expectedIdentity.toLowerCase() === "invada") &&
      Object.keys(props).some((k) => k.startsWith("html-directory")) &&
      input.action !== "add"
    )
      throw new Error("Portal HotSpot Invada dilindungi oleh batas pemilik.");
    if (
      m.id === "ipv6-address" &&
      router.host.includes(":") &&
      input.action !== "add"
    )
      throw new Error(
        "Alamat IPv6 pada router dengan management IPv6 dilindungi; sambungkan jalur lain sebelum mengubahnya.",
      );
    const assignments = (v: Record<string, string>) =>
      Object.entries(v)
        .map(
          ([key, value]) =>
            `${key}=${routerQuote(isSecretField(key) ? stash(value) : value)}`,
        )
        .join(" ");
    const find = m.singleton
      ? ""
      : `[find where ${selectorText(input.selector)}]`;
    if (input.action === "add") {
      if (m.fields.includes("comment") && !props.name)
        props.comment = `AGENT-${request.name}-${i + 1}${props.comment ? ` ${props.comment}` : ""}`;
      const selector = props.name
        ? { name: props.name }
        : props.comment
          ? { comment: props.comment }
          : Object.fromEntries(
              m.keys.filter((k) => props[k]).map((k) => [k, props[k]]),
            );
      if (!Object.keys(selector).length)
        throw new Error(
          `${m.title}: isi name, comment, interface atau address untuk target unik.`,
        );
      if (
        rows.some((r) => Object.entries(selector).every(([k, v]) => r[k] === v))
      )
        throw new Error(
          `${m.title}: object dengan identitas tersebut sudah ada. Edit object yang ada.`,
        );
      preconditions.push(countCheck(m.id, selector, 0));
      rollbackVerify.push(countCheck(m.id, selector, 0));
      verify.push(countCheck(m.id, selector, 1));
      guards.push(
        `:if ([:len [/${m.menu} find where ${selectorText(selector)}]] != 0) do={:error "STATE ${i + 1}: target already exists"}`,
      );
      const before =
        input.first && rows.length
          ? ` place-before=[:pick [/${m.menu} find where dynamic=no] 0]`
          : "";
      apply.push(`/${m.menu} add ${assignments(props)}${before}`);
      rollback.push([
        `/${m.menu} remove [find where ${selectorText(selector)}]`,
      ]);
      for (const [key, value] of Object.entries(props))
        if (!isSecretField(key) && key !== "comment")
          verify.push(valueCheck(m.id, selector, key, value));
      const added = {
        ...props,
        index: String(rows.length),
        flags: "",
        dynamic: "no",
        disabled: props.disabled || "no",
      };
      rows.push(added);
      if (
        [
          "vlan",
          "bridge",
          "pppoe-client",
          "wireguard",
          "bonding",
          "gre",
          "ipip",
          "eoip",
          "vxlan",
        ].includes(m.id)
      )
        current.get("interfaces")!.push(added);
      continue;
    }
    if (!m.singleton) {
      preconditions.push(countCheck(m.id, input.selector, 1));
      if (input.action !== "remove") {
        verify.push(countCheck(m.id, input.selector, 1));
        rollbackVerify.push(countCheck(m.id, input.selector, 1));
      }
      guards.push(
        `:if ([:len [/${m.menu} find where ${selectorText(input.selector)}]] != 1) do={:error "STATE ${i + 1}: target is not unique"}`,
      );
    }
    if (input.action === "remove") {
      if (m.ordered)
        throw new Error(
          "Penghapusan rule berurutan membutuhkan rollback posisi yang spesifik. Nonaktifkan rule atau gunakan rencana manual dengan posisi pemulihan.",
        );
      const row = selected[0],
        original: Record<string, string> = {};
      for (const key of m.fields)
        if (
          (Object.hasOwn(row, key) || isSecretField(key)) &&
          !["dynamic"].includes(key)
        ) {
          const v = isSecretField(key)
            ? (input.originalValues?.[key] ??
              (await readOriginal(m.id, input.selector, key)))
            : row[key];
          if (v === "[REDACTED]" || (isSecretField(key) && /^\*+$/.test(v)))
            throw new Error(
              "Credential rollback tidak dapat dibaca. Isi nilai pemulihan secara eksplisit.",
            );
          original[key] = v;
        }
      const unknown = Object.keys(row).filter(
        (k) =>
          ![
            "index",
            "flags",
            "dynamic",
            "running",
            "invalid",
            "default",
            ...(!m.fields.includes("disabled") ? ["disabled"] : []),
          ].includes(k) && !m.fields.includes(k),
      );
      if (unknown.length)
        throw new Error(
          `Rollback penuh belum dapat merekonstruksi properti ${unknown.join(", ")}. Nonaktifkan object atau gunakan rencana manual.`,
        );
      apply.push(`/${m.menu} remove ${find}`);
      rollback.push([`/${m.menu} add ${assignments(original)}`]);
      verify.push(countCheck(m.id, input.selector, 0));
      rollbackVerify.push(countCheck(m.id, input.selector, 1));
      rows.splice(rows.indexOf(row), 1);
      continue;
    }
    if (!Object.keys(props).length)
      throw new Error("Pilih minimal satu properti yang akan diubah.");
    const previous: Record<string, string> = {};
    for (const [key, value] of Object.entries(props)) {
      const cacheKey = JSON.stringify([m.id, input.selector, key]);
      let old = captured.get(cacheKey);
      if (old !== undefined)
        throw new Error(
          "Properti target yang sama muncul berulang. Gabungkan perubahan properti dalam satu operasi.",
        );
      if (old === undefined) {
        old =
          input.originalValues?.[key] ??
          (await readOriginal(m.id, input.selector, key));
        captured.set(cacheKey, old);
      }
      if (isSecretField(key) && (old === "[REDACTED]" || /^\*+$/.test(old)))
        throw new Error(
          "Credential lama tersembunyi. Isi credential rollback agar pemulihan tidak ditebak.",
        );
      previous[key] = old;
      if (!isSecretField(key)) {
        preconditions.push(valueCheck(m.id, input.selector, key, old));
        verify.push(valueCheck(m.id, input.selector, key, value));
        rollbackVerify.push(valueCheck(m.id, input.selector, key, old));
      }
    }
    apply.push(`/${m.menu} set ${find} ${assignments(props)}`);
    rollback.push([`/${m.menu} set ${find} ${assignments(previous)}`]);
    if (m.id === "identity") {
      identityBefore = e.identity;
      identityAfter = props.name;
    }
    if (selected[0]) Object.assign(selected[0], props);
  }
  if (!verify.length || !rollbackVerify.length)
    throw new Error(
      "Tidak ada pemeriksaan target/pemulihan yang dapat dibuktikan.",
    );
  if (request.recipeId === "hotspot" && request.params?.createPortal) {
    const directory = portalDirectory(request, e),
      login = `${directory}/login.html`;
    preconditions.push({
      command: `/file print count-only where name=${routerQuote(login)}`,
      contains: [],
      notContains: [],
      count: 0,
    });
    guards.push(
      `:if ([:len [/file find where name=${routerQuote(directory)}]] != 0) do={:error "Portal directory already exists"}`,
    );
    apply.push(
      `/ip hotspot reset-html numbers=[find where name=${routerQuote(`AGENT-${request.name}`)}]`,
    );
    verify.push({
      command: `/file print count-only where name=${routerQuote(login)}`,
      contains: [],
      notContains: [],
      count: 1,
    });
    // Keep only the new generated portal as a reusable asset; no existing file is edited.
  }
  const uniq = (v: PlanInput["verify"]) => [
    ...new Map(v.map((c) => [JSON.stringify(c), c])).values(),
  ];
  return {
    routerId: request.routerId,
    title: `${request.name} · ${RECIPES.find((r) => r.id === request.recipeId)?.title || "Pengaturan menu"}`,
    reason: `${operations.length} operasi dari evidence SSH ${e.createdAt}; router ${e.identity}, RouterOS ${e.version}. Management ${request.managementInterface}/${request.managementSubnet}; akses cadangan ${request.alternateAccess ? "dikonfirmasi" : "belum dikonfirmasi"}. Backup export dan biner wajib selesai sebelum perubahan. Credential berada di vault; autentikasi client/service tetap perlu dibuktikan setelah konfigurasi.${request.recipeId === "hotspot" && request.params?.createPortal ? " Portal bawaan baru dibuat dalam direktori AGENT. Rollback mengembalikan konfigurasi; file portal baru dipertahankan sebagai aset untuk digunakan ulang." : ""}`,
    apply: `# AGENT-${request.name}\n${guards.join("\n")}\n${apply.join("\n")}\n`,
    rollback: `# AGENT-${request.name} ROLLBACK\n${rollback.reverse().flat().join("\n")}\n`,
    preconditions: uniq(preconditions),
    verify: uniq(verify),
    rollbackVerify: uniq(rollbackVerify),
    automation: {
      name: request.name,
      recipeId: request.recipeId,
      evidenceId: e.id,
      managementSubnet: request.managementSubnet,
      managementInterface: request.managementInterface,
      alternateAccess: request.alternateAccess,
      menus: [...touched],
      identityBefore,
      identityAfter,
    },
  };
}
