import { Resolver } from "node:dns/promises";
import { withTimeout } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

const ID = "dns";
const TITLE = "DNS records";

const EXPLANATION =
  "DNS records show where a domain points and how it is set up. Established organizations usually have name servers, mail (MX) records and email-authentication records (SPF, DMARC). A domain with only a bare address record is not necessarily bad, but throwaway scam domains often look like that.";

function createResolver() {
  return new Resolver({ timeout: 2500, tries: 2 });
}

/** One slow or unanswered query (large TXT records often are) must not stall the whole check. */
const QUERY_CAP_MS = 3500;

async function settle(promise) {
  try {
    return { ok: true, value: await withTimeout(promise, QUERY_CAP_MS, "DNS query timed out") };
  } catch (error) {
    return { ok: false, code: error?.code || "ERROR" };
  }
}

const EMPTY_CODES = new Set(["ENODATA", "ENOTFOUND", "NXDOMAIN"]);

/** Look up the common record types. Exposed separately so it can be tested with a fake resolver. */
export async function lookupRecords(target, resolver = createResolver()) {
  const host = target.hostname;
  const apex = target.registrableDomain || host;

  const [a, aaaa, cname, mx, ns, txt, dmarc] = await Promise.all([
    settle(resolver.resolve4(host)),
    settle(resolver.resolve6(host)),
    settle(resolver.resolveCname(host)),
    settle(resolver.resolveMx(apex)),
    settle(resolver.resolveNs(apex)),
    settle(resolver.resolveTxt(apex)),
    settle(resolver.resolveTxt(`_dmarc.${apex}`)),
  ]);

  const flattenTxt = (result) => (result.ok ? result.value.map((parts) => parts.join("")) : []);
  const txtRecords = flattenTxt(txt);

  return {
    a: a.ok ? a.value : [],
    aaaa: aaaa.ok ? aaaa.value : [],
    cname: cname.ok ? cname.value : [],
    mx: mx.ok ? mx.value.sort((x, y) => x.priority - y.priority).map((record) => record.exchange).filter(Boolean) : [],
    ns: ns.ok ? ns.value : [],
    spf: txtRecords.find((record) => record.toLowerCase().startsWith("v=spf1")) || null,
    dmarc: flattenTxt(dmarc).find((record) => record.toLowerCase().startsWith("v=dmarc1")) || null,
    // Lookups that failed for a reason other than "no such record". Their absence is not evidence.
    inconclusive: Object.entries({ MX: mx, TXT: txt, DMARC: dmarc })
      .filter(([, result]) => !result.ok && !EMPTY_CODES.has(result.code))
      .map(([name]) => name),
    // If every query failed with something other than "no such record", the resolver itself is down.
    resolverFailed: [a, aaaa, mx, ns, txt].every((result) => !result.ok && !EMPTY_CODES.has(result.code)),
    nxdomain: !a.ok && !aaaa.ok && a.code === "ENOTFOUND" && aaaa.code === "ENOTFOUND",
  };
}

export async function checkDns(target, { resolver } = {}) {
  if (target.isIpHost) {
    return makeCheck({
      id: ID,
      title: TITLE,
      core: true,
      status: "info",
      summary: "Not applicable: the address is a raw IP, so there are no DNS records to inspect.",
      explanation: EXPLANATION,
    });
  }

  let records;
  try {
    records = await lookupRecords(target, resolver);
  } catch {
    records = null;
  }

  if (!records || records.resolverFailed) {
    return unavailable({
      id: ID,
      title: TITLE,
      core: true,
      summary: "DNS records could not be retrieved.",
      explanation: EXPLANATION,
    });
  }

  const evidence = [
    { label: "A (IPv4)", value: records.a.join(", ") || "None" },
    { label: "AAAA (IPv6)", value: records.aaaa.join(", ") || "None" },
    { label: "CNAME", value: records.cname.join(", ") },
    { label: "Name servers", value: records.ns.slice(0, 6).join(", ") || "None found" },
    { label: "Mail servers (MX)", value: records.mx.slice(0, 5).join(", ") || "None" },
    { label: "SPF", value: records.spf ? records.spf.slice(0, 160) : records.inconclusive.includes("TXT") ? "Could not be looked up (timed out)" : "Not published" },
    { label: "DMARC", value: records.dmarc ? records.dmarc.slice(0, 160) : records.inconclusive.includes("DMARC") ? "Could not be looked up (timed out)" : "Not published" },
  ];

  const hasAddress = records.a.length > 0 || records.aaaa.length > 0;
  const findings = [];

  if (!hasAddress) {
    findings.push({
      code: "dns-no-address",
      label: "The hostname does not resolve to any IP address, so the site cannot currently be reached",
      points: 10,
    });
  } else if (records.inconclusive.length === 0 && records.mx.length === 0 && !records.spf && !records.dmarc) {
    // Only judged when every lookup actually answered; a timeout is not evidence of a bare setup.
    findings.push({
      code: "dns-bare",
      label: "The domain has no mail servers and no email-authentication records, which is typical of minimal or throwaway setups",
      points: 3,
    });
  }

  return makeCheck({
    id: ID,
    title: TITLE,
    core: true,
    findings,
    status: !hasAddress ? "fail" : undefined,
    summary: !hasAddress
      ? "The hostname does not resolve."
      : `Resolves to ${records.a.length + records.aaaa.length} address${records.a.length + records.aaaa.length === 1 ? "" : "es"}; ${records.ns.length} name server${records.ns.length === 1 ? "" : "s"}, ${records.mx.length} mail server${records.mx.length === 1 ? "" : "s"}.`,
    explanation: EXPLANATION,
    evidence,
  });
}
