/** Known URL shortening services (registrable domains). */
export const URL_SHORTENERS = new Set([
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly",
  "rebrand.ly", "rb.gy", "cutt.ly", "shorturl.at", "tiny.cc", "bl.ink", "lnkd.in", "t.ly",
  "s.id", "shorte.st", "adf.ly", "bit.do", "soo.gd", "clck.ru", "qr.ae", "trib.al", "dlvr.it",
  "snip.ly", "short.io", "tiny.one", "urlz.fr", "x.co", "chilp.it", "u.to", "kutt.it", "hyperurl.co",
  "linktr.ee", "lnk.to", "surl.li", "shorturl.com", "tr.ee", "zpr.io", "qrco.de", "me-qr.com",
  "t2m.io", "yourls.org", "1url.com", "rotf.lol", "wa.link", "fb.me", "youtu.be", "amzn.to",
  "amzn.in", "fkrt.it", "ift.tt", "cli.re", "shrtco.de", "ouo.io", "bc.vc", "tny.im", "lc.cx",
  "rplg.co", "t.me", "n9.cl", "cutt.us", "gg.gg", "han.gl", "vo.la", "dub.sh", "dub.co",
]);

/**
 * TLDs that are disproportionately used for abuse because registration is free or very cheap.
 * A TLD on this list is a weak signal on its own; plenty of legitimate sites use them.
 */
export const HIGH_ABUSE_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "top", "xyz", "click", "link", "work", "rest", "fit", "zip", "mov",
  "country", "stream", "download", "racing", "win", "bid", "loan", "date", "faith", "review",
  "party", "science", "cricket", "accountant", "men", "kim", "cam", "quest", "sbs", "cfd", "icu",
  "cyou", "monster", "buzz", "lol", "bond", "shop", "live", "support", "help", "vip", "pw", "cc",
  "su", "ws", "skin", "hair", "makeup", "beauty", "autos", "boats", "homes", "motorcycles",
  "yachts", "info", "online", "site", "website", "space", "fun", "club", "life", "today", "world",
]);

/** Words that phishing pages put in hostnames to sound official or urgent. */
export const SUSPICIOUS_KEYWORDS = [
  "login", "log-in", "signin", "sign-in", "verify", "verification", "secure", "security", "account",
  "update", "confirm", "banking", "wallet", "recover", "recovery", "unlock", "suspend", "billing",
  "invoice", "password", "authenticate", "auth", "validate", "webscr", "bonus", "giveaway", "prize",
  "winner", "claim", "airdrop", "reward", "refund", "kyc", "helpdesk", "customer-care", "customercare",
];

/** File extensions that deliver executable or installable content. */
export const RISKY_EXTENSIONS = [
  "exe", "scr", "bat", "cmd", "msi", "apk", "dmg", "pkg", "jar", "vbs", "ps1", "iso", "img", "lnk", "hta",
];
