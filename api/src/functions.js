import { app } from "@azure/functions";
import { createStorage, ensureStorage } from "./storage.js";
import { createHandlers } from "./service.js";
import { createDataverseClient } from "./dataverse.js";

const storage = createStorage();
const handlers = createHandlers({ storage, ensureStorage, getDataverseClient: () => createDataverseClient() });

app.http("report", {
  methods: ["POST"], authLevel: "anonymous", route: "report", handler: handlers.report
});
app.http("health", {
  methods: ["GET"], authLevel: "anonymous", route: "health", handler: handlers.health
});
app.http("entryPoint", {
  methods: ["GET"], authLevel: "anonymous", route: "entry-points/{entryKey}", handler: handlers.entryPoint
});
app.http("intake", {
  methods: ["POST"], authLevel: "anonymous", route: "intake/{entryKey}", handler: handlers.intake
});
app.storageQueue("deliverReport", {
  queueName: process.env.CAREWEST_QUEUE_NAME || "safety-intake-delivery",
  connection: "CarewestStorage",
  handler: handlers.deliver
});
app.storageQueue("deliverDataverse", {
  queueName: process.env.CAREWEST_DATAVERSE_QUEUE_NAME || "carewest-dataverse-delivery",
  connection: "CarewestStorage",
  handler: handlers.deliverDataverse
});
