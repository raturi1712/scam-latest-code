/**
 * Shared input validation used by both forms (client) and route handlers (server).
 * Keep this file free of browser-only and Node-only APIs.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}

export function validateEmail(value) {
  if (!value || !value.trim()) return "Enter your email address.";
  if (!isEmail(value)) return "Enter a valid email address, like name@example.com.";
  return null;
}

export function validatePassword(value) {
  if (!value) return "Enter a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (value.length > 128) return "Use 128 characters or fewer.";
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

export function validateDisplayName(value) {
  const name = (value || "").trim();
  if (!name) return "Enter your name.";
  if (name.length < 2) return "Name must be at least 2 characters.";
  if (name.length > 60) return "Name must be 60 characters or fewer.";
  if (/[<>]/.test(name)) return "Name cannot contain < or >.";
  return null;
}

/** Remove control characters and trim. Output is still rendered as text, never as HTML. */
export function cleanText(value, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Light client-side URL check for instant form feedback.
 * The server performs the authoritative validation in lib/scanner/url.js.
 */
export function validateUrlInput(value) {
  const raw = (value || "").trim();
  if (!raw) return "Enter a website address to scan.";
  if (raw.length > 2048) return "That address is too long (2,048 characters max).";
  if (/\s/.test(raw)) return "A website address cannot contain spaces.";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return "That does not look like a valid website address.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http:// and https:// addresses can be scanned.";
  }
  if (!url.hostname.includes(".") && !url.hostname.includes(":")) {
    return "Enter a full domain, like example.com.";
  }
  return null;
}

export const REPORT_CATEGORIES = [
  { value: "phishing", label: "Phishing or fake login page" },
  { value: "fake-store", label: "Fake online store" },
  { value: "investment", label: "Investment or crypto scam" },
  { value: "impersonation", label: "Brand or government impersonation" },
  { value: "malware", label: "Malware or unwanted download" },
  { value: "tech-support", label: "Fake tech support" },
  { value: "other", label: "Something else" },
];

export const REPORT_REASONS = [
  { value: "lost-money", label: "I lost money or shared payment details" },
  { value: "shared-credentials", label: "I entered a password or personal data" },
  { value: "received-link", label: "I received the link by message or email" },
  { value: "saw-ad", label: "I saw it in an ad or search result" },
  { value: "looks-fake", label: "It looks fake, but I did not interact" },
  { value: "other", label: "Another reason" },
];

export function validateReport(input) {
  const errors = {};
  const urlError = validateUrlInput(input?.url);
  if (urlError) errors.url = urlError.replace("to scan", "to report");
  if (!REPORT_CATEGORIES.some((c) => c.value === input?.category)) {
    errors.category = "Choose a category.";
  }
  if (!REPORT_REASONS.some((r) => r.value === input?.reason)) {
    errors.reason = "Choose a reason for reporting.";
  }
  const description = cleanText(input?.description || "", 5000);
  if (description.length < 20) {
    errors.description = "Describe what happened in at least 20 characters.";
  } else if (description.length > 2000) {
    errors.description = "Keep the description under 2,000 characters.";
  }
  if (input?.contactEmail && !isEmail(input.contactEmail)) {
    errors.contactEmail = "Enter a valid email address, or leave this empty.";
  }
  return errors;
}
