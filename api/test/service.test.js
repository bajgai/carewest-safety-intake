import test from "node:test";
import assert from "node:assert/strict";
import { createHandlers } from "../src/service.js";
import { submissionKey } from "../src/intake.js";

function fixture({ sendMessage, updateEntity } = {}) {
  const entities = new Map();
  const messages = [];
  const dataverseMessages = [];
  const configEntities = new Map();
  const storage = {
    table: {
      async createEntity(e) { const k=`${e.partitionKey}/${e.rowKey}`; if(entities.has(k)){const x=new Error("exists");x.statusCode=409;throw x;} entities.set(k,{...e}); },
      async getEntity(p,r) { return entities.get(`${p}/${r}`); },
      async updateEntity(e) { if (updateEntity) return updateEntity(e, entities); Object.assign(entities.get(`${e.partitionKey}/${e.rowKey}`),e); },
      async deleteEntity(p,r) { entities.delete(`${p}/${r}`); }
    },
    queue: { async sendMessage(m) { if (sendMessage) return sendMessage(m, messages); messages.push(m); } },
    dataverseQueue: { async sendMessage(m) { dataverseMessages.push(m); } },
    configTable: {
      async getEntity(p, r) {
        const entity = configEntities.get(`${p}/${r}`);
        if (!entity) { const error = new Error("not found"); error.statusCode = 404; throw error; }
        return entity;
      }
    }
  };
  return { storage, entities, messages, dataverseMessages, configEntities };
}
const payload = { reportType:"Hazard",site:"Colonel Belcher",reporterName:"",location:"TEST",description:"TEST",urgency:"Low",areaSafeNow:"Yes - I made it safe",evidenceAvailable:"No",injuryFlag:"No",helpNeeded:"",hazardCategory:"Housekeeping",incidentDateTime:"",incidentType:"",bodyPart:"",side:"",witnessPresent:"",witnessName:"",witnessContact:"",productName:"",issueType:"",concernType:"",repeatIssue:"",feedbackSuggestion:"",honeypot:"",submissionId:"same-id" };
const request = () => ({ text: async () => JSON.stringify(payload) });
const context = { log() {}, error() {} };

test("persists before queueing and deduplicates", async () => {
  const f=fixture(); const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},now:()=>new Date("2026-07-10T12:34:00Z")});
  const first=await h.report(request(),context); const second=await h.report(request(),context);
  assert.equal(first.status,202); assert.equal(second.status,200); assert.equal(first.jsonBody.reportId,second.jsonBody.reportId);
  assert.equal(f.entities.size,1); assert.equal(f.messages.length,1);
});

test("worker delivers once and records downstream reference", async () => {
  process.env.POWER_AUTOMATE_URL="https://example.invalid/flow"; process.env.POWER_AUTOMATE_INTAKE_KEY="secret";
  const f=fixture(); const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},fetchImpl:async()=>({ok:true,json:async()=>({status:"received",reportId:"HZ-DOWNSTREAM"})})});
  const accepted=await h.report(request(),context); await h.deliver(f.messages[0],context); await h.deliver(f.messages[0],context);
  const entity=[...f.entities.values()][0]; assert.equal(entity.deliveryStatus,"Delivered"); assert.equal(entity.downstreamReportId,"HZ-DOWNSTREAM"); assert.equal(accepted.status,202);
});

test("rolls back the outbox row when queueing fails", async () => {
  const f=fixture({sendMessage:async()=>{ throw new Error("queue unavailable"); }});
  const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},now:()=>new Date("2026-07-10T12:34:00Z")});
  const accepted=await h.report(request(),context);
  assert.equal(accepted.status,503);
  assert.equal(f.entities.size,0);
});

test("duplicate retry requeues an existing received row", async () => {
  const f=fixture(); const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},now:()=>new Date("2026-07-10T12:34:00Z")});
  const rowKey=submissionKey(payload.submissionId);
  await f.storage.table.createEntity({
    partitionKey:"submission",rowKey,reportId:"HZ-EXISTING",submissionId:payload.submissionId,
    payload:JSON.stringify(payload),payloadHash:"hash",receivedAt:"2026-07-10T12:34:00.000Z",deliveryStatus:"Received",attemptCount:0
  });
  const duplicate=await h.report(request(),context);
  assert.equal(duplicate.status,200);
  assert.equal(duplicate.jsonBody.reportId,"HZ-EXISTING");
  assert.equal(duplicate.jsonBody.duplicate,true);
  assert.equal(f.messages.length,1);
  assert.deepEqual(JSON.parse(f.messages[0]),{partitionKey:"submission",rowKey,reportId:"HZ-EXISTING"});
  assert.equal([...f.entities.values()][0].deliveryStatus,"Queued");
});

test("accepts once queued even if status update fails", async () => {
  const f=fixture({updateEntity:async()=>{ throw new Error("table unavailable"); }});
  const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},now:()=>new Date("2026-07-10T12:34:00Z")});
  const accepted=await h.report(request(),context);
  assert.equal(accepted.status,202);
  assert.equal(f.messages.length,1);
});

