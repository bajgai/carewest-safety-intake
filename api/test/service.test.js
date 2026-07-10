import test from "node:test";
import assert from "node:assert/strict";
import { createHandlers } from "../src/service.js";

function fixture() {
  const entities = new Map();
  const messages = [];
  const storage = {
    table: {
      async createEntity(e) { const k=`${e.partitionKey}/${e.rowKey}`; if(entities.has(k)){const x=new Error("exists");x.statusCode=409;throw x;} entities.set(k,{...e}); },
      async getEntity(p,r) { return entities.get(`${p}/${r}`); },
      async updateEntity(e) { Object.assign(entities.get(`${e.partitionKey}/${e.rowKey}`),e); }
    },
    queue: { async sendMessage(m) { messages.push(JSON.parse(Buffer.from(m,"base64").toString())); } }
  };
  return { storage, entities, messages };
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
  const f=fixture(); const h=createHandlers({storage:f.storage,ensureStorage:async()=>{},fetchImpl:async()=>({ok:true,json:async()=>({reportId:"HZ-DOWNSTREAM"})})});
  const accepted=await h.report(request(),context); await h.deliver(f.messages[0],context); await h.deliver(f.messages[0],context);
  const entity=[...f.entities.values()][0]; assert.equal(entity.deliveryStatus,"Delivered"); assert.equal(entity.downstreamReportId,"HZ-DOWNSTREAM"); assert.equal(accepted.status,202);
});
