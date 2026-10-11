export interface ConfigModule {
  id: string;
  title: string;
  category: string;
  menu: string;
  fields: string[];
  keys: string[];
  singleton?: boolean;
  physical?: boolean;
  ordered?: boolean;
  minVersion?: number;
  readOnly?: boolean;
}
const modules: ConfigModule[] = [];
const group = (
  category: string,
  entries: [string, string, string, string, string?][],
) => {
  for (const [id, title, menu, properties, flags = ""] of entries)
    modules.push({
      id,
      title,
      category,
      menu,
      fields: properties.split(" ").filter(Boolean),
      keys: flags.includes("S")
        ? []
        : ["name", "comment", "interface", "address", "list"],
      singleton: flags.includes("S"),
      physical: flags.includes("P"),
      ordered: flags.includes("O"),
      minVersion: flags.includes("7") ? 7 : undefined,
    });
};
group("IP & management", [
  ["identity", "Identitas router", "system identity", "name", "S"],
  [
    "ip-address",
    "Alamat IP / management",
    "ip address",
    "address interface network comment disabled",
  ],
  [
    "ip-services",
    "SSH, WinBox & API",
    "ip service",
    "name port address disabled certificate tls-version max-sessions",
    "P",
  ],
  [
    "dns",
    "DNS resolver",
    "ip dns",
    "servers allow-remote-requests cache-size max-udp-packet-size query-server-timeout query-total-timeout",
    "S",
  ],
  [
    "dns-static",
    "DNS statis",
    "ip dns static",
    "name address type ttl match-subdomain regexp forward-to comment disabled",
  ],
  ["ip-pool", "Pool alamat IPv4", "ip pool", "name ranges next-pool"],
  [
    "arp",
    "ARP statis",
    "ip arp",
    "address mac-address interface published comment disabled",
  ],
  [
    "neighbor-settings",
    "Discovery management",
    "ip neighbor discovery-settings",
    "discover-interface-list protocol mode",
    "S",
  ],
  [
    "mac-server",
    "Akses MAC server",
    "tool mac-server",
    "allowed-interface-list",
    "S",
  ],
  [
    "mac-winbox",
    "MAC WinBox",
    "tool mac-server mac-winbox",
    "allowed-interface-list",
    "S",
  ],
  [
    "management-users",
    "Akun administrator",
    "user",
    "name group address password comment disabled",
  ],
  [
    "management-groups",
    "Hak akses administrator",
    "user group",
    "name policy skin comment",
  ],
]);
group("Interface, bridge & VLAN", [
  ["interfaces", "Interface", "interface", "name mtu comment disabled", "P"],
  [
    "ethernet",
    "Ethernet",
    "interface ethernet",
    "name mtu auto-negotiation advertise speed full-duplex comment disabled",
    "P",
  ],
  [
    "bridge",
    "Bridge / switching",
    "interface bridge",
    "name protocol-mode vlan-filtering pvid ingress-filtering frame-types igmp-snooping comment disabled",
  ],
  [
    "bridge-port",
    "Port bridge / access / trunk",
    "interface bridge port",
    "bridge interface pvid ingress-filtering frame-types hw path-cost internal-path-cost comment disabled",
  ],
  [
    "bridge-vlan",
    "Tabel VLAN bridge",
    "interface bridge vlan",
    "bridge vlan-ids tagged untagged comment disabled",
  ],
  [
    "bridge-filter",
    "Firewall bridge",
    "interface bridge filter",
    "chain action in-interface out-interface mac-protocol src-mac-address dst-mac-address comment disabled",
    "O",
  ],
  [
    "bridge-nat",
    "NAT bridge",
    "interface bridge nat",
    "chain action in-interface out-interface to-src-mac-address to-dst-mac-address comment disabled",
    "O",
  ],
  [
    "vlan",
    "Interface VLAN",
    "interface vlan",
    "name interface vlan-id mtu use-service-tag comment disabled",
  ],
  [
    "bonding",
    "Bonding / LACP",
    "interface bonding",
    "name slaves mode link-monitoring lacp-rate transmit-hash-policy comment disabled",
  ],
  [
    "interface-list",
    "Daftar interface",
    "interface list",
    "name include exclude comment",
  ],
  [
    "interface-list-member",
    "Anggota daftar interface",
    "interface list member",
    "list interface comment disabled",
  ],
  [
    "switch",
    "Chip switch",
    "interface ethernet switch",
    "name cpu-flow-control",
    "P",
  ],
  [
    "switch-port",
    "Port chip switch",
    "interface ethernet switch port",
    "vlan-mode vlan-header default-vlan-id isolation-leakage",
    "P",
  ],
  [
    "switch-vlan",
    "VLAN chip switch",
    "interface ethernet switch vlan",
    "switch vlan-id ports independent-learning",
  ],
  [
    "switch-rule",
    "ACL chip switch",
    "interface ethernet switch rule",
    "switch ports vlan-id src-address dst-address new-dst-ports redirect-to-cpu comment disabled",
    "O",
  ],
]);
group("DHCP", [
  [
    "dhcp-server",
    "DHCP server",
    "ip dhcp-server",
    "name interface address-pool lease-time authoritative add-arp use-radius conflict-detection comment disabled",
  ],
  [
    "dhcp-network",
    "Subnet DHCP",
    "ip dhcp-server network",
    "address gateway dns-server domain ntp-server wins-server netmask comment",
  ],
  [
    "dhcp-lease",
    "Reservasi DHCP",
    "ip dhcp-server lease",
    "address mac-address client-id server comment always-broadcast use-src-mac-address block-access rate-limit disabled",
  ],
  [
    "dhcp-client",
    "DHCP client / ISP",
    "ip dhcp-client",
    "interface add-default-route default-route-distance use-peer-dns use-peer-ntp comment disabled",
  ],
  [
    "dhcp-option",
    "Opsi DHCP",
    "ip dhcp-server option",
    "name code value force",
  ],
  [
    "dhcp-option-set",
    "Paket opsi DHCP",
    "ip dhcp-server option sets",
    "name options",
  ],
]);
group("ISP, routing & PCC", [
  [
    "static-route",
    "Route statis / failover",
    "ip route",
    "dst-address gateway distance check-gateway routing-table routing-mark scope target-scope pref-src comment disabled",
  ],
  ["routing-table", "Routing table", "routing table", "name fib", "7"],
  [
    "routing-rule",
    "Policy routing",
    "routing rule",
    "action table src-address dst-address interface routing-mark comment disabled",
    "7",
  ],
  [
    "pppoe-client",
    "WAN PPPoE client",
    "interface pppoe-client",
    "name interface user password service-name add-default-route default-route-distance use-peer-dns max-mtu max-mru comment disabled",
  ],
  [
    "pppoe-server",
    "PPPoE server",
    "interface pppoe-server server",
    "service-name interface default-profile authentication max-mtu max-mru one-session-per-host comment disabled",
  ],
  [
    "bgp-connection",
    "BGP connection",
    "routing bgp connection",
    "name as router-id local.role remote.address remote.as routing-table output.network input.filter output.filter-chain comment disabled",
    "7",
  ],
  [
    "bgp-template",
    "BGP template",
    "routing bgp template",
    "name as router-id routing-table input.filter output.filter-chain disabled",
    "7",
  ],
  [
    "ospf-instance",
    "OSPF instance",
    "routing ospf instance",
    "name version router-id redistribute routing-table disabled",
    "7",
  ],
  [
    "ospf-area",
    "OSPF area",
    "routing ospf area",
    "name area-id instance type disabled",
  ],
  [
    "ospf-interface",
    "OSPF interface template",
    "routing ospf interface-template",
    "area interfaces networks type cost priority auth auth-id auth-key disabled",
    "7",
  ],
  [
    "routing-filter",
    "Filter routing",
    "routing filter rule",
    "chain rule comment disabled",
    "O7",
  ],
  ["vrf", "VRF", "ip vrf", "name interfaces comment disabled", "O7"],
  [
    "lte",
    "LTE modem",
    "interface lte",
    "name apn-profiles network-mode band disabled",
    "P",
  ],
  [
    "lte-apn",
    "Profil APN LTE",
    "interface lte apn",
    "name apn authentication user password add-default-route default-route-distance use-peer-dns",
  ],
]);
group("Firewall & NAT", [
  [
    "firewall-filter",
    "Firewall IPv4",
    "ip firewall filter",
    "chain action src-address dst-address src-address-list dst-address-list protocol src-port dst-port in-interface out-interface in-interface-list out-interface-list connection-state connection-nat-state log log-prefix comment disabled",
    "O",
  ],
  [
    "firewall-nat",
    "NAT / masquerade / port forwarding",
    "ip firewall nat",
    "chain action src-address dst-address protocol src-port dst-port in-interface out-interface out-interface-list to-addresses to-ports comment disabled",
    "O",
  ],
  [
    "firewall-mangle",
    "Mangle / PCC / packet marking",
    "ip firewall mangle",
    "chain action src-address dst-address src-address-list dst-address-list in-interface out-interface connection-state connection-mark packet-mark dst-address-type new-connection-mark new-routing-mark new-packet-mark per-connection-classifier passthrough comment disabled",
    "O",
  ],
  [
    "firewall-raw",
    "Firewall RAW / anti-abuse",
    "ip firewall raw",
    "chain action src-address dst-address src-address-list dst-address-list protocol src-port dst-port in-interface comment disabled",
    "O",
  ],
  [
    "firewall-address-list",
    "Address list",
    "ip firewall address-list",
    "list address timeout comment disabled",
  ],
  [
    "connection-tracking",
    "Connection tracking",
    "ip firewall connection tracking",
    "enabled tcp-established-timeout udp-timeout udp-stream-timeout loose-tcp-tracking liberal-tcp-tracking",
    "S",
  ],
]);
group("Bandwidth, PCQ & QoS", [
  [
    "simple-queue",
    "Simple Queue",
    "queue simple",
    "name target dst parent packet-marks queue priority max-limit limit-at burst-limit burst-threshold burst-time comment disabled",
    "O",
  ],
  [
    "queue-tree",
    "Queue Tree / HTB",
    "queue tree",
    "name parent packet-mark queue priority max-limit limit-at burst-limit burst-threshold burst-time bucket-size comment disabled",
  ],
  [
    "queue-type",
    "PCQ / FQ-CoDel / CAKE / queue type",
    "queue type",
    "name kind pcq-rate pcq-classifier pcq-limit pcq-total-limit fq-codel-limit fq-codel-memlimit cake-bandwidth cake-diffserv cake-flowmode",
  ],
  ["interface-queue", "Queue interface", "queue interface", "queue", "P"],
]);
group("HotSpot & autentikasi", [
  [
    "hotspot-server",
    "HotSpot server",
    "ip hotspot",
    "name interface address-pool profile idle-timeout keepalive-timeout addresses-per-mac comment disabled",
  ],
  [
    "hotspot-profile",
    "Profil server / portal",
    "ip hotspot profile",
    "name hotspot-address dns-name html-directory login-by use-radius radius-interim-update ssl-certificate",
  ],
  [
    "hotspot-user-profile",
    "Profil user / bandwidth HotSpot",
    "ip hotspot user profile",
    "name rate-limit shared-users session-timeout idle-timeout keepalive-timeout address-pool transparent-proxy",
  ],
  [
    "hotspot-user",
    "User / voucher HotSpot",
    "ip hotspot user",
    "name password profile server limit-uptime limit-bytes-total mac-address comment disabled",
  ],
  [
    "hotspot-ip-binding",
    "HotSpot IP binding",
    "ip hotspot ip-binding",
    "mac-address address to-address server type comment disabled",
  ],
  [
    "hotspot-walled-garden",
    "Walled garden HTTP",
    "ip hotspot walled-garden",
    "action dst-host dst-port path method server comment disabled",
    "O",
  ],
  [
    "hotspot-walled-garden-ip",
    "Walled garden IP",
    "ip hotspot walled-garden ip",
    "action src-address dst-address protocol dst-port server comment disabled",
    "O",
  ],
  [
    "radius",
    "RADIUS client",
    "radius",
    "address secret service authentication-port accounting-port timeout src-address comment disabled",
  ],
  ["radius-incoming", "RADIUS CoA", "radius incoming", "accept port", "S"],
  [
    "ppp-profile",
    "PPP profile",
    "ppp profile",
    "name local-address remote-address dns-server bridge rate-limit only-one use-encryption change-tcp-mss",
  ],
  [
    "ppp-secret",
    "Akun PPP",
    "ppp secret",
    "name password service profile local-address remote-address comment disabled",
  ],
  [
    "user-manager-user",
    "User Manager: user",
    "user-manager user",
    "name password group shared-users disabled",
    "7",
  ],
  [
    "user-manager-router",
    "User Manager: router",
    "user-manager router",
    "name address shared-secret disabled",
    "7",
  ],
  [
    "user-manager-profile",
    "User Manager: profile",
    "user-manager profile",
    "name starts-when validity name-for-users override-shared-users",
    "7",
  ],
]);
group("WiFi & CAPsMAN", [
  [
    "wifi",
    "WiFi modern / AX / AC wave2",
    "interface wifi",
    "name configuration configuration.mode configuration.ssid configuration.country security datapath channel disabled",
    "P7",
  ],
  [
    "wifi-configuration",
    "Profil WiFi modern",
    "interface wifi configuration",
    "name mode ssid country security datapath channel chains installation",
    "7",
  ],
  [
    "wifi-security",
    "Security WPA2/WPA3",
    "interface wifi security",
    "name authentication-types passphrase encryption management-protection wps",
    "7",
  ],
  [
    "wifi-channel",
    "Channel WiFi",
    "interface wifi channel",
    "name band frequency width skip-dfs-channels",
    "7",
  ],
  [
    "wifi-datapath",
    "Datapath WiFi / VLAN",
    "interface wifi datapath",
    "name bridge vlan-id client-isolation",
    "7",
  ],
  [
    "wifi-access-list",
    "ACL WiFi",
    "interface wifi access-list",
    "action mac-address interface signal-range time ssid-regexp comment disabled",
    "O7",
  ],
  [
    "wifi-capsman",
    "Controller WiFi CAPsMAN",
    "interface wifi capsman",
    "enabled interfaces upgrade-policy require-peer-certificate",
    "S7",
  ],
  [
    "wifi-cap",
    "CAP modern",
    "interface wifi cap",
    "enabled caps-man-addresses discovery-interfaces slaves-datapath",
    "S7",
  ],
  [
    "wifi-provisioning",
    "Provisioning WiFi CAPsMAN",
    "interface wifi provisioning",
    "action master-configuration slave-configurations supported-bands radio-mac identity-regexp name-format name-prefix disabled",
    "O7",
  ],
  [
    "wireless",
    "Wireless legacy",
    "interface wireless",
    "name mode ssid country band frequency channel-width security-profile vlan-mode vlan-id disabled",
    "P",
  ],
  [
    "wireless-security",
    "Security wireless legacy",
    "interface wireless security-profiles",
    "name mode authentication-types unicast-ciphers group-ciphers wpa2-pre-shared-key wpa-pre-shared-key management-protection",
  ],
  [
    "wireless-access-list",
    "ACL wireless legacy",
    "interface wireless access-list",
    "interface mac-address signal-range authentication forwarding comment disabled",
    "O",
  ],
  [
    "wireless-connect-list",
    "Connect list wireless",
    "interface wireless connect-list",
    "interface ssid mac-address security-profile connect comment disabled",
    "O",
  ],
  [
    "capsman-manager",
    "CAPsMAN legacy",
    "caps-man manager",
    "enabled interfaces require-peer-certificate upgrade-policy",
    "S",
  ],
  [
    "capsman-configuration",
    "Konfigurasi CAPsMAN legacy",
    "caps-man configuration",
    "name mode ssid country security datapath channel",
  ],
  [
    "capsman-security",
    "Security CAPsMAN legacy",
    "caps-man security",
    "name authentication-types encryption passphrase",
  ],
  [
    "capsman-channel",
    "Channel CAPsMAN legacy",
    "caps-man channel",
    "name band frequency control-channel-width extension-channel",
  ],
  [
    "capsman-datapath",
    "Datapath CAPsMAN legacy",
    "caps-man datapath",
    "name bridge local-forwarding client-to-client-forwarding vlan-mode vlan-id",
  ],
  [
    "capsman-provisioning",
    "Provisioning CAPsMAN legacy",
    "caps-man provisioning",
    "action master-configuration slave-configurations radio-mac identity-regexp name-format name-prefix disabled",
    "O",
  ],
  [
    "wireless-cap",
    "CAP legacy",
    "interface wireless cap",
    "enabled interfaces discovery-interfaces caps-man-addresses bridge",
    "S",
  ],
]);
group("VPN & tunnel", [
  [
    "wireguard",
    "WireGuard interface",
    "interface wireguard",
    "name listen-port mtu private-key comment disabled",
    "7",
  ],
  [
    "wireguard-peer",
    "Peer WireGuard",
    "interface wireguard peers",
    "interface public-key preshared-key allowed-address endpoint-address endpoint-port persistent-keepalive comment disabled",
    "7",
  ],
  [
    "ipsec-peer",
    "IPsec peer",
    "ip ipsec peer",
    "name address local-address exchange-mode profile passive comment disabled",
  ],
  [
    "ipsec-identity",
    "IPsec identity",
    "ip ipsec identity",
    "peer auth-method secret certificate remote-certificate my-id remote-id generate-policy policy-template-group comment disabled",
  ],
  [
    "ipsec-policy",
    "IPsec policy",
    "ip ipsec policy",
    "src-address dst-address sa-src-address sa-dst-address tunnel action level proposal peer comment disabled",
    "O",
  ],
  [
    "ipsec-profile",
    "IPsec profile",
    "ip ipsec profile",
    "name hash-algorithm enc-algorithm dh-group dpd-interval dpd-maximum-failures",
  ],
  [
    "ipsec-proposal",
    "IPsec proposal",
    "ip ipsec proposal",
    "name auth-algorithms enc-algorithms lifetime pfs-group disabled",
  ],
  [
    "ipsec-mode-config",
    "IPsec mode config",
    "ip ipsec mode-config",
    "name responder address-pool address-prefix-length split-include system-dns static-dns",
  ],
  [
    "l2tp-client",
    "L2TP client",
    "interface l2tp-client",
    "name connect-to user password profile use-ipsec ipsec-secret add-default-route default-route-distance comment disabled",
  ],
  [
    "l2tp-server",
    "L2TP server",
    "interface l2tp-server server",
    "enabled default-profile authentication use-ipsec ipsec-secret max-mtu max-mru",
    "S",
  ],
  [
    "sstp-client",
    "SSTP client",
    "interface sstp-client",
    "name connect-to port user password profile certificate verify-server-certificate add-default-route comment disabled",
  ],
  [
    "sstp-server",
    "SSTP server",
    "interface sstp-server server",
    "enabled port certificate default-profile authentication verify-client-certificate",
    "S",
  ],
  [
    "ovpn-client",
    "OpenVPN client",
    "interface ovpn-client",
    "name connect-to port protocol user password certificate auth cipher verify-server-certificate add-default-route comment disabled",
  ],
  [
    "ovpn-server",
    "OpenVPN server",
    "interface ovpn-server server",
    "enabled port protocol mode certificate auth cipher default-profile require-client-certificate",
    "S",
  ],
  [
    "gre",
    "GRE tunnel",
    "interface gre",
    "name local-address remote-address mtu keepalive ipsec-secret comment disabled",
  ],
  [
    "ipip",
    "IPIP tunnel",
    "interface ipip",
    "name local-address remote-address mtu keepalive ipsec-secret comment disabled",
  ],
  [
    "eoip",
    "EoIP tunnel",
    "interface eoip",
    "name local-address remote-address tunnel-id mtu keepalive ipsec-secret comment disabled",
  ],
  [
    "vxlan",
    "VXLAN",
    "interface vxlan",
    "name vni port local-address mtu comment disabled",
    "7",
  ],
  [
    "vxlan-vtep",
    "VXLAN VTEP",
    "interface vxlan vteps",
    "interface remote-ip comment disabled",
    "7",
  ],
]);
group("IPv6", [
  [
    "ipv6-address",
    "Alamat IPv6",
    "ipv6 address",
    "address interface advertise eui-64 from-pool comment disabled",
  ],
  ["ipv6-pool", "Pool IPv6", "ipv6 pool", "name prefix prefix-length comment"],
  [
    "ipv6-route",
    "Route IPv6",
    "ipv6 route",
    "dst-address gateway distance check-gateway routing-table comment disabled",
  ],
  [
    "ipv6-dhcp-client",
    "DHCPv6 client / PD",
    "ipv6 dhcp-client",
    "interface request pool-name pool-prefix-length add-default-route use-peer-dns comment disabled",
  ],
  [
    "ipv6-dhcp-server",
    "DHCPv6 server",
    "ipv6 dhcp-server",
    "name interface address-pool lease-time preference comment disabled",
  ],
  [
    "ipv6-nd",
    "Router advertisement / ND",
    "ipv6 nd",
    "interface advertise-dns dns managed-address-configuration other-configuration ra-interval ra-lifetime comment disabled",
  ],
  [
    "ipv6-filter",
    "Firewall IPv6",
    "ipv6 firewall filter",
    "chain action src-address dst-address protocol src-port dst-port in-interface out-interface connection-state comment disabled",
    "O",
  ],
  [
    "ipv6-mangle",
    "Mangle IPv6",
    "ipv6 firewall mangle",
    "chain action src-address dst-address new-connection-mark new-packet-mark passthrough comment disabled",
    "O",
  ],
  [
    "ipv6-raw",
    "RAW IPv6",
    "ipv6 firewall raw",
    "chain action src-address dst-address protocol in-interface comment disabled",
    "O",
  ],
  [
    "ipv6-address-list",
    "Address list IPv6",
    "ipv6 firewall address-list",
    "list address timeout comment disabled",
  ],
]);
group("Sistem & monitoring", [
  [
    "clock",
    "Waktu & timezone",
    "system clock",
    "time-zone-name time-zone-autodetect",
    "S",
  ],
  [
    "ntp-client",
    "NTP client",
    "system ntp client",
    "enabled mode servers primary-ntp secondary-ntp",
    "S",
  ],
  [
    "ntp-server",
    "NTP server",
    "system ntp server",
    "enabled broadcast multicast manycast use-local-clock local-clock-stratum",
    "S",
  ],
  [
    "logging",
    "Aturan logging",
    "system logging",
    "topics action prefix disabled",
  ],
  [
    "logging-action",
    "Tujuan syslog",
    "system logging action",
    "name target remote remote-port src-address syslog-facility syslog-severity",
  ],
  [
    "snmp",
    "SNMP",
    "snmp",
    "enabled contact location engine-id trap-target trap-version trap-community",
    "S",
  ],
  [
    "snmp-community",
    "Komunitas SNMP",
    "snmp community",
    "name addresses security read-access write-access authentication-protocol authentication-password encryption-protocol encryption-password",
  ],
  [
    "traffic-flow",
    "NetFlow / IPFIX",
    "ip traffic-flow",
    "enabled interfaces cache-entries active-flow-timeout inactive-flow-timeout",
    "S",
  ],
  [
    "traffic-flow-target",
    "Collector NetFlow",
    "ip traffic-flow target",
    "dst-address port version v9-template-refresh v9-template-timeout src-address disabled",
  ],
  [
    "graphing-interface",
    "Grafik interface",
    "tool graphing interface",
    "interface allow-address store-on-disk disabled",
  ],
  [
    "graphing-queue",
    "Grafik queue",
    "tool graphing queue",
    "simple-queue allow-address store-on-disk disabled",
  ],
  [
    "graphing-resource",
    "Grafik resource",
    "tool graphing resource",
    "allow-address store-on-disk disabled",
  ],
]);
for (const module of modules)
  if (module.id.startsWith("user-manager")) module.readOnly = true;
