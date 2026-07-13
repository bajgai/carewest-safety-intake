import test from "node:test";
import assert from "node:assert/strict";
import { EntryPointError, publicEntryPoint, resolveEntryPoint, toEntryPointEntity } from "../src/entrypoints.js";

const active = toEntryPointEntity({
  entryKey: "test-main-cleaning",
  displayName: "Test Main Cleaning Review",
  siteCode: "test-main",
  siteName: "Test Main Hospital",
  programKey: "cleaning-review",
  programName: "Cleaning Review",
  templateVersion: "1",
  active: true,
  effectiveFrom: "2026-01-01T00:00:00Z",
  effectiveTo: "2027-01-01T00:00:00Z",
  allowedReportTypes: ["Cleaning Quality Concern"],
  siteDataverseId: "11111111-1111-4111-8111-111111111111",
  programDataverseId: "22222222-2222-4222-8222-222222222222",
  entryPointDataverseId: "33333333-3333-4333-8333-333333333333"
});

function storage(entity = active) {
  return { configTable: { async getEntity() { return entity; } } };
}

test("resolves an active entry point and keeps Dataverse IDs private", async () => {
  const resolved = await resolveEntryPoint(storage(), "TEST-MAIN-CLEANING", new Date("2026-07-13T12:00:00Z"));
  assert.equal(resolved.entryKey, "test-main-cleaning");
  assert.equal(resolved.site.dataverseId, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(resolved.allowedReportTypes, ["Cleaning Quality Concern"]);
  assert.deepEqual(publicEntryPoint(resolved).site, { code: "test-main", name: "Test Main Hospital" });
  assert.equal("dataverseId" in publicEntryPoint(resolved).site, false);
});

test("hides inactive and expired entry points", async () => {
  await assert.rejects(
    resolveEntryPoint(storage({ ...active, active: false }), active.rowKey, new Date("2026-07-13T12:00:00Z")),
    EntryPointError
  );
  await assert.rejects(
    resolveEntryPoint(storage(active), active.rowKey, new Date("2027-02-01T12:00:00Z")),
    EntryPointError
  );
});

test("rejects unsafe entry keys and invalid configuration IDs", () => {
  assert.throws(() => toEntryPointEntity({ ...active, entryKey: "../admin" }), EntryPointError);
  assert.throws(
    () => toEntryPointEntity({ ...active, entryKey: active.rowKey, siteDataverseId: "not-a-guid" }),
    /must be a GUID/
  );
});
