import { BRANDS, OFFICIAL_DOMAINS } from "../data/brands.js";
import { URL_SHORTENERS } from "../data/lists.js";
import { makeCheck } from "./check.js";

const ID = "impersonation";
const TITLE = "Typosquatting and brand impersonation";

const EXPLANATION =
  "Scammers register domains that look like trusted brands: swapped or missing letters (paypa1.com), the brand name glued to extra words (amazon-refund-help.com), or the brand placed in a subdomain of an unrelated site. The domain is compared against a list of commonly impersonated brands and their official domains.";

/** Characters commonly substituted to imitate other letters. */
const HOMOGLYPHS = {
  0: "o", 1: "l", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g", "!": "i", "|": "l", $: "s",
  // Cyrillic and Greek look-alikes that survive in Unicode hostnames
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w",
  α: "a", ο: "o", ν: "v", ρ: "p", τ: "t", υ: "u", ι: "i", κ: "k",
};

export function normalizeLookalikes(text) {
  const stripped = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  let out = "";
  for (const char of stripped) out += HOMOGLYPHS[char] ?? char;
  return out.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d");
}

/** Damerau-Levenshtein distance (insert, delete, substitute, transpose adjacent). */
export function editDistance(a, b) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

/**
 * Compare one domain against the brand list.
 * Returns { official: brand | null, matches: [{ brand, kind, points, label }] }.
 */
export function findImpersonation(target) {
  if (target.isIpHost || !target.registrableDomain) return { official: null, matches: [] };

  const domain = target.registrableDomain;
  if (OFFICIAL_DOMAINS.has(domain)) {
    return { official: BRANDS.find((brand) => brand.domains.includes(domain)) || null, matches: [] };
  }

  const unicodeSld = (target.unicodeHostname || target.hostname)
    .split(".")
    .slice(-(target.publicSuffix.split(".").length + 1))[0];
  const sldRaw = (target.domainWithoutSuffix || "").toLowerCase();
  const sldPlain = sldRaw.replace(/-/g, "");
  const sldLookalike = normalizeLookalikes(unicodeSld || sldRaw).replace(/-/g, "");
  const sldTokens = sldRaw.split("-").filter(Boolean);
  const tokenLookalikes = sldTokens.map((token) => normalizeLookalikes(token));
  const subdomainLabels = (target.subdomain || "").split(".").filter(Boolean);
  const subdomainTokens = subdomainLabels.flatMap((label) => label.split("-")).filter(Boolean);

  const matches = [];
  const seenBrands = new Set();
  const add = (brand, kind, points, label) => {
    if (seenBrands.has(brand.name)) return;
    seenBrands.add(brand.name);
    matches.push({ brand: brand.name, official: brand.domains[0], kind, points, label });
  };

  for (const brand of BRANDS) {
    const key = brand.keyword;
    const generic = Boolean(brand.generic);
    const long = key.length >= 6 && !generic;

    // 1. Same name, different ending: paypal.xyz
    if (sldPlain === key) {
      add(
        brand,
        "different-tld",
        generic ? 8 : 18,
        `Uses the ${brand.name} name on ${domain}, which is not one of the known official ${brand.name} domains (the main one is ${brand.domains[0]})`,
      );
      continue;
    }

    // 2. Look-alike characters: paypa1.com, arnazon.com
    if (sldLookalike === key && sldPlain !== key) {
      add(
        brand,
        "homoglyph",
        40,
        `"${unicodeSld}" imitates ${brand.name} using look-alike characters (the official domain is ${brand.domains[0]})`,
      );
      continue;
    }

    // 3. Near-miss spelling: paypall.com, amazn.com, gogle.com
    if (key.length >= 6 && !generic && brand.fuzzy !== false) {
      const allowed = key.length >= 9 ? 2 : 1;
      const distance = Math.min(editDistance(sldPlain, key), editDistance(sldLookalike, key));
      if (distance > 0 && distance <= allowed && Math.abs(sldPlain.length - key.length) <= allowed) {
        add(
          brand,
          "typo",
          35,
          `"${sldRaw}" is ${distance} character${distance === 1 ? "" : "s"} away from "${key}" (${brand.name}, official domain ${brand.domains[0]})`,
        );
        continue;
      }
    }

    // 4. Brand glued to other words: paypal-secure-login.com, amazonrefunds.net
    const exactHit = sldTokens.includes(key) || (long && sldPlain.includes(key));
    const lookalikeHit = !generic && (tokenLookalikes.includes(key) || (long && sldLookalike.includes(key)));
    if (exactHit) {
      add(
        brand,
        "combined",
        generic ? 10 : 30,
        generic
          ? `The domain ${domain} contains "${key}", which is also the name of a frequently impersonated brand (${brand.name})`
          : `The domain ${domain} contains the ${brand.name} name but is not an official ${brand.name} domain`,
      );
      continue;
    }
    if (lookalikeHit) {
      add(
        brand,
        "combined",
        35,
        `The domain ${domain} contains a look-alike spelling of ${brand.name} and is not an official ${brand.name} domain`,
      );
      continue;
    }

    // 5. Brand in a subdomain of an unrelated domain: paypal.com.account-check.io
    const subHit = subdomainTokens.includes(key) || (long && subdomainLabels.some((label) => label.includes(key)));
    if (subHit && !URL_SHORTENERS.has(domain)) {
      add(
        brand,
        "subdomain",
        generic ? 10 : 30,
        `"${key}" appears in the subdomain, but the real domain is ${domain}, which is not an official ${brand.name} domain`,
      );
    }
  }

  // Report the strongest matches first and cap the list.
  matches.sort((a, b) => b.points - a.points);
  return { official: null, matches: matches.slice(0, 3) };
}

export function checkImpersonation(target) {
  if (target.isIpHost) {
    return makeCheck({
      id: ID,
      title: TITLE,
      status: "info",
      summary: "Not applicable: the address is a raw IP, not a domain name.",
      explanation: EXPLANATION,
      evidence: [{ label: "Host", value: target.hostname }],
    });
  }

  const { official, matches } = findImpersonation(target);
  const evidence = [
    { label: "Registrable domain", value: target.registrableDomain },
    { label: "Brands compared", value: `${new Set(BRANDS.map((brand) => brand.name)).size} commonly impersonated brands` },
  ];

  if (official) {
    evidence.push({ label: "Recognized as", value: `Official ${official.name} domain` });
    return makeCheck({
      id: ID,
      title: TITLE,
      status: "pass",
      summary: `${target.registrableDomain} is a known official ${official.name} domain.`,
      explanation: EXPLANATION,
      evidence,
    });
  }

  // The strongest match carries full weight; additional brands add a little.
  const findings = matches.map((match, index) => ({
    code: `brand-${match.kind}`,
    label: match.label,
    points: index === 0 ? match.points : 5,
  }));
  for (const match of matches) {
    evidence.push({ label: `Resembles ${match.brand}`, value: `Official domain: ${match.official}` });
  }

  return makeCheck({
    id: ID,
    title: TITLE,
    findings,
    summary:
      matches.length === 0
        ? "The domain does not resemble any brand on the watch list."
        : `Possible imitation of ${matches.map((match) => match.brand).join(", ")}.`,
    explanation: EXPLANATION,
    evidence,
  });
}
