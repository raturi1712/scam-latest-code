import { Resolver } from "node:dns/promises";
import { fetchJson } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

const ID = "ip";
const TITLE = "IP address information";

const EXPLANATION =
  "The IP address shows which network actually hosts the site. Most sites, good and bad, sit on large hosting or CDN providers, so this is mainly context: it helps you see whether the hosting matches what you would expect from the organization the site claims to be.";

/**
 * Fetch network ownership for an IP from the public RDAP system (the successor to WHOIS).
 * ARIN's RDAP server redirects to whichever regional registry (RIPE, APNIC, LACNIC, AFRINIC) owns the address.
 */
export async function lookupIpNetwork(address) {
  const { ok, data } = await fetchJson(`https://rdap.arin.net/registry/ip/${encodeURIComponent(address)}`, {
    headers: { Accept: "application/rdap+json, application/json" },
    timeoutMs: 5000,
  });
  if (!ok || !data) return null;

  const cidr = Array.isArray(data.cidr0_cidrs)
    ? data.cidr0_cidrs
        .map((entry) => `${entry.v4prefix || entry.v6prefix}/${entry.length}`)
        .filter((value) => !value.startsWith("undefined"))
        .join(", ")
    : null;

  return {
    name: data.name || null,
    handle: data.handle || null,
    country: data.country || null,
    range: cidr || (data.startAddress && data.endAddress ? `${data.startAddress} to ${data.endAddress}` : null),
    organization: findOrganization(data.entities),
  };
}

function findOrganization(entities) {
  if (!Array.isArray(entities)) return null;
  for (const entity of entities) {
    const fn = entity?.vcardArray?.[1]?.find((item) => item[0] === "fn")?.[3];
    if (fn && (entity.roles || []).some((role) => role === "registrant" || role === "administrative")) return fn;
  }
  for (const entity of entities) {
    const fn = entity?.vcardArray?.[1]?.find((item) => item[0] === "fn")?.[3];
    if (fn) return fn;
  }
  return null;
}

async function reverseLookup(address) {
  try {
    const resolver = new Resolver({ timeout: 2000, tries: 1 });
    const names = await resolver.reverse(address);
    return names[0] || null;
  } catch {
    return null;
  }
}

export async function checkIp(addresses) {
  if (!addresses || addresses.length === 0) {
    return unavailable({
      id: ID,
      title: TITLE,
      summary: "No IP address could be determined for this site.",
      explanation: EXPLANATION,
    });
  }

  const primary = addresses[0].address;
  const [network, reverse] = await Promise.all([lookupIpNetwork(primary).catch(() => null), reverseLookup(primary)]);

  const evidence = [
    { label: "Primary address", value: primary },
    { label: "All addresses", value: addresses.length > 1 ? addresses.map((entry) => entry.address).join(", ") : null },
    { label: "Reverse DNS", value: reverse || "None" },
    { label: "Network name", value: network?.name },
    { label: "Network owner", value: network?.organization },
    { label: "Network range", value: network?.range },
    { label: "Registered country", value: network?.country },
  ];

  return makeCheck({
    id: ID,
    title: TITLE,
    status: "info",
    summary: network
      ? `Hosted at ${primary} on the ${network.organization || network.name || "unknown"} network${network.country ? ` (${network.country})` : ""}.`
      : `Hosted at ${primary}. Network ownership details were unavailable.`,
    explanation: EXPLANATION,
    evidence,
  });
}
