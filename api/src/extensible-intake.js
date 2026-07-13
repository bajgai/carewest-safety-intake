import { createHash, randomBytes } from "node:crypto";
import { IntakeError } from "./intake.js";

const ALLOWED_FIELDS = new Set([
  "submissionId", "reporterName", "location", "summary", "description", "priority",
  "structuredPayload", "honeypot"
]);
const PRIORITIES = new Set(["Low", "Medium", "High", "Emergency"]);
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function validateStructured(value, depth = 0) {
  if (depth > 4) throw new IntakeError("Structured payload is too deeply nested");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new IntakeError("Structured payload contains an invalid number");
    return;
  }
  if (typeof value === "string") {
    if (value.length > 2000) throw new IntakeError("Structured payload value is too long");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 50) throw new IntakeError("Structured payload array is too large");
    value.forEach((item) => validateStructured(item, depth + 1));
    return;
  }
  if (!value || typeof value !== "object") throw new IntakeError("Structured payload contains an invalid value");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new IntakeError("Structured payload has too many fields");
  for (const [key, item] of entries) {
    if (BLOCKED_KEYS.has(key) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) {
      throw new IntakeError("Structured payload contains an invalid field name");
    }
    validateStructured(item, depth + 1);
  }
}

export function parseAndValidateExtensible(rawBody) {
  if (Buffer.byteLength(rawBody || "", "utf8") > 32_768) throw new IntakeError("Request is too large", 413);
  let value;
  try { value = JSON.parse(rawBody); } catch { throw new IntakeError("Request must be valid JSON"); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new IntakeError("Request must be an object");
  for (const key of Object.keys(value)) if (!ALLOWED_FIELDS.has(key)) throw new IntakeError(`Unknown field: ${key}`);
  for (const field of ["submissionId", "reporterName", "location", "summary", "description", "priority", "honeypot"]) {
    if (value[field] !== undefined && typeof value[field] !== "string") throw new IntakeError(`Field must be text: ${field}`);
  }
  const payload = {
    submissionId: String(value.submissionId || "").trim(),
    reporterName: String(value.reporterName || "").trim(),
    location: String(value.location || "").trim(),
    summary: String(value.summary || "").trim(),
    description: String(value.description || "").trim(),
    priority: String(value.priority || "Low").trim(),
    structuredPayload: value.structuredPayload || {},
    honeypot: String(value.honeypot || "").trim()
  };
  if (payload.honeypot) throw new IntakeError("Accepted", 202);
  if (!payload.submissionId || payload.submissionId.length > 128) throw new IntakeError("Invalid submission ID");
  if (!payload.description || payload.description.length > 4000) throw new IntakeError("Description is required and must be at most 4000 characters");
  if (!payload.summary) payload.summary = payload.description.slice(0, 240);
  if (payload.summary.length > 240) throw new IntakeError("Summary is too long");
  if (payload.reporterName.length > 120) throw new IntakeError("Reporter name is too long");
  if (payload.location.length > 240) throw new IntakeError("Location is too long");
  if (!PRIORITIES.has(payload.priority)) throw new IntakeError("Invalid priority");
  validateStructured(payload.structuredPayload);
  return payload;
}

export function makeIntakeReportId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  return `CW-${stamp}-${randomBytes(2).toString("hex")}`;
}

export function dataverseRecordId(submissionId) {
  const chars = createHash("sha256").update(`carewest-intake:${submissionId}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