test("worker records retry state when downstream does not confirm receipt", async () => {
  process.env.POWER_AUTOMATE_URL="https://example.invalid/flow"; process.env.POWER_AUTOMATE_INTAKE_KEY="secret";
  const f=fixture(); const errors=[];
  const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},fetchImpl:async()=>({ok:true,json:async()=>({status:"pending"})})});
  await h.report(request(),context);
  await assert.rejects(h.deliver(f.messages[0],{log(){},error(message){errors.push(message);}}),/did not confirm/);
  const entity=[...f.entities.values()][0];
  assert.equal(entity.deliveryStatus,"PendingRetry");
  assert.equal(entity.lastErrorCode,"downstream_status_pending");
  assert.match(errors[0],/code=downstream_status_pending/);
});

const extensiblePayload = {
  submissionId: "extensible-id",
  reporterName: "Test Person",
  location: "Test corridor",
  summary: "Synthetic cleaning review",
  description: "Synthetic test only",
  priority: "Low",
  structuredPayload: { reportType: "Cleaning Quality Concern", rating: 4 },
  honeypot: ""
};

function addEntryPoint(f) {
  f.configEntities.set("qr-entry/test-cleaning", {
    partitionKey: "qr-entry", rowKey: "test-cleaning", active: true,
    displayName: "Test Cleaning Review", siteCode: "test-main", siteName: "Test Main",
    programKey: "cleaning-review", programName: "Cleaning Review", templateVersion: "1",
    defaultLocation: "Test corridor", allowedReportTypesJson: '["Cleaning Quality Concern"]',
    siteDataverseId: "11111111-1111-4111-8111-111111111111",
    programDataverseId: "22222222-2222-4222-8222-222222222222",
    entryPointDataverseId: "33333333-3333-4333-8333-333333333333"
  });
}

test("resolves a public entry point without exposing Dataverse IDs", async () => {
  const f = fixture(); addEntryPoint(f);
  const h = createHandlers({ storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => true });
  const response = await h.entryPoint({ params: { entryKey: "test-cleaning" } }, context);
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.entryPoint.program.key, "cleaning-review");
  assert.equal("dataverseId" in response.jsonBody.entryPoint.site, false);
});

test("accepts and deduplicates an extensible intake without touching the safety queue", async () => {
  const f = fixture(); addEntryPoint(f);
  const h = createHandlers({
    storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => true,
    now: () => new Date("2026-07-13T12:34:00Z")
  });
  const req = { params: { entryKey: "test-cleaning" }, text: async () => JSON.stringify(extensiblePayload) };
  const first = await h.intake(req, context);
  const second = await h.intake(req, context);
  assert.equal(first.status, 202);
  assert.equal(second.status, 200);
  assert.equal(first.jsonBody.reportId, second.jsonBody.reportId);
  assert.match(first.jsonBody.reportId, /^CW-/);
  assert.equal(f.messages.length, 0);
  assert.equal(f.dataverseMessages.length, 1);
});

test("rejects a submission ID reused for different content", async () => {
  const f = fixture(); addEntryPoint(f);
  const h = createHandlers({ storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => true });
  const req = (description) => ({
    params: { entryKey: "test-cleaning" },
    text: async () => JSON.stringify({ ...extensiblePayload, description })
  });
  assert.equal((await h.intake(req("First"), context)).status, 202);
  assert.equal((await h.intake(req("Different"), context)).status, 409);
});

test("rejects a report type outside the entry point allowlist", async () => {
  const f = fixture(); addEntryPoint(f);
  const h = createHandlers({ storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => true });
  const req = {
    params: { entryKey: "test-cleaning" },
    text: async () => JSON.stringify({ ...extensiblePayload, structuredPayload: { reportType: "Incident" } })
  };
  const response = await h.intake(req, context);
  assert.equal(response.status, 400);
  assert.match(response.jsonBody.error, /not allowed/);
  assert.equal(f.dataverseMessages.length, 0);
});

test("delivers an extensible submission once and records the Dataverse ID", async () => {
  const f = fixture(); addEntryPoint(f); const delivered = [];
  const h = createHandlers({
    storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => true,
    getDataverseClient: () => ({ async upsertSubmission(value) { delivered.push(value); return { recordId: value.recordId, entityUrl: "https://example/entity" }; } })
  });
  const req = { params: { entryKey: "test-cleaning" }, text: async () => JSON.stringify(extensiblePayload) };
  await h.intake(req, context);
  await h.deliverDataverse(f.dataverseMessages[0], context);
  await h.deliverDataverse(f.dataverseMessages[0], context);
  const entity = [...f.entities.values()][0];
  assert.equal(delivered.length, 1);
  assert.equal(entity.deliveryStatus, "Delivered");
  assert.equal(entity.dataverseRecordId, delivered[0].recordId);
});

test("keeps extensible routes hidden while the feature flag is off", async () => {
  const f = fixture();
  const h = createHandlers({ storage: f.storage, ensureStorage: async () => {}, isExtensibleEnabled: () => false });
  const response = await h.entryPoint({ params: { entryKey: "test-cleaning" } }, context);
  assert.equal(response.status, 404);
});
