/** Advice shown for a specific finding code. Prefix matches are supported (e.g. "brand-"). */
const ADVICE = [
  ["blocklisted", "This address is on a security blocklist. Close the page and do not download anything from it."],
  ["brand-login-page", "Do not sign in here. Open the real site by typing its address yourself or using your saved bookmark."],
  ["brand-", "Compare the address letter by letter with the official domain before trusting it. When in doubt, type the official address yourself."],
  ["password-over-http", "Never type a password into a page that is not served over HTTPS."],
  ["form-external", "The login form sends data elsewhere. Do not enter credentials."],
  ["domain-new", "The domain was registered very recently. That alone is not proof of a scam, but avoid paying or signing in until you can verify the business independently."],
  ["domain-young", "The domain is fairly new. Look for independent reviews and a verifiable company address before buying anything."],
  ["domain-expired", "The domain registration has lapsed, so the site may no longer belong to its original owner. Do not trust it."],
  ["domain-hold", "The registry has suspended this domain. Do not use the site."],
  ["ssl-invalid", "The certificate is not valid. Do not enter any personal or payment information."],
  ["ssl-missing", "The site has no working HTTPS. Do not submit forms on it."],
  ["shortener", "Short links hide their destination. Check the revealed destination in this report before opening the link."],
  ["ip-host", "Legitimate services almost never ask you to visit a raw IP address. Do not enter credentials."],
  ["embedded-credentials", "The part before the '@' is not the destination. Read the domain that comes after it."],
  ["punycode", "Look-alike characters can imitate a familiar name. Check the real domain shown in this report."],
  ["risky-download", "Do not open downloaded files from this link unless you fully trust the sender and the site."],
  ["redirect-blocked", "The link redirects somewhere a public website should not. Avoid it."],
  ["virustotal-", "Security vendors have flagged this address. Do not sign in, pay or download anything here."],
  ["redirect-downgrade", "The link ends on an unencrypted page. Do not submit information there."],
  ["redirect-cross-domain", "The link does not end where it starts. Judge the final destination, not the first address."],
  ["dns-no-address", "The site is currently offline or does not exist. Re-check the spelling of the address."],
  ["host-keywords", "Words like \"secure\", \"verify\" or \"login\" in an address are common in scam links. Go to the company's site yourself instead of following this link."],
  ["no-https-upgrade", "The site does not use HTTPS. Do not enter passwords or card details on it."],
  ["meta-refresh", "The page forwards you to another domain automatically. Check where you end up before entering anything."],
];

/** Advice for a check that could not run. Missing information is unknown, never safe. */
const UNAVAILABLE_ADVICE = {
  "domain-age": "The domain's registration date could not be found. Look the business up through an independent source before paying or signing in.",
  "safe-browsing": "Google's blocklist was not checked, so a known-dangerous site would not have been flagged here. Rescan later before you trust it.",
  ssl: "The site's security certificate could not be checked. Look for the padlock in your browser and avoid entering private details until you are sure.",
  content: "The page itself could not be read, so login forms and brand copying were not checked. Be extra careful with anything it asks for.",
};

const BASELINE = {
  safe: ["No major risk signals were found, but no scanner can guarantee a site is safe. Stay alert for unusual requests, and only enter passwords on addresses you reached yourself."],
  low: [
    "Double-check the address before entering passwords or card details.",
    "If you arrived here from an unexpected email or text, go to the site directly instead of using the link.",
  ],
  suspicious: [
    "Do not enter passwords, card numbers or one-time codes on this site.",
    "Verify the organization through an independent channel, such as its official app or a phone number you already trust.",
  ],
  high: [
    "Do not visit or interact with this site. Do not sign in, pay, or download anything.",
    "If you already entered a password here, change it now on the real service and turn on two-factor authentication.",
    "If you shared card or bank details, contact your bank immediately.",
  ],
};

/** The advice for one finding code, or null. Used for the per-check "what to do next" line. */
export function adviceForCode(code) {
  for (const [prefix, text] of ADVICE) {
    if (code === prefix || (prefix.endsWith("-") && code.startsWith(prefix))) return text;
  }
  return null;
}

export function buildRecommendations(level, breakdown, checks = []) {
  const specific = [];
  const codes = breakdown.flatMap((item) => item.reasons.map((reason) => reason.code));
  for (const [prefix, text] of ADVICE) {
    if (codes.some((code) => code === prefix || (prefix.endsWith("-") && code.startsWith(prefix)))) {
      if (!specific.includes(text)) specific.push(text);
    }
  }
  for (const check of checks) {
    if (check.status === "unavailable" && UNAVAILABLE_ADVICE[check.id]) specific.push(UNAVAILABLE_ADVICE[check.id]);
  }
  const baseline = BASELINE[level] || BASELINE.low;
  const combined = level === "high" || level === "suspicious" ? [...baseline, ...specific] : [...specific, ...baseline];
  if (level === "high" || level === "suspicious") {
    combined.push("Help protect others: report this site using the Report a Website form.");
  }
  return combined.slice(0, 7);
}
