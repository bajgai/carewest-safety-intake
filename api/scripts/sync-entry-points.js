import { readFile } from "node:fs/promises";
import { createStorage } from "../src/storage.js";
import { toEntryPointEntity } from "../src/entrypoints.js";

const source = process.argv[2];
if (!source) throw new Error("Usage: npm run sync:entry-points -- <entry-points.json>");
const parsed = JSON.parse(await readFile(source, "utf8"));
if (!Array.isArray(parsed)) throw new Error("Entry-point file must contain a JSON array");

const storage = createStorage();
await storage.configTable.createTable().catch((error) => {
  if (error.statusCode !== 409) throw error;
});
for (const item of parsed) await storage.configTable.upsertEntity(toEntryPointEntity(item), "Replace");
console.log(`Synchronized ${parsed.length} entry point(s) to ${process.env.CAREWEST_CONFIG_TABLE_NAME || "CarewestIntakeConfig"}`);
