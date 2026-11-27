import { fetchJson } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

/**
 * Google Safe Browsing lookup. It runs only when an API key is configured on the server.
 * The key never leaves the server and is never included in scan results.
 */

const GSB_EXPLANATION =
  "Google Safe Browsing is the blocklist that powers the red warning pages in Chrome, Firefox and Safari. A match is strong evidence. No match only means Google has not flagged the address yet; brand-new scam sites are often not listed.";

const THREAT_LABELS = {
  MALWARE: "malware",
  SOCIAL_ENGINEERING: "phishing or social engineering",
  UNWANTED_SOFTWARE: "unwanted software",
  POTENTIALLY_HARMFUL_APPLICATION: "a potentially harmful application",
};

export async function checkSafeBrowsing(urls, apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY) {
  const id = "safe-browsing";
  const title = "Google Safe Browsing";

  if (!apiKey) {
    // Not configured is "unavailable", never a pass: the blocklist was simply not consulted.
    return unavailable({
      id,
      title,
      summary: "The blocklist was not checked because this server has no Safe Browsing key.",
      explanation: GSB_EXPLANATION,
    });
  }

  let result;
  try {
    result = await fetchJson(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "scamshield-ai", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: Object.keys(THREAT_LABELS),
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [...new Set(urls)].slice(0, 5).map((url) => ({ url })),
        },
      }),
      timeoutMs: 6000,
    });
  } catch {
    result = null;
  }

  if (!result || !result.ok) {
    return unavailable({ id, title, summary: "Safe Browsing could not be reached.", explanation: GSB_EXPLANATION });
  }

  const matches = Array.isArray(result.data?.matches) ? result.data.matches : [];
  if (matches.length === 0) {
    return makeCheck({
      id,
      title,
      status: "pass",
      summary: "Not on Google's blocklist at the moment.",
      explanation: GSB_EXPLANATION,
      evidence: [{ label: "Addresses checked", value: [...new Set(urls)].join(", ") }],
    });
  }

  const threats = [...new Set(matches.map((match) => THREAT_LABELS[match.threatType] || match.threatType))];
  return makeCheck({
    id,
    title,
    findings: [{ code: "blocklisted", label: `Google Safe Browsing lists this address for ${threats.join(" and ")}`, points: 80 }],
    summary: `Listed by Google Safe Browsing for ${threats.join(" and ")}.`,
    explanation: GSB_EXPLANATION,
    evidence: matches.slice(0, 4).map((match) => ({ label: match.threatType, value: match.threat?.url })),
  });
}

/* ---------- VirusTotal (optional) ---------- */

const VT_EXPLANATION =
  "VirusTotal combines the verdicts of dozens of security vendors. It is an optional extra check: when it is not set up or has no record of the address, the result is unknown, never safe.";

/** VirusTotal identifies a URL by its unpadded base64url encoding. */
const vtUrlId = (url) => Buffer.from(url).toString("base64url");

/**
 * Optional VirusTotal lookup. Runs only when VIRUSTOTAL_API_KEY is set. Without a key, or when
 * VirusTotal has no existing analysis, it is "unavailable" with data.optional = true: it adds no
 * risk points and is not counted as a failed or missing core check.
 */
export async function checkVirusTotal(url, apiKey = process.env.VIRUSTOTAL_API_KEY) {
  const id = "virustotal";
  const title = "VirusTotal";

  if (!apiKey) {
    return unavailable({
      id,
      title,
      summary: "Not set up. This optional check was not run.",
      explanation: VT_EXPLANATION,
      data: { optional: true, reason: "not-configured" },
    });
  }

  let result;
  try {
    result = await fetchJson(`https://www.virustotal.com/api/v3/urls/${vtUrlId(url)}`, {
      headers: { "x-apikey": apiKey },
      timeoutMs: 6000,
    });
  } catch {
    result = null;
  }

  if (!result || !result.ok) {
    const notSeen = result?.status === 404;
    return unavailable({
      id,
      title,
      summary: notSeen ? "VirusTotal has no existing record of this address." : "VirusTotal could not be reached.",
      explanation: VT_EXPLANATION,
      data: { optional: true, reason: notSeen ? "no-record" : "unreachable" },
    });
  }

  const stats = result.data?.data?.attributes?.last_analysis_stats;
  const malicious = Number(stats?.malicious) || 0;
  const suspicious = Number(stats?.suspicious) || 0;
  const reviewed = malicious + suspicious + (Number(stats?.harmless) || 0) + (Number(stats?.undetected) || 0);
  const evidence = [
    { label: "Flagged as malicious", value: malicious },
    { label: "Flagged as suspicious", value: suspicious },
    { label: "Vendors that reviewed it", value: reviewed },
  ];
  const data = { optional: true, malicious, suspicious, reviewed };

  if (!stats || reviewed === 0) {
    return unavailable({
      id,
      title,
      summary: "VirusTotal returned no usable result.",
      explanation: VT_EXPLANATION,
      data: { optional: true, reason: "no-result" },
    });
  }
  if (malicious === 0 && suspicious === 0) {
    return makeCheck({
      id,
      title,
      status: "pass",
      summary: `None of the ${reviewed} security vendors flagged this address.`,
      explanation: VT_EXPLANATION,
      evidence,
      data,
    });
  }
  const plural = (n) => (n === 1 ? "" : "s");
  const findings =
    malicious > 0
      ? [
          {
            code: "virustotal-malicious",
            label: `${malicious} security vendor${plural(malicious)} flag this address as malicious`,
            points: malicious >= 5 ? 60 : malicious >= 2 ? 40 : 25,
          },
        ]
      : [
          {
            code: "virustotal-suspicious",
            label: `${suspicious} security vendor${plural(suspicious)} flag this address as suspicious`,
            points: 15,
          },
        ];
  return makeCheck({
    id,
    title,
    findings,
    summary:
      malicious > 0
        ? `${malicious} of ${reviewed} security vendors flag this address as malicious.`
        : `${suspicious} of ${reviewed} security vendors flag this address as suspicious.`,
    explanation: VT_EXPLANATION,
    evidence,
    data,
  });
}
