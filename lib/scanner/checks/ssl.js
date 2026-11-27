import tls from "node:tls";
import { makeCheck, unavailable } from "./check.js";

const ID = "ssl";
const TITLE = "SSL certificate";

const EXPLANATION =
  "A valid certificate means the connection is encrypted and the certificate matches the domain. It does NOT mean the site is trustworthy: certificates are free and issued automatically, and most phishing sites have one. A missing, expired or mismatched certificate, however, is a real warning sign.";

const DAY_MS = 86_400_000;

const TLS_ERRORS = {
  CERT_HAS_EXPIRED: "the certificate has expired",
  CERT_NOT_YET_VALID: "the certificate is not valid yet",
  DEPTH_ZERO_SELF_SIGNED_CERT: "the certificate is self-signed",
  SELF_SIGNED_CERT_IN_CHAIN: "the certificate chain contains a self-signed certificate",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "the certificate was not issued by a trusted authority",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "the certificate was not issued by a trusted authority",
  ERR_TLS_CERT_ALTNAME_INVALID: "the certificate was issued for a different domain",
  HOSTNAME_MISMATCH: "the certificate was issued for a different domain",
  CERT_REVOKED: "the certificate has been revoked",
};

/** Open a TLS connection to a vetted address and read the certificate. No HTTP is spoken. */
export function inspectCertificate(target, pinned, { timeoutMs = 6000, port = 443 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: pinned.address,
      port,
      servername: target.isIpHost ? undefined : target.hostname,
      // We want to read invalid certificates too; validity is reported via `authorized`.
      rejectUnauthorized: false,
      ALPNProtocols: ["http/1.1"],
    });
    const timer = setTimeout(() => {
      const error = new Error("TLS handshake timed out");
      error.code = "timeout";
      socket.destroy(error);
    }, timeoutMs);

    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      let hostnameError = null;
      if (certificate && !target.isIpHost) {
        hostnameError = tls.checkServerIdentity(target.hostname, certificate) || null;
      }
      const result = {
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
        hostnameMismatch: Boolean(hostnameError),
        protocol: socket.getProtocol(),
        subject: certificate?.subject?.CN || null,
        issuer: certificate?.issuer?.O || certificate?.issuer?.CN || null,
        validFrom: certificate?.valid_from ? new Date(certificate.valid_from) : null,
        validTo: certificate?.valid_to ? new Date(certificate.valid_to) : null,
        altNames: certificate?.subjectaltname
          ? certificate.subjectaltname
              .split(",")
              .map((name) => name.trim().replace(/^DNS:/, ""))
              .slice(0, 8)
          : [],
      };
      socket.end();
      resolve(result);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/** Turn certificate facts into findings. Pure, for testing. */
export function gradeCertificate(cert, now = Date.now()) {
  const findings = [];
  const expired = cert.validTo && cert.validTo.getTime() < now;
  const notYetValid = cert.validFrom && cert.validFrom.getTime() > now;

  if (expired) {
    findings.push({ code: "ssl-invalid", label: "The certificate has expired", points: 25 });
  } else if (notYetValid) {
    findings.push({ code: "ssl-invalid", label: "The certificate is not valid yet", points: 25 });
  } else if (cert.hostnameMismatch) {
    findings.push({ code: "ssl-invalid", label: "The certificate was issued for a different domain", points: 25 });
  } else if (!cert.authorized) {
    const reason = TLS_ERRORS[cert.authorizationError] || "it could not be verified against trusted authorities";
    findings.push({ code: "ssl-invalid", label: `The certificate is not trusted: ${reason}`, points: 25 });
  } else if (cert.validTo) {
    const daysLeft = (cert.validTo.getTime() - now) / DAY_MS;
    if (daysLeft < 5) {
      findings.push({
        code: "ssl-expiring",
        label: `The certificate expires in ${Math.max(0, Math.floor(daysLeft))} days and has not been renewed`,
        points: 3,
      });
    }
  }

  if (cert.protocol && /^(TLSv1|TLSv1\.1|SSLv3)$/.test(cert.protocol)) {
    findings.push({ code: "ssl-old-protocol", label: `The server negotiated the outdated ${cert.protocol} protocol`, points: 5 });
  }
  return findings;
}

export async function checkSsl(target, addresses, { inspect = inspectCertificate } = {}) {
  if (!addresses || addresses.length === 0) {
    return unavailable({
      id: ID,
      title: TITLE,
      core: true,
      summary: "The certificate could not be checked because the site's address is unknown.",
      explanation: EXPLANATION,
    });
  }

  const port = target.protocol === "https:" ? target.port : 443;
  let cert;
  try {
    cert = await inspect(target, addresses[0], { port });
  } catch (error) {
    if (error?.code === "ECONNREFUSED" || error?.code === "ECONNRESET" || /SSL|TLS|EPROTO/i.test(String(error?.code))) {
      return makeCheck({
        id: ID,
        title: TITLE,
        core: true,
        findings: [
          {
            code: "ssl-missing",
            label: "The site does not offer a working HTTPS connection, so anything you type could be intercepted",
            points: 15,
          },
        ],
        summary: "No working HTTPS connection is available.",
        explanation: EXPLANATION,
        evidence: [
          { label: "Port", value: port },
          { label: "Result", value: error.code },
        ],
      });
    }
    return unavailable({
      id: ID,
      title: TITLE,
      core: true,
      summary: "The certificate could not be retrieved (connection timed out or failed).",
      explanation: EXPLANATION,
      evidence: [{ label: "Port", value: port }],
    });
  }

  const findings = gradeCertificate(cert);
  const iso = (date) => (date ? date.toISOString().slice(0, 10) : "Unknown");
  const daysLeft = cert.validTo ? Math.floor((cert.validTo.getTime() - Date.now()) / DAY_MS) : null;
  const valid = !findings.some((finding) => finding.code === "ssl-invalid");

  return makeCheck({
    id: ID,
    title: TITLE,
    core: true,
    findings,
    summary: valid
      ? `Valid certificate from ${cert.issuer || "an unknown issuer"}, expiring ${iso(cert.validTo)}${daysLeft !== null ? ` (${daysLeft} days)` : ""}. Encryption alone does not make a site legitimate.`
      : findings[0].label + ".",
    explanation: EXPLANATION,
    evidence: [
      { label: "Trusted", value: valid ? "Yes" : "No" },
      { label: "Issued to", value: cert.subject },
      { label: "Issued by", value: cert.issuer },
      { label: "Valid from", value: iso(cert.validFrom) },
      { label: "Valid until", value: iso(cert.validTo) },
      { label: "Days remaining", value: daysLeft },
      { label: "Covers", value: cert.altNames.join(", ") },
      { label: "Protocol", value: cert.protocol },
      { label: "Verification error", value: valid ? null : cert.authorizationError },
    ],
  });
}
