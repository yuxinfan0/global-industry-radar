import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!postgresUrl) {
  console.error("Missing POSTGRES_URL or DATABASE_URL.");
  process.exit(1);
}

const sql = neon(postgresUrl);
const schemaPath = join(process.cwd(), "database", "schema.sql");
const schema = await readFile(schemaPath, "utf8");

const statements = schema
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Applied ${statements.length} database statements.`);
