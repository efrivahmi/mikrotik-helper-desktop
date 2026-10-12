import { detailRows } from "../shared/routeros";
import { routerQuote, singletonFields } from "../shared/routeros-literals";
import { ipv4Subnet, bandwidthBps } from "../shared/standards";
import {
  QuickSetupSchema,
  quickModules,
  protectedManagementPorts,
  portUsage,
  addressConflict,
} from "../shared/quick-setup";
import type {
  AutomationEvidence,
  AutomationRequest,
  ConfigOperation,
} from "../shared/automation";

type RecipeBuilder = (
  request: AutomationRequest,
  evidence: AutomationEvidence,
) => ConfigOperation[];
export interface QuickCompilation {
  operations: ConfigOperation[];
  portals: { server: string; directory: string }[];
  preserved: { interface: string; address: string }[];
  claimedPorts: string[];
}
/** Combines user choices with live configuration in a temporary planning overlay. */
export function compileQuickSetup(
  request: AutomationRequest,
  e: AutomationEvidence,
  recipe: RecipeBuilder,
): QuickCompilation {
  const q = QuickSetupSchema.parse(request.quick);
  const isolate = q.isolate && q.segments.length > 1;
  if (request.name.length > 20)
    throw new Error(
      "Nama Quick Setup maksimal 20 karakter agar tag setiap jaringan tetap unik.",
    );
  for (const id of quickModules(q))
    if (!Object.hasOwn(e.data, id))
      throw new Error(
        `Menu ${id} belum terbaca: ${e.errors[id] || "Baca router terlebih dahulu."}`,
      );
  if (new Set(q.segments.map((s) => s.id)).size !== q.segments.length)
    throw new Error("ID jaringan tidak boleh berulang.");
  if (
    q.topology === "bridge" &&
    q.segments.filter((s) => s.attachment === "new").length > 1
  )
    throw new Error(
      "LAN bersama membuat satu jaringan baru. Pilih port terpisah atau VLAN untuk beberapa jaringan.",
    );
  if (q.segments.filter((s) => s.service === "hotspot").length > 1)
    throw new Error(
      "Quick Setup membuat satu server HotSpot per rencana; tambah server berikutnya melalui paket HotSpot.",
    );
  if (q.segments.some((s) => s.service === "hotspot") && !q.firewall)
    throw new Error(
      "HotSpot Quick Setup membutuhkan proteksi firewall agar resolver terlindungi.",
    );
  if (isolate && !q.firewall)
    throw new Error("Isolasi antar jaringan membutuhkan paket firewall.");
  const physical = detailRows(e.data.ethernet || "").map((r) => r.name),
    interfaces = detailRows(e.data.interfaces || "").map((r) => r.name);
  if (!physical.includes(q.managementPort))
    throw new Error(
      "Pilih port fisik management yang sudah diketahui; port ini tetap dipertahankan.",
    );
  const protectedPorts = protectedManagementPorts(
    e,
    request.managementInterface,
    q.managementPort,
  );
  if (new Set(q.ports.map((p) => p.interface)).size !== q.ports.length)
    throw new Error("Satu port tidak boleh ditulis lebih dari sekali.");
  const used = q.ports.filter((p) => !["keep", "wan"].includes(p.role));
  if (used.length && !q.segments.some((s) => s.attachment === "new"))
    throw new Error(
      "Semua jaringan memakai konfigurasi existing. Peran port baru harus dikembalikan ke Pertahankan.",
    );
  for (const p of q.ports)
    if (!physical.includes(p.interface))
      throw new Error("Pilihan port harus berasal dari Ethernet yang terbaca.");
  const claimedPorts = [
    ...used.map((p) => p.interface),
    ...(q.internet.mode !== "keep" ? [q.internet.interface] : []),
  ];
  if (new Set(claimedPorts).size !== claimedPorts.length)
    throw new Error("Port internet dan LAN tidak boleh sama.");
  for (const name of claimedPorts) {
    if (!physical.includes(name))
      throw new Error(
        "Koneksi ISP baru memerlukan port Ethernet yang terbaca.",
      );
    if (protectedPorts.has(name))
      throw new Error(
        `${name} berada pada jalur management dan dipertahankan. Gunakan port lain atau rencana migrasi terarah.`,
      );
    const usage = portUsage(e, name);
    if (usage.length)
      throw new Error(
        `${name} sudah digunakan (${usage.join(", ")}). Pilih port kosong atau gunakan jaringan existing; Quick Setup tidak melepas port lama.`,
      );
  }
  if (!q.internet.interface || !interfaces.includes(q.internet.interface))
    throw new Error("Pilih interface internet yang benar-benar terbaca.");
  if (
    q.internet.mode === "keep" &&
    !detailRows(e.data["ip-address"]).some(
      (r) => r.interface === q.internet.interface,
    ) &&
    !detailRows(e.data["dhcp-client"]).some(
      (r) => r.interface === q.internet.interface && r.disabled !== "yes",
    ) &&
    !detailRows(e.data["pppoe-client"]).some(
      (r) => r.name === q.internet.interface && r.disabled !== "yes",
    )
  )
    throw new Error(
      "Interface internet existing belum memiliki IP/DHCP/PPPoE yang terbaca. Pilih interface ISP yang sudah dikonfigurasi atau siapkan ISP baru pada port kosong.",
    );
  if (
    q.internet.mode !== "keep" &&
    (detailRows(e.data["static-route"]).some(
      (r) => r["dst-address"] === "0.0.0.0/0" && r.disabled !== "yes",
    ) ||
      detailRows(e.data["dhcp-client"]).some(
        (r) => r.disabled !== "yes" && r["add-default-route"] === "yes",
      ) ||
      detailRows(e.data["pppoe-client"]).some(
        (r) => r.disabled !== "yes" && r["add-default-route"] === "yes",
      ))
  )
    throw new Error(
      "Sudah ada koneksi/default route ISP. Gunakan koneksi existing atau paket multi ISP/migrasi agar prioritas route tidak berubah tanpa desain.",
    );
  if (
    q.internet.mode !== "keep" &&
    q.ports.some(
      (p) => p.role === "wan" && p.interface !== q.internet.interface,
    )
  )
    throw new Error(
      "Quick Setup memakai satu ISP baru. Multi ISP tersedia melalui paket failover/PCC.",
    );
  if (
    q.segments.some(
      (s) =>
        s.attachment === "new" &&
        (s.dhcp === "server" || s.service === "hotspot"),
    )
  ) {
    if (!q.dns.trim()) throw new Error("Pilih resolver DNS untuk client.");
    for (const server of q.dns.split(",").map((x) => x.trim())) {
      const s = ipv4Subnet(`${server}/32`);
      if (
        detailRows(e.data["ip-address"] || "").some(
          (r) => r.address?.split("/")[0] === s.ip,
        )
      )
        throw new Error(
          "DNS client Quick Setup memakai resolver upstream. Jangan memilih alamat router sendiri.",
        );
    }
  }
  const networks = q.segments.map((s) => ipv4Subnet(s.address));
  for (const [i, a] of networks.entries())
    for (let j = 0; j < i; j++)
      if (a.start <= networks[j].end && networks[j].start <= a.end)
        throw new Error(
          "Subnet antar jaringan dalam Quick Setup tidak boleh bertumpuk.",
        );
  if (q.internet.mode === "static") {
    const wan = ipv4Subnet(q.internet.address);
    if (networks.some((n) => n.start <= wan.end && wan.start <= n.end))
      throw new Error("Subnet ISP dan LAN tidak boleh bertumpuk.");
  }
  for (const s of q.segments) {
    if (s.attachment === "new") {
      const conflict = addressConflict(s.address, e);
      if (conflict)
        throw new Error(`${s.label}: ${conflict}. Pilih kandidat IP lain.`);
      if (s.dhcp === "preserve")
        throw new Error("Jaringan baru memilih DHCP server atau tanpa DHCP.");
      if (s.service === "hotspot" && s.dhcp !== "server")
        throw new Error("HotSpot baru membutuhkan DHCP server pada paket ini.");
    } else {
      const found = detailRows(e.data["ip-address"] || "").filter(
        (r) => r.interface === s.interface && r.address === s.address,
      );
      if (found.length !== 1 || !interfaces.includes(s.interface))
        throw new Error(
          `${s.label}: pilih alamat/interface existing dari pembacaan terbaru.`,
        );
      if (s.dhcp !== "preserve" || s.service !== "lan")
        throw new Error(
          "Jaringan existing mempertahankan IP, DHCP dan layanan. Tambahan HotSpot menggunakan jaringan baru yang terpisah.",
        );
      if (claimedPorts.includes(s.interface))
        throw new Error(
          "Interface existing tidak boleh sekaligus dipindahkan ke jaringan baru.",
        );
    }
    if (s.shaping !== "none")
      for (const rate of [s.upload, s.download])
        if (bandwidthBps(rate) <= 0)
          throw new Error(
            `${s.label}: isi kapasitas upload dan download positif.`,
          );
  }
  const result: QuickCompilation = {
    operations: [],
    portals: [],
    preserved: q.segments
      .filter((s) => s.attachment === "existing")
      .map((s) => ({ interface: s.interface, address: s.address })),
    claimedPorts,
  };
  const virtual: AutomationEvidence = {
    ...e,
    data: { ...e.data },
    errors: { ...e.errors },
  };
  const serialize = (rows: Record<string, string>[]) =>
    rows
      .map(
        (r, i) =>
          `${i} ${Object.entries(r)
            .filter(([k]) => !["index", "flags"].includes(k))
            .map(([k, v]) => `${k}=${routerQuote(v)}`)
            .join(" ")}`,
      )
      .join("\n");
  const emit = (o: ConfigOperation) => {
    result.operations.push(o);
    if (o.moduleId === "dns") {
      const row = singletonFields(virtual.data.dns);
      Object.assign(row, o.values);
      virtual.data.dns = Object.entries(row)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return;
    }
    const rows = detailRows(virtual.data[o.moduleId] || "");
    if (o.action === "add")
      rows.push({
        ...o.values,
        index: String(rows.length),
        dynamic: "no",
        disabled: o.values.disabled || "no",
      });
    else {
      const matches = rows.filter((r) =>
        Object.entries(o.selector).every(([k, v]) => r[k] === v),
      );
      if (matches.length !== 1) throw new Error("Target komposisi tidak unik.");
      Object.assign(matches[0], o.values);
    }
    virtual.data[o.moduleId] = serialize(rows);
    if (
      o.action === "add" &&
      ["bridge", "vlan", "pppoe-client"].includes(o.moduleId)
    )
      virtual.data.interfaces = serialize([
        ...detailRows(virtual.data.interfaces),
        {
          ...o.values,
          name: o.values.name,
          index: "",
          dynamic: "no",
          disabled: "no",
        },
      ]);
  };
  const add = (
    moduleId: string,
    values: Record<string, string>,
    first = false,
  ) => emit({ moduleId, action: "add", selector: {}, values, first });
  const bundle = (
    recipeId: string,
    name: string,
    params: Record<string, unknown>,
  ) => {
    const operations = recipe(
      {
        ...request,
        quick: undefined,
        recipeId,
        name,
        params,
        operations: undefined,
      },
      virtual,
    );
    for (const o of operations) emit(o);
    if (recipeId === "hotspot") {
      const profile = operations.find((o) => o.moduleId === "hotspot-profile")!;
      result.portals.push({
        server: `AGENT-${name}`,
        directory: profile.values["html-directory"],
      });
    }
  };
  if (
    q.disableFastTrack &&
    (isolate ||
      q.segments.some((s) => s.shaping !== "none" || s.service === "hotspot"))
  ) {
    for (const r of detailRows(virtual.data["firewall-filter"]).filter(
      (r) => r.action === "fasttrack-connection" && r.disabled !== "yes",
    )) {
      const selector: Record<string, string> = r.comment
        ? { comment: r.comment }
        : { chain: r.chain, action: r.action };
      emit({
        moduleId: "firewall-filter",
        action: "set",
        selector,
        values: { disabled: "yes" },
      });
    }
  } else if (
    (isolate ||
      q.segments.some(
        (s) => s.shaping !== "none" || s.service === "hotspot",
      )) &&
    detailRows(virtual.data["firewall-filter"]).some(
      (r) => r.action === "fasttrack-connection" && r.disabled !== "yes",
    )
  )
    throw new Error(
      "FastTrack aktif. Izinkan penonaktifannya pada tahap layanan atau tinjau pengecualian terlebih dahulu.",
    );
  let wan = q.internet.interface;
  if (q.internet.mode !== "keep") {
    bundle(`wan-${q.internet.mode}`, `${request.name}-isp`, {
      ...q.internet,
      distance: String(q.internet.distance),
    });
    if (q.internet.mode === "pppoe") wan = `AGENT-${request.name}-isp`;
  }
  const newSegments = q.segments.filter((s) => s.attachment === "new"),
    sharedBridge = `AGENT-${request.name}-lan`,
    vlanBridge = `AGENT-${request.name}-br`;
  if (newSegments.length && q.topology === "bridge") {
    add("bridge", {
      name: sharedBridge,
      "protocol-mode": "rstp",
      "vlan-filtering": "no",
    });
    for (const p of used) {
      if (p.role !== "lan" || p.segment !== newSegments[0].id)
        throw new Error(
          "LAN bersama memakai port LAN pada jaringan yang sama.",
        );
      add("bridge-port", { bridge: sharedBridge, interface: p.interface });
    }
    if (!used.length)
      throw new Error("Pilih minimal satu port LAN untuk bridge baru.");
  }
  if (newSegments.length && q.topology === "vlan") {
    if (new Set(newSegments.map((s) => s.vlan)).size !== newSegments.length)
      throw new Error("VLAN ID setiap jaringan baru harus unik.");
    add("bridge", {
      name: vlanBridge,
      "protocol-mode": "rstp",
      "vlan-filtering": "yes",
      pvid: "4094",
      "frame-types": "admit-only-vlan-tagged",
      "ingress-filtering": "yes",
    });
    for (const p of used) {
      if (p.role === "access") {
        const s = newSegments.find((s) => s.id === p.segment);
        if (!s) throw new Error("Pilih VLAN untuk setiap port access.");
        add("bridge-port", {
          bridge: vlanBridge,
          interface: p.interface,
          pvid: String(s.vlan),
          "ingress-filtering": "yes",
          "frame-types": "admit-only-untagged-and-priority-tagged",
        });
      } else if (p.role === "trunk") {
        if (
          !p.segments.length ||
          p.segments.some((id) => !newSegments.some((s) => s.id === id))
        )
          throw new Error("Pilih VLAN yang diizinkan pada trunk.");
        add("bridge-port", {
          bridge: vlanBridge,
          interface: p.interface,
          "ingress-filtering": "yes",
          "frame-types": "admit-only-vlan-tagged",
        });
      } else throw new Error("Desain VLAN menggunakan port access atau trunk.");
    }
    for (const s of newSegments) {
      const trunks = used
          .filter((p) => p.role === "trunk" && p.segments.includes(s.id))
          .map((p) => p.interface),
        access = used
          .filter((p) => p.role === "access" && p.segment === s.id)
          .map((p) => p.interface);
      if (!trunks.length && !access.length)
        throw new Error(
          `${s.label}: pilih minimal satu port access atau trunk.`,
        );
      add("bridge-vlan", {
        bridge: vlanBridge,
        "vlan-ids": String(s.vlan),
        tagged: [vlanBridge, ...trunks].join(","),
        untagged: access.join(","),
      });
      add("vlan", {
        name: `AGENT-${request.name}-${s.id}`,
        interface: vlanBridge,
        "vlan-id": String(s.vlan),
      });
    }
  }
  const targets = new Map<string, string>();
  for (const s of q.segments) {
    let target = s.interface;
    if (s.attachment === "new") {
      if (q.topology === "bridge") target = sharedBridge;
      else if (q.topology === "vlan") target = `AGENT-${request.name}-${s.id}`;
      else {
        const ports = used.filter(
          (p) => p.segment === s.id && p.role === "lan",
        );
        if (ports.length !== 1)
          throw new Error(
            `${s.label}: jaringan port terpisah memakai tepat satu port LAN.`,
          );
        target = ports[0].interface;
      }
      const params = {
        interface: target,
        address: s.address,
        range: s.range,
        dns: q.dns,
        disableFastTrack: q.disableFastTrack,
      };
      if (s.service === "hotspot")
        bundle("hotspot", `${request.name}-${s.id}`, {
          ...params,
          ...s.hotspot,
          wan,
          createPortal: true,
          sharedUsers: String(s.hotspot.sharedUsers),
        });
      else if (s.dhcp === "server")
        bundle("lan-dhcp", `${request.name}-${s.id}`, params);
      else bundle("management-ip", `${request.name}-${s.id}`, params);
      if (s.service !== "hotspot" && q.internet.mode === "keep")
        add("firewall-nat", {
          chain: "srcnat",
          action: "masquerade",
          "src-address": ipv4Subnet(s.address).network,
          "out-interface": wan,
        });
    }
    if (target === wan)
      throw new Error(
        "Interface internet tidak boleh menjadi interface LAN yang sama.",
      );
    targets.set(s.id, target);
    if (s.shaping !== "none")
      bundle(
        s.shaping === "pcq" ? "pcq" : "simple-queue",
        `${request.name}-${s.id}-q`,
        {
          target: ipv4Subnet(s.address).network,
          upload: s.upload,
          download: s.download,
          disableFastTrack: q.disableFastTrack,
        },
      );
  }
  if (
    q.topology === "routed" &&
    used.some(
      (p) => p.role !== "lan" || !newSegments.some((s) => s.id === p.segment),
    )
  )
    throw new Error("Pilih jaringan untuk semua port LAN terpisah.");
  if (q.firewall) {
    const input = `AGENT-${request.name}-in`,
      forward = `AGENT-${request.name}-fw`,
      lanList = `AGENT-${request.name}-LAN`,
      lanTargets = [...new Set(targets.values())];
    if (isolate && lanTargets.length !== q.segments.length)
      throw new Error(
        "Isolasi membutuhkan interface VLAN atau port berbeda untuk setiap jaringan. Dua subnet pada bridge yang sama masih berbagi layer 2.",
      );
    add("interface-list", { name: lanList });
    for (const target of lanTargets)
      add("interface-list-member", { list: lanList, interface: target });
    const rule = (chain: string, values: Record<string, string>) =>
      add("firewall-filter", { chain, ...values });
    rule(input, {
      action: "accept",
      "connection-state": "established,related,untracked",
    });
    rule(input, { action: "drop", "connection-state": "invalid" });
    rule(input, {
      action: "accept",
      "src-address": ipv4Subnet(request.managementSubnet).network,
    });
    rule(input, { action: "accept", protocol: "icmp" });
    for (const protocol of ["tcp", "udp"])
      rule(input, {
        action: "accept",
        protocol,
        "dst-port": "53",
        "in-interface-list": lanList,
      });
    if (q.segments.some((s) => s.dhcp !== "none"))
      rule(input, {
        action: "accept",
        protocol: "udp",
        "dst-port": "67",
        "in-interface-list": lanList,
      });
    rule(input, { action: "drop", "in-interface": wan });
    rule(input, { action: "return" });
    rule(forward, {
      action: "accept",
      "connection-state": "established,related,untracked",
    });
    rule(forward, { action: "drop", "connection-state": "invalid" });
    rule(forward, {
      action: "accept",
      "src-address": ipv4Subnet(request.managementSubnet).network,
    });
    if (isolate) {
      for (const target of lanTargets)
        rule(forward, {
          action: "return",
          "in-interface": target,
          "out-interface": target,
        });
      rule(forward, {
        action: "drop",
        "in-interface-list": lanList,
        "out-interface-list": lanList,
      });
    }
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
  }
  if (!result.operations.length || result.operations.length > 64)
    throw new Error(
      `Pilihan ini menghasilkan ${result.operations.length} operasi; batas satu rencana 64. Kurangi jaringan/layanan dan lanjutkan paket tambahan setelah tahap ini.`,
    );
  return result;
}
