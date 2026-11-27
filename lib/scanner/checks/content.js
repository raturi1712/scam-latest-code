import { parse as parseDomain } from "tldts";
import { BRANDS, OFFICIAL_DOMAINS } from "../data/brands.js";
import { headerValue } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

const ID = "content";
const TITLE = "Page content signals";

const EXPLANATION =
  "The first part of the page's HTML is read as plain text. Nothing on the page is executed or rendered, and no forms are submitted. The check looks for login forms, forms that send data to a different domain, and pages that present themselves as a well-known brand while living on an unrelated domain.";

/** Static, regex-only inspection of an HTML string. Pure, for testing. */
export function inspectHtml(html, target) {
  const findings = [];
  const facts = { title: null, hasPasswordField: false, externalFormTargets: [], metaRefresh: null };

  const titleMatch = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  facts.title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 160) : null;

  facts.hasPasswordField = /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(html);

  const pageDomain = target.registrableDomain || target.hostname;
  const formActions = [...html.matchAll(/<form\b[^>]*\baction\s*=\s*["']?([^"'\s>]+)/gi)].map((match) => match[1]);
  for (const action of formActions.slice(0, 20)) {
    try {
      const resolved = new URL(decodeEntities(action), target.href);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      const actionDomain = parseDomain(resolved.hostname).domain || resolved.hostname;
      if (actionDomain !== pageDomain && !facts.externalFormTargets.includes(actionDomain)) {
        facts.externalFormTargets.push(actionDomain);
      }
    } catch {
      // Unparseable action attribute: ignore.
    }
  }

  const refresh = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'>\s]+)/i);
  if (refresh) {
    try {
      const resolved = new URL(decodeEntities(refresh[1]), target.href);
      const refreshDomain = parseDomain(resolved.hostname).domain || resolved.hostname;
      if (refreshDomain !== pageDomain) facts.metaRefresh = resolved.hostname;
    } catch {
      // ignore
    }
  }

  if (facts.hasPasswordField && target.protocol === "http:") {
    findings.push({
      code: "password-over-http",
      label: "The page asks for a password over an unencrypted connection",
      points: 25,
    });
  }

  if (facts.hasPasswordField && facts.externalFormTargets.length > 0) {
    findings.push({
      code: "form-external",
      label: `The page has a login form that sends what you type to a different domain (${facts.externalFormTargets.slice(0, 2).join(", ")})`,
      points: 15,
    });
  }

  // A page titled like a brand, with a login form, on a domain the brand does not own.
  if (facts.title && !OFFICIAL_DOMAINS.has(pageDomain)) {
    const titleLower = facts.title.toLowerCase();
    const brand = BRANDS.find(
      (entry) => !entry.generic && new RegExp(`(^|[^a-z])${escapeRegex(entry.name.toLowerCase())}([^a-z]|$)`).test(titleLower),
    );
    if (brand && facts.hasPasswordField) {
      findings.push({
        code: "brand-login-page",
        label: `The page presents itself as ${brand.name} and asks for a password, but ${pageDomain} is not an official ${brand.name} domain`,
        points: 30,
      });
    }
  }

  if (facts.metaRefresh) {
    findings.push({
      code: "meta-refresh",
      label: `The page automatically forwards visitors to another domain (${facts.metaRefresh})`,
      points: 6,
    });
  }

  return { findings, facts };
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkContent(chain) {
  if (!chain.final) {
    return unavailable({
      id: ID,
      title: TITLE,
      summary: "The page could not be downloaded, so its content was not inspected.",
      explanation: EXPLANATION,
    });
  }

  const { response, target } = chain.final;
  const contentType = headerValue(response.headers["content-type"]) || "";
  if (!/html|xml|text\/plain/i.test(contentType) && !/^\s*<(!doctype|html)/i.test(response.body)) {
    return makeCheck({
      id: ID,
      title: TITLE,
      status: "info",
      summary: `The address returned ${contentType || "non-HTML content"}, so there is no page to inspect.`,
      explanation: EXPLANATION,
      evidence: [{ label: "Content type", value: contentType || "Unknown" }],
    });
  }

  const { findings, facts } = inspectHtml(response.body, target);
  return makeCheck({
    id: ID,
    title: TITLE,
    findings,
    summary:
      findings.length > 0
        ? findings[0].label + "."
        : facts.hasPasswordField
          ? "The page contains a login form. No mismatch with its domain was detected."
          : "No login forms or deceptive page signals were detected.",
    explanation: EXPLANATION,
    evidence: [
      { label: "Page title", value: facts.title || "None" },
      { label: "Password field", value: facts.hasPasswordField ? "Yes" : "No" },
      { label: "Forms posting to other domains", value: facts.externalFormTargets.join(", ") || "None" },
      { label: "HTML inspected", value: `${Math.round(response.body.length / 1024)} KB${response.truncated ? " (size limit reached)" : ""}` },
    ],
  });
}
