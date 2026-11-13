import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })
  : null;

export function requireDatabase() {
  if (!pool) {
    const error = new Error("Account and record storage is not configured. Set DATABASE_URL.");
    error.status = 503;
    throw error;
  }
  return pool;
}

export async function initializeDatabase() {
  if (!pool) return;
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}
