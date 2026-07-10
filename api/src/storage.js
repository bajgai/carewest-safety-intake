import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";

function credential() {
  return process.env.AZURE_CLIENT_ID
    ? new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID })
    : new DefaultAzureCredential();
}

export function createStorage() {
  const account = process.env.CAREWEST_STORAGE_ACCOUNT;
  if (!account) throw new Error("CAREWEST_STORAGE_ACCOUNT is required");
  const tableName = process.env.CAREWEST_TABLE_NAME || "SafetyIntakeOutbox";
  const queueName = process.env.CAREWEST_QUEUE_NAME || "safety-intake-delivery";
  const cred = credential();
  return {
    table: new TableClient(`https://${account}.table.core.windows.net`, tableName, cred),
    queue: new QueueClient(`https://${account}.queue.core.windows.net/${queueName}`, cred)
  };
}

export async function ensureStorage(storage) {
  await storage.table.createTable().catch((error) => {
    if (error.statusCode !== 409) throw error;
  });
  await storage.queue.createIfNotExists();
}
