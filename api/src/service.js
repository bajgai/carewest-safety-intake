import { IntakeError, makeReportId, parseAndValidate, payloadHash, submissionKey } from "./intake.js";
import { EntryPointError, publicEntryPoint, resolveEntryPoint } from "./entrypoints.js";
import { dataverseRecordId, makeIntakeReportId, parseAndValidateExtensible } from "./extensible-intake.js";

function json(status, body) {
  return { status, jsonBody: body, headers: { "Cache-Control": "no-store" } };
}

export function createHandlers({
  storage,
  ensureStorage,
  fetchImpl = fetch,
  now = () => new Date(),
  getDataverseClient,
  isExtensibleEnabled = () => String(process.env.CAREWEST_EXTENSIBLE_INTAKE_ENABLED || "").toLowerCase() === "true"
}) {
  async function enqueueDelivery(work, context) {
    await storage.queue.sendMessage(JSON.stringify(work));
    try {
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Queued"
      }, "Merge");
    } catch (error) {
      context.error(`report queue status update failed reportId=${work.reportId} code=${error.code || error.name || "unknown"}`);
    }
  }

  async function enqueueDataverse(work, context) {
    if (!storage.dataverseQueue) throw new Error("Dataverse delivery queue is unavailable");
    await storage.dataverseQueue.sendMessage(JSON.stringify(work));
    try {
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Queued"
      }, "Merge");
    } catch (error) {
      context.error(`dataverse queue status update failed reportId=${work.reportId} code=${error.code || error.name || "unknown"}`);
    }
  }

  async function deleteOutboxRow(partitionKey, rowKey, context) {
    try {
      await storage.table.deleteEntity(partitionKey, rowKey);
    } catch (error) {
      context.error(`report rollback failed code=${error.code || error.name || "unknown"}`);
    }
  }

  async function report(request, context) {
    try {
      const payload = parseAndValidate(await request.text());
      const rowKey = submissionKey(payload.submissionId);
      await ensureStorage(storage);
      try {
        const reportId = makeReportId(now());
        const work = { partitionKey: "submission", rowKey, reportId };
        await storage.table.createEntity({
          partitionKey: "submission", rowKey, reportId, submissionId: payload.submissionId,
          payload: JSON.stringify(payload), payloadHash: payloadHash(payload),
          receivedAt: now().toISOString(), deliveryStatus: "Received", attemptCount: 0
        });
        try {
          await enqueueDelivery(work, context);
        } catch (error) {
          await deleteOutboxRow("submission", rowKey, context);
          throw error;
        }
        context.log(`report queued reportId=${reportId}`);
        return json(202, { reportId, status: "received" });
      } catch (error) {
        if (error.statusCode !== 409) throw error;
        const existing = await storage.table.getEntity("submission", rowKey);
        if (existing.deliveryStatus === "Received" || existing.deliveryStatus === "EnqueueFailed") {
          await enqueueDelivery({ partitionKey: "submission", rowKey, reportId: existing.reportId }, context);
        }
        return json(200, { reportId: existing.reportId, status: "received", duplicate: true });
      }
    } catch (error) {
      if (error instanceof IntakeError) {
        if (error.status === 202) return json(202, { status: "received" });
        return json(error.status, { status: "rejected", error: error.message });
      }
      context.error(`report intake failed code=${error.code || error.name || "unknown"}`);
      return json(503, { status: "unavailable", error: "Use the Microsoft Forms fallback" });
    }
  }

  async function entryPoint(request, context) {
    if (!isExtensibleEnabled()) return json(404, { status: "not_found" });
    try {
      await ensureStorage(storage, { extensible: true });
      const resolved = await resolveEntryPoint(storage, request.params?.entryKey, now());
      return json(200, { status: "ok", entryPoint: publicEntryPoint(resolved) });
    } catch (error) {
      if (error instanceof EntryPointError) return json(error.status, { status: "not_found" });
      context.error(`entry point resolution failed code=${error.code || error.name || "unknown"}`);
      return json(503, { status: "unavailable" });
    }
  }

  async function intake(request, context) {
    if (!isExtensibleEnabled()) return json(404, { status: "not_found" });
    try {
      const parsed = parseAndValidateExtensible(await request.text());
      const { honeypot: _honeypot, ...payload } = parsed;
      await ensureStorage(storage, { extensible: true });
      const resolved = await resolveEntryPoint(storage, request.params?.entryKey, now());
      const reportType = payload.structuredPayload?.reportType;
      if (typeof reportType !== "string" || !resolved.allowedReportTypes.includes(reportType)) {
        throw new IntakeError("Report type is not allowed for this entry point");
      }
      const rowKey = submissionKey(payload.submissionId);
      const partitionKey = "intake-submission";
      const requestHash = payloadHash({ entryKey: resolved.entryKey, payload });
      try {
        const reportId = makeIntakeReportId(now());
        const receivedAt = now().toISOString();
        const canonical = { ...payload, reportId, receivedAt, entryPoint: resolved };
        const work = { partitionKey, rowKey, reportId };
        await storage.table.createEntity({
          partitionKey, rowKey, reportId, submissionId: payload.submissionId,
          entryKey: resolved.entryKey, siteCode: resolved.site.code, programKey: resolved.program.key,
          payload: JSON.stringify(canonical), payloadHash: requestHash,
          receivedAt, deliveryStatus: "Received", attemptCount: 0
        });
        try {
          await enqueueDataverse(work, context);
        } catch (error) {
          await deleteOutboxRow(partitionKey, rowKey, context);
          throw error;
        }
        context.log(`intake queued reportId=${reportId}`);
        return json(202, { reportId, status: "received" });
      } catch (error) {
        if (error.statusCode !== 409) throw error;
        const existing = await storage.table.getEntity(partitionKey, rowKey);
        if (existing.payloadHash !== requestHash) {
          return json(409, { status: "rejected", error: "Submission ID was already used for different content" });
        }
        if (existing.deliveryStatus === "Received" || existing.deliveryStatus === "EnqueueFailed") {
          await enqueueDataverse({ partitionKey, rowKey, reportId: existing.reportId }, context);
        }
        return json(200, { reportId: existing.reportId, status: "received", duplicate: true });
      }
    } catch (error) {
      if (error instanceof IntakeError) {
        if (error.status === 202) return json(202, { status: "received" });
        return json(error.status, { status: "rejected", error: error.message });
      }
      if (error instanceof EntryPointError) return json(error.status, { status: "not_found" });
      context.error(`extensible intake failed code=${error.code || error.name || "unknown"}`);
      return json(503, { status: "unavailable", error: "Use the published fallback" });
    }
  }

  async function deliver(message, context) {
    const work = typeof message === "string" ? JSON.parse(message) : message;
    const entity = await storage.table.getEntity(work.partitionKey, work.rowKey);
    if (entity.deliveryStatus === "Delivered") return;
    const url = process.env.POWER_AUTOMATE_URL;
    const intakeKey = process.env.POWER_AUTOMATE_INTAKE_KEY;
    if (!url || !intakeKey) throw new Error("Downstream delivery settings are missing");
    const payload = JSON.parse(entity.payload);
    payload.intakeKey = intakeKey;
    payload.reportId = entity.reportId;
    await storage.table.updateEntity({
      partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Delivering",
      attemptCount: Number(entity.attemptCount || 0) + 1, lastAttemptAt: now().toISOString()
    }, "Merge");
    try {
      const response = await fetchImpl(url, {
        method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = new Error(`Downstream HTTP ${response.status}`);
        error.deliveryCode = `downstream_http_${response.status}`;
        throw error;
      }
      let result;
      try {
        result = await response.json();
      } catch {
        const error = new Error("Downstream response was not JSON");
        error.deliveryCode = "downstream_invalid_response";
        throw error;
      }
      if (result?.status !== "received") {
        const error = new Error("Downstream did not confirm receipt");
        error.deliveryCode = `downstream_status_${String(result?.status || "missing").toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
        throw error;
      }
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Delivered",
        deliveredAt: now().toISOString(), downstreamReportId: result.reportId || entity.reportId,
        lastErrorCode: ""
      }, "Merge");
      context.log(`report delivered reportId=${entity.reportId}`);
    } catch (error) {
      const deliveryCode = error.deliveryCode || "downstream_request_failed";
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "PendingRetry",
        lastErrorCode: deliveryCode
      }, "Merge");
      context.error(`report delivery failed reportId=${entity.reportId} code=${deliveryCode}`);
      throw error;
    }
  }

  async function deliverDataverse(message, context) {
    if (!isExtensibleEnabled()) throw new Error("Extensible intake is disabled");
    const work = typeof message === "string" ? JSON.parse(message) : message;
    const entity = await storage.table.getEntity(work.partitionKey, work.rowKey);
    if (entity.deliveryStatus === "Delivered") return;
    await storage.table.updateEntity({
      partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Delivering",
      attemptCount: Number(entity.attemptCount || 0) + 1, lastAttemptAt: now().toISOString()
    }, "Merge");
    try {
      if (!getDataverseClient) throw new Error("Dataverse client is not configured");
      const submission = JSON.parse(entity.payload);
      const recordId = dataverseRecordId(submission.submissionId);
      const result = await getDataverseClient().upsertSubmission({ recordId, submission });
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Delivered",
        deliveredAt: now().toISOString(), dataverseRecordId: result.recordId,
        dataverseEntityUrl: result.entityUrl || "", lastErrorCode: ""
      }, "Merge");
      context.log(`dataverse delivered reportId=${entity.reportId}`);
    } catch (error) {
      const deliveryCode = error.deliveryCode || "dataverse_request_failed";
      await storage.table.updateEntity({
        partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "PendingRetry",
        lastErrorCode: deliveryCode
      }, "Merge");
      context.error(`dataverse delivery failed reportId=${entity.reportId} code=${deliveryCode}`);
      throw error;
    }
  }

  async function health(_request, context) {
    try {
      await ensureStorage(storage);
      return json(200, { status: "ok", storage: "reachable" });
    } catch (error) {
      context.error(`health failed code=${error.code || error.name || "unknown"}`);
      return json(503, { status: "unavailable" });
    }
  }
  return { report, deliver, health, entryPoint, intake, deliverDataverse };
}
