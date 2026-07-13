import test from "node:test";
import assert from "node:assert/strict";
import { dataverseRecordId, parseAndValidateExtensible } from "../src/extensible-intake.js";

const valid = {
  submissionId: "submission-1",
  reporterName: "Test Person",
  location: "Test corridor",
  summary: "Test cleaning review",
  description: "Synthetic test only",
  priority: "Low",
  structuredPayload: { reportType: "Cleaning Quality Concern", repeatIssue: false },
  honeypot: ""
};

test("accepts a bounded program-specific payload", () => {
  const parsed = parseAndValidateExtensible(JSON.stringify(valid));
  assert.equal(parsed.summary, "Test cleaning review");
  assert.equal(parsed.structuredPayload.repeatIssue, false);
});

test("does not let the browser choose trusted routing fields", () => {
  assert.throws(
    () => parseAndValidateExtensible(JSON.stringify({ ...valid, site: "Colonel Belcher" })),
    /Unknown field: site/
  );
  assert.throws(
    () => parseAndValidateExtensible(JSON.stringify({ ...valid, programKey: "safety-report" })),
    /Unknown field: programKey/
  );
});

test("rejects unsafe or excessive structured payloads", () => {
  assert.throws(
    () => parseAndValidateExtensible(JSON.stringify({ ...valid, structuredPayload: { "bad key": "x" } })),
    /invalid field name/
  );
  assert.throws(
    () => parseAndValidateExtensible(JSON.stringify({ ...valid, structuredPayload: { a: { b: { c: { d: { e: "too deep" } } } } } })),
    /deeply nested/
  );
});

test("derives a stable opaque Dataverse record GUID", () => {
  const id = dataverseRecordId("submission-1");
  assert.equal(id, dataverseRecordId("submission-1"));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(id, dataverseRecordId("submission-2"));
});
