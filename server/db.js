import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function postgresPool() {
  if (!process.env.DATABASE_URL) return null;
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
}

function adaptSqlite(sql, params = []) {
  const ordered = [];
  const text = sql
    .replace(/::(jsonb|int|bigint|text)/gi, "")
    .replace(/\s+for update\b/gi, "")
    .replace(/\$(\d+)/g, (_, index) => {
      ordered.push(params[Number(index) - 1]);
      return "?";
    })
    .replace(/\bnow\(\)/gi, `'${new Date().toISOString()}'`);
  const bound = ordered.map((value) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && typeof value === "object" && !Buffer.isBuffer(value)) return JSON.stringify(value);
    return value ?? null;
  });
  return { text, bound };
}

function reviveRow(row) {
  if (!row || typeof row.result !== "string") return row;
  const trimmed = row.result.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return row;
  try {
    return { ...row, result: JSON.parse(row.result) };
  } catch {
    return row;
  }
}

function openLocalDatabase() {
  const { DatabaseSync } = requireLocalSqlite();
  const file = resolve(process.env.VEKAI_LOCAL_DB || resolve(root, "data/vekai.sqlite"));
  mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec("pragma foreign_keys = on");
  const schema = readFileSync(new URL("../db/schema.sqlite.sql", import.meta.url), "utf8");
  database.exec(schema);

  async function query(sql, params = []) {
    const { text, bound } = adaptSqlite(sql, params);
    try {
      const statement = database.prepare(text);
      const isRead = /^\s*(select|with)\b/i.test(text) || /\breturning\b/i.test(text);
      const rows = isRead ? statement.all(...bound).map(reviveRow) : (statement.run(...bound), []);
      return { rows };
    } catch (error) {
      if (String(error.code || "").includes("SQLITE_CONSTRAINT") || /UNIQUE/i.test(error.message)) {
        error.code = "23505";
      }
      throw error;
    }
  }

  return {
    kind: "sqlite",
    async query(sql, params) {
      return query(sql, params);
    },
    async connect() {
      return {
        async query(sql, params) {
          return query(sql, params);
        },
        release() {},
      };
    },
    async end() {
      database.close();
    },
  };
}

function requireLocalSqlite() {
  try {
    return process.getBuiltinModule("node:sqlite");
  } catch (error) {
    error.status = 503;
    throw error;
  }
}

const postgres = postgresPool();
export const pool = postgres || (process.env.NODE_ENV === "production" ? null : openLocalDatabase());

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
  if (pool.kind === "sqlite") return;
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}
