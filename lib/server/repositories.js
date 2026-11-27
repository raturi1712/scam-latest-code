import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const SCANS = "scans";
const REPORTS = "reports";
export const MAX_HISTORY = 200;

const SUMMARY_FIELDS = ["userId", "url", "finalUrl", "domain", "hostname", "score", "level", "levelLabel", "scannedAt"];

function toSummary(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    url: data.url,
    finalUrl: data.finalUrl,
    domain: data.domain,
    hostname: data.hostname,
    score: data.score,
    level: data.level,
    levelLabel: data.levelLabel,
    scannedAt: data.scannedAt,
  };
}

/** A salted hash lets abuse be correlated without storing raw IP addresses. */
function hashIp(ip) {
  return createHash("sha256")
    .update(`${process.env.REPORT_HASH_SALT || "scamshield"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Store a scan. `uid` must come from a verified ID token, or be null for a visitor who is not
 * signed in. Anonymous scans have `userId: null`, so no history query, ownership check or
 * Firestore rule can ever match them: they are visible only in the Firebase console.
 */
export async function saveScan(uid, scan, { ip = "unknown" } = {}) {
  const ref = adminDb().collection(SCANS).doc();
  await ref.set({
    userId: uid || null,
    anonymous: !uid,
    ...(uid ? {} : { visitorHash: hashIp(ip) }),
    url: scan.url,
    finalUrl: scan.finalUrl,
    domain: scan.domain,
    hostname: scan.hostname,
    score: scan.score,
    level: scan.level,
    levelLabel: scan.levelLabel,
    scannedAt: scan.scannedAt,
    createdAt: FieldValue.serverTimestamp(),
    // The full report is stored as a JSON string: it is only ever read back whole,
    // and this keeps it out of Firestore's automatic indexes.
    result: JSON.stringify(scan),
  });
  return ref.id;
}

export async function listScans(uid, limit = MAX_HISTORY) {
  const snapshot = await adminDb()
    .collection(SCANS)
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .select(...SUMMARY_FIELDS)
    .get();
  return snapshot.docs.map(toSummary);
}

/**
 * Load one scan, enforcing ownership. Returns null both when the scan does not exist and
 * when it belongs to someone else, so callers cannot probe for other users' scan IDs.
 */
export async function getScan(uid, id) {
  const doc = await adminDb().collection(SCANS).doc(id).get();
  if (!doc.exists || doc.data().userId !== uid) return null;
  try {
    return { ...JSON.parse(doc.data().result), id: doc.id };
  } catch {
    return null;
  }
}

/** Delete one scan, enforcing ownership. Returns false if it was not the caller's scan. */
export async function deleteScan(uid, id) {
  const ref = adminDb().collection(SCANS).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().userId !== uid) return false;
  await ref.delete();
  return true;
}

/** Store a public suspicious-website report. */
export async function saveReport(report, { uid = null, ip = "unknown" } = {}) {
  const ref = adminDb().collection(REPORTS).doc();
  await ref.set({
    url: report.url,
    domain: report.domain,
    category: report.category,
    reason: report.reason,
    description: report.description,
    contactEmail: report.contactEmail || null,
    reporterUid: uid,
    reporterHash: hashIp(ip),
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export function isValidDocId(id) {
  return typeof id === "string" && /^[A-Za-z0-9]{10,40}$/.test(id);
}
