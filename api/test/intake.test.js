import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidate, submissionKey } from "../src/intake.js";

const valid = {
  reportType: "Hazard", site: "Colonel Belcher", reporterName: "Test Person",
  location: "TEST hallway", description: "TEST only", urgency: "Low",
  areaSafeNow: "Yes - I made it safe", evidenceAvailable: "No", injuryFlag: "No",
  helpNeeded: "", hazardCategory: "Housekeeping", incidentDateTime: "", incidentType: "",
  bodyPart: "", side: "", witnessPresent: "", witnessName: "", witnessContact: "",
  productName: "", issueType: "", concernType: "", repeatIssue: "", feedbackSuggestion: "",
  honeypot: "", submissionId: "test-submission-1"
};

test("accepts a canonical hazard payload", () => {
  assert.equal(parseAndValidate(JSON.stringify(valid)).site, "Colonel Belcher");
});
test("rejects unknown fields", () => {
  assert.throws(() => parseAndValidate(JSON.stringify({ ...valid, admin: "true" })), /Unknown field/);
});
test("rejects contract drift", () => {
  assert.throws(() => parseAndValidate(JSON.stringify({ ...valid, site: "Signal Pointe" })), /Invalid site/);
});
test("submission keys are stable and opaque", () => {
  assert.equal(submissionKey("abc"), submissionKey("abc"));
  assert.equal(submissionKey("abc").length, 64);
});
