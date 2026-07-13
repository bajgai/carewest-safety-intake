import test from "node:test";
import assert from "node:assert/strict";
import { buildDataverseSubmission, createDataverseClient } from "../src/dataverse.js";

const fieldMap = {
  primaryName: "cwi_name",
  submissionId: "cwi_submissionid",
  externalReportId: "cwi_externalreportid",
  summary: "cwi_summary",
  description: "cwi_description",
  structuredPayloadJson: "cwi_structuredpayloadjson",
  azureDeliveryStatus: "cwi_azuredeliverystatus",
  azureDeliveryStatusValue: 781230001,
  receivedTime: "cwi_receivedtime",
  reporterName: "cwi_reportername",
  location: "cwi_location",
  siteLookup: "cwi_Site",
  siteEntitySet: "cwi_sites"
};
const submission = {
  reportId: "CW-TEST",
  submissionId: "submission-1",
  summary: "Synthetic review",
  description: "Synthetic test only",
  structuredPayload: { rating: 4 },
  reporterName: "Test Person",
  location: "Test corridor",
  receivedAt: "2026-07-13T12:00:00.000Z",
  priority: "Low",
  entryPoint: {
    defaultLocation: "Test default",
    templateVersion: "1",
    site: { dataverseId: "11111111-1111-4111-8111-111111111111" },
    program: { dataverseId: "" },
    dataverseId: ""
  }
};

test("maps a canonical submission without guessing unmapped choice fields", () => {
  const body = buildDataverseSubmission(submission, fieldMap);
  assert.equal(body.cwi_submissionid, "submission-1");
  assert.equal(body.cwi_azuredeliverystatus, 781230001);
  assert.equal(body["cwi_Site@odata.bind"], "/cwi_sites(11111111-1111-4111-8111-111111111111)");
  assert.equal("cwi_priority" in body, false);
});

test("upserts by deterministic record ID with a managed-identity token", async () => {
  const calls = [];
  const client = createDataverseClient({
    config: { orgUrl: "https://example.crm.dynamics.com", entitySet: "cwi_intakesubmissions", fieldMap },
    credentialImpl: { async getToken(scope) { assert.equal(scope, "https://example.crm.dynamics.com/.default"); return { token: "token" }; } },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 204, headers: { get: () => "https://example/entity" } };
    }
  });
  const result = await client.upsertSubmission({ recordId: "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa", submission });
  assert.match(calls[0].url, /cwi_intakesubmissions\(aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa\)$/);
  assert.equal(calls[0].options.method, "PATCH");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
  assert.equal(result.entityUrl, "https://example/entity");
});

test("returns a sanitized Dataverse delivery code", async () => {
  const client = createDataverseClient({
    config: { orgUrl: "https://example.crm.dynamics.com", entitySet: "cwi_intakesubmissions", fieldMap },
    credentialImpl: { async getToken() { return { token: "token" }; } },
    fetchImpl: async () => ({ status: 403, headers: { get: () => "" } })
  });
  await assert.rejects(
    client.upsertSubmission({ recordId: "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa", submission }),
    (error) => error.deliveryCode === "dataverse_http_403"
  );
});
