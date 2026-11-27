/**
 * Plain-English descriptions of every check, shared by the scanner (server) and the report (client).
 * No imports: this file must stay safe to bundle for the browser.
 *
 * tier "main"      one of the eight checks shown in the report's main grid and counted in its totals
 * tier "technical" extra context shown under "Advanced technical details"
 * tier "optional"  an add-on check that needs its own API key. It joins the totals only when it actually
 *                  ran; when unavailable it is listed separately, is not a failure and adds no risk
 */
export const MAIN_CHECK_IDS = ["domain-age", "ssl", "safe-browsing", "dns", "url-patterns", "impersonation", "redirects", "content"];

export const CHECK_INFO = {
  "domain-age": {
    tier: "main",
    label: "Domain registration",
    what: "When this domain name was first registered, and by which registrar, according to the official registry.",
    matters:
      "Most scam sites are only a few weeks old before they are reported and removed. A recent registration is a reason for care, not proof of fraud: many honest businesses are new, and older domains can be sold or hacked.",
  },
  ssl: {
    tier: "main",
    label: "Secure connection",
    what: "Whether the site has a valid security certificate (the padlock in your browser) for this exact address.",
    matters:
      "A valid certificate means your connection is encrypted. It does not show that the owner is trustworthy, because scam sites can get one for free. A missing or invalid certificate is a real warning sign.",
  },
  "safe-browsing": {
    tier: "main",
    label: "Google Safe Browsing",
    what: "Whether Google's Safe Browsing list has flagged this address for phishing or malware.",
    matters:
      "Browsers use this list to show red warning pages. A match is strong evidence. No match only means Google has not flagged it yet, and brand-new scam sites are often not listed.",
  },
  dns: {
    tier: "main",
    label: "Domain setup",
    what: "Whether the domain is fully set up to run a website and receive email.",
    matters:
      "Established organisations usually have a complete setup. A bare setup is common for throwaway sites, but it is not proof of anything by itself.",
  },
  "url-patterns": {
    tier: "main",
    label: "Suspicious link tricks",
    what: "Whether the web address uses tricks that scammers often rely on, such as look-alike characters, many hyphens or urgent wording.",
    matters: "Scam links are built to look familiar at a glance. Odd patterns in the address are an early warning.",
  },
  impersonation: {
    tier: "main",
    label: "Brand impersonation",
    what: "Whether the domain imitates the name of a well-known company or service.",
    matters:
      "Phishing sites copy a trusted name with a small spelling change so you trust them at a glance. Only the official address belongs to the real company.",
  },
  redirects: {
    tier: "main",
    label: "Where the link leads",
    what: "Where the link really ends up after any forwarding, and whether it started from a link shortener.",
    matters: "Scammers use redirects and short links to hide where a link leads. Normal sites usually forward at most once, for example from http to https.",
  },
  content: {
    tier: "main",
    label: "Page content",
    what: "What the page itself shows: login forms, where forms send what you type, and pages that pose as a known brand.",
    matters: "A login form that sends your password to a different domain, or a page that copies a brand it does not belong to, is a classic phishing sign.",
  },
  virustotal: {
    tier: "optional",
    label: "VirusTotal",
    what: "What dozens of security vendors say about this address, through VirusTotal.",
    matters: "Several vendors flagging the same address is strong evidence. Having no flags only means nobody has reported it yet.",
  },
  ip: {
    tier: "technical",
    label: "Hosting",
    what: "Which network hosts the site.",
    matters: "Context only. Most sites, good and bad, sit on large hosting providers, so this alone says little.",
  },
  http: {
    tier: "technical",
    label: "HTTP response",
    what: "Whether the site is online and how it answers.",
    matters: "Context only. It shows the site is reachable and what kind of server answered.",
  },
  shortener: {
    tier: "technical",
    label: "Link shortener",
    what: "Whether the address is a short link that hides its destination.",
    matters: "Short links hide where they lead until you open them.",
  },
};

export function checkTier(id) {
  return CHECK_INFO[id]?.tier || "main";
}

/** Optional checks count toward the totals only when they produced a real result. */
export const isOptionalCheck = (id) => CHECK_INFO[id]?.tier === "optional";
