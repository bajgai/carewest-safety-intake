import { IntakeError, makeReportId, parseAndValidate, payloadHash, submissionKey } from "./intake.js";

function json(status, body) {
  return { status, jsonBody: body, headers: { "Cache-Control": "no-store" } };
}

export function createHandlers({ storage, ensureStorage, fetchImpl = fetch, now = () => new Date() }) {
  async function report(request, context) {
    try {
      const payload = parseAndValidate(await request.text());
      const rowKey = submissionKey(payload.submissionId);
      await ensureStorage(storage);
      try {
        const reportId = makeReportId(now());
        await storage.table.createEntity({
          partitionKey: "submission", rowKey, reportId, submissionId: payload.submissionId,
          payload: JSON.stringify(payload), payloadHash: payloadHash(payload),
          receivedAt: now().toISOString(), deliveryStatus: "Received", attemptCount: 0
        });
        await storage.queue.sendMessage(Buffer.from(JSON.stringify({ partitionKey: "submission", rowKey, reportId })).toString("base64"));
        await storage.table.updateEntity({ partitionKey: "submission", rowKey, deliveryStatus: "Queued" }, "Merge");
        context.log(`report queued reportId=${reportId}`);
        return json(202, { reportId, status: "received" });
      } catch (error) {
        if (error.statusCode !== 409) throw error;
        const existing = await storage.table.getEntity("submission", rowKey);
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
    const response = await fetchImpl(url, {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Downstream HTTP ${response.status}`);
    const result = await response.json();
    await storage.table.updateEntity({
      partitionKey: work.partitionKey, rowKey: work.rowKey, deliveryStatus: "Delivered",
      deliveredAt: now().toISOString(), downstreamReportId: result.reportId || entity.reportId,
      lastErrorCode: ""
    }, "Merge");
    context.log(`report delivered reportId=${entity.reportId}`);
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
  return { report, deliver, health };
}
