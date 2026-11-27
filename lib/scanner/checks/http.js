import { URL_SHORTENERS } from "../data/lists.js";
import { headerValue } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

const HTTP_EXPLANATION =
  "The response status shows whether the site is actually online and what it answers with. Security headers such as HSTS and Content-Security-Policy are signs of a carefully maintained site; their absence is common and is shown for context only.";

const REDIRECT_EXPLANATION =
  "Redirects are normal (for example from http to https, or to a www address), but chains that hop across unrelated domains, drop from HTTPS to HTTP, or start from a link shortener are used to hide where a link really leads. Every hop was validated before it was followed.";

const SHORTENER_EXPLANATION =
  "Link shorteners hide the real destination until you click. They are widely used for legitimate reasons, but also by scammers in texts and emails because the link itself reveals nothing.";

export function checkHttpResponse(chain) {
  const id = "http";
  const title = "HTTP response";

  if (!chain.final) {
    const reason = chain.blocked?.reason || chain.error?.message || "The site did not respond.";
    return unavailable({
      id,
      title,
      core: true,
      summary: `No response could be read from the site. ${reason}`,
      explanation: HTTP_EXPLANATION,
      evidence: [{ label: "Failed at", value: chain.blocked?.url || chain.error?.url }],
    });
  }

  const { response, target } = chain.final;
  const headers = response.headers;
  const status = response.status;
  const findings = [];

  if (status >= 500) {
    findings.push({ code: "http-server-error", label: `The server answered with an error (HTTP ${status})`, points: 3 });
  } else if (status === 404 || status === 410) {
    findings.push({ code: "http-not-found", label: `The page does not exist (HTTP ${status})`, points: 3 });
  }

  const securityHeaders = [
    ["Strict-Transport-Security", headers["strict-transport-security"]],
    ["Content-Security-Policy", headers["content-security-policy"]],
    ["X-Frame-Options", headers["x-frame-options"]],
    ["X-Content-Type-Options", headers["x-content-type-options"]],
  ];
  const present = securityHeaders.filter(([, value]) => Boolean(value)).map(([name]) => name);

  return makeCheck({
    id,
    title,
    core: true,
    findings,
    status: findings.length === 0 && (status === 401 || status === 403) ? "info" : undefined,
    summary:
      status >= 200 && status < 300
        ? `The site is online and answered HTTP ${status}.`
        : `The site answered HTTP ${status}.`,
    explanation: HTTP_EXPLANATION,
    evidence: [
      { label: "Status", value: `HTTP ${status}` },
      { label: "Responding address", value: target.href },
      { label: "Server", value: headerValue(headers.server) },
      { label: "Content type", value: headerValue(headers["content-type"]) },
      { label: "Security headers present", value: present.join(", ") || "None" },
      { label: "Security headers missing", value: securityHeaders.filter(([, value]) => !value).map(([name]) => name).join(", ") || "None" },
    ],
  });
}

export function checkRedirects(chain, inputTarget) {
  const id = "redirects";
  const title = "Redirect chain";
  const hops = chain.hops;

  if (hops.length === 0) {
    return unavailable({
      id,
      title,
      summary: "The redirect chain could not be followed because the site did not respond.",
      explanation: REDIRECT_EXPLANATION,
    });
  }

  const findings = [];
  const redirectCount = hops.filter((hop) => hop.location).length;

  if (chain.blocked) {
    findings.push({
      code: "redirect-blocked",
      label: "The site redirects to an internal, private or otherwise invalid address, which a normal public website never does",
      points: 25,
    });
  }
  if (chain.error?.code === "too_many_redirects") {
    findings.push({ code: "redirect-loop", label: "The redirect chain is excessively long or loops", points: 10 });
  } else if (redirectCount >= 4) {
    findings.push({ code: "redirect-many", label: `The link passes through ${redirectCount} redirects`, points: 6 });
  }

  for (let index = 1; index < hops.length; index += 1) {
    if (hops[index - 1].protocol === "https:" && hops[index].protocol === "http:") {
      findings.push({
        code: "redirect-downgrade",
        label: "The chain drops from encrypted HTTPS to unencrypted HTTP",
        points: 15,
      });
      break;
    }
  }

  const domains = [...new Set(hops.map((hop) => hop.registrableDomain || hop.hostname))];
  const last = hops[hops.length - 1];
  const startDomain = inputTarget.registrableDomain || inputTarget.hostname;
  const endDomain = last.registrableDomain || last.hostname;
  if (domains.length >= 3) {
    findings.push({
      code: "redirect-cross-domain",
      label: `The chain crosses ${domains.length} different domains (${domains.join(" → ")})`,
      points: 8,
    });
  } else if (startDomain !== endDomain && !URL_SHORTENERS.has(startDomain)) {
    findings.push({
      code: "redirect-cross-domain",
      label: `The link lands on a different domain (${endDomain}) than the one you entered (${startDomain})`,
      points: 5,
    });
  }
  if (!last.location && last.protocol === "http:" && inputTarget.protocol === "http:") {
    findings.push({
      code: "no-https-upgrade",
      label: "The site stays on unencrypted HTTP and does not upgrade visitors to HTTPS",
      points: 5,
    });
  }

  const evidence = hops.map((hop, index) => ({
    label: `Hop ${index + 1} · HTTP ${hop.status}`,
    value: hop.location ? `${hop.url} → ${hop.location}` : `${hop.url} (final)`,
  }));
  if (chain.blocked) evidence.push({ label: "Blocked hop", value: `${chain.blocked.url}: ${chain.blocked.reason}` });
  if (chain.error && chain.final === null) evidence.push({ label: "Stopped", value: chain.error.message });

  return makeCheck({
    id,
    title,
    findings,
    summary:
      redirectCount === 0
        ? "No redirects: the address answers directly."
        : `${redirectCount} redirect${redirectCount === 1 ? "" : "s"}, ending at ${last.hostname}.`,
    explanation: REDIRECT_EXPLANATION,
    evidence,
  });
}

export function checkShortener(inputTarget, chain) {
  const id = "shortener";
  const title = "URL shortener";
  const domain = inputTarget.registrableDomain;
  const isShortener = Boolean(domain && (URL_SHORTENERS.has(domain) || URL_SHORTENERS.has(inputTarget.hostname)));

  if (!isShortener) {
    return makeCheck({
      id,
      title,
      status: "pass",
      summary: "The address is not a known link shortener.",
      explanation: SHORTENER_EXPLANATION,
      evidence: [{ label: "Services checked", value: `${URL_SHORTENERS.size} known shorteners` }],
    });
  }

  const destination = chain.final?.target;
  const revealed = destination && destination.hostname !== inputTarget.hostname;
  return makeCheck({
    id,
    title,
    findings: [
      {
        code: "shortener",
        label: revealed
          ? `The link is a ${domain} short link that hides its real destination (${destination.hostname})`
          : `The link is a ${domain} short link and its real destination could not be revealed`,
        points: revealed ? 8 : 15,
      },
    ],
    summary: revealed
      ? `Short link that leads to ${destination.hostname}. The remaining checks were run against that destination.`
      : "Short link whose destination could not be determined.",
    explanation: SHORTENER_EXPLANATION,
    evidence: [
      { label: "Shortener", value: domain },
      { label: "Real destination", value: revealed ? destination.href : "Unknown" },
    ],
  });
}
