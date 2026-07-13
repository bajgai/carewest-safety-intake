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

const validIncident = {
  ...valid, reportType: "Incident", hazardCategory: "", incidentDateTime: "2026-07-10T12:00",
  incidentType: "Accident", witnessPresent: "No"
};
const validChemical = {
  ...valid, reportType: "Chemical/Product Issue", hazardCategory: "", injuryFlag: "", issueType: "Leak / spill"
};
const validCleaning = {
  ...valid, reportType: "Cleaning Quality Concern", hazardCategory: "", injuryFlag: "",
  concernType: "Floors / spills", repeatIssue: "No"
};
const validMaintenance = { ...valid, reportType: "Maintenance", hazardCategory: "", injuryFlag: "" };

test("accepts a canonical hazard payload", () => {
  assert.equal(parseAndValidate(JSON.stringify(valid)).site, "Colonel Belcher");
});
test("rejects missing report-type specific required fields", () => {
  const cases = [
    ["hazard category", { ...valid, hazardCategory: "" }],
    ["hazard injury flag", { ...valid, injuryFlag: "" }],
    ["hazard area safety", { ...valid, areaSafeNow: "" }],
    ["incident date/time", { ...validIncident, incidentDateTime: "" }],
    ["incident type", { ...validIncident, incidentType: "" }],
    ["incident witnesses", { ...validIncident, witnessPresent: "" }],
    ["chemical issue type", { ...validChemical, issueType: "" }],
    ["cleaning concern type", { ...validCleaning, concernType: "" }],
    ["cleaning repeat issue", { ...validCleaning, repeatIssue: "" }],
    ["non-feedback evidence", { ...validMaintenance, evidenceAvailable: "" }]
  ];
  for (const [name, payload] of cases) {
    assert.throws(() => parseAndValidate(JSON.stringify(payload)), /required/, name);
  }
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
