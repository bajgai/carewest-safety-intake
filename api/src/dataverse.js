import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

function credential() {
  return process.env.AZURE_CLIENT_ID
    ? new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID })
    : new DefaultAzureCredential();
}

function requiredSetting(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required for Dataverse delivery`);
  return value;
}

export function loadDataverseConfig() {
  const orgUrl = requiredSetting("DATAVERSE_ORG_URL").replace(/\/$/, "");
  const entitySet = requiredSetting("DATAVERSE_INTAKE_ENTITY_SET");
  let fieldMap;
  try { fieldMap = JSON.parse(requiredSetting("DATAVERSE_FIELD_MAP_JSON")); }
  catch { throw new Error("DATAVERSE_FIELD_MAP_JSON must be valid JSON"); }
  const required = [
    "primaryName", "submissionId", "externalReportId", "summary", "description",
    "structuredPayloadJson", "azureDeliveryStatus", "receivedTime"
  ];
  if (!fieldMap || typeof fieldMap !== "object" || required.some((key) => typeof fieldMap[key] !== "string" || !fieldMap[key])) {
    throw new Error(`DATAVERSE_FIELD_MAP_JSON must define ${required.join(", ")}`);
  }
  if (!Number.isInteger(fieldMap.azureDeliveryStatusValue)) {
    throw new Error("DATAVERSE_FIELD_MAP_JSON must define numeric azureDeliveryStatusValue");
  }
  return { orgUrl, entitySet, fieldMap };
}

function set(body, key, value) {
  if (key && value !== undefined && value !== null && value !== "") body[key] = value;
}

export function buildDataverseSubmission(submission, fieldMap) {
  const body = {};
  set(body, fieldMap.primaryName, submission.summary || submission.reportId);
  set(body, fieldMap.submissionId, submission.submissionId);
  set(body, fieldMap.externalReportId, submission.reportId);
  set(body, fieldMap.summary, submission.summary);
  set(body, fieldMap.description, submission.description);
  set(body, fieldMap.structuredPayloadJson, JSON.stringify(submission.structuredPayload || {}));
  set(body, fieldMap.azureDeliveryStatus, fieldMap.azureDeliveryStatusValue);
  set(body, fieldMap.receivedTime, submission.receivedAt);
  set(body, fieldMap.reporterName, submission.reporterName);
  set(body, fieldMap.location, submission.location || submission.entryPoint.defaultLocation);
  set(body, fieldMap.priority, fieldMap.priorityValues?.[submission.priority]);
  set(body, fieldMap.sourceChannel, fieldMap.sourceChannelValue);
  set(body, fieldMap.templateVersion, submission.entryPoint.templateVersion);
  if (fieldMap.siteLookup && fieldMap.siteEntitySet && submission.entryPoint.site.dataverseId) {
    body[`${fieldMap.siteLookup}@odata.bind`] = `/${fieldMap.siteEntitySet}(${submission.entryPoint.site.dataverseId})`;
  }
  if (fieldMap.programLookup && fieldMap.programEntitySet && submission.entryPoint.program.dataverseId) {
    body[`${fieldMap.programLookup}@odata.bind`] = `/${fieldMap.programEntitySet}(${submission.entryPoint.program.dataverseId})`;
  }
  if (fieldMap.entryPointLookup && fieldMap.entryPointEntitySet && submission.entryPoint.dataverseId) {
    body[`${fieldMap.entryPointLookup}@odata.bind`] = `/${fieldMap.entryPointEntitySet}(${submission.entryPoint.dataverseId})`;
  }
  return body;
}

export function createDataverseClient({ fetchImpl = fetch, credentialImpl = credential(), config = loadDataverseConfig() } = {}) {
  return {
    async upsertSubmission({ recordId, submission }) {
      const token = await credentialImpl.getToken(`${config.orgUrl}/.default`);
      if (!token?.token) throw new Error("Dataverse access token is unavailable");
      const response = await fetchImpl(`${config.orgUrl}/api/data/v9.2/${config.entitySet}(${recordId})`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(buildDataverseSubmission(submission, config.fieldMap))
      });
      if (![200, 201, 204].includes(response.status)) {
        const error = new Error(`Dataverse HTTP ${response.status}`);
        error.deliveryCode = `dataverse_http_${response.status}`;
        throw error;
      }
      return { recordId, entityUrl: response.headers?.get?.("odata-entityid") || "" };
    }
  };
}
