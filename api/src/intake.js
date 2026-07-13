import { createHash, randomBytes } from "node:crypto";

export const SITES = new Set([
  "Colonel Belcher", "Signal Point", "Sarcee", "Royal Park", "Garrison Green",
  "Glenmore Park", "Dr Fanning", "George Boyak", "Nickle House"
]);
export const REPORT_TYPES = new Set([
  "Hazard", "Incident", "Maintenance", "Feedback",
  "Chemical/Product Issue", "Cleaning Quality Concern"
]);
const URGENCY = new Set(["", "Low", "Medium", "High", "Emergency"]);
const AREA_SAFE = new Set(["", "Yes - I made it safe", "No - site manager help needed"]);
const INJURY = new Set(["", "No", "Yes - tell supervisor now", "Not sure"]);
const YES_NO = new Set(["", "Yes", "No"]);
const HAZARD_CATEGORY = new Set(["", "Slip, trip, fall", "Ergonomics", "Electrical", "Chemical", "Housekeeping", "Other"]);
const ALLOWED_FIELDS = new Set([
  "reportType", "site", "reporterName", "location", "description", "urgency",
  "areaSafeNow", "evidenceAvailable", "injuryFlag", "helpNeeded", "hazardCategory",
  "incidentDateTime", "incidentType", "bodyPart", "side", "witnessPresent",
  "witnessName", "witnessContact", "productName", "issueType", "concernType",
  "repeatIssue", "feedbackSuggestion", "honeypot", "submissionId"
]);

const MAX_LENGTH = {
  reporterName: 120, location: 240, description: 4000, helpNeeded: 2000,
  feedbackSuggestion: 2000, witnessName: 120, witnessContact: 240, productName: 240
};
const REQUIRED_BY_REPORT_TYPE = {
  Hazard: ["location", "urgency", "areaSafeNow", "evidenceAvailable", "injuryFlag", "hazardCategory"],
  Incident: ["location", "urgency", "areaSafeNow", "evidenceAvailable", "injuryFlag", "incidentDateTime", "incidentType", "witnessPresent"],
  Maintenance: ["location", "urgency", "evidenceAvailable"],
  Feedback: [],
  "Chemical/Product Issue": ["location", "urgency", "areaSafeNow", "evidenceAvailable", "issueType"],
  "Cleaning Quality Concern": ["location", "urgency", "areaSafeNow", "evidenceAvailable", "concernType", "repeatIssue"]
};

export class IntakeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function parseAndValidate(rawBody) {
  if (Buffer.byteLength(rawBody || "", "utf8") > 16_384) throw new IntakeError("Request is too large", 413);
  let value;
  try { value = JSON.parse(rawBody); } catch { throw new IntakeError("Request must be valid JSON"); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new IntakeError("Request must be an object");
  for (const key of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(key)) throw new IntakeError(`Unknown field: ${key}`);
    if (typeof value[key] !== "string") throw new IntakeError(`Field must be text: ${key}`);
  }
  const payload = Object.fromEntries([...ALLOWED_FIELDS].map((key) => [key, (value[key] || "").trim()]));
  if (payload.honeypot) throw new IntakeError("Accepted", 202);
  if (!REPORT_TYPES.has(payload.reportType)) throw new IntakeError("Invalid report type");
  if (!SITES.has(payload.site)) throw new IntakeError("Invalid site");
  if (!payload.submissionId || payload.submissionId.length > 128) throw new IntakeError("Invalid submission ID");
  if (!payload.description) throw new IntakeError("Description is required");
  if (!URGENCY.has(payload.urgency)) throw new IntakeError("Invalid urgency");
  if (!AREA_SAFE.has(payload.areaSafeNow)) throw new IntakeError("Invalid area-safe value");
  if (!INJURY.has(payload.injuryFlag)) throw new IntakeError("Invalid injury value");
  if (!HAZARD_CATEGORY.has(payload.hazardCategory)) throw new IntakeError("Invalid hazard category");
  if (!YES_NO.has(payload.evidenceAvailable) || !YES_NO.has(payload.repeatIssue) || !YES_NO.has(payload.witnessPresent)) {
    throw new IntakeError("Invalid yes/no value");
  }
  for (const field of REQUIRED_BY_REPORT_TYPE[payload.reportType]) {
    if (!payload[field]) throw new IntakeError(`${field} is required`);
  }
  for (const [key, limit] of Object.entries(MAX_LENGTH)) {
    if (payload[key].length > limit) throw new IntakeError(`${key} is too long`);
  }
  for (const [key, val] of Object.entries(payload)) {
    if (!(key in MAX_LENGTH) && val.length > 500) throw new IntakeError(`${key} is too long`);
  }
  return payload;
}

export function makeReportId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  return `HZ-${stamp}-${randomBytes(2).toString("hex")}`;
}

export function submissionKey(submissionId) {
  return createHash("sha256").update(submissionId).digest("hex");
}

export function payloadHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