export const CONFIG_MODULES: readonly ConfigModule[] = modules;
export const configModule = (id: string) =>
  CONFIG_MODULES.find((m) => m.id === id);
export const isSecretField = (key: string) =>
  /(?:password|passwd|passphrase|secret|private-key|pre-shared-key|preshared-key|auth-key|authentication-key|encryption-key)$/i.test(
    key,
  );

export type ParamKind =
  | "text"
  | "interface"
  | "interfaces"
  | "address"
  | "subnet"
  | "ip"
  | "range"
  | "rate"
  | "number"
  | "secret"
  | "boolean"
  | "select"
  | "wans";
export interface RecipeField {
  key: string;
  label: string;
  kind: ParamKind;
  required?: boolean;
  hint?: string;
  options?: string[];
}
export interface Recipe {
  id: string;
  title: string;
  category: string;
  description: string;
  modules: string[];
  fields: RecipeField[];
  minVersion?: number;
}
const f = (
  key: string,
  label: string,
  kind: ParamKind = "text",
  hint?: string,
): RecipeField => ({ key, label, kind, required: kind !== "boolean", hint });
const lan = [
  f("interface", "Interface LAN", "interface"),
  f("address", "IP gateway LAN / prefix", "address"),
  f("range", "Rentang DHCP", "range"),
  f("dns", "DNS client (pisahkan koma)", "text"),
];
const shaping = [
  f("target", "Subnet / IP yang dibatasi", "subnet"),
  f("upload", "Total upload", "rate"),
  f("download", "Total download", "rate"),
  f(
    "disableFastTrack",
    "Izinkan menonaktifkan FastTrack untuk shaping",
    "boolean",
  ),
];
export const RECIPES: readonly Recipe[] = [
  {
    id: "management-ip",
    title: "Tambah IP management",
    category: "IP & management",
    description:
      "Menambahkan IP sekunder; alamat management lama dipertahankan.",
    modules: ["ip-address"],
    fields: [
      f("interface", "Interface management", "interface"),
      f("address", "Alamat management / prefix", "address"),
    ],
  },
  {
    id: "vlan",
    title: "Buat interface VLAN",
    category: "Interface, bridge & VLAN",
    description: "VLAN bertag pada parent yang dipilih.",
    modules: ["vlan"],
    fields: [
      f("interface", "Parent VLAN", "interface"),
      f("vlan", "VLAN ID (1–4094)", "number"),
    ],
  },
  {
    id: "bridge",
    title: "Bridge LAN baru",
    category: "Interface, bridge & VLAN",
    description: "Menggabungkan port bebas; port management tidak dipindahkan.",
    modules: ["bridge", "bridge-port"],
    fields: [f("ports", "Port anggota bridge", "interfaces")],
  },
  {
    id: "bridge-vlan",
    title: "VLAN access / trunk pada bridge",
    category: "Interface, bridge & VLAN",
    description:
      "Tabel VLAN, PVID access, dan VLAN filtering; membutuhkan jalur management cadangan.",
    modules: ["bridge", "bridge-port", "bridge-vlan"],
    fields: [
      f("bridge", "Bridge", "interface"),
      f("vlan", "VLAN ID", "number"),
      f(
        "tagged",
        "Port trunk bertag (sertakan bridge untuk CPU)",
        "interfaces",
      ),
      f("untagged", "Port access tanpa tag", "interfaces"),
    ],
  },
  {
    id: "lan-dhcp",
    title: "LAN + DHCP server",
    category: "DHCP",
    description:
      "IP gateway, pool, subnet DHCP dan server pada interface khusus.",
    modules: ["ip-address", "ip-pool", "dhcp-network", "dhcp-server"],
    fields: lan,
  },
  {
    id: "vlan-dhcp",
    title: "VLAN + IP + DHCP",
    category: "DHCP",
    description: "Segment LAN terpisah dengan VLAN, gateway dan DHCP.",
    modules: ["vlan", "ip-address", "ip-pool", "dhcp-network", "dhcp-server"],
    fields: [
      f("parent", "Parent VLAN", "interface"),
      f("vlan", "VLAN ID", "number"),
      ...lan.filter((p) => p.key !== "interface"),
    ],
  },
  {
    id: "dhcp-reservation",
    title: "Reservasi DHCP",
    category: "DHCP",
    description:
      "Lease statis MAC/IP; tidak me-renew atau menghapus sesi pengguna.",
    modules: ["dhcp-lease", "dhcp-server"],
    fields: [
      f("server", "Nama DHCP server"),
      f("ip", "IP reservasi", "ip"),
      f("mac", "MAC address"),
    ],
  },
  {
    id: "wan-dhcp",
    title: "ISP DHCP + NAT",
    category: "ISP, routing & PCC",
    description: "DHCP WAN, route otomatis dan masquerade terarah.",
    modules: ["dhcp-client", "firewall-nat"],
    fields: [
      f("interface", "Interface ISP", "interface"),
      f("distance", "Distance default route", "number"),
    ],
  },
  {
    id: "wan-static",
    title: "ISP IP statis + NAT",
    category: "ISP, routing & PCC",
    description: "Alamat WAN, gateway, default route dan NAT.",
    modules: ["ip-address", "static-route", "firewall-nat"],
    fields: [
      f("interface", "Interface ISP", "interface"),
      f("address", "IP WAN / prefix", "address"),
      f("gateway", "Gateway ISP", "ip"),
      f("distance", "Distance default route", "number"),
    ],
  },
  {
    id: "wan-pppoe",
    title: "ISP PPPoE + NAT",
    category: "ISP, routing & PCC",
    description:
      "PPPoE client dengan credential tersimpan terpisah dari script review.",
    modules: ["pppoe-client", "firewall-nat"],
    fields: [
      f("interface", "Interface ISP", "interface"),
      f("user", "Username PPPoE"),
      f("password", "Password PPPoE", "secret"),
      f("distance", "Distance default route", "number"),
    ],
  },
  {
    id: "failover",
    title: "Failover multi ISP",
    category: "ISP, routing & PCC",
    description:
      "Default route dengan prioritas berurutan dan check-gateway ping. Pemeriksaan gateway bukan pemeriksaan seluruh internet.",
    modules: ["static-route", "firewall-nat"],
    fields: [f("wans", "ISP dan gateway", "wans")],
  },
  {
    id: "pcc",
    title: "PCC multi ISP berbobot",
    category: "ISP, routing & PCC",
    description:
      "Connection mark, routing table, pengecualian jaringan lokal, NAT dan route ROS7. Ditolak pada router dengan HotSpot aktif.",
    modules: [
      "routing-table",
      "static-route",
      "firewall-mangle",
      "firewall-address-list",
      "firewall-nat",
      "firewall-filter",
    ],
    minVersion: 7,
    fields: [
      f("lan", "Interface LAN", "interface"),
      f("subnet", "Subnet LAN", "subnet"),
      f("wans", "ISP, gateway dan bobot", "wans"),
      f("disableFastTrack", "Izinkan menonaktifkan FastTrack", "boolean"),
    ],
  },
  {
    id: "pcq",
    title: "PCQ pembagian bandwidth",
    category: "Bandwidth, PCQ & QoS",
    description:
      "Membagi plafon bandwidth antara IP client yang aktif, dengan classifier upload/download. Batas total diisi sesuai kapasitas ISP.",
    modules: ["queue-type", "simple-queue", "firewall-filter"],
    fields: shaping,
  },
  {
    id: "simple-queue",
    title: "Batas bandwidth IP / subnet",
    category: "Bandwidth, PCQ & QoS",
    description: "Simple queue terarah tanpa mengubah profil user lain.",
    modules: ["simple-queue", "firewall-filter"],
    fields: shaping,
  },
  {
    id: "queue-tree",
    title: "QoS Queue Tree + PCQ",
    category: "Bandwidth, PCQ & QoS",
    description: "Packet marking upload/download dan parent HTB per arah.",
    modules: ["queue-type", "queue-tree", "firewall-mangle", "firewall-filter"],
    fields: [
      ...shaping,
      f("wan", "Interface uplink", "interface"),
      f("priority", "Prioritas (1–8)", "number"),
    ],
  },
  {
    id: "firewall-baseline",
    title: "Firewall proteksi router",
    category: "Firewall & NAT",
    description:
      "Chain khusus, established/related, management, ICMP, DNS/DHCP LAN dan proteksi input WAN; rule lama dipertahankan.",
    modules: ["firewall-filter"],
    fields: [
      f("wan", "Interface WAN", "interface"),
      f("lan", "Interface LAN", "interface"),
      f(
        "management",
        "Subnet administrator yang terlihat oleh router",
        "subnet",
      ),
    ],
  },
  {
    id: "port-forward",
    title: "Port forwarding",
    category: "Firewall & NAT",
    description:
      "DST-NAT dari interface WAN ke server; akses dibatasi source yang ditentukan.",
    modules: ["firewall-nat"],
    fields: [
      f("wan", "Interface WAN", "interface"),
      { ...f("protocol", "Protokol", "select"), options: ["tcp", "udp"] },
      f("port", "Port eksternal", "number"),
      f("server", "IP server", "ip"),
      f("serverPort", "Port server", "number"),
      f("source", "Subnet source yang diizinkan", "subnet"),
    ],
  },
  {
    id: "block-source",
    title: "Blokir source IP / subnet",
    category: "Firewall & NAT",
    description:
      "Address-list dan RAW drop untuk source terarah; tidak boleh mencakup subnet administrator.",
    modules: ["firewall-address-list", "firewall-raw"],
    fields: [f("source", "Source yang diblokir", "subnet")],
  },
  {
    id: "vlan-isolation",
    title: "Isolasi antar subnet / VLAN",
    category: "Firewall & NAT",
    description: "Drop forwarding dua arah di antara subnet yang ditentukan.",
    modules: ["firewall-filter"],
    fields: [
      f("subnetA", "Subnet A", "subnet"),
      f("subnetB", "Subnet B", "subnet"),
    ],
  },
  {
    id: "hotspot",
    title: "HotSpot + DHCP + profil user",
    category: "HotSpot & autentikasi",
    description:
      "HotSpot baru pada interface khusus; portal lama dan sesi user lain dipertahankan.",
    modules: [
      "hotspot-server",
      "hotspot-profile",
      "hotspot-user-profile",
      "ip-address",
      "ip-pool",
      "dhcp-network",
      "dhcp-server",
      "hotspot-user",
      "firewall-nat",
      "firewall-filter",
      "dns",
    ],
    fields: [
      ...lan,
      f("domain", "Domain portal lokal"),
      f(
        "createPortal",
        "Buat portal bawaan di direktori AGENT baru",
        "boolean",
      ),
      {
        ...f(
          "html",
          "Direktori portal yang tersedia (kosongkan bila membuat portal baru)",
        ),
        required: false,
      },
      f("wan", "Interface internet HotSpot", "interface"),
      f("user", "Username HotSpot awal"),
      f("password", "Password HotSpot awal", "secret"),
      f(
        "disableFastTrack",
        "Izinkan menonaktifkan FastTrack untuk limit HotSpot",
        "boolean",
      ),
      f("upload", "Upload per login", "rate"),
      f("download", "Download per login", "rate"),
      f("sharedUsers", "Login bersamaan per akun", "number"),
    ],
  },
  {
    id: "hotspot-user",
    title: "User / voucher HotSpot",
    category: "HotSpot & autentikasi",
    description:
      "Akun HotSpot baru dengan profil dan batas uptime yang dipilih.",
    modules: ["hotspot-user", "hotspot-user-profile"],
    fields: [
      f("user", "Username voucher"),
      f("password", "Password voucher", "secret"),
      f("profile", "Profil user yang tersedia"),
      f("uptime", "Batas uptime, misalnya 1d atau 0"),
    ],
  },
  {
    id: "hotspot-profile",
    title: "Profil bandwidth HotSpot baru",
    category: "HotSpot & autentikasi",
    description:
      "Profil baru; profil serta sesi yang sudah aktif tidak diubah.",
    modules: ["hotspot-user-profile"],
    fields: [
      f("upload", "Upload per login", "rate"),
      f("download", "Download per login", "rate"),
      f("sharedUsers", "Login bersamaan", "number"),
    ],
  },
  {
    id: "wifi",
    title: "WiFi modern WPA2/WPA3",
    category: "WiFi & CAPsMAN",
    description:
      "Profil keamanan dan SSID baru lalu diterapkan pada radio WiFi yang dipilih.",
    modules: ["wifi", "wifi-security", "wifi-configuration"],
    minVersion: 7,
    fields: [
      f("interface", "Radio WiFi", "interface"),
      f("ssid", "SSID"),
      f("country", "Regulatory country RouterOS"),
      f("password", "Passphrase (8–63 karakter)", "secret"),
    ],
  },
  {
    id: "wireless",
    title: "WiFi legacy WPA2",
    category: "WiFi & CAPsMAN",
    description:
      "Security profile WPA2 dan SSID AP untuk paket wireless legacy.",
    modules: ["wireless", "wireless-security"],
    fields: [
      f("interface", "Radio wireless", "interface"),
      f("ssid", "SSID"),
      f("country", "Regulatory country RouterOS"),
      f("password", "Passphrase (8–63 karakter)", "secret"),
    ],
  },
  {
    id: "wireguard",
    title: "WireGuard management / site-to-site",
    category: "VPN & tunnel",
    description:
      "Interface, alamat tunnel dan peer dengan public key yang diberikan; private key dibuat oleh RouterOS.",
    modules: ["wireguard", "wireguard-peer", "ip-address"],
    minVersion: 7,
    fields: [
      f("port", "Listen port", "number"),
      f("address", "IP tunnel / prefix", "address"),
      f("publicKey", "Public key peer"),
      f("allowed", "Allowed address peer", "subnet"),
      f("endpoint", "Alamat endpoint peer"),
      f("endpointPort", "Port endpoint peer", "number"),
    ],
  },
  {
    id: "capsman",
    title: "WiFi CAPsMAN modern",
    category: "WiFi & CAPsMAN",
    description:
      "Controller, security, SSID dan provisioning; memerlukan radio/package yang sesuai.",
    modules: [
      "wifi-capsman",
      "wifi-security",
      "wifi-configuration",
      "wifi-provisioning",
    ],
    minVersion: 7,
    fields: [
      f("interfaces", "Interface management CAP", "interfaces"),
      f("ssid", "SSID"),
      f("country", "Regulatory country"),
      f("password", "Passphrase WPA2/WPA3", "secret"),
      {
        ...f("bands", "Band CAP", "select"),
        options: ["2ghz-ax", "5ghz-ax", "2ghz-n", "5ghz-ac"],
      },
    ],
  },
];
export interface ConfigOperation {
  moduleId: string;
  action: "add" | "set" | "remove" | "enable" | "disable";
  selector: Record<string, string>;
  values: Record<string, string>;
  originalValues?: Record<string, string>;
  first?: boolean;
}
export interface AutomationEvidence {
  id: string;
  routerId: string;
  createdAt: string;
  targetHash: string;
  identity: string;
  version: string;
  data: Record<string, string>;
  errors: Record<string, string>;
}
export interface AutomationRequest {
  routerId: string;
  name: string;
  recipeId?: string;
  params?: Record<string, unknown>;
  operations?: ConfigOperation[];
  evidenceId: string;
  managementSubnet: string;
  managementInterface: string;
  alternateAccess: boolean;
}
