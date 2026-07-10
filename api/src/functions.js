import { app } from "@azure/functions";
import { createStorage, ensureStorage } from "./storage.js";
import { createHandlers } from "./service.js";

const storage = createStorage();
const handlers = createHandlers({ storage, ensureStorage });

app.http("report", {
  methods: ["POST"], authLevel: "anonymous", route: "report", handler: handlers.report
});
app.http("health", {
  methods: ["GET"], authLevel: "anonymous", route: "health", handler: handlers.health
});
app.storageQueue("deliverReport", {
  queueName: process.env.CAREWEST_QUEUE_NAME || "safety-intake-delivery",
  connection: "CarewestStorage",
  handler: handlers.deliver
});
