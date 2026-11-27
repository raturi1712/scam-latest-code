import { BlockList, isIP } from "node:net";

/**
 * Address ranges the scanner must never connect to (SSRF protection).
 * Sources: IANA IPv4/IPv6 Special-Purpose Address Registries.
 */
const BLOCKED_RANGES = [
  // IPv4
  ["0.0.0.0", 8, "ipv4", "the unspecified 'this network' range"],
  ["10.0.0.0", 8, "ipv4", "a private network"],
  ["100.64.0.0", 10, "ipv4", "carrier-grade NAT space"],
  ["127.0.0.0", 8, "ipv4", "the loopback range (localhost)"],
  ["169.254.0.0", 16, "ipv4", "the link-local range (cloud metadata lives here)"],
  ["172.16.0.0", 12, "ipv4", "a private network"],
  ["192.0.0.0", 24, "ipv4", "an IETF protocol assignment range"],
  ["192.0.2.0", 24, "ipv4", "a documentation-only range"],
  ["192.88.99.0", 24, "ipv4", "a deprecated relay range"],
  ["192.168.0.0", 16, "ipv4", "a private network"],
  ["198.18.0.0", 15, "ipv4", "a benchmarking range"],
  ["198.51.100.0", 24, "ipv4", "a documentation-only range"],
  ["203.0.113.0", 24, "ipv4", "a documentation-only range"],
  ["224.0.0.0", 4, "ipv4", "the multicast range"],
  ["240.0.0.0", 4, "ipv4", "a reserved range"],
  // IPv6
  ["::", 128, "ipv6", "the unspecified address"],
  ["::1", 128, "ipv6", "the loopback address (localhost)"],
  ["::ffff:0:0", 96, "ipv6", "an IPv4-mapped address"],
  ["64:ff9b::", 96, "ipv6", "a NAT64 translation range"],
  ["64:ff9b:1::", 48, "ipv6", "a NAT64 translation range"],
  ["100::", 64, "ipv6", "a discard-only range"],
  ["2001::", 23, "ipv6", "an IETF protocol assignment range"],
  ["2001:db8::", 32, "ipv6", "a documentation-only range"],
  ["2002::", 16, "ipv6", "a 6to4 relay range"],
  ["fc00::", 7, "ipv6", "a private (unique local) network"],
  ["fe80::", 10, "ipv6", "the link-local range"],
  ["ff00::", 8, "ipv6", "the multicast range"],
].map(([network, prefix, family, label]) => {
  const list = new BlockList();
  list.addSubnet(network, prefix, family);
  return { list, label, family };
});

/**
 * Returns a description of why an address is blocked, or null if it is a public address.
 * Anything that is not a valid IP literal is treated as blocked.
 */
export function blockedReason(address) {
  const version = isIP(address);
  if (version === 0) return "not a valid IP address";
  const family = version === 4 ? "ipv4" : "ipv6";
  for (const range of BLOCKED_RANGES) {
    if (range.family === family && range.list.check(address, family)) return range.label;
  }
  // BlockList also matches IPv4 rules against IPv4-mapped IPv6 input; double-check explicitly.
  if (version === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return blockedReason(mapped[1]) || "an IPv4-mapped address";
  }
  return null;
}

export function isBlockedAddress(address) {
  return blockedReason(address) !== null;
}
