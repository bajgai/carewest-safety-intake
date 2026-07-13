const ENTRY_POINT_PARTITION = "qr-entry";
const ENTRY_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class EntryPointError extends Error {
  constructor(message = "Entry point is unavailable", status = 404) {
    super(message);
    this.status = status;
  }
}

export function normalizeEntryKey(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!ENTRY_KEY_PATTERN.test(value)) throw new EntryPointError();
  return value;
}

function enabled(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function parseAllowedReportTypes(value) {
  if (!value) return [];
  let parsed;
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; } catch { throw new EntryPointError(); }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length > 120)) {
    throw new EntryPointError();
  }
  return parsed;
}

function validAt(entity, now) {
  if (!enabled(entity.active)) return false;
  const instant = now.getTime();
  const starts = entity.effectiveFrom ? Date.parse(entity.effectiveFrom) : Number.NEGATIVE_INFINITY;
  const ends = entity.effectiveTo ? Date.parse(entity.effectiveTo) : Number.POSITIVE_INFINITY;
  return Number.isFinite(starts) || starts === Number.NEGATIVE_INFINITY
    ? (Number.isFinite(ends) || ends === Number.POSITIVE_INFINITY) && instant >= starts && instant <= ends
    : false;
}

export async function resolveEntryPoint(storage, rawKey, now = new Date()) {
  const entryKey = normalizeEntryKey(rawKey);
  if (!storage.configTable) throw new Error("Entry-point configuration storage is unavailable");
  let entity;
  try {
    entity = await storage.configTable.getEntity(ENTRY_POINT_PARTITION, entryKey);
  } catch (error) {
    if (error.statusCode === 404) throw new EntryPointError();
    throw error;
  }
  if (!validAt(entity, now)) throw new EntryPointError();
  const required = ["displayName", "siteCode", "siteName", "programKey", "programName", "templateVersion"];
  if (required.some((field) => !entity[field])) throw new EntryPointError();
  return {
    entryKey,
    displayName: entity.displayName,
    urlSlug: entity.urlSlug || entryKey,
    site: { code: entity.siteCode, name: entity.siteName, dataverseId: entity.siteDataverseId || "" },
    program: { key: entity.programKey, name: entity.programName, dataverseId: entity.programDataverseId || "" },
    dataverseId: entity.entryPointDataverseId || "",
    defaultLocation: entity.defaultLocation || "",
    templateVersion: entity.templateVersion,
    allowedReportTypes: parseAllowedReportTypes(entity.allowedReportTypesJson),
    effectiveFrom: entity.effectiveFrom || "",
    effectiveTo: entity.effectiveTo || ""
  };
}

export function publicEntryPoint(entryPoint) {
  return {
    entryKey: entryPoint.entryKey,
    displayName: entryPoint.displayName,
    urlSlug: entryPoint.urlSlug,
    site: { code: entryPoint.site.code, name: entryPoint.site.name },
    program: { key: entryPoint.program.key, name: entryPoint.program.name },
    defaultLocation: entryPoint.defaultLocation,
    templateVersion: entryPoint.templateVersion,
    allowedReportTypes: entryPoint.allowedReportTypes
  };
}

export function toEntryPointEntity(input) {
  const entryKey = normalizeEntryKey(input.entryKey);
  const required = ["displayName", "siteCode", "siteName", "programKey", "programName", "templateVersion"];
  for (const field of required) {
    if (typeof input[field] !== "string" || !input[field].trim()) throw new Error(`${field} is required`);
  }
  for (const field of ["siteDataverseId", "programDataverseId", "entryPointDataverseId"]) {
    if (input[field] && !GUID_PATTERN.test(input[field])) throw new Error(`${field} must be a GUID`);
  }
  const allowedReportTypes = input.allowedReportTypes || [];
  if (!Array.isArray(allowedReportTypes) || allowedReportTypes.some((item) => typeof item !== "string")) {
    throw new Error("allowedReportTypes must be an array of strings");
  }
  return {
    partitionKey: ENTRY_POINT_PARTITION,
    rowKey: entryKey,
    displayName: input.displayName.trim(),
    urlSlug: String(input.urlSlug || entryKey).trim(),
    siteCode: input.siteCode.trim(),
    siteName: input.siteName.trim(),
    programKey: input.programKey.trim(),
    programName: input.programName.trim(),
    defaultLocation: String(input.defaultLocation || "").trim(),
    templateVersion: input.templateVersion.trim(),
    active: input.active === true,
    effectiveFrom: String(input.effectiveFrom || "").trim(),
    effectiveTo: String(input.effectiveTo || "").trim(),
    allowedReportTypesJson: JSON.stringify(allowedReportTypes),
    siteDataverseId: String(input.siteDataverseId || "").trim(),
    programDataverseId: String(input.programDataverseId || "").trim(),
    entryPointDataverseId: String(input.entryPointDataverseId || "").trim()
  };
}
